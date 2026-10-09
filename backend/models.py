import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Role(db.Model):
    __tablename__ = 'roles'
    id = db.Column(db.String(64), primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)
    description = db.Column(db.Text)

class Permission(db.Model):
    __tablename__ = 'permissions'
    id = db.Column(db.String(64), primary_key=True)
    code = db.Column(db.String(64), unique=True, nullable=False)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text)

class RolePermission(db.Model):
    __tablename__ = 'role_permissions'
    role_id = db.Column(db.String(64), db.ForeignKey('roles.id', ondelete='CASCADE'), primary_key=True)
    permission_id = db.Column(db.String(64), db.ForeignKey('permissions.id', ondelete='CASCADE'), primary_key=True)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.String(64), primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(128), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(128), nullable=False)
    badge_number = db.Column(db.String(64))
    agency = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(64), nullable=False, default='INVESTIGATOR')
    is_active = db.Column(db.Integer, nullable=False, default=1)
    created_at = db.Column(db.String(64), nullable=False)
    updated_at = db.Column(db.String(64), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'badge_number': self.badge_number,
            'agency': self.agency,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

class Case(db.Model):
    __tablename__ = 'cases'
    id = db.Column(db.String(64), primary_key=True)
    case_number = db.Column(db.String(64), unique=True, nullable=False, index=True)
    title = db.Column(db.String(256), nullable=False)
    description = db.Column(db.Text)
    jurisdiction = db.Column(db.String(128), nullable=False)
    status = db.Column(db.String(64), nullable=False, default='OPEN')
    lead_investigator_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.String(64), nullable=False)
    updated_at = db.Column(db.String(64), nullable=False)

    lead_investigator = db.relationship('User', foreign_keys=[lead_investigator_id])

class Evidence(db.Model):
    __tablename__ = 'evidence'
    id = db.Column(db.String(64), primary_key=True)
    case_id = db.Column(db.String(64), db.ForeignKey('cases.id'), nullable=False, index=True)
    item_number = db.Column(db.String(64), nullable=False)
    original_filename = db.Column(db.String(256), nullable=False)
    file_size_bytes = db.Column(db.BigInteger, nullable=False)
    mime_type = db.Column(db.String(128), nullable=False)
    storage_key = db.Column(db.String(256), unique=True, nullable=False)
    original_sha256 = db.Column(db.String(64), nullable=False, index=True)
    evidence_type = db.Column(db.String(64), nullable=False)
    current_custodian_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False)
    uploader_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False)
    upload_timestamp = db.Column(db.String(64), nullable=False)
    status = db.Column(db.String(64), nullable=False, default='IN_CUSTODY')
    notes = db.Column(db.Text)
    is_tampered_test_copy = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.String(64), nullable=False)

    case = db.relationship('Case', foreign_keys=[case_id])
    current_custodian = db.relationship('User', foreign_keys=[current_custodian_id])
    uploader = db.relationship('User', foreign_keys=[uploader_id])

class CustodyEvent(db.Model):
    __tablename__ = 'custody_events'
    id = db.Column(db.String(64), primary_key=True)
    evidence_id = db.Column(db.String(64), db.ForeignKey('evidence.id'), nullable=False, index=True)
    sequence_number = db.Column(db.Integer, nullable=False)
    event_type = db.Column(db.String(64), nullable=False)
    actor_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False)
    timestamp = db.Column(db.String(64), nullable=False)
    previous_event_hash = db.Column(db.String(64), nullable=False)
    event_hash = db.Column(db.String(64), nullable=False)
    action_details = db.Column(db.Text, nullable=False)
    reason = db.Column(db.Text)

    __table_args__ = (db.UniqueConstraint('evidence_id', 'sequence_number', name='uq_ev_seq'),)
    actor = db.relationship('User', foreign_keys=[actor_id])

