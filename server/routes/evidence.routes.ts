import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { requireAuth, requirePermission, logAuditEvent } from '../auth.js';
import { query, queryOne, run, transaction, storeEvidenceMetadataInPostgres } from '../db.js';
import {
  STAGING_DIR,
  commitStagedEvidence,
  getSafeEvidencePath,
  isPermittedFileType,
  sanitizeFilename,
  simulateTamperFile,
  MAX_FILE_SIZE_BYTES,
} from '../storage.js';
import {
  computeCustodyEventHash,
  generateId,
  computeBufferSha256,
} from '../crypto.js';

const router = Router();

// Multer staging configuration
const upload = multer({
  dest: STAGING_DIR,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (!isPermittedFileType(file.originalname)) {
      cb(new Error(`File extension '${path.extname(file.originalname)}' is not permitted for evidentiary custody.`));
      return;
    }
    cb(null, true);
  },
});

// List evidence
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const { caseId, type, search, status } = req.query;

    let sql = `
      SELECT 
        e.*,
        c.case_number,
        c.title as case_title,
        u_cust.full_name as current_custodian_name,
        u_up.full_name as uploader_name,
        (SELECT count(*) FROM custody_events ce WHERE ce.evidence_id = e.id) as custody_event_count,
        (SELECT file_status FROM verification_runs vr WHERE vr.evidence_id = e.id ORDER BY timestamp DESC LIMIT 1) as last_verification_status,
        (SELECT timestamp FROM verification_runs vr WHERE vr.evidence_id = e.id ORDER BY timestamp DESC LIMIT 1) as last_verification_timestamp
      FROM evidence e
      JOIN cases c ON e.case_id = c.id
      JOIN users u_cust ON e.current_custodian_id = u_cust.id
      JOIN users u_up ON e.uploader_id = u_up.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (caseId) {
      sql += ' AND e.case_id = ?';
      params.push(caseId);
    }
    if (type) {
      sql += ' AND e.evidence_type = ?';
      params.push(type);
    }
    if (status) {
      sql += ' AND e.status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND (e.item_number LIKE ? OR e.original_filename LIKE ? OR c.case_number LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY e.created_at DESC';

    const items = query(sql, params);
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve evidence registry.' });
  }
});

// Get evidence details
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = queryOne<any>(`
      SELECT 
        e.*,
        c.case_number,
        c.title as case_title,
        c.jurisdiction as case_jurisdiction,
        u_cust.full_name as current_custodian_name,
        u_cust.badge_number as current_custodian_badge,
        u_cust.agency as current_custodian_agency,
        u_up.full_name as uploader_name,
        u_up.badge_number as uploader_badge,
        u_up.agency as uploader_agency
      FROM evidence e
      JOIN cases c ON e.case_id = c.id
      JOIN users u_cust ON e.current_custodian_id = u_cust.id
      JOIN users u_up ON e.uploader_id = u_up.id
      WHERE e.id = ?
    `, [id]);

    if (!item) {
      res.status(404).json({ error: 'Evidence record not found.' });
      return;
    }

    // Latest verification run
    const lastRun = queryOne<any>(
      'SELECT * FROM verification_runs WHERE evidence_id = ? ORDER BY timestamp DESC LIMIT 1',
      [id]
    );

    // Latest signed checkpoint
    const lastCheckpoint = queryOne<any>(
      'SELECT * FROM signed_checkpoints WHERE evidence_id = ? ORDER BY checkpoint_number DESC LIMIT 1',
      [id]
    );

    // Total custody events count
    const eventCount = queryOne<any>(
      'SELECT count(*) as count FROM custody_events WHERE evidence_id = ?',
      [id]
    );

    res.json({
      evidence: item,
      lastVerification: lastRun,
      lastCheckpoint,
      totalEvents: eventCount ? eventCount.count : 0
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve evidence details.' });
  }
});

// Upload evidence (staged, chunked SHA-256, atomic commit, genesis event)
router.post('/upload', requireAuth, requirePermission('EVIDENCE_UPLOAD'), upload.single('file'), async (req: Request, res: Response) => {
  let stagedFile = req.file;

  try {
    if (!stagedFile) {
      res.status(400).json({ error: 'No evidence file received in upload payload.' });
      return;
    }

    const {
      caseId,
      itemNumber,
      evidenceType,
      notes,
    } = req.body;

    if (!caseId || !itemNumber || !evidenceType) {
      if (stagedFile.path && fs.existsSync(stagedFile.path)) {
        fs.unlinkSync(stagedFile.path);
      }
      res.status(400).json({ error: 'Missing mandatory metadata: caseId, itemNumber, and evidenceType are required.' });
      return;
    }

    // Verify case exists
    const caseRecord = queryOne<any>('SELECT id, case_number FROM cases WHERE id = ?', [caseId]);
    if (!caseRecord) {
      if (stagedFile.path && fs.existsSync(stagedFile.path)) {
        fs.unlinkSync(stagedFile.path);
      }
      res.status(404).json({ error: `Associated case ${caseId} does not exist.` });
      return;
    }

    // Commit staged file to private evidence vault
    const safeOriginalName = sanitizeFilename(stagedFile.originalname);
    const { storageKey, sha256, sizeBytes } = await commitStagedEvidence(
      stagedFile.path,
      safeOriginalName
    );

    const evidenceId = generateId('EV');
    const now = new Date().toISOString();
    const genesisPrevHash = '0000000000000000000000000000000000000000000000000000000000000000';

    // Genesis custody event payload
    const genesisPayload = {
      evidence_id: evidenceId,
      sequence_number: 1,
      event_type: 'EVIDENCE_UPLOAD',
      actor_id: req.user!.id,
      timestamp: now,
      action_details: {
        action: 'Initial evidentiary intake and secure staged deposit',
        original_filename: safeOriginalName,
        file_size_bytes: sizeBytes,
        original_sha256: sha256,
        case_number: caseRecord.case_number,
        item_number: itemNumber,
      }
    };

    const genesisEventHash = computeCustodyEventHash(genesisPayload, genesisPrevHash);
    const eventId = generateId('CEV');

    // Atomic transaction for evidence creation and genesis chain event
    transaction(() => {
      run(`
        INSERT INTO evidence (
          id, case_id, item_number, original_filename, file_size_bytes, mime_type,
          storage_key, original_sha256, evidence_type, current_custodian_id, uploader_id,
          upload_timestamp, status, notes, is_tampered_test_copy, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN_CUSTODY', ?, 0, ?)
      `, [
        evidenceId,
        caseId,
        itemNumber.trim(),
        safeOriginalName,
        sizeBytes,
        stagedFile?.mimetype || 'application/octet-stream',
        storageKey,
        sha256,
        evidenceType,
        req.user!.id,
        req.user!.id,
        now,
        notes || '',
        now
      ]);

      run(`
        INSERT INTO custody_events (
          id, evidence_id, sequence_number, event_type, actor_id, timestamp,
          previous_event_hash, event_hash, action_details, reason
        ) VALUES (?, ?, 1, 'EVIDENCE_UPLOAD', ?, ?, ?, ?, ?, ?)
      `, [
        eventId,
        evidenceId,
        req.user!.id,
        now,
        genesisPrevHash,
        genesisEventHash,
        JSON.stringify(genesisPayload.action_details),
        'Initial intake and cryptographic hashing into secure custody'
      ]);
    });

    // Store metadata in PostgreSQL
    try {
      await storeEvidenceMetadataInPostgres({
        id: evidenceId,
        case_id: caseId,
        item_number: itemNumber.trim(),
        original_filename: safeOriginalName,
        file_size_bytes: sizeBytes,
        mime_type: stagedFile?.mimetype || 'application/octet-stream',
        storage_key: storageKey,
        original_sha256: sha256,
        evidence_type: evidenceType,
        current_custodian_id: req.user!.id,
        uploader_id: req.user!.id,
        upload_timestamp: now,
        status: 'IN_CUSTODY',
        notes: notes || '',
        is_tampered_test_copy: 0,
        created_at: now
      });
    } catch (pgErr: any) {
      console.warn('[PostgreSQL] Metadata sync note:', pgErr.message);
    }

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'EVIDENCE_UPLOAD',
      'INFO',
      req.ip || '127.0.0.1',
      `Evidence item ${itemNumber} (${safeOriginalName}) secured in case ${caseRecord.case_number}. Genesis SHA-256: ${sha256}`
    );

    res.status(201).json({
      message: 'Evidence successfully committed to private storage and chain of custody initialized.',
      evidence: {
        id: evidenceId,
        itemNumber,
        originalFilename: safeOriginalName,
        originalSha256: sha256,
        fileSizeBytes: sizeBytes,
        storageKey,
        caseNumber: caseRecord.case_number,
        uploadTimestamp: now,
        genesisEventId: eventId,
        genesisEventHash,
      }
    });
  } catch (err: any) {
    if (stagedFile && stagedFile.path && fs.existsSync(stagedFile.path)) {
      try { fs.unlinkSync(stagedFile.path); } catch (e) {}
    }
    res.status(500).json({ error: `Upload validation failed: ${err.message}` });
  }
});

// Authorized raw download of evidence
router.get('/:id/download', requireAuth, requirePermission('EVIDENCE_DOWNLOAD'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = queryOne<any>('SELECT * FROM evidence WHERE id = ?', [id]);
    if (!item) {
      res.status(404).json({ error: 'Evidence item not found.' });
      return;
    }

    const filePath = getSafeEvidencePath(item.storage_key);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File payload is missing from private storage.' });
      return;
    }

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'EVIDENCE_DOWNLOAD',
      'INFO',
      req.ip || '127.0.0.1',
      `Authorized raw download of evidence item ${item.item_number} (${item.original_filename})`
    );

    res.setHeader('Content-Disposition', `attachment; filename="${item.original_filename}"`);
    res.setHeader('Content-Type', item.mime_type || 'application/octet-stream');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to stream evidence file.' });
  }
});

// AUDIT / DEMO HELPER: Simulate tampering with physical file on disk
router.post('/:id/tamper-test', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = queryOne<any>('SELECT * FROM evidence WHERE id = ?', [id]);
    if (!item) {
      res.status(404).json({ error: 'Evidence item not found.' });
      return;
    }

    const filePath = getSafeEvidencePath(item.storage_key);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Target file not found in storage.' });
      return;
    }

    // Save backup copy if not already saved
    const backupPath = filePath + '.original_backup';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
    }

    // Tamper by modifying bytes
    simulateTamperFile(item.storage_key, '\n[ALERT: UNAUTHORIZED BITSTREAM MODIFICATION AT SECTOR 0xDEADBEEF]');

    run('UPDATE evidence SET is_tampered_test_copy = 1 WHERE id = ?', [id]);

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'TAMPER_SIMULATION_EXECUTED',
      'WARNING',
      req.ip || '127.0.0.1',
      `Demonstration: Modified physical file bytes for evidence ${item.item_number}. Genesis hash remains trusted in database.`
    );

    res.json({
      message: 'File bytes deliberately altered on disk for audit demonstration.',
      evidenceId: id,
      itemNumber: item.item_number,
      trustedSha256: item.original_sha256,
      note: 'Run verification now to observe automatic FAIL detection and tamper report.'
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to simulate tampering: ${err.message}` });
  }
});

