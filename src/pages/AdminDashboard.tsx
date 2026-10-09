import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  Lock,
  History,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  KeySquare,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { DashboardStats, SystemHealth, SecurityAuditEvent } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { AlertBanner } from '../components/common/AlertBanner';
import { CardSkeleton } from '../components/common/Skeleton';

interface AdminDashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<SecurityAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, healthData, logsData] = await Promise.all([
        api.dashboard.getStats(),
        api.admin.systemHealth(),
        api.admin.auditLogs({ severity: 'CRITICAL', limit: 5 }),
      ]);
      setStats(statsData);
      setHealth(healthData);
      setRecentAlerts(logsData.logs);
    } catch (err: any) {
      setError(err.message || 'Failed to load administrator control plane statistics.');
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
          title="Administrative Telemetry Error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
            <span className="text-xs font-mono font-semibold text-purple-400 uppercase tracking-wider">
              System Administration & Vault Governance
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">Administrator Control Plane</h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Strict role-based access control, tamper-evident security audit stream, and storage health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('users')}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-md shadow-cyan-950"
          >
            <Users className="w-4 h-4" />
            Manage Users
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Admin KPI Metrics */}
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
                <span>Storage Vault</span>
                <HardDrive className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-extrabold text-slate-100 font-mono mt-2">
                {health?.storage?.evidenceVault?.formattedSize || '0 MB'}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">
                {health?.storage?.evidenceVault?.fileCount || 0} Bitstream Files
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Cryptographic Engine</span>
                <KeySquare className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-extrabold text-emerald-400 font-mono mt-2">NIST P-256</div>
              <div className="text-[10px] text-emerald-500/80 font-mono mt-1">Hardware Key Isolated</div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Security Alerts</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-extrabold text-rose-400 font-mono mt-2">
                {stats?.recentAlerts?.length || 0}
              </div>
              <div className="text-[10px] text-rose-400/80 font-mono mt-1">Audited Exceptions</div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Database Integrity</span>
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-extrabold text-cyan-400 font-mono mt-2">ACID WAL</div>
              <div className="text-[10px] text-cyan-500/80 font-mono mt-1">
                {health?.storage?.database?.formattedSize || '0 MB'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Admin Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => onNavigate('users')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors space-y-3"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-950 text-blue-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">User Directory</h3>
            <p className="text-xs text-slate-400 mt-1">Provision officers, assign roles, lock accounts.</p>
          </div>
          <div className="text-xs text-cyan-400 font-mono flex items-center gap-1 pt-2 border-t border-slate-800">
            Open Users <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('roles')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors space-y-3"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-950 text-purple-400 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">Roles & Permissions</h3>
            <p className="text-xs text-slate-400 mt-1">Review granular RBAC permission matrix.</p>
          </div>
          <div className="text-xs text-cyan-400 font-mono flex items-center gap-1 pt-2 border-t border-slate-800">
            Inspect RBAC <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('audit-logs')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors space-y-3"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-950 text-amber-400 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">Security Audit Logs</h3>
            <p className="text-xs text-slate-400 mt-1">Review tamper-evident system-wide event logs.</p>
          </div>
          <div className="text-xs text-cyan-400 font-mono flex items-center gap-1 pt-2 border-t border-slate-800">
            Review Logs <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('system-health')}
          className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors space-y-3"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">Storage & System Health</h3>
            <p className="text-xs text-slate-400 mt-1">Private vault capacity, staging quarantine, keys.</p>
          </div>
          <div className="text-xs text-cyan-400 font-mono flex items-center gap-1 pt-2 border-t border-slate-800">
            Inspect Health <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Critical Security Alert Stream */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Security & Integrity Audit Alerts
          </h3>
          <button
            onClick={() => onNavigate('audit-logs')}
            className="text-xs text-cyan-400 hover:underline font-mono"
          >
            All Audit Records
          </button>
        </div>

        <div className="space-y-2">
          {recentAlerts.length === 0 ? (
            <p className="text-slate-500 text-xs font-mono py-4 text-center">
              No critical security violations or anomalies detected.
            </p>
          ) : (
            recentAlerts.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">{log.event_type}</span>
                    <span className="text-[10px] text-slate-500">
                      Actor: {log.actor_username || 'SYSTEM'} ({log.ip_address})
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] mt-0.5">{log.details}</p>
                </div>
                <StatusBadge status={log.severity} size="sm" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
