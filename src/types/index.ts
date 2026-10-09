export type UserRole = 'ADMINISTRATOR' | 'INVESTIGATOR' | 'AUDITOR';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  badge_number: string | null;
  agency: string;
  role: UserRole;
  is_active: number;
  created_at: string;
  updated_at: string;
  permissions?: string[];
}

export interface Case {
  id: string;
  case_number: string;
  title: string;
  description: string;
  jurisdiction: string;
  status: 'OPEN' | 'PENDING_REVIEW' | 'ARCHIVED' | 'CLOSED';
  lead_investigator_id: string;
  lead_investigator_name?: string;
  lead_investigator_agency?: string;
  evidence_count?: number;
  active_custody_count?: number;
  created_at: string;
  updated_at: string;
}

export type EvidenceType = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'FORENSIC_IMAGE' | 'NETWORK_CAPTURE' | 'OTHER';
export type EvidenceStatus = 'IN_CUSTODY' | 'TRANSFER_PENDING' | 'RELEASED' | 'EVIDENTIARY_HOLD';
export type IntegrityStatus = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export interface Evidence {
  id: string;
  case_id: string;
  case_number?: string;
  case_title?: string;
  case_jurisdiction?: string;
  item_number: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string;
  storage_key: string;
  original_sha256: string;
  evidence_type: EvidenceType;
  current_custodian_id: string;
  current_custodian_name?: string;
  current_custodian_badge?: string;
  current_custodian_agency?: string;
  uploader_id: string;
  uploader_name?: string;
  upload_timestamp: string;
  status: EvidenceStatus;
  notes?: string;
  is_tampered_test_copy: number;
  created_at: string;
  custody_event_count?: number;
  last_verification_status?: IntegrityStatus;
  last_verification_timestamp?: string;
}

export interface CustodyEvent {
  id: string;
  evidence_id: string;
  sequence_number: number;
  event_type: string;
  actor_id: string;
  actor_name?: string;
  actor_badge?: string;
  actor_agency?: string;
  actor_role?: string;
  timestamp: string;
  previous_event_hash: string;
  event_hash: string;
  action_details: string;
  action_details_parsed?: any;
  reason?: string;
  isHashValid?: boolean;
  isLinkValid?: boolean;
}

export interface CustodyTransfer {
  id: string;
  evidence_id: string;
  item_number?: string;
  original_filename?: string;
  case_number?: string;
  from_user_id: string;
  from_user_name?: string;
  from_user_agency?: string;
  to_user_id: string;
  to_user_name?: string;
  to_user_agency?: string;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  requested_at: string;
  resolved_at?: string;
  resolution_notes?: string;
  expected_custodian_version: number;
}

export interface SignedCheckpoint {
  id: string;
  checkpoint_number: number;
  evidence_id?: string;
  item_number?: string;
  original_filename?: string;
  chain_head_event_id: string;
  chain_head_sequence: number;
  chain_head_hash: string;
  timestamp: string;
  signer_actor_id: string;
  signer_name?: string;
  signer_badge?: string;
  signer_agency?: string;
  key_id: string;
  algorithm: string;
  public_key_pem: string;
  signature_hex: string;
  canonical_payload: string;
  created_at: string;
}

export interface VerificationRun {
  id: string;
  evidence_id: string;
  verified_by_id: string;
  verified_by_name?: string;
  verified_by_agency?: string;
  timestamp: string;
  file_status: IntegrityStatus;
  chain_status: IntegrityStatus;
  checkpoint_status: IntegrityStatus;
  overall_status: IntegrityStatus;
  trusted_sha256: string;
  calculated_sha256?: string;
  findings: string;
  failure_type?: string;
}

export interface SecurityAuditEvent {
  id: string;
  actor_id: string | null;
  actor_username: string | null;
  event_type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  ip_address: string;
  details: string;
  timestamp: string;
}

export interface ForensicReport {
  id: string;
  report_number: string;
  evidence_id: string;
  item_number?: string;
  original_filename?: string;
  verification_run_id?: string;
  generated_by_id: string;
  generated_by_name?: string;
  generated_by_agency?: string;
  report_type: string;
  title: string;
  created_at: string;
  file_path?: string;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'INFO' | 'TRANSFER_REQUEST' | 'VERIFICATION_ALERT' | 'SECURITY_WARNING';
  is_read: number;
  link?: string;
  created_at: string;
}

export interface DashboardStats {
  totalEvidence: number;
  totalCases: number;
  pendingTransfers: number;
  passingIntegrityCount: number;
  failingIntegrityCount: number;
  unreadNotificationsCount: number;
  recentEvents: any[];
  recentAlerts: SecurityAuditEvent[];
}

export interface SystemHealth {
  status: string;
  timestamp: string;
  uptimeSeconds: number;
  storage: {
    evidenceVault: {
      path: string;
      fileCount: number;
      totalSizeBytes: number;
      formattedSize: string;
    };
    stagingArea: {
      path: string;
      fileCount: number;
      totalSizeBytes: number;
      formattedSize: string;
    };
    database: {
      engine: string;
      sizeBytes: number;
      formattedSize: string;
    };
  };
  cryptography: {
    signingAlgorithm: string;
    activeKeyId: string;
    privateKeySecured: boolean;
    publicKeyAccessible: boolean;
    hashingEngine: string;
  };
  memory: any;
}
