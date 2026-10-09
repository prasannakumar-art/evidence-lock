import { Router, Request, Response } from 'express';
import { requireAuth, requireRole, logAuditEvent } from '../auth.js';
import { query, queryOne, run } from '../db.js';
import { generateId } from '../crypto.js';

const router = Router();

// List all cases
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const cases = query<any>(`
      SELECT 
        c.*,
        u.full_name as lead_investigator_name,
        u.agency as lead_investigator_agency,
        (SELECT count(*) FROM evidence e WHERE e.case_id = c.id) as evidence_count,
        (SELECT count(*) FROM evidence e WHERE e.case_id = c.id AND e.status = 'IN_CUSTODY') as active_custody_count
      FROM cases c
      JOIN users u ON c.lead_investigator_id = u.id
      ORDER BY c.created_at DESC
    `);
    res.json({ cases });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve cases.' });
  }
});

// Get case details
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caseRecord = queryOne<any>(`
      SELECT 
        c.*,
        u.full_name as lead_investigator_name,
        u.badge_number as lead_investigator_badge,
        u.agency as lead_investigator_agency
      FROM cases c
      JOIN users u ON c.lead_investigator_id = u.id
      WHERE c.id = ?
    `, [id]);

    if (!caseRecord) {
      res.status(404).json({ error: 'Case not found.' });
      return;
    }

    const evidenceItems = query<any>(`
      SELECT 
        e.*,
        u_cust.full_name as current_custodian_name,
        (SELECT file_status FROM verification_runs vr WHERE vr.evidence_id = e.id ORDER BY timestamp DESC LIMIT 1) as last_verification_status
      FROM evidence e
      JOIN users u_cust ON e.current_custodian_id = u_cust.id
      WHERE e.case_id = ?
      ORDER BY e.created_at DESC
    `, [id]);

    res.json({ case: caseRecord, evidence: evidenceItems });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve case details.' });
  }
});

// Create new case
router.post('/', requireAuth, (req: Request, res: Response) => {
  try {
    const { caseNumber, title, description, jurisdiction, leadInvestigatorId } = req.body;

    if (!caseNumber || !title || !jurisdiction) {
      res.status(400).json({ error: 'caseNumber, title, and jurisdiction are required.' });
      return;
    }

    const existing = queryOne<any>('SELECT id FROM cases WHERE case_number = ?', [caseNumber.trim()]);
    if (existing) {
      res.status(409).json({ error: 'A case with this number already exists.' });
      return;
    }

    const caseId = generateId('CASE');
    const now = new Date().toISOString();
    const leadId = leadInvestigatorId || req.user!.id;

    run(`
      INSERT INTO cases (id, case_number, title, description, jurisdiction, status, lead_investigator_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)
    `, [caseId, caseNumber.trim(), title.trim(), description || '', jurisdiction.trim(), leadId, now, now]);

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'CASE_CREATED',
      'INFO',
      req.ip || '127.0.0.1',
      `New case docket opened: ${caseNumber} - ${title}`
    );

    res.status(201).json({
      message: 'Case successfully initialized.',
      case: { id: caseId, caseNumber: caseNumber.trim(), title: title.trim() }
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to create case: ${err.message}` });
  }
});

export default router;
