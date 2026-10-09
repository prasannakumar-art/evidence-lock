import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import { requireAuth, logAuditEvent } from '../auth.js';
import { query, queryOne, run, recordVerificationInPostgres } from '../db.js';
import {
  computeFileSha256,
  computeCustodyEventHash,
  verifyCheckpointSignature,
  validateCustodyChain,
  verifyCheckpointAgainstChain,
  generateId,
} from '../crypto.js';
import {
  getSafeEvidencePath,
  STAGING_DIR,
  MAX_FILE_SIZE_BYTES,
} from '../storage.js';

const router = Router();

const upload = multer({
  dest: STAGING_DIR,
  limits: { fileSize: MAX_FILE_SIZE_BYTES }
});

const GENESIS_PREV_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

// 1. Standalone File Integrity Verification (Reads bytes from private storage)
router.post('/file/:evidenceId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.params;
    const evidence = queryOne<any>('SELECT * FROM evidence WHERE id = ?', [evidenceId]);

    if (!evidence) {
      res.status(404).json({
        result: 'INCONCLUSIVE',
        failureType: 'NOT_FOUND',
        message: 'Evidence record not found in database registry.'
      });
      return;
    }

    const trustedSha256 = evidence.original_sha256;
    let filePath: string;

    try {
      filePath = getSafeEvidencePath(evidence.storage_key);
    } catch (err: any) {
      res.status(400).json({
        result: 'INCONCLUSIVE',
        failureType: 'SECURITY_ERROR',
        message: 'Path security validation failed: Storage key rejected.'
      });
      return;
    }

    // Check if file physically exists on private storage
    if (!fs.existsSync(filePath)) {
      const now = new Date().toISOString();
      const runId = generateId('VRUN');

      run(`
        INSERT INTO verification_runs (
          id, evidence_id, verified_by_id, timestamp, file_status, chain_status,
          checkpoint_status, overall_status, trusted_sha256, calculated_sha256, findings, failure_type
        ) VALUES (?, ?, ?, ?, 'FAIL', 'INCONCLUSIVE', 'INCONCLUSIVE', 'FAIL', ?, NULL, ?, 'MISSING_FILE')
      `, [
        runId,
        evidenceId,
        req.user!.id,
        now,
        trustedSha256,
        'File payload is missing from private storage. Possible storage volume disconnection or unauthorized file removal.'
      ]);

      logAuditEvent(
        req.user!.id,
        req.user!.username,
        'VERIFICATION_FAILED',
        'CRITICAL',
        req.ip || '127.0.0.1',
        `Verification FAIL for ${evidence.item_number}: Stored file payload is MISSING on disk.`
      );

      res.json({
        result: 'FAIL',
        failureType: 'MISSING_FILE',
        trustedSha256,
        calculatedSha256: null,
        findings: 'The underlying evidence bitstream file could not be located in private storage. This may indicate unmounted storage or file deletion.',
        explanation: 'Missing evidence represents a severe custody breach. Stored metadata exists, but byte verification cannot execute.',
        verifiedAt: now
      });
      return;
    }

    // Read bytes and calculate current SHA-256
    let calculatedSha256: string;
    try {
      calculatedSha256 = await computeFileSha256(filePath);
    } catch (err: any) {
      const now = new Date().toISOString();
      const runId = generateId('VRUN');

      run(`
        INSERT INTO verification_runs (
          id, evidence_id, verified_by_id, timestamp, file_status, chain_status,
          checkpoint_status, overall_status, trusted_sha256, calculated_sha256, findings, failure_type
        ) VALUES (?, ?, ?, ?, 'INCONCLUSIVE', 'INCONCLUSIVE', 'INCONCLUSIVE', 'INCONCLUSIVE', ?, NULL, ?, 'UNREADABLE_FILE')
      `, [
        runId,
        evidenceId,
        req.user!.id,
        now,
        trustedSha256,
        `I/O Error while reading file bitstream: ${err.message}`
      ]);

      logAuditEvent(
        req.user!.id,
        req.user!.username,
        'VERIFICATION_INCONCLUSIVE',
        'WARNING',
        req.ip || '127.0.0.1',
        `File verification INCONCLUSIVE for ${evidence.item_number}: Unreadable file payload (${err.message}).`
      );

      res.json({
        result: 'INCONCLUSIVE',
        failureType: 'UNREADABLE_FILE',
        trustedSha256,
        calculatedSha256: null,
        findings: `File could not be read: ${err.message}. Storage access restricted or unreadable bitstream.`,
        explanation: 'The evidence file exists in private storage, but its bytes could not be read due to file system permission restrictions (EACCES) or an I/O device error.',
        verifiedAt: now
      });
      return;
    }

    const matches = (calculatedSha256.toLowerCase() === trustedSha256.toLowerCase());
    const fileStatus = matches ? 'PASS' : 'FAIL';
    const failureType = matches ? 'NONE' : 'HASH_MISMATCH';
    const now = new Date().toISOString();

    const findings = matches
      ? 'Current bitstream SHA-256 matches trusted genesis hash bit-for-bit (zero deviations detected).'
      : `HASH MISMATCH: Calculated SHA-256 (${calculatedSha256}) differs from trusted genesis SHA-256 (${trustedSha256}). Stored bytes have changed.`;

    const explanation = matches
      ? 'Evidence bitstream integrity is intact. Cryptographic digest confirms no bits have been altered since initial ingestion.'
      : 'A hash mismatch indicates a difference in file content since intake. While this proves the file was modified, it indicates an integrity discrepancy and does not automatically prove malicious intent (e.g. disk corruption, conversion error, or unauthorized edit).';

    const runId = generateId('VRUN');
    run(`
      INSERT INTO verification_runs (
        id, evidence_id, verified_by_id, timestamp, file_status, chain_status,
        checkpoint_status, overall_status, trusted_sha256, calculated_sha256, findings, failure_type
      ) VALUES (?, ?, ?, ?, ?, 'INCONCLUSIVE', 'INCONCLUSIVE', ?, ?, ?, ?, ?)
    `, [
      runId,
      evidenceId,
      req.user!.id,
      now,
      fileStatus,
      fileStatus,
      trustedSha256,
      calculatedSha256,
      findings,
      failureType
    ]);

    try {
      await recordVerificationInPostgres({
        id: runId,
        evidence_id: evidenceId,
        verified_by_id: req.user!.id,
        timestamp: now,
        file_status: fileStatus,
        chain_status: 'INCONCLUSIVE',
        checkpoint_status: 'INCONCLUSIVE',
        overall_status: fileStatus,
        trusted_sha256: trustedSha256,
        calculated_sha256: calculatedSha256,
        findings,
        failure_type: failureType
      });
    } catch (pgErr: any) {
      console.warn('[PostgreSQL] Verification sync note:', pgErr.message);
    }

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      matches ? 'VERIFICATION_PASSED' : 'VERIFICATION_FAILED',
      matches ? 'INFO' : 'CRITICAL',
      req.ip || '127.0.0.1',
      `File verification ${fileStatus} for item ${evidence.item_number}. Calculated: ${calculatedSha256.substring(0, 16)}...`
    );

    res.json({
      result: fileStatus,
      failureType,
      trustedSha256,
      calculatedSha256,
      findings,
      explanation,
      verifiedAt: now
    });
  } catch (err: any) {
    res.status(500).json({
      result: 'INCONCLUSIVE',
      failureType: 'INTERNAL_ERROR',
      message: `Verification engine error: ${err.message}`
    });
  }
});

