import base64
import hmac
import hashlib
import json
import time
from functools import wraps
from flask import request, jsonify, g
from .models import db, User, Permission, RolePermission, Role, SecurityAuditEvent
from .crypto import generate_id
from .config import Config

TOKEN_TTL_SECONDS = 24 * 3600

def create_session_token(user_id: str) -> str:
    payload = {
        'userId': user_id,
        'expiresAt': int(time.time()) + TOKEN_TTL_SECONDS,
        'rand': generate_id()
    }
    raw_json = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    b64 = base64.urlsafe_b64encode(raw_json).decode('ascii').rstrip('=')
    sig = hmac.new(Config.SECRET_KEY.encode('utf-8'), b64.encode('utf-8'), hashlib.sha256).hexdigest()
    return f"{b64}.{sig}"

def verify_session_token(token: str):
    try:
        parts = token.split('.')
        if len(parts) != 2:
            return None
        b64, sig = parts
        expected_sig = hmac.new(Config.SECRET_KEY.encode('utf-8'), b64.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None

        # Pad base64
        padded = b64 + '=' * (-len(b64) % 4)
        raw_json = base64.urlsafe_b64decode(padded).decode('utf-8')
        payload = json.loads(raw_json)

        if payload.get('expiresAt', 0) < time.time():
            return None
        return payload.get('userId')
    except Exception:
        return None

def log_audit_event(actor_id, actor_username, event_type, severity, ip_address, details):
    try:
        event = SecurityAuditEvent(
            id=generate_id('AUD-EVT'),
            actor_id=actor_id,
            actor_username=actor_username,
            event_type=event_type,
            severity=severity,
            ip_address=ip_address or '127.0.0.1',
            details=details,
            timestamp=datetime_now_iso()
        )
        db.session.add(event)
        db.session.commit()
    except Exception:
        db.session.rollback()

def datetime_now_iso():
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')

def authenticate_request():
    auth_header = request.headers.get('Authorization')
    token = None
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header[7:].strip()
    elif 'evidencelock_session' in request.cookies:
        token = request.cookies.get('evidencelock_session')

    if not token:
        g.current_user = None
        g.permissions = []
        return

    user_id = verify_session_token(token)
    if not user_id:
        g.current_user = None
        g.permissions = []
        return

    user = User.query.filter_by(id=user_id, is_active=1).first()
    if not user:
        g.current_user = None
        g.permissions = []
        return

    g.current_user = user

    # Query permissions
    perms = (
        db.session.query(Permission.code)
        .join(RolePermission, Permission.id == RolePermission.permission_id)
        .join(Role, RolePermission.role_id == Role.id)
        .filter(Role.name == user.role)
        .all()
    )
    g.permissions = [p[0] for p in perms]

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not getattr(g, 'current_user', None):
            return jsonify({'error': 'Authentication Required', 'message': 'You must be logged in.'}), 401
        return f(*args, **kwargs)
    return decorated

def require_role(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = getattr(g, 'current_user', None)
            if not user:
                return jsonify({'error': 'Authentication Required'}), 401
            if user.role not in roles:
                log_audit_event(
                    user.id, user.username, 'UNAUTHORIZED_ACCESS_ATTEMPT', 'WARNING',
                    request.remote_addr, f"Forbidden role {user.role} on {request.path}"
                )
                return jsonify({'error': 'Forbidden', 'message': f"Requires role in: {', '.join(roles)}"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

def require_permission(perm_code):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = getattr(g, 'current_user', None)
            if not user:
                return jsonify({'error': 'Authentication Required'}), 401
            if user.role != 'ADMINISTRATOR' and perm_code not in getattr(g, 'permissions', []):
                log_audit_event(
                    user.id, user.username, 'UNAUTHORIZED_PERMISSION_ATTEMPT', 'WARNING',
                    request.remote_addr, f"Missing permission {perm_code} on {request.path}"
                )
                return jsonify({'error': 'Forbidden', 'message': f"Missing permission: {perm_code}"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
