import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Search,
  Filter,
  Download,
  FileCheck2,
  GitCommit,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { api } from '../services/api';
import { Evidence, Case } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';
import { AlertBanner, AlertType } from '../components/common/AlertBanner';

interface EvidenceRepositoryProps {
  onNavigate: (page: string, params?: any) => void;
}

export const EvidenceRepository: React.FC<EvidenceRepositoryProps> = ({ onNavigate }) => {
  const [items, setItems] = useState<Evidence[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: AlertType; title: string; message: string; details?: string } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [caseFilter, setCaseFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [simulatingTamperId, setSimulatingTamperId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [evData, casesData] = await Promise.all([
        api.evidence.list({
          search: search || undefined,
          caseId: caseFilter || undefined,
          type: typeFilter || undefined,
          status: statusFilter || undefined,
        }),
        api.cases.list(),
      ]);
      setItems(evData.items);
      setCases(casesData.cases);
    } catch (err: any) {
      setError(err.message || 'Failed to query evidence repository from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [caseFilter, typeFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleTamperSimulation = async (id: string) => {
    setSimulatingTamperId(id);
    try {
      await api.evidence.tamperTest(id);
      await loadData();
      setFeedback({
        type: 'warning',
        title: 'Tamper Simulation Active',
        message: 'Physical file bytes deliberately modified in private storage.',
        details: 'Run verification now on this item to witness automated cryptographic FAIL detection.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Tamper Simulation Error',
        message: err.message || 'Failed to execute tamper test.',
      });
    } finally {
      setSimulatingTamperId(null);
    }
  };

  const handleRestoreSimulation = async (id: string) => {
    try {
      await api.evidence.restoreTest(id);
      await loadData();
      setFeedback({
        type: 'success',
        title: 'Bitstream Restored',
        message: 'File bitstream in private storage restored from original verified backup.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Restore Operation Failed',
        message: err.message || 'Failed to restore bitstream.',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Real error banner */}
      {error && (
        <AlertBanner
          type="error"
          title="Repository Sync Error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Real feedback banner for tamper / restore simulations */}
      {feedback && (
        <AlertBanner
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          details={feedback.details}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              Digital Evidence Registry
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative repository of sealed bitstreams, chunked hashes, and custodians.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('evidence-upload')}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-md shadow-cyan-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Ingest New Evidence
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh Registry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
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
              placeholder="Search by Item ID, original filename, or case..."
              className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none font-mono"
            />
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={caseFilter}
            onChange={(e) => setCaseFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none"
          >
            <option value="">All Cases</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.case_number}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="FORENSIC_IMAGE">Forensic Image</option>
            <option value="NETWORK_CAPTURE">Network PCAP</option>
            <option value="DOCUMENT">Document</option>
            <option value="IMAGE">Photograph</option>
            <option value="VIDEO">Video</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="IN_CUSTODY">In Custody</option>
            <option value="TRANSFER_PENDING">Transfer Pending</option>
            <option value="RELEASED">Released</option>
          </select>
        </div>
      </div>

      {/* Main Evidence Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Item ID</th>
                <th className="py-3 px-4">Case Docket</th>
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4">Genesis SHA-256</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Custodian</th>
                <th className="py-3 px-4">Custody Status</th>
                <th className="py-3 px-4">Last Verified</th>
                <th className="py-3 px-4 text-right">Forensic Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-sans">
                    No evidence items match the specified query filters.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-cyan-300">{item.item_number}</td>
                    <td className="py-3 px-4 text-slate-400">{item.case_number}</td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-200" title={item.original_filename}>
                      {item.original_filename}
                    </td>
                    <td className="py-3 px-4">
                      <HashDisplay hash={item.original_sha256} truncate />
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {(item.file_size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3 px-4 text-slate-300">{item.current_custodian_name}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.status} size="sm" />
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.last_verification_status || 'UNVERIFIED'} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => onNavigate('evidence-details', { id: item.id })}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] transition-colors"
                        title="View Full Metadata & Hex inspection"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => onNavigate('custody-timeline', { evidenceId: item.id })}
                        className="px-2 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 text-[11px] transition-colors"
                        title="View Merkle Custody Chain"
                      >
                        <GitCommit className="w-3.5 h-3.5 inline" />
                      </button>
                      <a
                        href={api.evidence.downloadUrl(item.id)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] inline-flex items-center transition-colors"
                        title="Export Raw Bitstream"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      {/* Demo tamper simulation buttons */}
                      {item.is_tampered_test_copy ? (
                        <button
                          onClick={() => handleRestoreSimulation(item.id)}
                          className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 text-[11px] transition-colors"
                          title="Restore original file bytes"
                        >
                          <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                          Restore
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTamperSimulation(item.id)}
                          className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-[11px] transition-colors"
                          title="Audit Test: Simulate unauthorized file byte alteration on disk"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                          Tamper
                        </button>
                      )}
                    </td>
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
