import {
  User,
  Case,
  Evidence,
  CustodyEvent,
  CustodyTransfer,
  SignedCheckpoint,
  VerificationRun,
  SecurityAuditEvent,
  ForensicReport,
  NotificationItem,
  DashboardStats,
  SystemHealth,
} from '../types';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token: string | null = null;
  try {
    token = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('evidencelock_token') : null;
  } catch (e) {
    // Iframe or storage access denied
  }

  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Create timeout signal if none provided
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);
  const signal = options.signal || controller.signal;

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      let errorMsg = `Request failed (${response.status}): ${response.statusText}`;
      if (contentType.includes('application/json')) {
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorData.error || errorMsg;
        } catch (e) {
          // Fallback message
        }
      }
      throw new Error(errorMsg);
    }

    if (!contentType.includes('application/json')) {
      throw new Error(`Expected JSON response from ${endpoint}, received ${contentType}`);
    }

    return response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${endpoint} timed out. Backend service may be initializing.`);
    }
    throw err;
  }
}

export const api = {
  // Auth
  auth: {
    login: (credentials: { username: string; password: string }) =>
      request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    logout: () =>
      request<{ message: string }>('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: User }>('/auth/me'),
    getDemoAccounts: () =>
      request<{ demoAccounts: User[] }>('/auth/demo-accounts'),
    switchDemoUser: (username: string) =>
      request<{ token: string; user: User }>('/auth/switch-demo-user', {
        method: 'POST',
        body: JSON.stringify({ username }),
      }),
  },

  // Dashboard & Metrics
  dashboard: {
    getStats: () => request<DashboardStats>('/admin/dashboard/stats'),
  },

  // Evidence
  evidence: {
    list: (params?: { caseId?: string; type?: string; search?: string; status?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ items: Evidence[] }>(`/evidence?${q}`);
    },
    get: (id: string) =>
      request<{
        evidence: Evidence;
        lastVerification?: VerificationRun;
        lastCheckpoint?: SignedCheckpoint;
        totalEvents: number;
      }>(`/evidence/${id}`),
    upload: (formData: FormData) =>
      request<{ message: string; evidence: any }>('/evidence/upload', {
        method: 'POST',
        body: formData,
      }),
    tamperTest: (id: string) =>
      request<any>(`/evidence/${id}/tamper-test`, { method: 'POST' }),
    restoreTest: (id: string) =>
      request<any>(`/evidence/${id}/restore-test`, { method: 'POST' }),
    tamperEventTest: (id: string, sequenceNumber: number) =>
      request<any>(`/evidence/${id}/tamper-event-test`, {
        method: 'POST',
        body: JSON.stringify({ sequenceNumber }),
      }),
    downloadUrl: (id: string) => `/api/evidence/${id}/download`,
  },

  // Custody
  custody: {
    getEvents: (evidenceId: string) =>
      request<{
        events: CustodyEvent[];
        chainIntegrity: { isValid: boolean; reason: string; headHash: string | null; totalEvents: number };
      }>(`/custody/events/${evidenceId}`),
    verifyChain: (evidenceId: string) =>
      request<{
        result: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
        eventCount: number;
        headSequence: number;
        headHash: string;
        discrepancies: string[];
        verificationTimestamp: string;
      }>(`/custody/verify-chain/${evidenceId}`, { method: 'POST' }),
    requestTransfer: (payload: { evidenceId: string; toUserId: string; reason: string }) =>
      request<{ message: string; transferId: string }>(`/custody/transfers`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    acceptTransfer: (transferId: string) =>
      request<{ message: string }>(`/custody/transfers/${transferId}/accept`, { method: 'POST' }),
    rejectTransfer: (transferId: string, reason?: string) =>
      request<{ message: string }>(`/custody/transfers/${transferId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    listTransfers: (params?: { status?: string; evidenceId?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ transfers: CustodyTransfer[] }>(`/custody/transfers?${q}`);
    },
  },

  // Checkpoints
  checkpoints: {
    list: (evidenceId?: string) =>
      request<{ checkpoints: SignedCheckpoint[] }>(
        `/checkpoints${evidenceId ? `?evidenceId=${evidenceId}` : ''}`
      ),
    create: (payload: { evidenceId: string; jurisdictionNote?: string }) =>
      request<{ message: string; checkpoint: any }>('/checkpoints', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    verify: (id: string) =>
      request<{
        result: 'PASS' | 'FAIL';
        isSignatureValid: boolean;
        isChainHeadIntact: boolean;
        chainHeadHash: string;
        findings: string;
        verifiedAt: string;
      }>(`/checkpoints/verify/${id}`, { method: 'POST' }),
    getPublicKey: () =>
      request<{
        keyId: string;
        algorithm: string;
        publicKeyPem: string;
        disclaimer: string;
      }>('/checkpoints/public-key'),
  },

  // Verification
  verification: {
    verifyFile: (evidenceId: string) =>
      request<{
        result: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
        failureType?: string;
        trustedSha256: string;
        calculatedSha256?: string;
        findings: string;
        explanation: string;
        verifiedAt: string;
      }>(`/verify/file/${evidenceId}`, { method: 'POST' }),
    verifyFull: (evidenceId: string) =>
      request<{
        verificationRunId: string;
        evidenceId: string;
        overallStatus: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
        tier1_file: any;
        tier2_chain: any;
        tier3_checkpoint: any;
        timestamp: string;
        disclaimer: string;
      }>(`/verify/full/${evidenceId}`, { method: 'POST' }),
    verifyExternal: (formData: FormData) =>
      request<{
        candidateSha256: string;
        matchesTarget: boolean;
        matchedEvidence: any | null;
        message: string;
      }>('/verify/external', {
        method: 'POST',
        body: formData,
      }),
    history: (evidenceId: string) =>
      request<{ history: VerificationRun[] }>(`/verify/history/${evidenceId}`),
  },

  // Cases
  cases: {
    list: () => request<{ cases: Case[] }>('/cases'),
    get: (id: string) => request<{ case: Case; evidence: Evidence[] }>(`/cases/${id}`),
    create: (data: { caseNumber: string; title: string; description?: string; jurisdiction: string }) =>
      request<{ message: string; case: any }>('/cases', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Reports
  reports: {
    list: (evidenceId?: string) =>
      request<{ reports: ForensicReport[] }>(
        `/reports${evidenceId ? `?evidenceId=${evidenceId}` : ''}`
      ),
    generate: (payload: { evidenceId: string; reportType?: string; title?: string }) =>
      request<{ message: string; reportId: string; reportNumber: string; pdfUrl: string }>('/reports/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    pdfUrl: (id: string) => `/api/reports/${id}/pdf`,
  },

  // Admin
  admin: {
    listUsers: () => request<{ users: User[] }>('/admin/users'),
    createUser: (data: any) =>
      request<{ message: string; user: any }>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateUser: (id: string, updates: any) =>
      request<{ message: string }>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    listRoles: () => request<{ roles: any[]; allPermissions: any[] }>('/admin/roles'),
    auditLogs: (params?: { severity?: string; eventType?: string; search?: string; limit?: number }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<{ logs: SecurityAuditEvent[] }>(`/admin/audit-logs?${q}`);
    },
    systemHealth: () => request<SystemHealth>('/admin/system-health'),
  },

  // Notifications
  notifications: {
    list: () => request<{ notifications: NotificationItem[] }>('/admin/notifications'),
    markRead: (id: string) =>
      request<{ success: boolean }>(`/admin/notifications/${id}/read`, { method: 'POST' }),
  },
};
