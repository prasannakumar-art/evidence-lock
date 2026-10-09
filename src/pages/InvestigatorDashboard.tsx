import React, { useEffect, useState } from 'react';
import {
  Upload,
  FileCheck2,
  FolderGit2,
  ArrowRightLeft,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Evidence, Case, DashboardStats, CustodyTransfer } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';
import { AlertBanner } from '../components/common/AlertBanner';
import { CardSkeleton, Skeleton } from '../components/common/Skeleton';

interface InvestigatorDashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

export const InvestigatorDashboard: React.FC<InvestigatorDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [transfers, setTransfers] = useState<CustodyTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, evData, casesData, trData] = await Promise.all([
        api.dashboard.getStats(),
        api.evidence.list({ status: 'IN_CUSTODY' }),
        api.cases.list(),
        api.custody.listTransfers({ status: 'PENDING' }),
      ]);
      setStats(statsData);
      setEvidenceList(evData.items.slice(0, 6));
      setCases(casesData.cases.slice(0, 4));
      setTransfers(trData.transfers);
    } catch (err: any) {
      setError(err.message || 'Unable to load real-time investigator operational metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-2">
      {/* Error alert if backend request fails */}
      {error && (
        <AlertBanner
          type="error"
          title="Telemetry Connection Alert"
          message={error}
          details="Could not synchronize with the forensic API. Click the refresh button to reconnect."
          onClose={() => setError(null)}
        />
      )}

      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
            <span className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-wider">
              Investigator Operations
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">
            Welcome, {user?.full_name || 'Special Agent'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Agency: {user?.agency} | Badge: {user?.badge_number || 'N/A'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigate('evidence-upload')}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-md shadow-cyan-950"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Evidence
          </button>
          <button
            onClick={() => onNavigate('verify-evidence')}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs font-mono transition-colors flex items-center gap-2"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" />
            Verify Items
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics */}
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
                <span>Total Evidence</span>
                <FolderGit2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-extrabold text-slate-100 font-mono mt-2">
                {stats?.totalEvidence ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">Registered in vault</div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Verified Intact</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-2">
                {stats?.passingIntegrityCount ?? 0}
              </div>
              <div className="text-[10px] text-emerald-500/80 font-mono mt-1">Zero bitstream deviations</div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Integrity Alerts</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-extrabold text-rose-400 font-mono mt-2">
                {stats?.failingIntegrityCount ?? 0}
              </div>
              <div className="text-[10px] text-rose-400/80 font-mono mt-1">Tampered or missing</div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Pending Transfers</span>
                <ArrowRightLeft className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-extrabold text-amber-400 font-mono mt-2">
                {stats?.pendingTransfers ?? 0}
              </div>
              <div className="text-[10px] text-amber-400/80 font-mono mt-1">Awaiting acceptance</div>
            </div>
          </>
        )}
      </div>

      {/* Pending Transfers Alert if any */}
      {!loading && transfers.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h4 className="text-xs font-semibold text-amber-200">
                Action Required: {transfers.length} Custody Transfer Request(s)
              </h4>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                Review and process chain of custody transfers waiting for formal acceptance.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('transfers')}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs font-mono transition-colors shrink-0"
          >
            Review Transfers
          </button>
        </div>
      )}

      {/* Recent Evidence Items Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">Active Evidence Items</h3>
            <p className="text-xs text-slate-400 mt-0.5">Secure digital artifacts currently under active investigation</p>
          </div>
          <button
            onClick={() => onNavigate('evidence-repository')}
            className="text-xs font-medium text-cyan-400 hover:underline flex items-center gap-1 font-mono"
          >
            View Repository
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Item ID</th>
                <th className="py-3 px-4">Case Docket</th>
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4">Genesis SHA-256</th>
                <th className="py-3 px-4">Custodian</th>
                <th className="py-3 px-4">Integrity</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center">
                    <div className="flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                      <span>Loading active evidence records from database...</span>
                    </div>
                  </td>
                </tr>
              ) : evidenceList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                    No active evidence items found in vault. Upload evidence to initiate custody tracking.
                  </td>
                </tr>
              ) : (
                evidenceList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-cyan-300">{item.item_number}</td>
                    <td className="py-3 px-4 text-slate-400">{item.case_number}</td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-200">{item.original_filename}</td>
                    <td className="py-3 px-4">
                      <HashDisplay hash={item.original_sha256} truncate />
                    </td>
                    <td className="py-3 px-4 text-slate-300">{item.current_custodian_name}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.last_verification_status || 'UNVERIFIED'} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => onNavigate('evidence-details', { id: item.id })}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => onNavigate('custody-timeline', { evidenceId: item.id })}
                        className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 text-[11px] transition-colors"
                      >
                        Timeline
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cases summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-cyan-400" />
              Active Investigation Dockets
            </h3>
            <button
              onClick={() => onNavigate('cases')}
              className="text-xs text-cyan-400 hover:underline font-mono"
            >
              All Cases
            </button>
          </div>
          <div className="space-y-3">
            {cases.map((c) => (
              <div
                key={c.id}
                onClick={() => onNavigate('cases', { selectedCaseId: c.id })}
                className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-cyan-400">{c.case_number}</span>
                  <StatusBadge status={c.status} size="sm" />
                </div>
                <div className="text-xs text-slate-200 font-medium mt-1">{c.title}</div>
                <div className="text-[10px] text-slate-500 font-mono mt-1">
                  Jurisdiction: {c.jurisdiction}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Forensic Tools */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Cryptographic Integrity Tools
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Direct access to forensic validation engines and evidence export facilities.
            </p>

            <div className="mt-4 space-y-2">
              <button
                onClick={() => onNavigate('verify-evidence')}
                className="w-full text-left p-3 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800 flex items-center justify-between transition-colors text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-200">Interactive Verification Studio</div>
                  <div className="text-[10px] text-slate-400">Run 3-tier file, chain, and checkpoint checks</div>
                </div>
                <ArrowRight className="w-4 h-4 text-cyan-400" />
              </button>

              <button
                onClick={() => onNavigate('reports')}
                className="w-full text-left p-3 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800 flex items-center justify-between transition-colors text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-200">Certified PDF Reports</div>
                  <div className="text-[10px] text-slate-400">Generate and download court-ready verification certificates</div>
                </div>
                <ArrowRight className="w-4 h-4 text-cyan-400" />
              </button>

              <button
                onClick={() => onNavigate('transfers')}
                className="w-full text-left p-3 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800 flex items-center justify-between transition-colors text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-200">Transfer Custody</div>
                  <div className="text-[10px] text-slate-400">Initiate or accept chain of custody assignments</div>
                </div>
                <ArrowRight className="w-4 h-4 text-cyan-400" />
              </button>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-300 font-mono">
            Every transaction is committed atomically to the tamper-evident Merkle custody chain.
          </div>
        </div>
      </div>
    </div>
  );
};
