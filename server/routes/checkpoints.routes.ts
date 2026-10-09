import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission, logAuditEvent } from '../auth.js';
import { query, queryOne, run } from '../db.js';
import {
  signCheckpointPayload,
  verifyCheckpointSignature,
  getPublicKeyPem,
  getKeyId,
  generateId,
} from '../crypto.js';

const router = Router();

// List signed checkpoints
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.query;
    let sql = `
      SELECT 
        sc.*,
        e.item_number,
        e.original_filename,
        u.full_name as signer_name,
        u.badge_number as signer_badge,
        u.agency as signer_agency
      FROM signed_checkpoints sc
      LEFT JOIN evidence e ON sc.evidence_id = e.id
      JOIN users u ON sc.signer_actor_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (evidenceId) {
      sql += ' AND sc.evidence_id = ?';
      params.push(evidenceId);
    }

    sql += ' ORDER BY sc.created_at DESC';

    const checkpoints = query(sql, params);
    res.json({ checkpoints });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve checkpoints.' });
  }
});

// Create new signed checkpoint over custody-chain head
router.post('/', requireAuth, requirePermission('CHECKPOINT_CREATE'), (req: Request, res: Response) => {
  try {
    const { evidenceId, jurisdictionNote } = req.body;

    if (!evidenceId) {
      res.status(400).json({ error: 'evidenceId is required.' });
      return;
    }

    const evidence = queryOne<any>('SELECT * FROM evidence WHERE id = ?', [evidenceId]);
    if (!evidence) {
      res.status(404).json({ error: 'Evidence item not found.' });
      return;
    }

    // Retrieve latest custody event (chain head)
    const headEvent = queryOne<any>(
      'SELECT * FROM custody_events WHERE evidence_id = ? ORDER BY sequence_number DESC LIMIT 1',
      [evidenceId]
    );

    if (!headEvent) {
      res.status(400).json({ error: 'Cannot create checkpoint: No custody events exist for this item.' });
      return;
    }

    const checkpointId = generateId('CHK');
    const now = new Date().toISOString();

    // Query count of existing checkpoints to assign sequential number
    const countRow = queryOne<any>('SELECT count(*) as count FROM signed_checkpoints WHERE evidence_id = ?', [evidenceId]);
    const checkpointNumber = (countRow ? countRow.count : 0) + 1;

    // Construct canonical payload for asymmetric digital signature
    const payload = {
      checkpoint_number: checkpointNumber,
      evidence_id: evidenceId,
      chain_head_event_id: headEvent.id,
      chain_head_sequence: headEvent.sequence_number,
      chain_head_hash: headEvent.event_hash,
      timestamp: now,
      signer_actor_id: req.user!.id,
      jurisdiction: jurisdictionNote || 'Federal Forensic Seal of Evidentiary Custody',
    };

    // Digitally sign with NIST P-256 ECDSA
    const signed = signCheckpointPayload(payload);

    run(`
      INSERT INTO signed_checkpoints (
        id, checkpoint_number, evidence_id, chain_head_event_id, chain_head_sequence,
        chain_head_hash, timestamp, signer_actor_id, key_id, algorithm,
        public_key_pem, signature_hex, canonical_payload, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      checkpointId,
      checkpointNumber,
      evidenceId,
      headEvent.id,
      headEvent.sequence_number,
      headEvent.event_hash,
      now,
      req.user!.id,
      signed.keyId,
      signed.algorithm,
      signed.publicKeyPem,
      signed.signatureHex,
      JSON.stringify(payload),
      now
    ]);

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'CHECKPOINT_CREATED',
      'INFO',
      req.ip || '127.0.0.1',
      `Asymmetric digital checkpoint #${checkpointNumber} sealed over chain head ${headEvent.sequence_number} (${headEvent.event_hash.substring(0, 16)}...) using key ${signed.keyId}`
    );

    res.status(201).json({
      message: 'Cryptographic checkpoint sealed and signed.',
      checkpoint: {
        id: checkpointId,
        checkpointNumber,
        evidenceId,
        chainHeadSequence: headEvent.sequence_number,
        chainHeadHash: headEvent.event_hash,
        keyId: signed.keyId,
        algorithm: signed.algorithm,
        signatureHex: signed.signatureHex,
        timestamp: now,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: `Checkpoint creation failed: ${err.message}` });
  }
});

// Verify cryptographic digital signature of checkpoint
router.post('/verify/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const checkpoint = queryOne<any>('SELECT * FROM signed_checkpoints WHERE id = ?', [id]);
    if (!checkpoint) {
      res.status(404).json({ error: 'Checkpoint record not found.' });
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(checkpoint.canonical_payload);
    } catch (e) {
      res.status(500).json({ error: 'Corrupt checkpoint payload structure.' });
      return;
    }

    // Verify cryptographic signature against public key
    const isSignatureValid = verifyCheckpointSignature(
      payload,
      checkpoint.signature_hex,
      checkpoint.public_key_pem
    );

    // Verify whether the chain head in the database matches the checkpoint's anchored head
    const eventInDb = queryOne<any>(
      'SELECT * FROM custody_events WHERE id = ? AND sequence_number = ?',
      [checkpoint.chain_head_event_id, checkpoint.chain_head_sequence]
    );

    const isChainHeadIntact = !!(eventInDb && eventInDb.event_hash === checkpoint.chain_head_hash);

    const overallValid = isSignatureValid && isChainHeadIntact;

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'CHECKPOINT_VERIFICATION',
      overallValid ? 'INFO' : 'CRITICAL',
      req.ip || '127.0.0.1',
      `Audited checkpoint ${checkpoint.id}: Signature=${isSignatureValid ? 'VALID' : 'INVALID'}, ChainHeadMatch=${isChainHeadIntact ? 'MATCH' : 'MISMATCH'}`
    );

    res.json({
      result: overallValid ? 'PASS' : 'FAIL',
      checkpointId: checkpoint.id,
      keyId: checkpoint.key_id,
      algorithm: checkpoint.algorithm,
      isSignatureValid,
      isChainHeadIntact,
      chainHeadHash: checkpoint.chain_head_hash,
      databaseEventHash: eventInDb ? eventInDb.event_hash : null,
      findings: overallValid
        ? 'NIST P-256 ECDSA digital signature is mathematically valid and matches the anchored custody chain head.'
        : (!isSignatureValid
          ? 'CRITICAL: Digital signature verification failed! The cryptographic signature does not verify against the public key.'
          : 'CRITICAL: Signature is valid, but the custody chain head in the database does not match the anchored checkpoint! History has been rewritten or truncated!'),
      verifiedAt: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: `Verification failed: ${err.message}` });
  }
});

// Export Public Verification Key
router.get('/public-key', (_req: Request, res: Response) => {
  const pem = getPublicKeyPem();
  const keyId = getKeyId();
  res.json({
    keyId,
    algorithm: 'ECDSA-SHA256 (NIST P-256 / secp256r1)',
    publicKeyPem: pem,
    disclaimer: 'The public key is published for independent verification. The corresponding private key is stored strictly within secure server-side storage and is never transmitted.'
  });
});

export default router;
