import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  FileCheck2,
  GitCommit,
  KeySquare,
  FileText,
  AlertTriangle,
  CheckCircle2,
  History,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardStats, Evidence, SignedCheckpoint, SecurityAuditEvent } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';
import { AlertBanner } from '../components/common/AlertBanner';
import { CardSkeleton } from '../components/common/Skeleton';

interface AuditorDashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

export const AuditorDashboard: React.FC<AuditorDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [checkpoints, setCheckpoints] = useState<SignedCheckpoint[]>([]);
  const [recentLogs, setRecentLogs] = useState<SecurityAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, evData, chkData, logsData] = await Promise.all([
        api.dashboard.getStats(),
        api.evidence.list(),
        api.checkpoints.list(),
        api.admin.auditLogs({ limit: 6 }),
      ]);
      setStats(statsData);
      setEvidenceList(evData.items);
      setCheckpoints(chkData.checkpoints);
      setRecentLogs(logsData.logs);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve independent audit statistics from backend API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-2">
      {error && (
        <AlertBanner
          type="error"
          title="Audit Telemetry Warning"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider">
              Independent Forensic Audit Console
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            Evidentiary Integrity & Compliance Dashboard
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Non-repudiation oversight, Merkle continuity auditing, and asymmetric cryptographic seal verification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('checkpoints')}
            className="px-4 py-2 rounded-lg bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-800 text-xs font-mono font-semibold transition-colors flex items-center gap-2"
          >
            <KeySquare className="w-4 h-4 text-purple-400" />
            Audit Checkpoint Signatures
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            Certificates
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Audit Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Audited Evidence</span>
                <FileCheck2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-extrabold text-slate-100 font-mono mt-2">
                {stats?.totalEvidence ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">100% Ingestion Tracked</div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Passing Bitstreams</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-2">
                {stats?.passingIntegrityCount ?? 0}
              </div>
              <div className="text-[10px] text-emerald-500/80 font-mono mt-1">Confirmed Bit-for-Bit</div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Cryptographic Checkpoints</span>
                <KeySquare className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-extrabold text-purple-400 font-mono mt-2">
                {checkpoints.length}
              </div>
              <div className="text-[10px] text-purple-400/80 font-mono mt-1">ECDSA P-256 Signatures</div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Security Alerts</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-extrabold text-rose-400 font-mono mt-2">
                {stats?.recentAlerts?.length ?? 0}
              </div>
              <div className="text-[10px] text-rose-400/80 font-mono mt-1">Critical Warnings Logged</div>
            </div>
          </>
        )}
      </div>

      {/* Main Evidence Audit Register */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">Evidence Vault Verification Status</h3>
            <p className="text-xs text-slate-400 mt-0.5">Authoritative checksum comparisons and Merkle event counts</p>
          </div>
          <button
            onClick={() => onNavigate('evidence-repository')}
            className="text-xs text-cyan-400 hover:underline font-mono"
          >
            Full Registry
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Item ID</th>
                <th className="py-3 px-4">Case Docket</th>
                <th className="py-3 px-4">Genesis SHA-256</th>
                <th className="py-3 px-4">Merkle Chain Depth</th>
                <th className="py-3 px-4">Integrity Status</th>
                <th className="py-3 px-4 text-right">Audit Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                      <span>Auditing evidence checksums against cryptographic ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : evidenceList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-slate-500">
                    No evidence items registered for auditing.
                  </td>
                </tr>
              ) : (
                evidenceList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-cyan-300">{item.item_number}</td>
                    <td className="py-3 px-4 text-slate-400">{item.case_number}</td>
                    <td className="py-3 px-4">
                      <HashDisplay hash={item.original_sha256} truncate />
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {item.custody_event_count || 1} Events
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.last_verification_status || 'UNVERIFIED'} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => onNavigate('custody-timeline', { evidenceId: item.id })}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
                      >
                        Audit Chain
                      </button>
                      <button
                        onClick={() => onNavigate('verify-evidence', { selectedEvidenceId: item.id })}
                        className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 text-[11px]"
                      >
                        Verify
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Checkpoints & Audit Logs split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Checkpoints Overview */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <KeySquare className="w-4 h-4 text-purple-400" />
              Recent Asymmetric Checkpoints
            </h3>
            <button
              onClick={() => onNavigate('checkpoints')}
              className="text-xs text-purple-400 hover:underline font-mono"
            >
              View All
            </button>
          </div>

          <div className="space-y-3">
            {checkpoints.slice(0, 3).map((chk) => (
              <div
                key={chk.id}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300">Checkpoint #{chk.checkpoint_number}</span>
                  <span className="text-[10px] text-slate-400">{chk.created_at.substring(0, 10)}</span>
                </div>
                <div className="text-slate-400 text-[11px]">Key: {chk.key_id} ({chk.algorithm})</div>
                <div className="text-slate-500 text-[10px] truncate">
                  Head Hash: {chk.chain_head_hash}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Audit Trail */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              Security Audit Stream
            </h3>
            <button
              onClick={() => onNavigate('audit-logs')}
              className="text-xs text-cyan-400 hover:underline font-mono"
            >
              Audit Trail
            </button>
          </div>

          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs font-mono space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-200 font-semibold">{log.event_type}</span>
                  <StatusBadge status={log.severity} size="sm" />
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-1">{log.details}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
