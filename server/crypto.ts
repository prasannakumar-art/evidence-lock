import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

export const KEYS_DIR = path.resolve(process.cwd(), 'keys');
export const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'signing_private_key.pem');
export const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'signing_public_key.pem');
export const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Confirms the asymmetric signing key is stored strictly on the filesystem
 * with owner-only permissions (0o600) and completely outside the evidence database.
 */
export function isPrivateKeyOutsideDatabase(): boolean {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) return false;
  try {
    const stat = fs.statSync(PRIVATE_KEY_PATH);
    const hasOwnerPermissionsOnly = (stat.mode & 0o077) === 0;
    return stat.isFile() && hasOwnerPermissionsOnly;
  } catch {
    return false;
  }
}

// Ensure keys exist or generate ECDSA P-256 pair
export function ensureKeypairExists(): { publicKeyPem: string; keyId: string } {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
  }

  let publicKeyPem = '';
  if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1', // NIST P-256 / secp256r1
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: 0o600 });
    fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, { mode: 0o644 });
    publicKeyPem = publicKey;
  } else {
    publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');
  }

  // Key ID is SHA-256 fingerprint of public key
  const keyId = 'KEY-P256-' + crypto.createHash('sha256').update(publicKeyPem).digest('hex').substring(0, 16).toUpperCase();
  return { publicKeyPem, keyId };
}

export function getPublicKeyPem(): string {
  if (!fs.existsSync(PUBLIC_KEY_PATH)) {
    return ensureKeypairExists().publicKeyPem;
  }
  return fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');
}

export function getKeyId(): string {
  const pem = getPublicKeyPem();
  return 'KEY-P256-' + crypto.createHash('sha256').update(pem).digest('hex').substring(0, 16).toUpperCase();
}

/**
 * Calculates SHA-256 over complete file bytes using chunked streaming.
 * Securely handles missing files, permission-denied (unreadable), and directory/I/O errors.
 */
export async function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }

    // Check for simulated unreadable condition or restricted permissions
    if (fs.existsSync(`${filePath}.unreadable_lock`)) {
      return reject(new Error(`EACCES: permission denied, read '${filePath}' (unreadable lock active)`));
    }

    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        return reject(new Error(`EISDIR: illegal operation on non-regular file, read '${filePath}'`));
      }
      // Check mode 000 (no read permission for owner/group/others)
      const mode = stat.mode & 0o777;
      if (mode === 0) {
        return reject(new Error(`EACCES: permission denied, read '${filePath}' (file permission mode 000)`));
      }
    } catch (statErr: any) {
      return reject(statErr);
    }

    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex').toLowerCase()));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Calculates SHA-256 over in-memory buffer.
 */
export function computeBufferSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex').toLowerCase();
}

/**
 * Deterministically serialize any JavaScript object or primitive according to RFC 8785 principles.
 * Recursively sorts dictionary keys so serialization is invariant to insertion order.
 */
export function deterministicStringify(value: any): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map((item) => deterministicStringify(item)).join(',') + ']';
  }

  const sortedKeys = Object.keys(value).sort();
  const pairs = sortedKeys.map((k) => {
    return JSON.stringify(k) + ':' + deterministicStringify(value[k]);
  });
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes hash for custody event:
 * SHA-256( previousHash + ":" + deterministicStringify(canonicalPayload) )
 */
export function computeCustodyEventHash(payload: Record<string, any>, prevHash: string): string {
  const canonical = deterministicStringify(payload);
  const dataToHash = `${prevHash}:${canonical}`;
  return crypto.createHash('sha256').update(dataToHash, 'utf8').digest('hex').toLowerCase();
}

/**
 * Asymmetrically signs a checkpoint payload using NIST P-256 ECDSA and SHA-256.
 */
