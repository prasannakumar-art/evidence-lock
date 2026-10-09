import { Router, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth, requireRole, requirePermission, logAuditEvent } from '../auth.js';
import { query, queryOne, run } from '../db.js';
import { getKeyId, getPublicKeyPem, hashPassword, generateId } from '../crypto.js';
import { EVIDENCE_DIR, STAGING_DIR } from '../storage.js';

const router = Router();

// Dashboard aggregated stats
router.get('/dashboard/stats', requireAuth, (req: Request, res: Response) => {
  try {
    const totalEvidence = queryOne<any>('SELECT count(*) as count FROM evidence');
    const totalCases = queryOne<any>('SELECT count(*) as count FROM cases');
    const pendingTransfers = queryOne<any>("SELECT count(*) as count FROM custody_transfers WHERE status = 'PENDING'");
    
    // Total passing vs failing verification
    const passCount = queryOne<any>(`
      SELECT count(*) as count FROM (
        SELECT evidence_id, file_status FROM verification_runs vr1
        WHERE vr1.timestamp = (SELECT max(timestamp) FROM verification_runs vr2 WHERE vr2.evidence_id = vr1.evidence_id)
        AND vr1.file_status = 'PASS'
      )
    `);

    const failCount = queryOne<any>(`
      SELECT count(*) as count FROM (
        SELECT evidence_id, file_status FROM verification_runs vr1
        WHERE vr1.timestamp = (SELECT max(timestamp) FROM verification_runs vr2 WHERE vr2.evidence_id = vr1.evidence_id)
        AND vr1.file_status = 'FAIL'
      )
    `);

    const recentEvents = query<any>(`
      SELECT 
        ce.*,
        e.item_number,
        u.full_name as actor_name
      FROM custody_events ce
      JOIN evidence e ON ce.evidence_id = e.id
      JOIN users u ON ce.actor_id = u.id
      ORDER BY ce.timestamp DESC
      LIMIT 8
    `);

    const recentAlerts = query<any>(`
      SELECT * FROM security_audit_events
      WHERE severity IN ('WARNING', 'CRITICAL')
      ORDER BY timestamp DESC
      LIMIT 6
    `);

    const unreadNotifications = queryOne<any>(
      'SELECT count(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user!.id]
    );

    res.json({
      totalEvidence: totalEvidence?.count || 0,
      totalCases: totalCases?.count || 0,
      pendingTransfers: pendingTransfers?.count || 0,
      passingIntegrityCount: passCount?.count || 0,
      failingIntegrityCount: failCount?.count || 0,
      unreadNotificationsCount: unreadNotifications?.count || 0,
      recentEvents,
      recentAlerts,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load dashboard metrics.' });
  }
});

// User management: List all users
router.get('/users', requireAuth, (req: Request, res: Response) => {
  try {
    const users = query<any>(`
      SELECT id, username, email, full_name, badge_number, agency, role, is_active, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `);
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve users.' });
  }
});

// User management: Create new user
router.post('/users', requireAuth, requireRole('ADMINISTRATOR'), async (req: Request, res: Response) => {
  try {
    const { username, email, password, fullName, badgeNumber, agency, role } = req.body;
    if (!username || !email || !password || !fullName || !agency || !role) {
      res.status(400).json({ error: 'Missing mandatory user fields.' });
      return;
    }

    const existing = queryOne<any>('SELECT id FROM users WHERE username = ? OR email = ?', [username.trim(), email.trim()]);
    if (existing) {
      res.status(409).json({ error: 'Username or email is already registered.' });
      return;
    }

    const userId = generateId('USR');
    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    run(`
      INSERT INTO users (id, username, email, password_hash, full_name, badge_number, agency, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [userId, username.trim(), email.trim(), passwordHash, fullName.trim(), badgeNumber || '', agency.trim(), role, now, now]);

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'USER_CREATED',
      'INFO',
      req.ip || '127.0.0.1',
      `Provisioned new ${role} account: ${username} (${fullName})`
    );

    res.status(201).json({
      message: 'User provisioned successfully.',
      user: { id: userId, username, email, fullName, role }
    });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to create user: ${err.message}` });
  }
});

// User management: Update status or role
router.patch('/users/:id', requireAuth, requireRole('ADMINISTRATOR'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive, role, agency, badgeNumber, fullName } = req.body;

    const user = queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (id === req.user!.id && isActive === false) {
      res.status(400).json({ error: 'Administrators cannot deactivate their own session.' });
      return;
    }

    const newActive = (isActive !== undefined) ? (isActive ? 1 : 0) : user.is_active;
    const newRole = role || user.role;
    const newAgency = agency !== undefined ? agency : user.agency;
    const newBadge = badgeNumber !== undefined ? badgeNumber : user.badge_number;
    const newName = fullName !== undefined ? fullName : user.full_name;
    const now = new Date().toISOString();

    run(`
      UPDATE users 
      SET is_active = ?, role = ?, agency = ?, badge_number = ?, full_name = ?, updated_at = ?
      WHERE id = ?
    `, [newActive, newRole, newAgency, newBadge, newName, now, id]);

    logAuditEvent(
      req.user!.id,
      req.user!.username,
      'USER_UPDATED',
      'INFO',
      req.ip || '127.0.0.1',
      `Admin updated account ${user.username}: active=${newActive}, role=${newRole}`
    );

    res.json({ message: 'User record updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// Roles and permissions management
router.get('/roles', requireAuth, (req: Request, res: Response) => {
  try {
    const roles = query<any>('SELECT * FROM roles');
    const permissions = query<any>('SELECT * FROM permissions');
    const rolePerms = query<any>(`
      SELECT rp.role_id, p.code, p.name 
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
    `);

    const result = roles.map(r => ({
      ...r,
      permissions: rolePerms.filter(rp => rp.role_id === r.id).map(rp => rp.code)
    }));

    res.json({ roles: result, allPermissions: permissions });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve roles.' });
  }
});

// Audit logs
router.get('/audit-logs', requireAuth, requirePermission('AUDIT_LOG_VIEW'), (req: Request, res: Response) => {
  try {
    const { severity, eventType, search, limit = 100 } = req.query;
    let sql = 'SELECT * FROM security_audit_events WHERE 1=1';
    const params: any[] = [];

    if (severity) {
      sql += ' AND severity = ?';
      params.push(severity);
    }
    if (eventType) {
      sql += ' AND event_type = ?';
      params.push(eventType);
    }
    if (search) {
      sql += ' AND (details LIKE ? OR actor_username LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(Number(limit));

    const logs = query(sql, params);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve security audit logs.' });
  }
});

// Storage and System Health
router.get('/system-health', requireAuth, (req: Request, res: Response) => {
  try {
    let evidenceDirBytes = 0;
    let evidenceFileCount = 0;
    if (fs.existsSync(EVIDENCE_DIR)) {
      const files = fs.readdirSync(EVIDENCE_DIR);
      evidenceFileCount = files.length;
      for (const f of files) {
        try {
          const st = fs.statSync(path.join(EVIDENCE_DIR, f));
          evidenceDirBytes += st.size;
        } catch (e) {}
      }
    }

    let stagingDirBytes = 0;
    let stagingFileCount = 0;
    if (fs.existsSync(STAGING_DIR)) {
      const sFiles = fs.readdirSync(STAGING_DIR);
      stagingFileCount = sFiles.length;
      for (const f of sFiles) {
        try {
          const st = fs.statSync(path.join(STAGING_DIR, f));
          stagingDirBytes += st.size;
        } catch (e) {}
      }
    }

    const dbPath = path.resolve(process.cwd(), 'data', 'evidencelock.sqlite');
    let dbSizeBytes = 0;
    if (fs.existsSync(dbPath)) {
      dbSizeBytes = fs.statSync(dbPath).size;
    }

    const keyId = getKeyId();
    const hasPrivateKey = fs.existsSync(path.resolve(process.cwd(), 'keys', 'signing_private_key.pem'));
    const hasPublicKey = fs.existsSync(path.resolve(process.cwd(), 'keys', 'signing_public_key.pem'));

    res.json({
      status: 'OPERATIONAL',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      storage: {
        evidenceVault: {
          path: '/storage/evidence',
          fileCount: evidenceFileCount,
          totalSizeBytes: evidenceDirBytes,
          formattedSize: `${(evidenceDirBytes / (1024 * 1024)).toFixed(2)} MB`
        },
        stagingArea: {
          path: '/storage/staging',
          fileCount: stagingFileCount,
          totalSizeBytes: stagingDirBytes,
          formattedSize: `${(stagingDirBytes / 1024).toFixed(2)} KB`
        },
        database: {
          engine: 'SQLite Relational WAL Engine',
          sizeBytes: dbSizeBytes,
          formattedSize: `${(dbSizeBytes / (1024 * 1024)).toFixed(2)} MB`,
        }
      },
      cryptography: {
        signingAlgorithm: 'ECDSA-SHA256 (NIST P-256 / secp256r1)',
        activeKeyId: keyId,
        privateKeySecured: hasPrivateKey,
        publicKeyAccessible: hasPublicKey,
        hashingEngine: 'SHA-256 (FIPS 180-4 chunked)',
      },
      memory: process.memoryUsage(),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to inspect system health.' });
  }
});

// Notifications
router.get('/notifications', requireAuth, (req: Request, res: Response) => {
  try {
    const notifications = query<any>(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user!.id]
    );
    res.json({ notifications });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve notifications.' });
  }
});

router.post('/notifications/:id/read', requireAuth, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.user!.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

export default router;
