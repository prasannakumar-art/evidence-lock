import React, { useState, useEffect } from 'react';
import {
  Shield,
  FileCheck2,
  GitCommit,
  Download,
  FileText,
  AlertTriangle,
  RotateCcw,
  Clock,
  User,
  HardDrive,
  ArrowLeft,
  KeySquare,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { Evidence, VerificationRun, SignedCheckpoint } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';
import { AlertBanner, AlertType } from '../components/common/AlertBanner';

interface EvidenceDetailsProps {
  evidenceId: string;
  onNavigate: (page: string, params?: any) => void;
}

export const EvidenceDetails: React.FC<EvidenceDetailsProps> = ({ evidenceId, onNavigate }) => {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [lastVerification, setLastVerification] = useState<VerificationRun | null>(null);
  const [lastCheckpoint, setLastCheckpoint] = useState<SignedCheckpoint | null>(null);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: AlertType; title: string; message: string; details?: string } | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [verificationOutput, setVerificationOutput] = useState<any | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await api.evidence.get(evidenceId);
      setEvidence(data.evidence);
      setLastVerification(data.lastVerification || null);
      setLastCheckpoint(data.lastCheckpoint || null);
      setTotalEvents(data.totalEvents);
    } catch (err: any) {
      setPageError(err.message || 'Evidence record could not be retrieved from the vault.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (evidenceId) {
      loadData();
    }
  }, [evidenceId]);

  const runFullVerification = async () => {
    if (!evidence) return;
    setVerifying(true);
    setVerificationOutput(null);
    setFeedback(null);
    try {
      const result = await api.verification.verifyFull(evidence.id);
      setVerificationOutput(result);
      await loadData();
      if (result.overallStatus === 'PASS') {
        setFeedback({
          type: 'success',
          title: 'Forensic Audit Succeeded',
          message: 'All 3 tiers verified bit-for-bit: Stored bytes match genesis SHA-256 and Merkle custody chain is intact.',
        });
      } else {
        setFeedback({
          type: 'error',
          title: 'Integrity Violation Detected',
          message: `Verification outcome: ${result.overallStatus}. Review tier diagnostic breakdown below.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Verification Exception',
        message: err.message || 'Audit execution halted due to an unexpected condition.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleTamperBitstream = async () => {
    if (!evidence) return;
    try {
      await api.evidence.tamperTest(evidence.id);
      await loadData();
      setFeedback({
        type: 'warning',
        title: 'Tamper Simulation Active',
        message: 'Physical file bytes deliberately modified in private vault storage.',
        details: 'Run forensic verification now to observe automatic detection and integrity failure.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Tamper Test Error',
        message: err.message || 'Tamper simulation failed.',
      });
    }
  };

  const handleRestoreBitstream = async () => {
    if (!evidence) return;
    try {
      await api.evidence.restoreTest(evidence.id);
      await loadData();
      setFeedback({
        type: 'success',
        title: 'Bitstream Restored',
        message: 'Original file bytes restored from pristine master bitstream backup.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Restore Error',
        message: err.message || 'Failed to restore bitstream.',
      });
    }
  };

  const handleGeneratePdfCertificate = async () => {
    if (!evidence) return;
    setGeneratingReport(true);
    setFeedback(null);
    try {
      const res = await api.reports.generate({
        evidenceId: evidence.id,
        title: `Forensic Integrity Certificate for ${evidence.item_number}`,
      });
      setFeedback({
        type: 'success',
        title: 'Certified PDF Generated',
        message: `Report ${res.reportNumber} generated with cryptographic signature verification. Download commencing...`,
      });
      window.location.href = res.pdfUrl;
    } catch (err: any) {
      setFeedback({
        type: 'error',
        title: 'Report Generation Failed',
        message: err.message || 'Failed to compile certified forensic certificate.',
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 font-mono text-xs">
        Loading evidentiary record from secure vault...
      </div>
    );
  }

  if (!evidence) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-slate-400">Evidence item not found.</p>
        <button
          onClick={() => onNavigate('evidence-repository')}
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-mono"
        >
          Return to Registry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Real error banner */}
      {pageError && (
        <AlertBanner
          type="error"
          title="Vault Record Access Error"
          message={pageError}
          onClose={() => setPageError(null)}
        />
      )}

      {/* Real action feedback banner */}
      {feedback && (
        <AlertBanner
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          details={feedback.details}
          onClose={() => setFeedback(null)}
        />
      )}

      {/* Back button and title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('evidence-repository')}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-100 font-mono">
                {evidence.item_number}
              </span>
              <StatusBadge status={evidence.status} size="sm" />
              {evidence.is_tampered_test_copy === 1 && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800 animate-pulse">
                  TAMPERED TEST BITSTREAM
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Docket: {evidence.case_number} — {evidence.case_title}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={runFullVerification}
            disabled={verifying}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-md shadow-cyan-950"
          >
            <FileCheck2 className="w-4 h-4" />
            {verifying ? 'Running 3-Tier Audit...' : 'Run Forensic Verification'}
          </button>
          <button
            onClick={handleGeneratePdfCertificate}
            disabled={generatingReport}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors flex items-center gap-2"
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            {generatingReport ? 'Compiling PDF...' : 'Export Certified PDF'}
          </button>
          <a
            href={api.evidence.downloadUrl(evidence.id)}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors inline-flex items-center gap-1.5"
            title="Download original file bitstream"
          >
            <Download className="w-4 h-4" />
            Bitstream
          </a>
        </div>
      </div>

      {/* Live Verification Output if run just completed */}
      {verificationOutput && (
        <div
          className={`p-6 rounded-2xl border transition-all ${
            verificationOutput.overallStatus === 'PASS'
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              : verificationOutput.overallStatus === 'INCONCLUSIVE'
              ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {verificationOutput.overallStatus === 'PASS' ? (
                <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0" />
              ) : verificationOutput.overallStatus === 'INCONCLUSIVE' ? (
                <AlertTriangle className="w-7 h-7 text-amber-400 shrink-0" />
              ) : (
                <XCircle className="w-7 h-7 text-rose-400 shrink-0" />
              )}
              <div>
                <h3 className="text-base font-bold font-mono">
                  VERIFICATION RESULT: {verificationOutput.overallStatus}
                </h3>
                <p className="text-xs opacity-90 mt-0.5 font-mono">
                  Audit executed at {verificationOutput.timestamp.replace('T', ' ').substring(0, 19)} UTC
                </p>
              </div>
            </div>
            <StatusBadge status={verificationOutput.overallStatus} size="lg" />
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Tier 1: Bitstream SHA-256</span>
              <span className={`font-bold mt-1 block ${verificationOutput.tier1_file.status === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {verificationOutput.tier1_file.status}
              </span>
              <p className="text-[11px] text-slate-300 mt-1">{verificationOutput.tier1_file.findings}</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Tier 2: Merkle Custody Chain</span>
              <span className={`font-bold mt-1 block ${verificationOutput.tier2_chain.status === 'PASS' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {verificationOutput.tier2_chain.status}
              </span>
              <p className="text-[11px] text-slate-300 mt-1">
                {verificationOutput.tier2_chain.eventCount} sequential events verified.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Tier 3: Asymmetric Checkpoint</span>
              <span className={`font-bold mt-1 block ${verificationOutput.tier3_checkpoint.status === 'PASS' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {verificationOutput.tier3_checkpoint.status}
              </span>
              <p className="text-[11px] text-slate-300 mt-1">{verificationOutput.tier3_checkpoint.findings}</p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/60 text-[10px] text-slate-400 italic">
            {verificationOutput.disclaimer}
          </div>
        </div>
      )}

      {/* Forensic Properties Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Metadata */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              Evidentiary Bitstream Properties
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Original Filename:</span>
                <span className="font-semibold text-slate-200 break-all">{evidence.original_filename}</span>
              </div>
              <div>
                <span className="text-slate-500 block">File Size:</span>
                <span className="text-slate-200">
                  {(evidence.file_size_bytes / 1024).toFixed(2)} KB ({evidence.file_size_bytes.toLocaleString()} bytes)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">MIME Type:</span>
                <span className="text-slate-200">{evidence.mime_type}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Evidence Classification:</span>
                <span className="text-cyan-300">{evidence.evidence_type}</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-slate-500 block">Private Internal Storage Identifier:</span>
                <span className="text-slate-400 bg-slate-950 px-2 py-1 rounded block mt-0.5 border border-slate-800 select-all">
                  {evidence.storage_key}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <span className="text-xs font-mono font-bold text-slate-400 block mb-1">
                Authoritative Genesis SHA-256 (Immutable Intake Digest):
              </span>
              <HashDisplay hash={evidence.original_sha256} />
            </div>

            {evidence.notes && (
              <div className="pt-3 border-t border-slate-800 text-xs">
                <span className="text-slate-500 font-mono block">Acquisition Chain Notes:</span>
                <p className="text-slate-300 mt-1 italic">{evidence.notes}</p>
              </div>
            )}
          </div>

          {/* Chain of Custody Summary Card */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 font-mono">
                <GitCommit className="w-4 h-4 text-cyan-400" />
                Custody Chain Timeline ({totalEvents} Events)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographically linked sequential Merkle chain with deterministic RFC 8785 hashes.
              </p>
            </div>
            <button
              onClick={() => onNavigate('custody-timeline', { evidenceId: evidence.id })}
              className="px-4 py-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 text-xs font-mono font-semibold transition-colors"
            >
              Open Interactive Timeline
            </button>
          </div>
        </div>

        {/* Right Column: Custody & Testing Sidebar */}
        <div className="space-y-6">
          {/* Current Custodian */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" />
              Current Custodian of Record
            </h3>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
              <div className="font-bold text-slate-200 text-sm">{evidence.current_custodian_name}</div>
              <div className="text-slate-400">Badge: {evidence.current_custodian_badge || 'N/A'}</div>
              <div className="text-cyan-400 text-[11px]">{evidence.current_custodian_agency}</div>
            </div>

            <button
              onClick={() => onNavigate('transfers', { evidenceId: evidence.id })}
              className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors"
            >
              Transfer Custody to Another Officer
            </button>
          </div>

          {/* Asymmetric Checkpoint Seal */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <KeySquare className="w-4 h-4 text-purple-400" />
              Cryptographic Checkpoint Seal
            </h3>
            {lastCheckpoint ? (
              <div className="text-xs font-mono space-y-1.5">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>Checkpoint #{lastCheckpoint.checkpoint_number}</span>
                  <span className="text-emerald-400">ECDSA-P256</span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Key ID: <span className="text-cyan-400">{lastCheckpoint.key_id}</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Anchored Head Seq: #{lastCheckpoint.chain_head_sequence}
                </div>
                <button
                  onClick={() => onNavigate('checkpoints', { evidenceId: evidence.id })}
                  className="w-full mt-2 py-1.5 rounded bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 border border-purple-800/60 text-[11px] transition-colors"
                >
                  Verify Checkpoint Signature
                </button>
              </div>
            ) : (
              <div className="text-xs text-slate-400 space-y-2">
                <p>No asymmetric checkpoint has been sealed for this head yet.</p>
                <button
                  onClick={() => onNavigate('checkpoints', { evidenceId: evidence.id })}
                  className="w-full py-2 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-purple-200 text-xs font-mono transition-colors"
                >
                  Seal Cryptographic Checkpoint
                </button>
              </div>
            )}
          </div>

          {/* Tamper Simulation Demonstration Studio */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-rose-950/60 space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              Audit Demonstration Mode
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Demonstrate tamper detection: Alter raw file bytes on disk without changing database hash, proving EVIDENCELOCK catches all unauthorized modifications.
            </p>

            <div className="pt-2 flex flex-col gap-2">
              {evidence.is_tampered_test_copy ? (
                <button
                  onClick={handleRestoreBitstream}
                  className="w-full py-2 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-xs font-mono font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore Original Bitstream
                </button>
              ) : (
                <button
                  onClick={handleTamperBitstream}
                  className="w-full py-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 text-xs font-mono font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <AlertTriangle className="w-4 h-4" />
                  Simulate Bitstream Tampering
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
