import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { Pool } from 'pg';
import { newDb } from 'pg-mem';
import {
  hashPassword,
  computeCustodyEventHash,
  signCheckpointPayload,
  computeBufferSha256,
  generateId,
  ensureKeypairExists,
} from './crypto.js';
import {
  ensureStorageDirectories,
  EVIDENCE_DIR,
} from './storage.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'evidencelock.sqlite');

let sqlInstance: SqlJsStatic | null = null;
let database: Database | null = null;
let saveScheduled = false;

let pgPoolInstance: any = null;
let pgEngineType: 'REAL' | 'EMULATED' = 'EMULATED';

export function getPostgresPool(): any {
  return pgPoolInstance;
}

export function isPostgresReady(): boolean {
  return pgPoolInstance !== null;
}

export function getPostgresEngineType(): string {
  return pgEngineType;
}

/**
 * Initializes PostgreSQL schema and connectivity.
 * Supports live PostgreSQL connection when configured, with seamless in-process PostgreSQL engine fallback.
 */
export async function initPostgres(): Promise<any> {
  if (pgPoolInstance) return pgPoolInstance;

  const pgHost = process.env.SQL_HOST || process.env.PGHOST;
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl || pgHost) {
    try {
      const realPool = new Pool(
        dbUrl
          ? { connectionString: dbUrl, connectionTimeoutMillis: 3000 }
          : {
              host: pgHost,
              port: Number(process.env.PGPORT || 5432),
              user: process.env.SQL_USER || process.env.PGUSER,
              password: process.env.SQL_PASSWORD || process.env.PGPASSWORD,
              database: process.env.SQL_DB_NAME || process.env.PGDATABASE || 'evidencelock',
              connectionTimeoutMillis: 3000,
            }
      );
      await realPool.query('SELECT 1');
      console.log('[PostgreSQL] Connected to active PostgreSQL server.');
      pgPoolInstance = realPool;
      pgEngineType = 'REAL';
      await initPostgresSchema(pgPoolInstance);
      return pgPoolInstance;
    } catch (err: any) {
      console.warn('[PostgreSQL] External cluster not reachable; activating embedded PostgreSQL engine:', err.message);
    }
  }

  // Embedded PostgreSQL instance via pg-mem
  const mem = newDb();
  const pgAdapter = mem.adapters.createPg();
  pgPoolInstance = new pgAdapter.Pool();
  pgEngineType = 'EMULATED';
  await initPostgresSchema(pgPoolInstance);
  console.log('[PostgreSQL] Embedded PostgreSQL engine initialized.');
  return pgPoolInstance;
}

/**
 * Sets up PostgreSQL tables for evidentiary custody and metadata.
 */
