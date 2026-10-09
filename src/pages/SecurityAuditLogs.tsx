import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  ShieldAlert,
  RefreshCw,
  Clock,
  User,
  Globe,
} from 'lucide-react';
import { api } from '../services/api';
import { SecurityAuditEvent } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';

export const SecurityAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<SecurityAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.admin.auditLogs({
        severity: severityFilter || undefined,
        eventType: eventTypeFilter || undefined,
        search: search || undefined,
        limit: 150,
      });
      setLogs(data.logs);
    } catch (err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [severityFilter, eventTypeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLogs();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              Immutable Security Audit Trail
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative log of logins, access attempts, bitstream intakes, and verification exceptions.
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[240px]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit details or usernames..."
              className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none font-mono"
            />
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none font-mono"
          >
            <option value="">All Severities</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>

          <select
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none font-mono"
          >
            <option value="">All Event Types</option>
            <option value="USER_LOGIN">USER_LOGIN</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
            <option value="EVIDENCE_UPLOAD">EVIDENCE_UPLOAD</option>
            <option value="VERIFICATION_FAILED">VERIFICATION_FAILED</option>
            <option value="CUSTODY_TRANSFER_ACCEPTED">CUSTODY_TRANSFER_ACCEPTED</option>
            <option value="CHECKPOINT_CREATED">CHECKPOINT_CREATED</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No security events found matching current filter parameters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                      {log.timestamp.replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={log.severity} size="sm" />
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-200">{log.event_type}</td>
                    <td className="py-3 px-4 text-cyan-300">{log.actor_username || 'SYSTEM'}</td>
                    <td className="py-3 px-4 text-slate-400">{log.ip_address}</td>
                    <td className="py-3 px-4 text-slate-300 max-w-lg break-words">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
