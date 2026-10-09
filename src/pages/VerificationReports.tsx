import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Plus,
  RefreshCw,
  Shield,
  FileCheck2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';
import { ForensicReport, Evidence } from '../types';
import { Modal } from '../components/common/Modal';

interface VerificationReportsProps {
  onNavigate: (page: string, params?: any) => void;
}

export const VerificationReports: React.FC<VerificationReportsProps> = ({ onNavigate }) => {
  const [reports, setReports] = useState<ForensicReport[]>([]);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [reportType, setReportType] = useState('FORENSIC_INTEGRITY_CERTIFICATE');
  const [reportTitle, setReportTitle] = useState('');
  const [generating, setGenerating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rData, evData] = await Promise.all([
        api.reports.list(),
        api.evidence.list(),
      ]);
      setReports(rData.reports);
      setEvidenceList(evData.items);
      if (evData.items.length > 0 && !selectedEvidenceId) {
        setSelectedEvidenceId(evData.items[0].id);
        setReportTitle(`Forensic Integrity Certificate for ${evData.items[0].item_number}`);
      }
    } catch (err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvidenceId) return;

    setGenerating(true);
    try {
      const res = await api.reports.generate({
        evidenceId: selectedEvidenceId,
        reportType,
        title: reportTitle.trim() || undefined,
      });
      setIsModalOpen(false);
      await loadData();
      // Direct download PDF
      window.location.href = res.pdfUrl;
    } catch (err: any) {
      alert(`Report generation error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              Certified Forensic Verification Reports
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Certified technical audit certificates with complete bitstream hashes, Merkle history, and digital signatures.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={evidenceList.length === 0}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-md shadow-cyan-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Generate New Report
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-100 text-xs font-mono">
            Archived Certificates ({reports.length})
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">PDF Direct Download Available</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Certificate ID</th>
                <th className="py-3 px-4">Evidence Item</th>
                <th className="py-3 px-4">Report Title</th>
                <th className="py-3 px-4">Certified By</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Download PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No forensic certificates generated yet. Click "Generate New Report" to compile one.
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-cyan-300">{r.report_number}</td>
                    <td className="py-3 px-4 text-slate-300">{r.item_number}</td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-200">{r.title}</td>
                    <td className="py-3 px-4 text-slate-400">
                      <div>{r.generated_by_name}</div>
                      <div className="text-[10px] text-slate-500">{r.generated_by_agency}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {r.created_at.replace('T', ' ').substring(0, 16)} UTC
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={api.reports.pdfUrl(r.id)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 text-xs font-mono font-semibold transition-colors inline-flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download PDF
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legal Limitations Notice Card */}
      <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 text-xs space-y-2">
        <h4 className="font-bold text-slate-200 font-mono flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          Evidentiary Notice on Forensic Reports
        </h4>
        <p className="text-slate-400 leading-relaxed text-[11px]">
          All PDF certificates compiled by EVIDENCELOCK include cryptographic timestamps, SHA-256 chunked digests, Merkle link verifications, and asymmetric ECDSA checkpoint signatures.
          A matching hash confirms bitstream authenticity relative to the intake moment; it does not attest to pre-acquisition veracity. Legal admissibility remains governed by applicable jurisdiction rules (e.g., FRE 902(13)/(14)).
        </p>
      </div>

      {/* Generate Report Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Generate Forensic Report"
        subtitle="Compile certified PDF with cryptographic verification stamps"
      >
        <form onSubmit={handleGenerateReport} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Select Evidence Record *
            </label>
            <select
              value={selectedEvidenceId}
              onChange={(e) => {
                setSelectedEvidenceId(e.target.value);
                const ev = evidenceList.find((item) => item.id === e.target.value);
                if (ev) setReportTitle(`Forensic Integrity Certificate for ${ev.item_number}`);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            >
              {evidenceList.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.item_number} — {e.original_filename} ({e.case_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Certificate Scope & Type *
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="FORENSIC_INTEGRITY_CERTIFICATE">
                Forensic Bitstream Integrity Certificate (SHA-256 Audit)
              </option>
              <option value="CHAIN_OF_CUSTODY_AUDIT">
                Complete Chain-of-Custody Timeline & Merkle Audit
              </option>
              <option value="FULL_CASE_SUMMARY">
                Comprehensive Docket & Evidentiary Seal Summary
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Report Title
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none font-mono"
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
              disabled={generating}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2"
            >
              <FileCheck2 className="w-4 h-4" />
              {generating ? 'Compiling PDF...' : 'Compile & Download PDF'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
