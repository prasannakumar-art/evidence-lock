import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { computeFileSha256 } from './crypto.js';

export const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
export const EVIDENCE_DIR = path.join(STORAGE_DIR, 'evidence');
export const STAGING_DIR = path.join(STORAGE_DIR, 'staging');
export const HASHES_DIR = path.join(STORAGE_DIR, 'hashes');

export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

// Explicitly permitted MIME types & extensions for digital forensics
export const PERMITTED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.tiff', '.bmp',
  '.txt', '.csv', '.json', '.xml', '.log',
  '.mp4', '.mov', '.avi', '.mkv', '.mp3', '.wav',
  '.zip', '.tar', '.gz', '.7z',
  '.dd', '.raw', '.e01', '.iso', '.pcap', '.pcapng', '.bin', '.dat'
]);

export function ensureStorageDirectories(): void {
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(STAGING_DIR)) fs.mkdirSync(STAGING_DIR, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(HASHES_DIR)) fs.mkdirSync(HASHES_DIR, { recursive: true, mode: 0o700 });
}

/**
 * Sanitizes original filename: strips path traversal sequences, replaces suspicious chars.
 */
export function sanitizeFilename(originalName: string): string {
  if (!originalName || typeof originalName !== 'string') return 'evidence_item.bin';
  // Strip null bytes and directory components
  const baseName = path.basename(originalName).replace(/\0/g, '');
  // Clean special characters but keep extension
  const sanitized = baseName.replace(/[^a-zA-Z0-9._\- ]/g, '_');
  return sanitized.length > 0 ? sanitized : 'evidence_item.bin';
}

/**
 * Checks extension compatibility.
 */
export function isPermittedFileType(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return PERMITTED_EXTENSIONS.has(ext);
}

/**
 * Moves staged file to permanent private evidence store and verifies SHA-256.
 */
export async function commitStagedEvidence(
  stagedPath: string,
  originalFilename: string
): Promise<{
  storageKey: string;
  sha256: string;
  sizeBytes: number;
  finalPath: string;
  hashFilePath: string;
}> {
  ensureStorageDirectories();

  if (!fs.existsSync(stagedPath)) {
    throw new Error('Staged file does not exist or was prematurely removed.');
  }

  const stat = fs.statSync(stagedPath);
  if (stat.size === 0) {
    fs.unlinkSync(stagedPath);
    throw new Error('Empty file: zero bytes received.');
  }

  if (stat.size > MAX_FILE_SIZE_BYTES) {
    fs.unlinkSync(stagedPath);
    throw new Error(`File size ${stat.size} bytes exceeds permitted limit (${MAX_FILE_SIZE_BYTES} bytes).`);
  }

  // Calculate SHA-256 over full chunked bytes
  const sha256 = await computeFileSha256(stagedPath);

  // Generate internal UUID storage key - never trust user filename for disk path
  const storageKey = `ev_${crypto.randomUUID()}${path.extname(originalFilename).toLowerCase()}`;
  const finalPath = path.join(EVIDENCE_DIR, storageKey);

  // Atomically move from staging to private evidence directory
  fs.renameSync(stagedPath, finalPath);
  fs.chmodSync(finalPath, 0o600); // Read/write only by owner process

  // Save the original file's cryptographic hash digest separately in private hash storage
  const hashFilePath = path.join(HASHES_DIR, `${storageKey}.sha256`);
  fs.writeFileSync(hashFilePath, sha256 + '\n', { mode: 0o600 });

  return {
    storageKey,
    sha256,
    sizeBytes: stat.size,
    finalPath,
    hashFilePath,
  };
}

/**
 * Gets absolute filesystem path for an internal storage key, preventing traversal attacks.
 */
export function getSafeEvidencePath(storageKey: string): string {
  const safeName = path.basename(storageKey);
  const resolvedPath = path.resolve(EVIDENCE_DIR, safeName);
  
  if (!resolvedPath.startsWith(EVIDENCE_DIR)) {
    throw new Error('Security violation: Attempted path traversal.');
  }
  return resolvedPath;
}

/**
 * Reads evidence file as readable stream.
 */
export function getEvidenceStream(storageKey: string): fs.ReadStream {
  const safePath = getSafeEvidencePath(storageKey);
  if (!fs.existsSync(safePath)) {
    throw new Error('Evidence file not found in private storage.');
  }
  return fs.createReadStream(safePath);
}

/**
 * Gets the separately stored hash file path.
 */
export function getSafeHashPath(storageKey: string): string {
  const safeName = path.basename(storageKey);
  const resolvedPath = path.resolve(HASHES_DIR, `${safeName}.sha256`);
  if (!resolvedPath.startsWith(HASHES_DIR)) {
    throw new Error('Security violation: Attempted path traversal in hash lookup.');
  }
  return resolvedPath;
}

/**
 * Reads the separately stored SHA-256 digest from private hash storage.
 */
export function getStoredHash(storageKey: string): string | null {
  const hashPath = getSafeHashPath(storageKey);
  if (fs.existsSync(hashPath)) {
    return fs.readFileSync(hashPath, 'utf8').trim();
  }
  return null;
}

/**
 * Performs real file verification against stored bytes in private storage.
 * Evaluates unchanged, modified, missing, and unreadable files.
 */