// 2. Full 3-Tier Forensic Verification (File SHA-256 + Merkle Custody Chain + Signed Checkpoint)
router.post('/full/:evidenceId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.params;
    const evidence = queryOne<any>('SELECT * FROM evidence WHERE id = ?', [evidenceId]);

    if (!evidence) {
      res.status(404).json({ error: 'Evidence record not found.' });
      return;
    }

    const now = new Date().toISOString();
    const trustedSha256 = evidence.original_sha256;

    // --- Tier 1: File Integrity ---
    let fileStatus: 'PASS' | 'FAIL' | 'INCONCLUSIVE' = 'PASS';
    let calculatedSha256: string | null = null;
    let fileFailureType = 'NONE';
    let fileFindings = '';

    try {
      const filePath = getSafeEvidencePath(evidence.storage_key);
      if (!fs.existsSync(filePath)) {
        fileStatus = 'FAIL';
        fileFailureType = 'MISSING_FILE';
        fileFindings = 'Evidence file payload missing from private storage.';
      } else {
        calculatedSha256 = await computeFileSha256(filePath);
        if (calculatedSha256.toLowerCase() === trustedSha256.toLowerCase()) {
          fileStatus = 'PASS';
          fileFindings = 'Bitstream matches trusted genesis SHA-256 perfectly.';
        } else {
          fileStatus = 'FAIL';
          fileFailureType = 'HASH_MISMATCH';
          fileFindings = `Byte mismatch detected: Computed ${calculatedSha256} does not match ${trustedSha256}.`;
        }
      }
    } catch (e: any) {
      fileStatus = 'INCONCLUSIVE';
      fileFailureType = 'UNREADABLE_FILE';
      fileFindings = `File read error: ${e.message}`;
    }

    // --- Tier 2: Custody Chain Integrity ---
    const events = query<any>(
      'SELECT * FROM custody_events WHERE evidence_id = ? ORDER BY sequence_number ASC',
      [evidenceId]
    );

    let chainStatus: 'PASS' | 'FAIL' | 'INCONCLUSIVE' = 'PASS';
    let chainDiscrepancies: string[] = [];
    const chainValidation = validateCustodyChain(events);

    if (events.length === 0) {
      chainStatus = 'INCONCLUSIVE';
      chainDiscrepancies.push('No custody events exist for this item.');
    } else {
      chainStatus = chainValidation.isValid ? 'PASS' : 'FAIL';
      chainDiscrepancies = chainValidation.discrepancies;
    }

    // --- Tier 3: Signed Checkpoint Integrity ---
    const checkpoints = query<any>(
      'SELECT * FROM signed_checkpoints WHERE evidence_id = ? ORDER BY checkpoint_number DESC',
      [evidenceId]
    );

    let checkpointStatus: 'PASS' | 'FAIL' | 'INCONCLUSIVE' = 'INCONCLUSIVE';
    let checkpointFindings = '';

    if (checkpoints.length === 0) {
      checkpointStatus = 'INCONCLUSIVE';
      checkpointFindings = 'No signed cryptographic checkpoints created yet for this evidence head.';
    } else {
      let allCheckpointsValid = true;
      const checkpointIssues: string[] = [];

      for (const chk of checkpoints) {
        const chkEval = verifyCheckpointAgainstChain(chk, chainValidation);
        if (!chkEval.isValid) {
          allCheckpointsValid = false;
          checkpointIssues.push(...chkEval.discrepancies);
        }
      }

      if (!allCheckpointsValid) {
        checkpointStatus = 'FAIL';
        checkpointFindings = checkpointIssues.join('; ');
      } else {
        checkpointStatus = 'PASS';
        checkpointFindings = `All ${checkpoints.length} signed checkpoints verified mathematically with valid NIST P-256 ECDSA signatures.`;
      }
    }

    // Overall Status
    let overallStatus: 'PASS' | 'FAIL' | 'INCONCLUSIVE' = 'PASS';
    if (fileStatus === 'FAIL' || chainStatus === 'FAIL' || checkpointStatus === 'FAIL') {
      overallStatus = 'FAIL';
    } else if (fileStatus === 'INCONCLUSIVE' || chainStatus === 'INCONCLUSIVE') {
      overallStatus = 'INCONCLUSIVE';
    }

    const runId = generateId('VRUN');
    const combinedFindings = [
      `Tier 1 (File Integrity): ${fileFindings}`,
      `Tier 2 (Custody Merkle Chain): ${chainStatus === 'PASS' ? 'Intact (' + events.length + ' events)' : chainDiscrepancies.join('; ')}`,
      `Tier 3 (Cryptographic Checkpoint): ${checkpointFindings}`,
    ].join('\n');

    // Save verification run in database
    run(`
      INSERT INTO verification_runs (
        id, evidence_id, verified_by_id, timestamp, file_status, chain_status,
        checkpoint_status, overall_status, trusted_sha256, calculated_sha256, findings, failure_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      runId,
      evidenceId,
      req.user!.id,
      now,
      fileStatus,
      chainStatus,
      checkpointStatus,
      overallStatus,
      trustedSha256,
      calculatedSha256,
      combinedFindings,
      fileFailureType !== 'NONE' ? fileFailureType : (chainStatus === 'FAIL' ? 'BROKEN_CHAIN_LINK' : 'NONE')
    ]);

    // Also record a custody event for this verification run!
    const headEvent = events[events.length - 1];
    if (headEvent) {
      const nextSeq = headEvent.sequence_number + 1;
      const vEventPayload = {
        evidence_id: evidenceId,
        sequence_number: nextSeq,
        event_type: 'VERIFICATION_RUN',
        actor_id: req.user!.id,
        timestamp: now,
        action_details: {
          verification_run_id: runId,
          overall_status: overallStatus,
          file_status: fileStatus,
          chain_status: chainStatus,
          checkpoint_status: checkpointStatus,
          calculated_sha256: calculatedSha256,
        }
      };
      const vEventHash = computeCustodyEventHash(vEventPayload, headEvent.event_hash);
      run(`
        INSERT INTO custody_events (
          id, evidence_id, sequence_number, event_type, actor_id, timestamp,
          previous_event_hash, event_hash, action_details, reason
        ) VALUES (?, ?, ?, 'VERIFICATION_RUN', ?, ?, ?, ?, ?, ?)
      `, [
        generateId('CEV'),
        evidenceId,
        nextSeq,
        req.user!.id,
        now,
        headEvent.event_hash,
        vEventHash,
        JSON.stringify(vEventPayload.action_details),
        `Automated comprehensive 3-tier integrity audit (${overallStatus})`
      ]);
    }

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      overallStatus === 'PASS' ? 'FULL_AUDIT_PASSED' : 'FULL_AUDIT_ALERT',
      overallStatus === 'PASS' ? 'INFO' : 'CRITICAL',
      req.ip || '127.0.0.1',
      `Full 3-tier verification run ${runId} completed for ${evidence.item_number}: Overall=${overallStatus}`
    );

    res.json({
      verificationRunId: runId,
      evidenceId,
      overallStatus,
      tier1_file: {
        status: fileStatus,
        trustedSha256,
        calculatedSha256,
        failureType: fileFailureType,
        findings: fileFindings,
      },
      tier2_chain: {
        status: chainStatus,
        eventCount: events.length,
        discrepancies: chainDiscrepancies,
      },
      tier3_checkpoint: {
        status: checkpointStatus,
        checkpointCount: checkpoints.length,
        findings: checkpointFindings,
      },
      timestamp: now,
      disclaimer: 'Notice: A passing hash and signature confirms bitstream authenticity and chain continuity relative to intake. It does not certify external legal admissibility or veracity of pre-acquisition states.'
    });
  } catch (err: any) {
    res.status(500).json({ error: `Verification audit failed: ${err.message}` });
  }
});

// 3. Verify Candidate File from User Desktop against Database
router.post('/external', requireAuth, upload.single('candidateFile'), async (req: Request, res: Response) => {
  let tempFile = req.file;
  try {
    if (!tempFile) {
      res.status(400).json({ error: 'No candidate file received.' });
      return;
    }

    const { targetEvidenceId } = req.body;
    const computedHash = await computeFileSha256(tempFile.path);

    // Clean up temporary file
    fs.unlinkSync(tempFile.path);

    let targetEvidence: any = null;
    let matchFound = false;

    if (targetEvidenceId) {
      targetEvidence = queryOne<any>('SELECT * FROM evidence WHERE id = ?', [targetEvidenceId]);
      if (targetEvidence) {
        matchFound = (targetEvidence.original_sha256.toLowerCase() === computedHash.toLowerCase());
      }
    } else {
      // Search entire database for this hash
      targetEvidence = queryOne<any>('SELECT * FROM evidence WHERE lower(original_sha256) = ?', [computedHash.toLowerCase()]);
      matchFound = !!targetEvidence;
    }

    res.json({
      candidateSha256: computedHash,
      matchesTarget: matchFound,
      matchedEvidence: targetEvidence ? {
        id: targetEvidence.id,
        itemNumber: targetEvidence.item_number,
        originalFilename: targetEvidence.original_filename,
        caseId: targetEvidence.case_id,
        uploadTimestamp: targetEvidence.upload_timestamp,
        trustedSha256: targetEvidence.original_sha256,
      } : null,
      message: matchFound
        ? 'SUCCESS: Candidate file matches registered evidence item perfectly bit-for-bit.'
        : 'NO MATCH: Candidate file SHA-256 does not match the target evidence item or registered repository records.'
    });
  } catch (err: any) {
    if (tempFile && fs.existsSync(tempFile.path)) {
      try { fs.unlinkSync(tempFile.path); } catch (e) {}
    }
    res.status(500).json({ error: `Candidate verification failed: ${err.message}` });
  }
});

// Verification history
router.get('/history/:evidenceId', requireAuth, (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.params;
    const history = query<any>(`
      SELECT 
        vr.*,
        u.full_name as verified_by_name,
        u.agency as verified_by_agency,
        u.role as verified_by_role
      FROM verification_runs vr
      JOIN users u ON vr.verified_by_id = u.id
      WHERE vr.evidence_id = ?
      ORDER BY vr.timestamp DESC
    `, [evidenceId]);

    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve verification history.' });
  }
});

export default router;