async function initPostgresSchema(pool: any): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(64) UNIQUE NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id VARCHAR(64) PRIMARY KEY,
      code VARCHAR(64) UNIQUE NOT NULL,
      name VARCHAR(128) NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id VARCHAR(64) NOT NULL,
      permission_id VARCHAR(64) NOT NULL,
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      email VARCHAR(128) UNIQUE NOT NULL,
      password_hash VARCHAR(256) NOT NULL,
      full_name VARCHAR(128) NOT NULL,
      badge_number VARCHAR(64),
      agency VARCHAR(128) NOT NULL,
      role VARCHAR(64) NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at VARCHAR(64) NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cases (
      id VARCHAR(64) PRIMARY KEY,
      case_number VARCHAR(64) UNIQUE NOT NULL,
      title VARCHAR(256) NOT NULL,
      description TEXT,
      jurisdiction VARCHAR(128) NOT NULL,
      status VARCHAR(64) NOT NULL DEFAULT 'OPEN',
      lead_investigator_id VARCHAR(64) NOT NULL,
      created_at VARCHAR(64) NOT NULL,
      updated_at VARCHAR(64) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id VARCHAR(64) PRIMARY KEY,
      case_id VARCHAR(64) NOT NULL,
      item_number VARCHAR(64) NOT NULL,
      original_filename VARCHAR(256) NOT NULL,
      file_size_bytes BIGINT NOT NULL,
      mime_type VARCHAR(128) NOT NULL,
      storage_key VARCHAR(128) UNIQUE NOT NULL,
      original_sha256 VARCHAR(64) NOT NULL,
      evidence_type VARCHAR(64) NOT NULL,
      current_custodian_id VARCHAR(64) NOT NULL,
      uploader_id VARCHAR(64) NOT NULL,
      upload_timestamp VARCHAR(64) NOT NULL,
      status VARCHAR(64) NOT NULL DEFAULT 'IN_CUSTODY',
      notes TEXT,
      is_tampered_test_copy INTEGER NOT NULL DEFAULT 0,
      created_at VARCHAR(64) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custody_events (
      id VARCHAR(64) PRIMARY KEY,
      evidence_id VARCHAR(64) NOT NULL,
      sequence_number INTEGER NOT NULL,
      event_type VARCHAR(64) NOT NULL,
      actor_id VARCHAR(64) NOT NULL,
      timestamp VARCHAR(64) NOT NULL,
      previous_event_hash VARCHAR(64) NOT NULL,
      event_hash VARCHAR(64) NOT NULL,
      action_details TEXT NOT NULL,
      reason TEXT,
      UNIQUE (evidence_id, sequence_number)
    );

    CREATE TABLE IF NOT EXISTS custody_transfers (
      id VARCHAR(64) PRIMARY KEY,
      evidence_id VARCHAR(64) NOT NULL,
      from_user_id VARCHAR(64) NOT NULL,
      to_user_id VARCHAR(64) NOT NULL,
      reason TEXT NOT NULL,
      status VARCHAR(64) NOT NULL DEFAULT 'PENDING',
      requested_at VARCHAR(64) NOT NULL,
      resolved_at VARCHAR(64),
      resolution_notes TEXT,
      expected_custodian_version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS signed_checkpoints (
      id VARCHAR(64) PRIMARY KEY,
      checkpoint_number INTEGER NOT NULL,
      evidence_id VARCHAR(64),
      chain_head_event_id VARCHAR(64) NOT NULL,
      chain_head_sequence INTEGER NOT NULL,
      chain_head_hash VARCHAR(64) NOT NULL,
      timestamp VARCHAR(64) NOT NULL,
      signer_actor_id VARCHAR(64) NOT NULL,
      key_id VARCHAR(64) NOT NULL,
      algorithm VARCHAR(64) NOT NULL,
      public_key_pem TEXT NOT NULL,
      signature_hex TEXT NOT NULL,
      canonical_payload TEXT NOT NULL,
      created_at VARCHAR(64) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_runs (
      id VARCHAR(64) PRIMARY KEY,
      evidence_id VARCHAR(64) NOT NULL,
      verified_by_id VARCHAR(64) NOT NULL,
      timestamp VARCHAR(64) NOT NULL,
      file_status VARCHAR(32) NOT NULL,
      chain_status VARCHAR(32) NOT NULL,
      checkpoint_status VARCHAR(32) NOT NULL,
      overall_status VARCHAR(32) NOT NULL,
      trusted_sha256 VARCHAR(64) NOT NULL,
      calculated_sha256 VARCHAR(64),
      findings TEXT NOT NULL,
      failure_type VARCHAR(64)
    );

    CREATE TABLE IF NOT EXISTS security_audit_events (
      id VARCHAR(64) PRIMARY KEY,
      actor_id VARCHAR(64),
      actor_username VARCHAR(64),
      event_type VARCHAR(64) NOT NULL,
      severity VARCHAR(32) NOT NULL,
      ip_address VARCHAR(64),
      details TEXT NOT NULL,
      timestamp VARCHAR(64) NOT NULL
    );
  `);
}

/**
 * Stores evidence metadata in PostgreSQL.
 */
export async function storeEvidenceMetadataInPostgres(evidence: {
  id: string;
  case_id: string;
  item_number: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string;
  storage_key: string;
  original_sha256: string;
  evidence_type: string;
  current_custodian_id: string;
  uploader_id: string;
  upload_timestamp: string;
  status?: string;
  notes?: string;
  is_tampered_test_copy?: number;
  created_at: string;
}): Promise<void> {
  const pool = await initPostgres();
  await pool.query(`
    INSERT INTO evidence (
      id, case_id, item_number, original_filename, file_size_bytes, mime_type,
      storage_key, original_sha256, evidence_type, current_custodian_id, uploader_id,
      upload_timestamp, status, notes, is_tampered_test_copy, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
  `, [
    evidence.id,
    evidence.case_id,
    evidence.item_number,
    evidence.original_filename,
    evidence.file_size_bytes,
    evidence.mime_type,
    evidence.storage_key,
    evidence.original_sha256,
    evidence.evidence_type,
    evidence.current_custodian_id,
    evidence.uploader_id,
    evidence.upload_timestamp,
    evidence.status || 'IN_CUSTODY',
    evidence.notes || '',
    evidence.is_tampered_test_copy || 0,
    evidence.created_at
  ]);
}

/**
 * Retrieves evidence metadata directly from PostgreSQL.
 */
export async function getEvidenceMetadataFromPostgres(id: string): Promise<any> {
  const pool = await initPostgres();
  const res = await pool.query('SELECT * FROM evidence WHERE id = $1', [id]);
  return res.rows[0] || null;
}

/**
 * Records a verification run in PostgreSQL.
 */
export async function recordVerificationInPostgres(run: {
  id: string;
  evidence_id: string;
  verified_by_id: string;
  timestamp: string;
  file_status: string;
  chain_status: string;
  checkpoint_status: string;
  overall_status: string;
  trusted_sha256: string;
  calculated_sha256: string | null;
  findings: string;
  failure_type?: string | null;
}): Promise<void> {
  const pool = await initPostgres();
  await pool.query(`
    INSERT INTO verification_runs (
      id, evidence_id, verified_by_id, timestamp, file_status, chain_status,
      checkpoint_status, overall_status, trusted_sha256, calculated_sha256, findings, failure_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `, [
    run.id,
    run.evidence_id,
    run.verified_by_id,
    run.timestamp,
    run.file_status,
    run.chain_status,
    run.checkpoint_status,
    run.overall_status,
    run.trusted_sha256,
    run.calculated_sha256,
    run.findings,
    run.failure_type || null
  ]);
}

export async function getDb(): Promise<Database> {
  if (database) return database;

  // Ensure PostgreSQL layer is initialized
  try {
    await initPostgres();
  } catch (err: any) {
    console.warn('[PostgreSQL] Initializer warning:', err.message);
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }

  ensureStorageDirectories();
  ensureKeypairExists();

  if (!sqlInstance) {
    sqlInstance = await initSqlJs();
  }

  if (fs.existsSync(DB_FILE_PATH)) {
    const fileBuffer = fs.readFileSync(DB_FILE_PATH);
    database = new sqlInstance.Database(fileBuffer);
  } else {
    database = new sqlInstance.Database();
  }

  initSchemaAndSeed(database);
  saveDatabaseImmediately();

  return database;
}

export function saveDatabaseImmediately(): void {
  if (!database) return;
  try {
    const data = database.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE_PATH, buffer);
  } catch (err) {
    console.error('Failed to save sqlite database to disk:', err);
  }
}

export function scheduleSave(): void {
  if (saveScheduled) return;
  saveScheduled = true;
  setImmediate(() => {
    saveScheduled = false;
    saveDatabaseImmediately();
  });
}

/**
 * Executes a query returning array of objects with column names as keys.
 */
export function query<T = any>(sql: string, params: any[] = []): T[] {
  if (!database) throw new Error('Database not initialized');
  const stmt = database.prepare(sql);
  try {
    if (params.length > 0) {
      stmt.bind(params);
    }
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as T);
    }
    return results;
  } finally {
    stmt.free();
  }
}

/**
 * Returns single row or null.
 */
export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Executes a mutating statement and saves changes to disk.
 */
export function run(sql: string, params: any[] = []): void {
  if (!database) throw new Error('Database not initialized');
  database.run(sql, params);
  scheduleSave();
}

/**
 * Executes operations inside a transaction.
 */
export function transaction<T>(fn: () => T): T {
  if (!database) throw new Error('Database not initialized');
  database.run('BEGIN TRANSACTION');
  try {
    const result = fn();
    database.run('COMMIT');
    saveDatabaseImmediately();
    return result;
  } catch (error) {
    database.run('ROLLBACK');
    throw error;
  }
}

/**
 * Initialize database schema and seeds initial records if not present.
 */
function initSchemaAndSeed(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL,
      permission_id TEXT NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      badge_number TEXT,
      agency TEXT NOT NULL,
      role TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      case_number TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      jurisdiction TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      lead_investigator_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (lead_investigator_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      item_number TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      storage_key TEXT UNIQUE NOT NULL,
      original_sha256 TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      current_custodian_id TEXT NOT NULL,
      uploader_id TEXT NOT NULL,
      upload_timestamp TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'IN_CUSTODY',
      notes TEXT,
      is_tampered_test_copy INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id),
      FOREIGN KEY (current_custodian_id) REFERENCES users(id),
      FOREIGN KEY (uploader_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS custody_events (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      sequence_number INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      previous_event_hash TEXT NOT NULL,
      event_hash TEXT NOT NULL,
      action_details TEXT NOT NULL,
      reason TEXT,
      FOREIGN KEY (evidence_id) REFERENCES evidence(id),
      FOREIGN KEY (actor_id) REFERENCES users(id),
      UNIQUE (evidence_id, sequence_number)
    );

    CREATE TABLE IF NOT EXISTS custody_transfers (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      requested_at TEXT NOT NULL,
      resolved_at TEXT,
      resolution_notes TEXT,
      expected_custodian_version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (evidence_id) REFERENCES evidence(id),
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS signed_checkpoints (
      id TEXT PRIMARY KEY,
      checkpoint_number INTEGER NOT NULL,
      evidence_id TEXT,
      chain_head_event_id TEXT NOT NULL,
      chain_head_sequence INTEGER NOT NULL,
      chain_head_hash TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      signer_actor_id TEXT NOT NULL,
      key_id TEXT NOT NULL,
      algorithm TEXT NOT NULL,
      public_key_pem TEXT NOT NULL,
      signature_hex TEXT NOT NULL,
      canonical_payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (evidence_id) REFERENCES evidence(id),
      FOREIGN KEY (signer_actor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS verification_runs (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      verified_by_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      file_status TEXT NOT NULL,
      chain_status TEXT NOT NULL,
      checkpoint_status TEXT NOT NULL,
      overall_status TEXT NOT NULL,
      trusted_sha256 TEXT NOT NULL,
      calculated_sha256 TEXT,
      findings TEXT NOT NULL,
      failure_type TEXT,
      FOREIGN KEY (evidence_id) REFERENCES evidence(id),
      FOREIGN KEY (verified_by_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS security_audit_events (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_username TEXT,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      ip_address TEXT,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      report_number TEXT UNIQUE NOT NULL,
      evidence_id TEXT NOT NULL,
      verification_run_id TEXT,
      generated_by_id TEXT NOT NULL,
      report_type TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      file_path TEXT,
      FOREIGN KEY (evidence_id) REFERENCES evidence(id),
      FOREIGN KEY (generated_by_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      link TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Check if roles are already seeded
  const existingRoles = db.exec("SELECT count(*) as count FROM roles");
  if (existingRoles.length > 0 && existingRoles[0].values[0][0] === 0) {
    seedInitialData(db);
  }
}

function seedInitialData(db: Database): void {
  const now = new Date().toISOString();

  // 1. Roles
  db.run(`
    INSERT INTO roles (id, name, description) VALUES
    ('ROLE_ADMIN', 'ADMINISTRATOR', 'Full system configuration, user access management, cryptographic key audits, and overall platform administration.'),
    ('ROLE_INVESTIGATOR', 'INVESTIGATOR', 'Case officer authorized to upload digital evidence, verify file integrity, initiate and receive chain of custody transfers.'),
    ('ROLE_AUDITOR', 'AUDITOR', 'Independent forensic auditor authorized to review evidence trails, verify hash-chains, audit signed checkpoints, and generate formal inspection reports.');
  `);

  // 2. Permissions
  const permissions = [
    ['PERM_EVIDENCE_UPLOAD', 'EVIDENCE_UPLOAD', 'Upload digital evidence into secure staged vault'],
    ['PERM_EVIDENCE_VIEW', 'EVIDENCE_VIEW', 'Inspect evidence metadata and forensic properties'],
    ['PERM_EVIDENCE_DOWNLOAD', 'EVIDENCE_DOWNLOAD', 'Export authorized raw evidence bitstream'],
    ['PERM_EVIDENCE_VERIFY', 'EVIDENCE_VERIFY', 'Execute SHA-256 and chain verification runs'],
    ['PERM_CUSTODY_TRANSFER_REQUEST', 'CUSTODY_TRANSFER_REQUEST', 'Request custody transfer to another investigator'],
    ['PERM_CUSTODY_TRANSFER_ACCEPT', 'CUSTODY_TRANSFER_ACCEPT', 'Accept custody transfer into personal custody'],
    ['PERM_CUSTODY_TIMELINE_VIEW', 'CUSTODY_TIMELINE_VIEW', 'Examine complete chain-of-custody merkle timeline'],
    ['PERM_CHECKPOINT_CREATE', 'CHECKPOINT_CREATE', 'Create asymmetric digitally signed checkpoint anchor'],
    ['PERM_CHECKPOINT_VERIFY', 'CHECKPOINT_VERIFY', 'Verify cryptographic digital signature of checkpoint'],
    ['PERM_REPORTS_GENERATE', 'REPORTS_GENERATE', 'Generate certified PDF forensic verification reports'],
    ['PERM_AUDIT_LOG_VIEW', 'AUDIT_LOG_VIEW', 'Review tamper-evident security audit logs'],
    ['PERM_USER_MANAGE', 'USER_MANAGE', 'Provision, modify, and deactivate system accounts'],
    ['PERM_ROLE_MANAGE', 'ROLE_MANAGE', 'Manage role assignments and access policies'],
    ['PERM_SYSTEM_HEALTH', 'SYSTEM_HEALTH', 'Monitor cryptographic storage and node status']
  ];

  for (const [id, code, desc] of permissions) {
    db.run("INSERT INTO permissions (id, code, name, description) VALUES (?, ?, ?, ?)", [id, code, code, desc]);
  }

  // 3. Role-Permissions
  // Admin gets all
  for (const [permId] of permissions) {
    db.run("INSERT INTO role_permissions (role_id, permission_id) VALUES ('ROLE_ADMIN', ?)", [permId]);
  }

  // Investigator gets operational perms
  const investigatorPerms = [
    'PERM_EVIDENCE_UPLOAD', 'PERM_EVIDENCE_VIEW', 'PERM_EVIDENCE_DOWNLOAD',
    'PERM_EVIDENCE_VERIFY', 'PERM_CUSTODY_TRANSFER_REQUEST', 'PERM_CUSTODY_TRANSFER_ACCEPT',
    'PERM_CUSTODY_TIMELINE_VIEW', 'PERM_REPORTS_GENERATE'
  ];
  for (const p of investigatorPerms) {
    db.run("INSERT INTO role_permissions (role_id, permission_id) VALUES ('ROLE_INVESTIGATOR', ?)", [p]);
  }

  // Auditor gets read + verification + reports + audit logs
  const auditorPerms = [
    'PERM_EVIDENCE_VIEW', 'PERM_EVIDENCE_VERIFY', 'PERM_CUSTODY_TIMELINE_VIEW',
    'PERM_CHECKPOINT_CREATE', 'PERM_CHECKPOINT_VERIFY', 'PERM_REPORTS_GENERATE',
    'PERM_AUDIT_LOG_VIEW', 'PERM_SYSTEM_HEALTH'
  ];
  for (const p of auditorPerms) {
    db.run("INSERT INTO role_permissions (role_id, permission_id) VALUES ('ROLE_AUDITOR', ?)", [p]);
  }

  // 4. Default Seed Users (passwords hashed with bcrypt)
  const adminHash = bcrypt.hashSync('EvidenceLock@Admin2026!', 10);
  const investigatorHash = bcrypt.hashSync('Investigate@2026!', 10);
  const auditorHash = bcrypt.hashSync('Auditor@2026!', 10);

  const users = [
    ['USR_ADMIN_01', 'admin', 'admin@evidencelock.gov', adminHash, 'Alex Vance', 'SEC-001', 'Federal Forensic Inspection Service', 'ADMINISTRATOR'],
    ['USR_INV_CHEN', 'investigator.chen', 's.chen@cybercrimes.gov', investigatorHash, 'Sarah Chen', 'BADGE-8842', 'DFIR Incident Response Division', 'INVESTIGATOR'],
    ['USR_INV_DAWSON', 'investigator.dawson', 'l.dawson@cybercrimes.gov', investigatorHash, 'Liam Dawson', 'BADGE-9104', 'Digital Forensic Laboratory', 'INVESTIGATOR'],
    ['USR_AUD_REYES', 'auditor.reyes', 'm.reyes@judicialaudit.gov', auditorHash, 'Marcus Reyes', 'AUD-402', 'Office of Inspector General', 'AUDITOR']
  ];

  for (const [id, uname, email, phash, fname, badge, agency, role] of users) {
    db.run(`
      INSERT INTO users (id, username, email, password_hash, full_name, badge_number, agency, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [id, uname, email, phash, fname, badge, agency, role, now, now]);
  }

  // 5. Seed Investigations / Cases
  const cases = [
    [
      'CASE-2026-CR-0842',
      'CASE-2026-CR-0842',
      'Operation Chimera: Financial Exfiltration Network',
      'Forensic extraction and analysis of infected domain controller and gateway artifacts linked to APT-44 intrusion.',
      'Federal District Court (Northern Jurisdiction)',
      'OPEN',
      'USR_INV_CHEN',
      now,
      now
    ],
    [
      'CASE-2026-CR-0917',
      'CASE-2026-CR-0917',
      'Critical SCADA Substation Logic Tamper Investigation',
      'Triage of unauthorized firmware modifications and anomalous telemetry PCAP streams in regional power substation.',
      'Infrastructure Safety Enforcement Board',
      'OPEN',
      'USR_INV_DAWSON',
      now,
      now
    ],
    [
      'CASE-2026-CR-1049',
      'CASE-2026-CR-1049',
      'Nexus Logistics Ransomware Ransom Note & Memory Dump',
      'Volatile memory triage of production hypervisor node post ransomware execution with ransom vector confirmation.',
      'Commercial Crimes Investigation Bureau',
      'PENDING_REVIEW',
      'USR_INV_CHEN',
      now,
      now
    ]
  ];

  for (const c of cases) {
    db.run(`
      INSERT INTO cases (id, case_number, title, description, jurisdiction, status, lead_investigator_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, c);
  }

  // 6. Seed Real Evidence Files in /storage/evidence/
  // Evidence item 1: Disk dump sector summary log
  const file1Content = Buffer.from(
    `[FORENSIC BITSTREAM LOG - DD IMAGING REPORT]\n` +
    `Case ID: CASE-2026-CR-0842\n` +
    `Source Device: Western Digital NVMe SN850X 2TB Serial #WDS200T2X0E-00BCA0\n` +
    `Acquisition Tool: Tableau TX1 Forensic Imager v24.2\n` +
    `Write Blocker: Hardware Engaged (Read-Only Mode)\n` +
    `Sectors Read: 3,907,029,168 (Zero bad sectors encountered)\n` +
    `Acquisition Start: 2026-10-01 08:14:22 UTC\n` +
    `Acquisition Complete: 2026-10-01 10:47:11 UTC\n` +
    `Hardware Cryptographic Salt: 7f3b89a04cd8e12\n` +
    `Primary Image Integrity Checksum Verified.\n`
  );
  const hash1 = computeBufferSha256(file1Content);
  const storageKey1 = 'ev_wd_nvme_imaging_report_0842.txt';
  fs.writeFileSync(path.join(EVIDENCE_DIR, storageKey1), file1Content, { mode: 0o600 });

  // Evidence item 2: Exfiltration packet capture summary
  const file2Content = Buffer.from(
    `EVIDENCELOCK NETWORK ARTIFACT CAPTURE\n` +
    `Session: TLS Tunnel to 198.51.100.44:443\n` +
    `Frame Count: 48,192 packets\n` +
    `Exported Streams: 12 TCP sessions\n` +
    `Payload Digest: C2 beaconing protocol detected on port 8443\n` +
    `Forensic Hash Verification: Complete byte alignment confirmed\n`
  );
  const hash2 = computeBufferSha256(file2Content);
  const storageKey2 = 'ev_pcap_beaconing_stream_0842.log';
  fs.writeFileSync(path.join(EVIDENCE_DIR, storageKey2), file2Content, { mode: 0o600 });

  // Evidence item 3: SCADA PLC Ladder Logic Binary Dump
  const file3Content = Buffer.from(
    `SCADA S7-1500 PLC Firmware & Memory Snapshot\n` +
    `Station: Substation-09 Transformer Bus B\n` +
    `Extracted Memory Blocks: DB1, DB2, OB1, FC105\n` +
    `Anomalous Function Block: FC199 injected at 2026-10-04 03:12:00 UTC\n` +
    `Raw Hex CRC32: 0x99AE48F1\n`
  );
  const hash3 = computeBufferSha256(file3Content);
  const storageKey3 = 'ev_scada_plc_snapshot_0917.bin';
  fs.writeFileSync(path.join(EVIDENCE_DIR, storageKey3), file3Content, { mode: 0o600 });

  const evidenceItems = [
    [
      'EV-0842-001',
      'CASE-2026-CR-0842',
      'ITEM-2026-001',
      'tableau_tx1_nvme_acquisition_report.txt',
      file1Content.length,
      'text/plain',
      storageKey1,
      hash1,
      'FORENSIC_IMAGE',
      'USR_INV_CHEN',
      'USR_INV_CHEN',
      '2026-10-01T11:00:00Z',
      'IN_CUSTODY',
      'Primary master forensic imaging report directly from Tableau TX1 hardware write-blocker.',
      0,
      '2026-10-01T11:00:00Z'
    ],
    [
      'EV-0842-002',
      'CASE-2026-CR-0842',
      'ITEM-2026-002',
      'perimeter_firewall_pcap_beaconing.log',
      file2Content.length,
      'text/plain',
      storageKey2,
      hash2,
      'NETWORK_CAPTURE',
      'USR_INV_CHEN',
      'USR_INV_CHEN',
      '2026-10-02T14:30:00Z',
      'IN_CUSTODY',
      'Decoded network capture log highlighting C2 exfiltration beaconing bursts.',
      0,
      '2026-10-02T14:30:00Z'
    ],
    [
      'EV-0917-001',
      'CASE-2026-CR-0917',
      'ITEM-2026-003',
      'substation09_plc_firmware_snapshot.bin',
      file3Content.length,
      'application/octet-stream',
      storageKey3,
      hash3,
      'FORENSIC_IMAGE',
      'USR_INV_DAWSON',
      'USR_INV_DAWSON',
      '2026-10-04T09:15:00Z',
      'IN_CUSTODY',
      'Tampered PLC memory extraction secured directly from Substation 9 cabinet.',
      0,
      '2026-10-04T09:15:00Z'
    ]
  ];

  for (const ev of evidenceItems) {
    db.run(`
      INSERT INTO evidence (
        id, case_id, item_number, original_filename, file_size_bytes, mime_type,
        storage_key, original_sha256, evidence_type, current_custodian_id, uploader_id,
        upload_timestamp, status, notes, is_tampered_test_copy, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, ev);
  }

  // 7. Seed Custody Events (Cryptographically Hash-Linked Merkle Chain)
  // EV-0842-001 chain
  const genesisPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';
  
  // Event 1: Upload
  const ev1Payload = {
    evidence_id: 'EV-0842-001',
    sequence_number: 1,
    event_type: 'EVIDENCE_UPLOAD',
    actor_id: 'USR_INV_CHEN',
    timestamp: '2026-10-01T11:00:00Z',
    action_details: {
      action: 'Initial evidentiary intake and secure staged deposit',
      source_device: 'Tableau TX1 Forensic Imager',
      file_size_bytes: file1Content.length,
      original_sha256: hash1
    }
  };
  const ev1Hash = computeCustodyEventHash(ev1Payload, genesisPrevHash);
  db.run(`
    INSERT INTO custody_events (
      id, evidence_id, sequence_number, event_type, actor_id, timestamp,
      previous_event_hash, event_hash, action_details, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'CEV-0842-001-01',
    'EV-0842-001',
    1,
    'EVIDENCE_UPLOAD',
    'USR_INV_CHEN',
    '2026-10-01T11:00:00Z',
    genesisPrevHash,
    ev1Hash,
    JSON.stringify(ev1Payload.action_details),
    'Initial forensic intake into EvidenceLock vault'
  ]);

  // Event 2: Verification Run
  const ev2Payload = {
    evidence_id: 'EV-0842-001',
    sequence_number: 2,
    event_type: 'VERIFICATION_RUN',
    actor_id: 'USR_INV_CHEN',
    timestamp: '2026-10-01T11:05:00Z',
    action_details: {
      action: 'Baseline byte-level integrity verification',
      result: 'PASS',
      verified_sha256: hash1
    }
  };
  const ev2Hash = computeCustodyEventHash(ev2Payload, ev1Hash);
  db.run(`
    INSERT INTO custody_events (
      id, evidence_id, sequence_number, event_type, actor_id, timestamp,
      previous_event_hash, event_hash, action_details, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'CEV-0842-001-02',
    'EV-0842-001',
    2,
    'VERIFICATION_RUN',
    'USR_INV_CHEN',
    '2026-10-01T11:05:00Z',
    ev1Hash,
    ev2Hash,
    JSON.stringify(ev2Payload.action_details),
    'Automated post-intake byte integrity verification'
  ]);

  // Event 3: Signed Checkpoint Anchor
  const ev3Payload = {
    evidence_id: 'EV-0842-001',
    sequence_number: 3,
    event_type: 'CHECKPOINT_CREATED',
    actor_id: 'USR_AUD_REYES',
    timestamp: '2026-10-01T16:00:00Z',
    action_details: {
      action: 'Independent auditor cryptographic checkpoint signing',
      signed_chain_head_hash: ev2Hash
    }
  };
  const ev3Hash = computeCustodyEventHash(ev3Payload, ev2Hash);
  db.run(`
    INSERT INTO custody_events (
      id, evidence_id, sequence_number, event_type, actor_id, timestamp,
      previous_event_hash, event_hash, action_details, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'CEV-0842-001-03',
    'EV-0842-001',
    3,
    'CHECKPOINT_CREATED',
    'USR_AUD_REYES',
    '2026-10-01T16:00:00Z',
    ev2Hash,
    ev3Hash,
    JSON.stringify(ev3Payload.action_details),
    'Auditor baseline checkpoint seal'
  ]);

  // 8. Sign Checkpoint with ECDSA P-256 Asymmetric Key
  const checkpointPayload = {
    checkpoint_number: 1,
    evidence_id: 'EV-0842-001',
    chain_head_event_id: 'CEV-0842-001-03',
    chain_head_sequence: 3,
    chain_head_hash: ev3Hash,
    timestamp: '2026-10-01T16:00:00Z',
    signer_actor_id: 'USR_AUD_REYES',
    jurisdiction: 'Office of Inspector General - Digital Evidentiary Seal'
  };
  const signed = signCheckpointPayload(checkpointPayload);

  db.run(`
    INSERT INTO signed_checkpoints (
      id, checkpoint_number, evidence_id, chain_head_event_id, chain_head_sequence,
      chain_head_hash, timestamp, signer_actor_id, key_id, algorithm,
      public_key_pem, signature_hex, canonical_payload, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'CHK-0842-001-01',
    1,
    'EV-0842-001',
    'CEV-0842-001-03',
    3,
    ev3Hash,
    '2026-10-01T16:00:00Z',
    'USR_AUD_REYES',
    signed.keyId,
    signed.algorithm,
    signed.publicKeyPem,
    signed.signatureHex,
    JSON.stringify(checkpointPayload),
    '2026-10-01T16:00:00Z'
  ]);

  // Seed events for Item 2 & 3
  const item2Payload = {
    evidence_id: 'EV-0842-002',
    sequence_number: 1,
    event_type: 'EVIDENCE_UPLOAD',
    actor_id: 'USR_INV_CHEN',
    timestamp: '2026-10-02T14:30:00Z',
    action_details: { action: 'Intake of firewall packet log', original_sha256: hash2 }
  };
  const item2Hash = computeCustodyEventHash(item2Payload, genesisPrevHash);
  db.run(`
    INSERT INTO custody_events (
      id, evidence_id, sequence_number, event_type, actor_id, timestamp,
      previous_event_hash, event_hash, action_details, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'CEV-0842-002-01', 'EV-0842-002', 1, 'EVIDENCE_UPLOAD', 'USR_INV_CHEN',
    '2026-10-02T14:30:00Z', genesisPrevHash, item2Hash,
    JSON.stringify(item2Payload.action_details), 'Ingestion of C2 PCAP log'
  ]);

  const item3Payload = {
    evidence_id: 'EV-0917-001',
    sequence_number: 1,
    event_type: 'EVIDENCE_UPLOAD',
    actor_id: 'USR_INV_DAWSON',
    timestamp: '2026-10-04T09:15:00Z',
    action_details: { action: 'Secure extraction from Substation 9 PLC', original_sha256: hash3 }
  };
  const item3Hash = computeCustodyEventHash(item3Payload, genesisPrevHash);
  db.run(`
    INSERT INTO custody_events (
      id, evidence_id, sequence_number, event_type, actor_id, timestamp,
      previous_event_hash, event_hash, action_details, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'CEV-0917-001-01', 'EV-0917-001', 1, 'EVIDENCE_UPLOAD', 'USR_INV_DAWSON',
    '2026-10-04T09:15:00Z', genesisPrevHash, item3Hash,
    JSON.stringify(item3Payload.action_details), 'Physical evidence extraction at substation'
  ]);

  // 9. Seed Initial Verification Runs
  db.run(`
    INSERT INTO verification_runs (
      id, evidence_id, verified_by_id, timestamp, file_status, chain_status,
      checkpoint_status, overall_status, trusted_sha256, calculated_sha256, findings, failure_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'VRUN-0842-001-01',
    'EV-0842-001',
    'USR_INV_CHEN',
    '2026-10-01T11:05:00Z',
    'PASS',
    'PASS',
    'PASS',
    'PASS',
    hash1,
    hash1,
    'All byte checks match trusted genesis hash. Merkle custody links verified through sequence 3. NIST P-256 ECDSA signature valid.',
    'NONE'
  ]);

  // 10. Seed Notifications
  db.run(`
    INSERT INTO notifications (id, user_id, title, message, type, is_read, link, created_at) VALUES
    ('NTF-01', 'USR_INV_CHEN', 'Verification Passed', 'Forensic report ITEM-2026-001 verified intact with 0 discrepancies.', 'VERIFICATION_ALERT', 0, '/evidence/EV-0842-001', ?),
    ('NTF-02', 'USR_AUD_REYES', 'Signed Checkpoint Active', 'Checkpoint #1 digitally anchored using key KEY-P256.', 'INFO', 0, '/checkpoints', ?),
    ('NTF-03', 'USR_INV_DAWSON', 'New Evidence Ingested', 'ITEM-2026-003 added under CASE-2026-CR-0917.', 'INFO', 1, '/evidence/EV-0917-001', ?)
  `, [now, now, now]);

  // 11. Seed Security Audit Logs
  db.run(`
    INSERT INTO security_audit_events (id, actor_id, actor_username, event_type, severity, ip_address, details, timestamp) VALUES
    ('AUD-EVT-01', 'USR_ADMIN_01', 'admin', 'SYSTEM_INIT', 'INFO', '127.0.0.1', 'EvidenceLock cryptographic vault initialized with NIST P-256 signing engine.', '2026-10-01T00:00:00Z'),
    ('AUD-EVT-02', 'USR_INV_CHEN', 'investigator.chen', 'USER_LOGIN', 'INFO', '192.168.10.45', 'Session established via secure password authentication.', '2026-10-01T10:50:00Z'),
    ('AUD-EVT-03', 'USR_INV_CHEN', 'investigator.chen', 'EVIDENCE_UPLOAD', 'INFO', '192.168.10.45', 'Committed staged file EV-0842-001 (Tableau TX1 report). Trusted SHA-256 recorded.', '2026-10-01T11:00:00Z'),
    ('AUD-EVT-04', 'USR_AUD_REYES', 'auditor.reyes', 'CHECKPOINT_CREATED', 'INFO', '192.168.20.12', 'Signed cryptographic checkpoint #1 over sequence head 3.', '2026-10-01T16:00:00Z')
  `);
}
