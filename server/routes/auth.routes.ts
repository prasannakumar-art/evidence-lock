import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, run } from '../db.js';
import { createSessionToken, logAuditEvent } from '../auth.js';
import { generateId, hashPassword } from '../crypto.js';

const router = Router();

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const user = queryOne<any>(
      'SELECT id, username, email, password_hash, full_name, badge_number, agency, role, is_active FROM users WHERE username = ? OR email = ?',
      [username.trim(), username.trim()]
    );

    if (!user) {
      logAuditEvent(null, username, 'LOGIN_FAILED', 'WARNING', req.ip || '127.0.0.1', 'Invalid credentials: user not found');
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    if (user.is_active !== 1) {
      logAuditEvent(user.id, user.username, 'LOGIN_FAILED', 'WARNING', req.ip || '127.0.0.1', 'Attempted login to deactivated account');
      res.status(403).json({ error: 'This forensic account has been suspended or deactivated.' });
      return;
    }

    const matches = await bcrypt.compare(password, user.password_hash);
    if (!matches) {
      logAuditEvent(user.id, user.username, 'LOGIN_FAILED', 'WARNING', req.ip || '127.0.0.1', 'Invalid credentials: password mismatch');
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const token = createSessionToken(user.id);
    res.cookie('evidencelock_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    // Query permissions
    const permRows = query<{ code: string }>(`
      SELECT p.code 
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN roles r ON rp.role_id = r.id
      WHERE r.name = ?
    `, [user.role]);

    logAuditEvent(user.id, user.username, 'USER_LOGIN', 'INFO', req.ip || '127.0.0.1', `Investigator session created for ${user.full_name} (${user.role})`);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        badge_number: user.badge_number,
        agency: user.agency,
        role: user.role,
        permissions: permRows.map(p => p.code),
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Authentication service encountered an unexpected condition.' });
  }
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  if (req.user) {
    logAuditEvent(req.user.id, req.user.username, 'USER_LOGOUT', 'INFO', req.ip || '127.0.0.1', 'User session terminated cleanly.');
  }
  res.clearCookie('evidencelock_session');
  res.json({ message: 'Session terminated successfully.' });
});

// Current user info
router.get('/me', (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ user: null });
    return;
  }
  res.json({ user: req.user });
});

// Demo accounts for quick evaluation of roles
router.get('/demo-accounts', (req: Request, res: Response) => {
  const users = query<any>(
    'SELECT id, username, full_name, badge_number, agency, role FROM users WHERE is_active = 1 ORDER BY role ASC'
  );
  res.json({ demoAccounts: users });
});

// Quick switch demo user (facilitates testing without retyping credentials)
router.post('/switch-demo-user', (req: Request, res: Response) => {
  const { username } = req.body;
  const user = queryOne<any>(
    'SELECT id, username, email, full_name, badge_number, agency, role, is_active FROM users WHERE username = ?',
    [username]
  );
  if (!user || user.is_active !== 1) {
    res.status(404).json({ error: 'Demo account not found.' });
    return;
  }

  const token = createSessionToken(user.id);
  res.cookie('evidencelock_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  const permRows = query<{ code: string }>(`
    SELECT p.code 
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    JOIN roles r ON rp.role_id = r.id
    WHERE r.name = ?
  `, [user.role]);

  logAuditEvent(user.id, user.username, 'DEMO_USER_SWITCH', 'INFO', req.ip || '127.0.0.1', `Switched active context to demo user ${user.username}`);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      badge_number: user.badge_number,
      agency: user.agency,
      role: user.role,
      permissions: permRows.map(p => p.code),
    }
  });
});

export default router;