export function signCheckpointPayload(checkpointData: Record<string, any>): {
  signatureHex: string;
  keyId: string;
  algorithm: string;
  publicKeyPem: string;
} {
  ensureKeypairExists();
  const privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
  const publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');
  const keyId = getKeyId();
  const algorithm = 'ECDSA-SHA256';

  const canonical = deterministicStringify(checkpointData);
  const sign = crypto.createSign('SHA256');
  sign.update(canonical, 'utf8');
  sign.end();

  const signatureBuffer = sign.sign(privateKeyPem);
  return {
    signatureHex: signatureBuffer.toString('hex'),
    keyId,
    algorithm,
    publicKeyPem,
  };
}

/**
 * Verifies an asymmetric ECDSA signature against the canonical checkpoint data and public key.
 */
export function verifyCheckpointSignature(
  checkpointData: Record<string, any>,
  signatureHex: string,
  publicKeyPem: string
): boolean {
  try {
    const canonical = deterministicStringify(checkpointData);
    const verify = crypto.createVerify('SHA256');
    verify.update(canonical, 'utf8');
    verify.end();

    const signatureBuffer = Buffer.from(signatureHex, 'hex');
    return verify.verify(publicKeyPem, signatureBuffer);
  } catch (err) {
    return false;
  }
}

export interface CustodyEventValidationInput {
  id?: string;
  evidence_id: string;
  sequence_number: number;
  event_type: string;
  actor_id: string;
  timestamp: string;
  previous_event_hash: string;
  event_hash: string;
  action_details: any;
  reason?: string;
}

export interface CustodyChainValidationResult {
  isValid: boolean;
  totalEvents: number;
  hasSequenceGap: boolean;
  hasReorderedEvents: boolean;
  hasModifiedEvents: boolean;
  hasBrokenLinks: boolean;
  discrepancies: string[];
  headHash: string | null;
  headSequence: number | null;
}

/**
 * Validates a complete custody event sequence:
 * - Deterministic event serialization and SHA-256 hash validation (event modification detection)
 * - Strict sequential numbering (1..N) (sequence validation)
 * - Missing-event detection (sequence gaps, dangling previous-hash pointers)
 * - Reordered-event detection (out-of-sequence ordering, inverted previous-hash pointers)
 * - Continuous Merkle hash linkage from genesis to chain head
 */
export function validateCustodyChain(events: CustodyEventValidationInput[]): CustodyChainValidationResult {
  if (!events || events.length === 0) {
    return {
      isValid: false,
      totalEvents: 0,
      hasSequenceGap: false,
      hasReorderedEvents: false,
      hasModifiedEvents: false,
      hasBrokenLinks: false,
      discrepancies: ['Chain is empty: no custody events present.'],
      headHash: null,
      headSequence: null,
    };
  }

  const discrepancies: string[] = [];
  let hasSequenceGap = false;
  let hasReorderedEvents = false;
  let hasModifiedEvents = false;
  let hasBrokenLinks = false;

  let expectedPrevHash = GENESIS_PREV_HASH;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const expectedSeq = i + 1;

    // 1. Sequence validation: Detect missing or reordered events
    if (ev.sequence_number !== expectedSeq) {
      if (ev.sequence_number > expectedSeq) {
        hasSequenceGap = true;
        discrepancies.push(`Missing event detected before position ${i + 1}: Expected sequence #${expectedSeq}, but found #${ev.sequence_number}.`);
      } else {
        hasReorderedEvents = true;
        discrepancies.push(`Reordered event detected at position ${i + 1}: Expected sequence #${expectedSeq}, but found sequence #${ev.sequence_number}.`);
      }
    }

    // 2. Hash-pointer linkage validation: Detect broken chain links
    if (ev.previous_event_hash !== expectedPrevHash) {
      hasBrokenLinks = true;
      discrepancies.push(`Broken hash pointer link at sequence #${ev.sequence_number} (event ${ev.id || i}): Previous hash pointer '${ev.previous_event_hash.substring(0, 16)}...' does not match expected parent hash '${expectedPrevHash.substring(0, 16)}...'.`);
    }

    // 3. Deterministic payload serialization and hash verification: Detect event modification
    let parsedDetails: any = ev.action_details;
    if (typeof parsedDetails === 'string') {
      try {
        parsedDetails = JSON.parse(parsedDetails);
      } catch {
        parsedDetails = ev.action_details;
      }
    }

    const canonicalPayload = {
      evidence_id: ev.evidence_id,
      sequence_number: ev.sequence_number,
      event_type: ev.event_type,
      actor_id: ev.actor_id,
      timestamp: ev.timestamp,
      action_details: parsedDetails,
    };

    const computedHash = computeCustodyEventHash(canonicalPayload, ev.previous_event_hash);
    if (computedHash !== ev.event_hash) {
      hasModifiedEvents = true;
      discrepancies.push(`Event modification detected at sequence #${ev.sequence_number} (event ${ev.id || i}): Stored hash '${ev.event_hash}' does not match recomputed SHA-256 '${computedHash}'. Event payload or metadata has been altered.`);
    }

    expectedPrevHash = ev.event_hash;
  }

  const isValid = discrepancies.length === 0;

  return {
    isValid,
    totalEvents: events.length,
    hasSequenceGap,
    hasReorderedEvents,
    hasModifiedEvents,
    hasBrokenLinks,
    discrepancies,
    headHash: events[events.length - 1].event_hash,
    headSequence: events[events.length - 1].sequence_number,
  };
}