// AUDIT / DEMO HELPER: Restore file from backup
router.post('/:id/restore-test', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = queryOne<any>('SELECT * FROM evidence WHERE id = ?', [id]);
    if (!item) {
      res.status(404).json({ error: 'Evidence item not found.' });
      return;
    }

    const filePath = getSafeEvidencePath(item.storage_key);
    const backupPath = filePath + '.original_backup';

    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
    }

    run('UPDATE evidence SET is_tampered_test_copy = 0 WHERE id = ?', [id]);

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'TAMPER_RESTORATION',
      'INFO',
      req.ip || '127.0.0.1',
      `Restored original file bitstream for evidence ${item.item_number}.`
    );

    res.json({
      message: 'Original file bitstream restored successfully.',
      evidenceId: id
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to restore file: ${err.message}` });
  }
});

// AUDIT / DEMO HELPER: Simulate tampering with custody event record in DB
router.post('/:id/tamper-event-test', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sequenceNumber } = req.body;

    const event = queryOne<any>(
      'SELECT * FROM custody_events WHERE evidence_id = ? AND sequence_number = ?',
      [id, sequenceNumber || 1]
    );

    if (!event) {
      res.status(404).json({ error: 'Target custody event not found.' });
      return;
    }

    // Tamper with action_details JSON or event_hash
    const tamperedDetails = JSON.stringify({
      ...JSON.parse(event.action_details),
      tampered_entry: 'FORGED_RECORD_INJECTED_BY_ATTACKER',
      unauthorized_actor: 'UNKNOWN_ROOT_INTRUDER'
    });

    run('UPDATE custody_events SET action_details = ? WHERE id = ?', [tamperedDetails, event.id]);

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'EVENT_TAMPER_SIMULATION',
      'CRITICAL',
      req.ip || '127.0.0.1',
      `Demonstration: Tampered with custody event ${event.id} payload in database to test hash-chain break detection.`
    );

    res.json({
      message: `Custody event seq #${event.sequence_number} payload altered in database. Chain verification will now catch the broken hash link!`,
      eventId: event.id,
      sequenceNumber: event.sequence_number
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to tamper event: ${err.message}` });
  }
});

export default router;
