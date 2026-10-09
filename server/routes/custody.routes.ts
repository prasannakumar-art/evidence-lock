import { Router, Request, Response } from 'express';
import { requireAuth, requirePermission, logAuditEvent } from '../auth.js';
import { query, queryOne, run, transaction } from '../db.js';
import {
  computeCustodyEventHash,
  generateId,
  validateCustodyChain,
  GENESIS_PREV_HASH,
} from '../crypto.js';

const router = Router();

// Get custody timeline for an evidence item
router.get('/events/:evidenceId', requireAuth, (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.params;
    const events = query<any>(`
      SELECT 
        ce.*,
        u.full_name as actor_name,
        u.badge_number as actor_badge,
        u.agency as actor_agency,
        u.role as actor_role
      FROM custody_events ce
      JOIN users u ON ce.actor_id = u.id
      WHERE ce.evidence_id = ?
      ORDER BY ce.sequence_number ASC
    `, [evidenceId]);

    // Attach computed verification flag for each event on the fly
    let expectedPrevHash = GENESIS_PREV_HASH;
    let chainBroken = false;
    let breakReason = '';

    const enrichedEvents = events.map((ev, index) => {
      let isHashValid = true;
      let isLinkValid = true;

      // 1. Check sequence monotonicity
      if (ev.sequence_number !== index + 1) {
        chainBroken = true;
        breakReason = `Sequence broken: expected ${index + 1}, found ${ev.sequence_number}`;
      }

      // 2. Check previous hash link
      if (ev.previous_event_hash !== expectedPrevHash) {
        isLinkValid = false;
        chainBroken = true;
        breakReason = `Previous hash link mismatch at sequence ${ev.sequence_number}`;
      }

      // 3. Recompute hash from canonical payload
      let parsedDetails: any = {};
      try {
        parsedDetails = JSON.parse(ev.action_details);
      } catch (e) {
        parsedDetails = ev.action_details;
      }

      const payload = {
        evidence_id: ev.evidence_id,
        sequence_number: ev.sequence_number,
        event_type: ev.event_type,
        actor_id: ev.actor_id,
        timestamp: ev.timestamp,
        action_details: parsedDetails,
      };

      const calculatedHash = computeCustodyEventHash(payload, ev.previous_event_hash);
      if (calculatedHash !== ev.event_hash) {
        isHashValid = false;
        chainBroken = true;
        breakReason = `Event payload modified: computed ${calculatedHash.substring(0, 16)}... != stored ${ev.event_hash.substring(0, 16)}...`;
      }

      expectedPrevHash = ev.event_hash;

      return {
        ...ev,
        action_details_parsed: parsedDetails,
        isHashValid,
        isLinkValid,
      };
    });

    res.json({
      events: enrichedEvents,
      chainIntegrity: {
        isValid: !chainBroken,
        reason: breakReason || 'All sequential Merkle links and deterministic hashes match perfectly.',
        headHash: events.length > 0 ? events[events.length - 1].event_hash : null,
        totalEvents: events.length
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve custody timeline.' });
  }
});

// Comprehensive hash-chain verification endpoint
router.post('/verify-chain/:evidenceId', requireAuth, (req: Request, res: Response) => {
  try {
    const { evidenceId } = req.params;
    const events = query<any>(`
      SELECT * FROM custody_events 
      WHERE evidence_id = ? 
      ORDER BY sequence_number ASC
    `, [evidenceId]);

    if (events.length === 0) {
      res.status(404).json({
        result: 'INCONCLUSIVE',
        message: 'No custody events recorded for this evidence ID.'
      });
      return;
    }

    const chainValidation = validateCustodyChain(events);

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'CUSTODY_CHAIN_VERIFICATION',
      chainValidation.isValid ? 'INFO' : 'CRITICAL',
      req.ip || '127.0.0.1',
      `Custody chain verification for evidence ${evidenceId}: ${chainValidation.isValid ? 'PASSED (valid Merkle chain)' : 'FAILED (' + chainValidation.discrepancies.length + ' discrepancies)'}`
    );

    res.json({
      result: chainValidation.isValid ? 'PASS' : 'FAIL',
      eventCount: chainValidation.totalEvents,
      headSequence: chainValidation.headSequence,
      headHash: chainValidation.headHash,
      hasSequenceGap: chainValidation.hasSequenceGap,
      hasReorderedEvents: chainValidation.hasReorderedEvents,
      hasModifiedEvents: chainValidation.hasModifiedEvents,
      hasBrokenLinks: chainValidation.hasBrokenLinks,
      discrepancies: chainValidation.discrepancies,
      verificationTimestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: `Verification failed: ${err.message}` });
  }
});

// Request custody transfer
router.post('/transfers', requireAuth, requirePermission('CUSTODY_TRANSFER_REQUEST'), (req: Request, res: Response) => {
  try {
    const { evidenceId, toUserId, reason } = req.body;

    if (!evidenceId || !toUserId || !reason) {
      res.status(400).json({ error: 'evidenceId, toUserId, and reason are required.' });
      return;
    }

    const evidence = queryOne<any>('SELECT * FROM evidence WHERE id = ?', [evidenceId]);
    if (!evidence) {
      res.status(404).json({ error: 'Evidence item not found.' });
      return;
    }

    // Verify current user is custodian or admin
    if (evidence.current_custodian_id !== req.user!.id && req.user!.role !== 'ADMINISTRATOR') {
      res.status(403).json({ error: 'Only the current custodian or an administrator can initiate a custody transfer.' });
      return;
    }

    // Check if target user exists and is active
    const targetUser = queryOne<any>('SELECT id, full_name, is_active FROM users WHERE id = ?', [toUserId]);
    if (!targetUser || targetUser.is_active !== 1) {
      res.status(400).json({ error: 'Designated recipient user does not exist or is inactive.' });
      return;
    }

    if (evidence.current_custodian_id === toUserId) {
      res.status(400).json({ error: 'Target recipient is already the current custodian.' });
      return;
    }

    // Check if there is already a pending transfer
    const existingPending = queryOne<any>(
      "SELECT id FROM custody_transfers WHERE evidence_id = ? AND status = 'PENDING'",
      [evidenceId]
    );
    if (existingPending) {
      res.status(409).json({ error: 'A custody transfer is already pending for this item.' });
      return;
    }

    const transferId = generateId('TRF');
    const now = new Date().toISOString();

    // Query current head event
    const headEvent = queryOne<any>(
      'SELECT sequence_number, event_hash FROM custody_events WHERE evidence_id = ? ORDER BY sequence_number DESC LIMIT 1',
      [evidenceId]
    );
    const nextSeq = headEvent ? headEvent.sequence_number + 1 : 1;
    const prevHash = headEvent ? headEvent.event_hash : GENESIS_PREV_HASH;

    const eventPayload = {
      evidence_id: evidenceId,
      sequence_number: nextSeq,
      event_type: 'CUSTODY_TRANSFER_REQUEST',
      actor_id: req.user!.id,
      timestamp: now,
      action_details: {
        action: 'Formal custody transfer requested',
        from_user_id: req.user!.id,
        to_user_id: toUserId,
        recipient_name: targetUser.full_name,
        reason: reason.trim(),
      }
    };
    const eventHash = computeCustodyEventHash(eventPayload, prevHash);
    const eventId = generateId('CEV');

    transaction(() => {
      // 1. Create transfer record with expected version = current sequence number
      run(`
        INSERT INTO custody_transfers (
          id, evidence_id, from_user_id, to_user_id, reason, status, requested_at, expected_custodian_version
        ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)
      `, [transferId, evidenceId, req.user!.id, toUserId, reason.trim(), now, nextSeq]);

      // 2. Update evidence status to TRANSFER_PENDING
      run("UPDATE evidence SET status = 'TRANSFER_PENDING' WHERE id = ?", [evidenceId]);

      // 3. Log custody event
      run(`
        INSERT INTO custody_events (
          id, evidence_id, sequence_number, event_type, actor_id, timestamp,
          previous_event_hash, event_hash, action_details, reason
        ) VALUES (?, ?, ?, 'CUSTODY_TRANSFER_REQUEST', ?, ?, ?, ?, ?, ?)
      `, [
        eventId,
        evidenceId,
        nextSeq,
        req.user!.id,
        now,
        prevHash,
        eventHash,
        JSON.stringify(eventPayload.action_details),
        reason.trim()
      ]);

      // 4. Create notification for recipient
      run(`
        INSERT INTO notifications (id, user_id, title, message, type, is_read, link, created_at)
        VALUES (?, ?, 'Custody Transfer Request', ?, 'TRANSFER_REQUEST', 0, ?, ?)
      `, [
        generateId('NTF'),
        toUserId,
        `Special Agent ${req.user!.full_name} has requested to transfer custody of item ${evidence.item_number} to you.`,
        `/transfers`,
        now
      ]);
    });

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'CUSTODY_TRANSFER_REQUESTED',
      'INFO',
      req.ip || '127.0.0.1',
      `Custody transfer initiated for ${evidence.item_number} to ${targetUser.full_name}`
    );

    res.status(201).json({
      message: 'Custody transfer request recorded.',
      transferId,
      sequenceNumber: nextSeq,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Transfer request failed: ${err.message}` });
  }
});

// Accept custody transfer
router.post('/transfers/:id/accept', requireAuth, requirePermission('CUSTODY_TRANSFER_ACCEPT'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transfer = queryOne<any>('SELECT * FROM custody_transfers WHERE id = ?', [id]);
    if (!transfer) {
      res.status(404).json({ error: 'Transfer record not found.' });
      return;
    }

    if (transfer.status !== 'PENDING') {
      res.status(400).json({ error: `Cannot accept transfer in state '${transfer.status}'.` });
      return;
    }

    // Only intended recipient or admin can accept
    if (transfer.to_user_id !== req.user!.id && req.user!.role !== 'ADMINISTRATOR') {
      res.status(403).json({ error: 'Only the designated recipient investigator can accept this transfer.' });
      return;
    }

    const evidence = queryOne<any>('SELECT * FROM evidence WHERE id = ?', [transfer.evidence_id]);
    if (!evidence) {
      res.status(404).json({ error: 'Evidence record not found.' });
      return;
    }

    const now = new Date().toISOString();

    // Query current head event
    const headEvent = queryOne<any>(
      'SELECT sequence_number, event_hash FROM custody_events WHERE evidence_id = ? ORDER BY sequence_number DESC LIMIT 1',
      [transfer.evidence_id]
    );

    const nextSeq = headEvent.sequence_number + 1;
    const prevHash = headEvent.event_hash;

    const eventPayload = {
      evidence_id: transfer.evidence_id,
      sequence_number: nextSeq,
      event_type: 'CUSTODY_TRANSFER_ACCEPTED',
      actor_id: req.user!.id,
      timestamp: now,
      action_details: {
        action: 'Custody transfer formally accepted and verified',
        previous_custodian_id: transfer.from_user_id,
        new_custodian_id: req.user!.id,
        new_custodian_name: req.user!.full_name,
        transfer_id: id,
      }
    };
    const eventHash = computeCustodyEventHash(eventPayload, prevHash);
    const eventId = generateId('CEV');

    transaction(() => {
      // Concurrency protection: Verify transfer is still PENDING
      const currentStatus = queryOne<any>('SELECT status FROM custody_transfers WHERE id = ?', [id]);
      if (currentStatus.status !== 'PENDING') {
        throw new Error('Conflicting concurrent operation: Transfer status modified simultaneously.');
      }

      // Update transfer status
      run(`
        UPDATE custody_transfers 
        SET status = 'ACCEPTED', resolved_at = ?, resolution_notes = 'Accepted by authorized investigator'
        WHERE id = ?
      `, [now, id]);

      // Update evidence custodian and status
      run(`
        UPDATE evidence 
        SET current_custodian_id = ?, status = 'IN_CUSTODY'
        WHERE id = ?
      `, [req.user!.id, transfer.evidence_id]);

      // Append custody event
      run(`
        INSERT INTO custody_events (
          id, evidence_id, sequence_number, event_type, actor_id, timestamp,
          previous_event_hash, event_hash, action_details, reason
        ) VALUES (?, ?, ?, 'CUSTODY_TRANSFER_ACCEPTED', ?, ?, ?, ?, ?, ?)
      `, [
        eventId,
        transfer.evidence_id,
        nextSeq,
        req.user!.id,
        now,
        prevHash,
        eventHash,
        JSON.stringify(eventPayload.action_details),
        'Physical and digital custody accepted into custody registry'
      ]);

      // Notify previous custodian
      run(`
        INSERT INTO notifications (id, user_id, title, message, type, is_read, link, created_at)
        VALUES (?, ?, 'Custody Transfer Accepted', ?, 'INFO', 0, ?, ?)
      `, [
        generateId('NTF'),
        transfer.from_user_id,
        `${req.user!.full_name} accepted custody of item ${evidence.item_number}.`,
        `/evidence/${transfer.evidence_id}`,
        now
      ]);
    });

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'CUSTODY_TRANSFER_ACCEPTED',
      'INFO',
      req.ip || '127.0.0.1',
      `Custody of item ${evidence.item_number} transferred to ${req.user!.full_name}`
    );

    res.json({
      message: 'Custody successfully accepted and chain of custody updated.',
      evidenceId: transfer.evidence_id,
      newCustodianId: req.user!.id,
      sequenceNumber: nextSeq,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to accept transfer: ${err.message}` });
  }
});

