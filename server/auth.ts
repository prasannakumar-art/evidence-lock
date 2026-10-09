import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { query, queryOne, run } from './db.js';
import { generateId } from './crypto.js';

const SESSION_SECRET = process.env.SESSION_SECRET || 'evidencelock-super-secure-production-cryptographic-secret-2026';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface UserSession {
  id: string;
  username: string;
  email: string;
  full_name: string;
  badge_number: string | null;
  agency: string;
  role: 'ADMINISTRATOR' | 'INVESTIGATOR' | 'AUDITOR';
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
    }
  }
}

/**
 * Creates a signed session token: base64(payload) + '.' + hmac(payload)
 */
export function createSessionToken(userId: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = JSON.stringify({ userId, expiresAt, rand: crypto.randomBytes(8).toString('hex') });
  const b64 = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
  return `${b64}.${signature}`;
}

/**
 * Verifies session token and returns userId if valid.
 */
export function verifySessionToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [b64, signature] = parts;

    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const json = Buffer.from(b64, 'base64url').toString('utf8');
    const data = JSON.parse(json);
    if (!data.userId || !data.expiresAt) return null;
    if (Date.now() > data.expiresAt) return null;

    return data.userId;
  } catch (err) {
    return null;
  }
}

/**
 * Middleware: extracts token from Authorization header or cookie, loads user and permissions.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && req.cookies.evidencelock_session) {
      token = req.cookies.evidencelock_session;
    }

    if (!token) {
      return next();
    }

    const userId = verifySessionToken(token);
    if (!userId) {
      return next();
    }

    const user = queryOne<any>(
      'SELECT id, username, email, full_name, badge_number, agency, role, is_active FROM users WHERE id = ?',
      [userId]
    );

    if (!user || user.is_active !== 1) {
      return next();
    }

    // Get user's permissions via role
    const permRows = query<{ code: string }>(`
      SELECT p.code 
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN roles r ON rp.role_id = r.id
      WHERE r.name = ?
    `, [user.role]);

    const permissions = permRows.map(p => p.code);

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      badge_number: user.badge_number,
      agency: user.agency,
      role: user.role,
      permissions
    };

    next();
  } catch (err) {
    next();
  }
}

/**
 * Guard middleware: requires an authenticated session.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      error: 'Authentication Required',
      message: 'You must be logged in to access this forensic endpoint.'
    });
    return;
  }
  next();
}

/**
 * Guard middleware: requires specific role(s).
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      logAuditEvent(
        req.user.id,
        req.user.username,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'WARNING',
        req.ip || '127.0.0.1',
        `Access denied to role ${req.user.role} on route ${req.originalUrl}. Required: ${allowedRoles.join(', ')}`
      );
      res.status(403).json({
        error: 'Forbidden',
        message: `Action requires one of the following roles: ${allowedRoles.join(', ')}.`
      });
      return;
    }
    next();
  };
}

/**
 * Guard middleware: requires specific granular permission code.
 */
export function requirePermission(permissionCode: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    if (!req.user.permissions.includes(permissionCode) && req.user.role !== 'ADMINISTRATOR') {
      logAuditEvent(
        req.user.id,
        req.user.username,
        'UNAUTHORIZED_PERMISSION_ATTEMPT',
        'WARNING',
        req.ip || '127.0.0.1',
        `User missing required permission ${permissionCode} on route ${req.originalUrl}`
      );
      res.status(403).json({
        error: 'Forbidden',
        message: `Your role does not possess the ${permissionCode} permission.`
      });
      return;
    }
    next();
  };
}

/**
 * Records an immutable security audit event.
 */
export function logAuditEvent(
  actorId: string | null,
  actorUsername: string | null,
  eventType: string,
  severity: 'INFO' | 'WARNING' | 'CRITICAL',
  ipAddress: string,
  details: string
): void {
  try {
    const id = generateId('AUD-EVT');
    const timestamp = new Date().toISOString();
    run(`
      INSERT INTO security_audit_events (id, actor_id, actor_username, event_type, severity, ip_address, details, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, actorId, actorUsername, eventType, severity, ipAddress, details, timestamp]);
  } catch (err) {
    console.error('Failed to record security audit log:', err);
  }
}
