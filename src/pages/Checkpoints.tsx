import React, { useState, useEffect } from 'react';
import {
  KeySquare,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Download,
  AlertTriangle,
  FileCheck2,
} from 'lucide-react';
import { api } from '../services/api';
import { SignedCheckpoint, Evidence } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

interface CheckpointsProps {
  initialEvidenceId?: string;
  onNavigate: (page: string, params?: any) => void;
}

export const Checkpoints: React.FC<CheckpointsProps> = ({ initialEvidenceId, onNavigate }) => {
  const [checkpoints, setCheckpoints] = useState<SignedCheckpoint[]>([]);
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(initialEvidenceId || '');
  const [jurisdictionNote, setJurisdictionNote] = useState('Office of Inspector General - Judicial Evidentiary Seal');
  const [submitting, setSubmitting] = useState(false);

  // Public key modal
  const [isPubKeyOpen, setIsPubKeyOpen] = useState(false);
  const [pubKeyData, setPubKeyData] = useState<any | null>(null);

  // Verification outcome
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<string, any>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [chkData, evData] = await Promise.all([
        api.checkpoints.list(initialEvidenceId),
        api.evidence.list(),
      ]);
      setCheckpoints(chkData.checkpoints);
      setEvidenceList(evData.items);
      if (evData.items.length > 0 && !selectedEvidenceId) {
        setSelectedEvidenceId(evData.items[0].id);
      }
    } catch (err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [initialEvidenceId]);

  const handleCreateCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvidenceId) return;

    setSubmitting(true);
    try {
      await api.checkpoints.create({
        evidenceId: selectedEvidenceId,
        jurisdictionNote,
      });
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Checkpoint creation failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifySignature = async (id: string) => {
    setVerifyingId(id);
    try {
      const res = await api.checkpoints.verify(id);
      setVerificationResults((prev) => ({ ...prev, [id]: res }));
    } catch (err: any) {
      alert(`Signature verification failed: ${err.message}`);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleViewPublicKey = async () => {
    try {
      const res = await api.checkpoints.getPublicKey();
      setPubKeyData(res);
      setIsPubKeyOpen(true);
    } catch (err: any) {
      alert(`Failed to load public key: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <KeySquare className="w-5 h-5 text-purple-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              Protected Asymmetric Checkpoint Registry
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Digitally signed custody-chain head anchors using NIST P-256 ECDSA. Keys reside outside database.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleViewPublicKey}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors flex items-center gap-1.5"
          >
            Public Verification Key
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={evidenceList.length === 0}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-md shadow-purple-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Seal New Checkpoint
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Checkpoints Cards */}
      <div className="space-y-4">
        {checkpoints.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs rounded-xl bg-slate-900 border border-slate-800">
            No signed cryptographic checkpoints created yet.
          </div>
        ) : (
          checkpoints.map((chk) => {
            const vRes = verificationResults[chk.id];
            const isVerifying = verifyingId === chk.id;

            return (
              <div
                key={chk.id}
                className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-800 text-purple-300 flex items-center justify-center font-mono font-bold text-xs">
                      #{chk.checkpoint_number}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-200 text-sm font-mono">
                        Checkpoint ID: {chk.id}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">
                        Evidence Item: {chk.item_number} ({chk.original_filename})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVerifySignature(chk.id)}
                      disabled={isVerifying}
                      className="px-3.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 text-xs font-mono font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {isVerifying ? 'Verifying ECDSA...' : 'Verify Signature'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Signer Authority:</span>
                    <span className="text-slate-200">{chk.signer_name} ({chk.signer_agency})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Algorithm & Key:</span>
                    <span className="text-purple-300">
                      {chk.algorithm} | Key ID: {chk.key_id}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Anchored Chain Head Seq:</span>
                    <span className="text-slate-200 font-bold">Sequence #{chk.chain_head_sequence}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Timestamp:</span>
                    <span className="text-slate-400">
                      {chk.timestamp.replace('T', ' ').substring(0, 19)} UTC
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-500 block text-[10px]">Anchored Chain Head Hash:</span>
                    <span className="text-cyan-300 break-all bg-slate-950 px-2 py-1 rounded block mt-0.5 border border-slate-800 select-all">
                      {chk.chain_head_hash}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-500 block text-[10px]">ECDSA Digital Signature (Hex):</span>
                    <span className="text-slate-400 break-all bg-slate-950 px-2 py-1 rounded block mt-0.5 border border-slate-800 select-all text-[11px]">
                      {chk.signature_hex}
                    </span>
                  </div>
                </div>

                {/* Live verification card if run */}
                {vRes && (
                  <div
                    className={`mt-4 p-4 rounded-xl border flex items-center justify-between text-xs font-mono ${
                      vRes.result === 'PASS'
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                        : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {vRes.result === 'PASS' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold">SIGNATURE AUDIT: {vRes.result}</span>
                        <p className="text-[11px] opacity-90 mt-0.5">{vRes.findings}</p>
                      </div>
                    </div>
                    <StatusBadge status={vRes.result} size="md" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Seal New Checkpoint Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Seal Asymmetric Cryptographic Checkpoint"
        subtitle="Digitally signs current chain head using NIST P-256 ECDSA"
      >
        <form onSubmit={handleCreateCheckpoint} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Select Evidence Record *
            </label>
            <select
              required
              value={selectedEvidenceId}
              onChange={(e) => setSelectedEvidenceId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
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
              Jurisdictional Authority & Seal Purpose
            </label>
            <input
              type="text"
              required
              value={jurisdictionNote}
              onChange={(e) => setJurisdictionNote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
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
              className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs font-mono transition-all flex items-center gap-2"
            >
              <KeySquare className="w-4 h-4" />
              {submitting ? 'Signing Payload...' : 'Digitally Sign Checkpoint'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Public Key Modal */}
      <Modal
        isOpen={isPubKeyOpen}
        onClose={() => setIsPubKeyOpen(false)}
        title="Public Verification Key"
        subtitle="Publicly accessible SPKI PEM for external audit verification"
      >
        {pubKeyData && (
          <div className="space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between text-slate-300">
              <span>Algorithm: {pubKeyData.algorithm}</span>
              <span className="text-cyan-400 font-bold">Key ID: {pubKeyData.keyId}</span>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 text-cyan-300 text-[11px] font-mono border border-slate-800 select-all overflow-x-auto whitespace-pre">
              {pubKeyData.publicKeyPem}
            </pre>

            <p className="text-[11px] text-slate-400 leading-relaxed italic">
              {pubKeyData.disclaimer}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