export async function verifyStoredFile(
  storageKey: string,
  trustedSha256: string
): Promise<{
  status: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  failureType: 'NONE' | 'HASH_MISMATCH' | 'MISSING_FILE' | 'UNREADABLE_FILE';
  calculatedSha256: string | null;
  trustedSha256: string;
  findings: string;
  explanation: string;
}> {
  let filePath: string;
  try {
    filePath = getSafeEvidencePath(storageKey);
  } catch (err: any) {
    return {
      status: 'INCONCLUSIVE',
      failureType: 'UNREADABLE_FILE',
      calculatedSha256: null,
      trustedSha256,
      findings: `Security path validation error: ${err.message}`,
      explanation: 'Storage key failed security validation.',
    };
  }

  // 1. Missing file check
  if (!fs.existsSync(filePath)) {
    return {
      status: 'FAIL',
      failureType: 'MISSING_FILE',
      calculatedSha256: null,
      trustedSha256,
      findings: 'The underlying evidence bitstream file could not be located in private storage. This may indicate unmounted storage or file deletion.',
      explanation: 'Missing evidence represents a severe custody breach. Stored metadata exists, but byte verification cannot execute.',
    };
  }

  // 2. Read bytes and compute SHA-256 (handles unreadable files safely)
  let calculatedSha256: string;
  try {
    calculatedSha256 = await computeFileSha256(filePath);
  } catch (err: any) {
    return {
      status: 'INCONCLUSIVE',
      failureType: 'UNREADABLE_FILE',
      calculatedSha256: null,
      trustedSha256,
      findings: `File could not be read: ${err.message}. I/O access restricted or file permissions prevent byte verification.`,
      explanation: 'The evidence file exists in private storage, but its bytes could not be read due to file system permission restrictions (EACCES) or an I/O device error.',
    };
  }

  // 3. Compare calculated hash to trusted genesis hash
  const matches = (calculatedSha256.toLowerCase() === trustedSha256.toLowerCase());
  return {
    status: matches ? 'PASS' : 'FAIL',
    failureType: matches ? 'NONE' : 'HASH_MISMATCH',
    calculatedSha256,
    trustedSha256,
    findings: matches
      ? 'Current bitstream SHA-256 matches trusted genesis hash bit-for-bit (zero deviations detected).'
      : `HASH MISMATCH: Calculated SHA-256 (${calculatedSha256}) differs from trusted genesis SHA-256 (${trustedSha256}). Stored bytes have changed.`,
    explanation: matches
      ? 'Evidence bitstream integrity is intact. Cryptographic digest confirms no bits have been altered since initial ingestion.'
      : 'A hash mismatch indicates a difference in file content since intake. While this proves the file was modified, it indicates an integrity discrepancy and does not automatically prove malicious intent (e.g. disk corruption, conversion error, or unauthorized edit).',
  };
}

/**
 * Testing & Audit verification helper: Simulates byte-level tampering on a file.
 * This is used to demonstrate that EVIDENCELOCK catches any altered bit.
 */
export function simulateTamperFile(storageKey: string, alteredContent: string = 'MALICIOUS_TAMPERED_BYTE_DATA_'): void {
  const safePath = getSafeEvidencePath(storageKey);
  if (!fs.existsSync(safePath)) {
    throw new Error('Evidence file not found to tamper.');
  }
  // Append or overwrite bytes
  const original = fs.readFileSync(safePath);
  const modified = Buffer.concat([original, Buffer.from(alteredContent)]);
  fs.writeFileSync(safePath, modified);
}

/**
 * Testing & Audit helper: Simulates unreadable file condition (permission restrictions or I/O failure).
 */
export function simulateUnreadableFile(storageKey: string): void {
  const safePath = getSafeEvidencePath(storageKey);
  if (!fs.existsSync(safePath)) {
    throw new Error('Evidence file not found to make unreadable.');
  }
  fs.chmodSync(safePath, 0o000);
  fs.writeFileSync(`${safePath}.unreadable_lock`, 'EACCES_PERMISSION_RESTRICTION');
}

/**
 * Testing & Audit helper: Restores readability of a simulated unreadable file.
 */
export function restoreFileReadability(storageKey: string): void {
  const safePath = getSafeEvidencePath(storageKey);
  if (fs.existsSync(`${safePath}.unreadable_lock`)) {
    try { fs.unlinkSync(`${safePath}.unreadable_lock`); } catch (e) {}
  }
  if (fs.existsSync(safePath)) {
    fs.chmodSync(safePath, 0o600);
  }
}

/**
 * Testing & Audit helper: Deletes evidence file to simulate missing file on storage.
 */
export function deleteStoredFile(storageKey: string): void {
  const safePath = getSafeEvidencePath(storageKey);
  if (fs.existsSync(safePath)) {
    fs.unlinkSync(safePath);
  }
  if (fs.existsSync(`${safePath}.unreadable_lock`)) {
    fs.unlinkSync(`${safePath}.unreadable_lock`);
  }
}

/**
 * Clean up old orphan files in staging older than 1 hour.
 */
export function cleanupStaging(): void {
  try {
    ensureStorageDirectories();
    const files = fs.readdirSync(STAGING_DIR);
    const now = Date.now();
    for (const f of files) {
      const full = path.join(STAGING_DIR, f);
      const stat = fs.statSync(full);
      if (now - stat.mtimeMs > 60 * 60 * 1000) {
        fs.unlinkSync(full);
      }
    }
  } catch (err) {
    // Non-fatal cleanup error
  }
}
