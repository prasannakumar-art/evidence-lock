import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  HardDrive,
  GitCommit,
  KeySquare,
  Search,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { Evidence } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';
import { AlertBanner } from '../components/common/AlertBanner';

interface VerifyEvidenceProps {
  onNavigate: (page: string, params?: any) => void;
}

export const VerifyEvidence: React.FC<VerifyEvidenceProps> = ({ onNavigate }) => {
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [vaultResult, setVaultResult] = useState<any | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);

  // External candidate verification state
  const [candidateFile, setCandidateFile] = useState<File | null>(null);
  const [candidateTargetId, setCandidateTargetId] = useState('');
  const [verifyingCandidate, setVerifyingCandidate] = useState(false);
  const [candidateResult, setCandidateResult] = useState<any | null>(null);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  useEffect(() => {
    api.evidence.list()
      .then((res) => {
        setEvidenceList(res.items || []);
        if (res.items && res.items.length > 0) {
          setSelectedEvidenceId(res.items[0].id);
        }
      })
      .catch((err) => {
        setVaultError(err.message || 'Failed to populate evidence list.');
        setEvidenceList([]);
      });
  }, []);

  const handleRunVaultVerification = async () => {
    if (!selectedEvidenceId) {
      setVaultError('Please select an evidence record from the dropdown.');
      return;
    }
    setVerifying(true);
    setVaultResult(null);
    setVaultError(null);
    try {
      const res = await api.verification.verifyFull(selectedEvidenceId);
      setVaultResult(res);
    } catch (err: any) {
      setVaultError(err.message || 'Verification audit failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateFile) {
      setCandidateError('Please choose an external file to verify.');
      return;
    }

    setVerifyingCandidate(true);
    setCandidateResult(null);
    setCandidateError(null);

    const formData = new FormData();
    formData.append('candidateFile', candidateFile);
    if (candidateTargetId) {
      formData.append('targetEvidenceId', candidateTargetId);
    }

    try {
      const res = await api.verification.verifyExternal(formData);
      setCandidateResult(res);
    } catch (err: any) {
      setCandidateError(err.message || 'External file verification failed.');
    } finally {
      setVerifyingCandidate(false);
    }
  };

  const selectedEvidence = evidenceList.find((e) => e.id === selectedEvidenceId);

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-cyan-400" />
          <h1 className="text-xl font-bold text-slate-100 font-mono">
            Forensic Integrity Verification Studio
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Perform multi-tier cryptographic integrity audits against stored bitstreams and independent evidence files.
        </p>
      </div>

      {/* Mode A: Internal Vault Verification */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider block">
              MODE A
            </span>
            <h2 className="text-base font-semibold text-slate-100 mt-0.5">
              Vault Bitstream & Chain of Custody Audit
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">3-Tier Multi-Dimensional Inspection</span>
        </div>

        {vaultError && (
          <AlertBanner
            type="error"
            title="Vault Verification Issue"
            message={vaultError}
            onClose={() => setVaultError(null)}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
              Select Evidence Record to Audit
            </label>
            <select
              value={selectedEvidenceId}
              onChange={(e) => {
                setSelectedEvidenceId(e.target.value);
                setVaultResult(null);
              }}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
            >
              {evidenceList.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.item_number} — {e.original_filename} ({e.case_number})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleRunVaultVerification}
              disabled={verifying || !selectedEvidenceId}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition-all flex items-center justify-center gap-2 shadow-md shadow-cyan-950"
            >
              <FileCheck2 className="w-4 h-4" />
              {verifying ? 'Executing 3-Tier Check...' : 'Audit Selected Evidence'}
            </button>
          </div>
        </div>

        {selectedEvidence && (
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 text-[10px] block">Trusted Genesis SHA-256:</span>
              <HashDisplay hash={selectedEvidence.original_sha256} />
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">Current Custodian:</span>
              <span className="text-slate-200">{selectedEvidence.current_custodian_name}</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">Case Docket:</span>
              <span className="text-cyan-300">{selectedEvidence.case_number}</span>
            </div>
          </div>
        )}

        {/* Vault Audit Result Cards */}
        {vaultResult && (
          <div className="space-y-4 pt-2">
            <div
              className={`p-6 rounded-xl border flex items-center justify-between ${
                vaultResult.overallStatus === 'PASS'
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                  : vaultResult.overallStatus === 'INCONCLUSIVE'
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-200'
                  : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {vaultResult.overallStatus === 'PASS' ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                ) : vaultResult.overallStatus === 'INCONCLUSIVE' ? (
                  <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
                ) : (
                  <XCircle className="w-8 h-8 text-rose-400 shrink-0" />
                )}
                <div>
                  <h3 className="font-bold text-base font-mono">
                    OVERALL STATUS: {vaultResult.overallStatus}
                  </h3>
                  <p className="text-xs opacity-90 mt-0.5 font-mono">
                    Audit Run ID: {vaultResult.verificationRunId}
                  </p>
                </div>
              </div>
              <StatusBadge status={vaultResult.overallStatus} size="lg" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
              {/* Tier 1 */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    Tier 1: Bitstream
                  </span>
                  <StatusBadge status={vaultResult.tier1_file.status} size="sm" />
                </div>
                <div className="text-[11px] text-slate-400">{vaultResult.tier1_file.findings}</div>
                {vaultResult.tier1_file.calculatedSha256 && (
                  <div className="pt-2 border-t border-slate-800 text-[10px]">
                    <span className="text-slate-500 block">Current Bitstream Hash:</span>
                    <span className="text-cyan-300 break-all">{vaultResult.tier1_file.calculatedSha256}</span>
                  </div>
                )}
              </div>

              {/* Tier 2 */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <GitCommit className="w-4 h-4 text-blue-400" />
                    Tier 2: Merkle Custody
                  </span>
                  <StatusBadge status={vaultResult.tier2_chain.status} size="sm" />
                </div>
                <div className="text-[11px] text-slate-400">
                  {vaultResult.tier2_chain.eventCount} sequential custody events audited.
                </div>
                {vaultResult.tier2_chain.discrepancies.length > 0 && (
                  <div className="text-rose-400 text-[10px]">
                    {vaultResult.tier2_chain.discrepancies.join(', ')}
                  </div>
                )}
              </div>

              {/* Tier 3 */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <KeySquare className="w-4 h-4 text-purple-400" />
                    Tier 3: Checkpoint Seal
                  </span>
                  <StatusBadge status={vaultResult.tier3_checkpoint.status} size="sm" />
                </div>
                <div className="text-[11px] text-slate-400">{vaultResult.tier3_checkpoint.findings}</div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[10px] text-slate-400 italic">
              {vaultResult.disclaimer}
            </div>
          </div>
        )}
      </div>

      {/* Mode B: External File Hash Matcher */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider block">
              MODE B
            </span>
            <h2 className="text-base font-semibold text-slate-100 mt-0.5">
              Candidate File Matcher & Reverse Lookup
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">External Desktop Bitstream Verification</span>
        </div>

        <form onSubmit={handleVerifyCandidate} className="space-y-4">
          {candidateError && (
            <AlertBanner
              type="error"
              title="Candidate Matcher Error"
              message={candidateError}
              onClose={() => setCandidateError(null)}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Select Local File from Examiner Workstation *
              </label>
              <input
                type="file"
                required
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setCandidateFile(e.target.files[0]);
                    setCandidateResult(null);
                  }
                }}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-800 file:text-slate-200 file:text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                Target Evidence Item (Optional: leave blank to search whole vault)
              </label>
              <select
                value={candidateTargetId}
                onChange={(e) => setCandidateTargetId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
              >
                <option value="">Search all evidence records in database</option>
                {evidenceList.map((e) => (
                  <option key={e.id} value={e.id}>
                    Match against {e.item_number} ({e.original_filename})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={verifyingCandidate || !candidateFile}
              className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold text-xs font-mono transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4 text-cyan-400" />
              {verifyingCandidate ? 'Computing Chunked Hash...' : 'Compute SHA-256 & Match'}
            </button>
          </div>
        </form>

        {candidateResult && (
          <div
            className={`p-6 rounded-xl border space-y-4 ${
              candidateResult.matchesTarget
                ? 'bg-emerald-950/30 border-emerald-500/50'
                : 'bg-amber-950/30 border-amber-500/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {candidateResult.matchesTarget ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-sm text-slate-100 font-mono">
                    {candidateResult.matchesTarget ? 'MATCH CONFIRMED' : 'NO RECORD MATCH'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">{candidateResult.message}</p>
                </div>
              </div>
              <StatusBadge status={candidateResult.matchesTarget ? 'PASS' : 'FAIL'} size="md" />
            </div>

            <div className="p-3 rounded-lg bg-slate-950 text-xs font-mono space-y-1">
              <span className="text-slate-500 block">Candidate File Calculated SHA-256:</span>
              <span className="text-cyan-300 break-all">{candidateResult.candidateSha256}</span>
            </div>

            {candidateResult.matchedEvidence && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono space-y-2">
                <span className="text-emerald-400 font-bold block">Matched Registered Evidence:</span>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>Item ID: {candidateResult.matchedEvidence.itemNumber}</div>
                  <div>Filename: {candidateResult.matchedEvidence.originalFilename}</div>
                  <div>Intake: {candidateResult.matchedEvidence.uploadTimestamp}</div>
                </div>
                <button
                  onClick={() => onNavigate('evidence-details', { id: candidateResult.matchedEvidence.id })}
                  className="mt-2 text-cyan-400 hover:underline flex items-center gap-1"
                >
                  Inspect Matched Record
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