// Reject custody transfer
router.post('/transfers/:id/reject', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const transfer = queryOne<any>('SELECT * FROM custody_transfers WHERE id = ?', [id]);
    if (!transfer) {
      res.status(404).json({ error: 'Transfer record not found.' });
      return;
    }

    if (transfer.status !== 'PENDING') {
      res.status(400).json({ error: `Cannot reject transfer in state '${transfer.status}'.` });
      return;
    }

    // Only intended recipient or initiator can reject/cancel
    if (transfer.to_user_id !== req.user!.id && transfer.from_user_id !== req.user!.id && req.user!.role !== 'ADMINISTRATOR') {
      res.status(403).json({ error: 'You are not authorized to reject this transfer.' });
      return;
    }

    const evidence = queryOne<any>('SELECT * FROM evidence WHERE id = ?', [transfer.evidence_id]);
    const now = new Date().toISOString();

    const headEvent = queryOne<any>(
      'SELECT sequence_number, event_hash FROM custody_events WHERE evidence_id = ? ORDER BY sequence_number DESC LIMIT 1',
      [transfer.evidence_id]
    );

    const nextSeq = headEvent.sequence_number + 1;
    const prevHash = headEvent.event_hash;

    const eventPayload = {
      evidence_id: transfer.evidence_id,
      sequence_number: nextSeq,
      event_type: 'CUSTODY_TRANSFER_REJECTED',
      actor_id: req.user!.id,
      timestamp: now,
      action_details: {
        action: 'Custody transfer rejected / cancelled',
        rejected_by: req.user!.full_name,
        reason: reason || 'Declined by recipient or cancelled by sender',
        transfer_id: id,
      }
    };
    const eventHash = computeCustodyEventHash(eventPayload, prevHash);
    const eventId = generateId('CEV');

    transaction(() => {
      run(`
        UPDATE custody_transfers 
        SET status = 'REJECTED', resolved_at = ?, resolution_notes = ?
        WHERE id = ?
      `, [now, reason || 'Declined', id]);

      // Revert evidence status to IN_CUSTODY
      run("UPDATE evidence SET status = 'IN_CUSTODY' WHERE id = ?", [transfer.evidence_id]);

      // Append custody event
      run(`
        INSERT INTO custody_events (
          id, evidence_id, sequence_number, event_type, actor_id, timestamp,
          previous_event_hash, event_hash, action_details, reason
        ) VALUES (?, ?, ?, 'CUSTODY_TRANSFER_REJECTED', ?, ?, ?, ?, ?, ?)
      `, [
        eventId,
        transfer.evidence_id,
        nextSeq,
        req.user!.id,
        now,
        prevHash,
        eventHash,
        JSON.stringify(eventPayload.action_details),
        reason || 'Transfer rejected'
      ]);
    });

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'CUSTODY_TRANSFER_REJECTED',
      'INFO',
      req.ip || '127.0.0.1',
      `Custody transfer for ${evidence.item_number} rejected by ${req.user!.full_name}`
    );

    res.json({ message: 'Custody transfer rejected.', transferId: id });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to reject transfer: ${err.message}` });
  }
});

// List transfers
router.get('/transfers', requireAuth, (req: Request, res: Response) => {
  try {
    const { status, evidenceId } = req.query;
    let sql = `
      SELECT 
        ct.*,
        e.item_number,
        e.original_filename,
        c.case_number,
        u_from.full_name as from_user_name,
        u_from.agency as from_user_agency,
        u_to.full_name as to_user_name,
        u_to.agency as to_user_agency
      FROM custody_transfers ct
      JOIN evidence e ON ct.evidence_id = e.id
      JOIN cases c ON e.case_id = c.id
      JOIN users u_from ON ct.from_user_id = u_from.id
      JOIN users u_to ON ct.to_user_id = u_to.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      sql += ' AND ct.status = ?';
      params.push(status);
    }
    if (evidenceId) {
      sql += ' AND ct.evidence_id = ?';
      params.push(evidenceId);
    }

    sql += ' ORDER BY ct.requested_at DESC';

    const transfers = query(sql, params);
    res.json({ transfers });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve transfers list.' });
  }
});

export default router;
