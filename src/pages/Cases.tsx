import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  FolderGit2,
  User,
  ArrowRight,
  Shield,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { Case, Evidence } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

interface CasesProps {
  selectedCaseId?: string;
  onNavigate: (page: string, params?: any) => void;
}

export const Cases: React.FC<CasesProps> = ({ selectedCaseId, onNavigate }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [caseEvidence, setCaseEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);

  // New Case Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [caseNumber, setCaseNumber] = useState('');
  const [title, setTitle] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCases = async () => {
    setLoading(true);
    try {
      const data = await api.cases.list();
      setCases(data.cases);
      const toSelect = selectedCaseId
        ? data.cases.find((c) => c.id === selectedCaseId)
        : data.cases[0];
      if (toSelect) {
        selectCase(toSelect.id);
      }
    } catch (err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const selectCase = async (id: string) => {
    try {
      const data = await api.cases.get(id);
      setActiveCase(data.case);
      setCaseEvidence(data.evidence);
    } catch (err) {
      // Ignore
    }
  };

  useEffect(() => {
    loadCases();
  }, [selectedCaseId]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber || !title || !jurisdiction) {
      setError('Docket Number, Title, and Jurisdiction are mandatory.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.cases.create({
        caseNumber: caseNumber.trim(),
        title: title.trim(),
        jurisdiction: jurisdiction.trim(),
        description: description.trim(),
      });
      setIsModalOpen(false);
      setCaseNumber('');
      setTitle('');
      setJurisdiction('');
      setDescription('');
      await loadCases();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize case');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              Investigation Dockets & Cases
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Judicial dockets, evidentiary jurisdiction, and assigned lead investigators.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsModalOpen(true);
              setCaseNumber(`CASE-${new Date().getFullYear()}-CR-${Math.floor(1000 + Math.random() * 9000)}`);
              setJurisdiction('Federal District Court');
            }}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-md shadow-cyan-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Open Case Docket
          </button>
          <button
            onClick={loadCases}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Layout: Left Cases List, Right Selected Case Evidence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cases List */}
        <div className="space-y-3">
          <div className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider px-1">
            Active Dockets ({cases.length})
          </div>

          <div className="space-y-2">
            {cases.map((c) => {
              const isSelected = activeCase?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => selectCase(c.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500/70 shadow-lg shadow-cyan-950/30'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-cyan-300">
                      {c.case_number}
                    </span>
                    <StatusBadge status={c.status} size="sm" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-200 mt-1">{c.title}</h4>
                  <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center justify-between">
                    <span>{c.lead_investigator_name}</span>
                    <span className="text-cyan-400">{c.evidence_count ?? 0} Evidence Items</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Case Detail and Evidence Table */}
        <div className="lg:col-span-2 space-y-6">
          {activeCase ? (
            <>
              {/* Docket Header Card */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-sm font-bold text-cyan-400">
                      {activeCase.case_number}
                    </span>
                    <h2 className="text-lg font-bold text-slate-100 mt-0.5">{activeCase.title}</h2>
                  </div>
                  <StatusBadge status={activeCase.status} size="md" />
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{activeCase.description}</p>

                <div className="pt-3 border-t border-slate-800 grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Jurisdiction:</span>
                    <span className="text-slate-300">{activeCase.jurisdiction}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Lead Investigator:</span>
                    <span className="text-slate-300">
                      {activeCase.lead_investigator_name} ({activeCase.lead_investigator_agency})
                    </span>
                  </div>
                </div>
              </div>

              {/* Case Evidence Table */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-100 text-xs font-mono">
                    Associated Digital Evidence ({caseEvidence.length})
                  </h3>
                  <button
                    onClick={() => onNavigate('evidence-upload')}
                    className="text-xs text-cyan-400 hover:underline font-mono"
                  >
                    + Add to Case
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Item ID</th>
                        <th className="py-3 px-4">File Name</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Custodian</th>
                        <th className="py-3 px-4">Integrity</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                      {caseEvidence.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                            No evidence items currently assigned to this docket.
                          </td>
                        </tr>
                      ) : (
                        caseEvidence.map((ev) => (
                          <tr key={ev.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 font-bold text-cyan-300">{ev.item_number}</td>
                            <td className="py-3 px-4 max-w-xs truncate text-slate-200">
                              {ev.original_filename}
                            </td>
                            <td className="py-3 px-4 text-slate-400">{ev.evidence_type}</td>
                            <td className="py-3 px-4 text-slate-300">{ev.current_custodian_name}</td>
                            <td className="py-3 px-4">
                              <StatusBadge status={ev.last_verification_status || 'PASS'} size="sm" />
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <button
                                onClick={() => onNavigate('evidence-details', { id: ev.id })}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
                              >
                                Inspect
                              </button>
                              <button
                                onClick={() => onNavigate('custody-timeline', { evidenceId: ev.id })}
                                className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-[11px]"
                              >
                                Chain
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 font-mono text-xs">
              Select an investigation docket on the left to examine case details.
            </div>
          )}
        </div>
      </div>

      {/* Create Case Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Open Investigation Docket"
        subtitle="Initialize formal digital forensics case registry"
      >
        <form onSubmit={handleCreateCase} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Case Docket Number *
            </label>
            <input
              type="text"
              required
              value={caseNumber}
              onChange={(e) => setCaseNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
              placeholder="CASE-2026-CR-0842"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Investigation Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
              placeholder="Operation Cyber Intrusion & Ransomware Exfiltration"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Jurisdiction & Judicial Body *
            </label>
            <input
              type="text"
              required
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
              placeholder="Federal District Court (Northern Division)"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Case Scope & Incident Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
              placeholder="Brief summary of forensic acquisition scope..."
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs font-mono"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition-all"
            >
              {submitting ? 'Initializing...' : 'Open Case Docket'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