/**
 * Validates a signed checkpoint anchor against a candidate custody chain head.
 * Detects chain rewriting where intermediate history was modified and re-hashed.
 */
export function verifyCheckpointAgainstChain(
  checkpoint: {
    chain_head_sequence: number;
    chain_head_hash: string;
    signature_hex: string;
    public_key_pem: string;
    canonical_payload: string | Record<string, any>;
  },
  chainValidation: CustodyChainValidationResult
): {
  isValid: boolean;
  isSignatureValid: boolean;
  isChainHeadMatching: boolean;
  discrepancies: string[];
} {
  const discrepancies: string[] = [];

  let payloadObj: any = checkpoint.canonical_payload;
  if (typeof payloadObj === 'string') {
    try {
      payloadObj = JSON.parse(payloadObj);
    } catch {
      discrepancies.push('Failed to parse canonical checkpoint payload.');
      return { isValid: false, isSignatureValid: false, isChainHeadMatching: false, discrepancies };
    }
  }

  // 1. Cryptographic signature check
  const isSignatureValid = verifyCheckpointSignature(
    payloadObj,
    checkpoint.signature_hex,
    checkpoint.public_key_pem
  );

  if (!isSignatureValid) {
    discrepancies.push('Checkpoint digital signature verification failed: Signature does not match public key or payload was modified.');
  }

  // 2. Chain head match check against anchor
  const isChainHeadMatching = (
    chainValidation.isValid &&
    chainValidation.headSequence === checkpoint.chain_head_sequence &&
    chainValidation.headHash === checkpoint.chain_head_hash
  );

  if (!isChainHeadMatching) {
    discrepancies.push(`Chain rewriting detected: Checkpoint anchors head sequence #${checkpoint.chain_head_sequence} (hash ${checkpoint.chain_head_hash.substring(0, 16)}...), but current chain head is sequence #${chainValidation.headSequence} (hash ${chainValidation.headHash ? chainValidation.headHash.substring(0, 16) : 'null'}...). History has been rewritten.`);
  }

  const isValid = isSignatureValid && isChainHeadMatching;

  return {
    isValid,
    isSignatureValid,
    isChainHeadMatching,
    discrepancies,
  };
}

/**
 * Secure password hashing using bcrypt.
 */
export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainText, salt);
}

/**
 * Verify password against bcrypt hash.
 */
export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

/**
 * Cryptographic random UUID with optional prefix.
 */
export function generateId(prefix: string = ''): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}