class CustodyTransfer(db.Model):
    __tablename__ = 'custody_transfers'
    id = db.Column(db.String(64), primary_key=True)
    evidence_id = db.Column(db.String(64), db.ForeignKey('evidence.id'), nullable=False)
    from_user_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False)
    to_user_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(64), nullable=False, default='PENDING')
    requested_at = db.Column(db.String(64), nullable=False)
    resolved_at = db.Column(db.String(64))
    resolution_notes = db.Column(db.Text)
    expected_custodian_version = db.Column(db.Integer, nullable=False, default=1)

    from_user = db.relationship('User', foreign_keys=[from_user_id])
    to_user = db.relationship('User', foreign_keys=[to_user_id])
    evidence = db.relationship('Evidence', foreign_keys=[evidence_id])

class SignedCheckpoint(db.Model):
    __tablename__ = 'signed_checkpoints'
    id = db.Column(db.String(64), primary_key=True)
    checkpoint_number = db.Column(db.Integer, nullable=False)
    evidence_id = db.Column(db.String(64), db.ForeignKey('evidence.id'), nullable=True)
    chain_head_event_id = db.Column(db.String(64), nullable=False)
    chain_head_sequence = db.Column(db.Integer, nullable=False)
    chain_head_hash = db.Column(db.String(64), nullable=False)
    timestamp = db.Column(db.String(64), nullable=False)
    signer_actor_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False)
    key_id = db.Column(db.String(64), nullable=False)
    algorithm = db.Column(db.String(64), nullable=False, default='ECDSA-SHA256')
    public_key_pem = db.Column(db.Text, nullable=False)
    signature_hex = db.Column(db.Text, nullable=False)
    canonical_payload = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.String(64), nullable=False)

    signer = db.relationship('User', foreign_keys=[signer_actor_id])
    evidence = db.relationship('Evidence', foreign_keys=[evidence_id])

class VerificationRun(db.Model):
    __tablename__ = 'verification_runs'
    id = db.Column(db.String(64), primary_key=True)
    evidence_id = db.Column(db.String(64), db.ForeignKey('evidence.id'), nullable=False)
    verified_by_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False)
    timestamp = db.Column(db.String(64), nullable=False)
    file_status = db.Column(db.String(32), nullable=False)
    chain_status = db.Column(db.String(32), nullable=False)
    checkpoint_status = db.Column(db.String(32), nullable=False)
    overall_status = db.Column(db.String(32), nullable=False)
    trusted_sha256 = db.Column(db.String(64), nullable=False)
    calculated_sha256 = db.Column(db.String(64))
    findings = db.Column(db.Text, nullable=False)
    failure_type = db.Column(db.String(64), default='NONE')

    verified_by = db.relationship('User', foreign_keys=[verified_by_id])
    evidence = db.relationship('Evidence', foreign_keys=[evidence_id])

class SecurityAuditEvent(db.Model):
    __tablename__ = 'security_audit_events'
    id = db.Column(db.String(64), primary_key=True)
    actor_id = db.Column(db.String(64))
    actor_username = db.Column(db.String(64))
    event_type = db.Column(db.String(64), nullable=False)
    severity = db.Column(db.String(32), nullable=False)
    ip_address = db.Column(db.String(64))
    details = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.String(64), nullable=False)

class ForensicReport(db.Model):
    __tablename__ = 'reports'
    id = db.Column(db.String(64), primary_key=True)
    report_number = db.Column(db.String(64), unique=True, nullable=False)
    evidence_id = db.Column(db.String(64), db.ForeignKey('evidence.id'), nullable=False)
    verification_run_id = db.Column(db.String(64))
    generated_by_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False)
    report_type = db.Column(db.String(64), nullable=False)
    title = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.String(64), nullable=False)
    file_path = db.Column(db.String(256))

    generated_by = db.relationship('User', foreign_keys=[generated_by_id])
    evidence = db.relationship('Evidence', foreign_keys=[evidence_id])

class Notification(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(128), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(64), nullable=False)
    is_read = db.Column(db.Integer, nullable=False, default=0)
    link = db.Column(db.String(256))
    created_at = db.Column(db.String(64), nullable=False)

    user = db.relationship('User', foreign_keys=[user_id])
