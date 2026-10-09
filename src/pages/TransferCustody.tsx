import React, { useState, useEffect } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Plus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { CustodyTransfer, Evidence, User as UserType } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

interface TransferCustodyProps {
  onNavigate: (page: string, params?: any) => void;
}

export const TransferCustody: React.FC<TransferCustodyProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<CustodyTransfer[]>([]);
  const [myEvidence, setMyEvidence] = useState<Evidence[]>([]);
  const [investigators, setInvestigators] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  // New transfer modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [selectedToUserId, setSelectedToUserId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [trData, evData, usersData] = await Promise.all([
        api.custody.listTransfers(),
        api.evidence.list({ status: 'IN_CUSTODY' }),
        api.admin.listUsers(),
      ]);
      setTransfers(trData.transfers);
      // Items where current user is custodian
      const myItems = evData.items.filter((e) => user?.role === 'ADMINISTRATOR' || e.current_custodian_id === user?.id);
      setMyEvidence(myItems);
      if (myItems.length > 0 && !selectedEvidenceId) {
        setSelectedEvidenceId(myItems[0].id);
      }
      // Target investigators (exclude current user)
      const targetUsers = usersData.users.filter((u) => u.id !== user?.id && u.is_active === 1);
      setInvestigators(targetUsers);
      if (targetUsers.length > 0 && !selectedToUserId) {
        setSelectedToUserId(targetUsers[0].id);
      }
    } catch (err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvidenceId || !selectedToUserId || !reason.trim()) {
      setError('Evidence item, recipient, and official transfer reason are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.custody.requestTransfer({
        evidenceId: selectedEvidenceId,
        toUserId: selectedToUserId,
        reason: reason.trim(),
      });
      setIsModalOpen(false);
      setReason('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Transfer request failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptTransfer = async (id: string) => {
    try {
      await api.custody.acceptTransfer(id);
      await loadData();
    } catch (err: any) {
      alert(`Accept failed: ${err.message}`);
    }
  };

  const handleRejectTransfer = async (id: string) => {
    const reasonPrompt = prompt('Provide formal reason for rejecting custody transfer:');
    if (reasonPrompt === null) return;
    try {
      await api.custody.rejectTransfer(id, reasonPrompt);
      await loadData();
    } catch (err: any) {
      alert(`Reject failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              Chain-of-Custody Transfer Management
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Formal multi-party custody assignments with optimistic concurrency version locks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsModalOpen(true);
              setError(null);
            }}
            disabled={myEvidence.length === 0}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-md shadow-cyan-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Request Custody Transfer
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Transfers Registry Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-100 text-sm">Transfer Dockets</h3>
          <span className="text-xs text-slate-400 font-mono">{transfers.length} Total Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Item ID</th>
                <th className="py-3 px-4">Case Docket</th>
                <th className="py-3 px-4">From Custodian</th>
                <th className="py-3 px-4">Designated Recipient</th>
                <th className="py-3 px-4">Reason / Notes</th>
                <th className="py-3 px-4">Requested At</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    No custody transfer requests recorded.
                  </td>
                </tr>
              ) : (
                transfers.map((t) => {
                  const isRecipient = user?.id === t.to_user_id || user?.role === 'ADMINISTRATOR';
                  const isPending = t.status === 'PENDING';

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-cyan-300">{t.item_number}</td>
                      <td className="py-3 px-4 text-slate-400">{t.case_number}</td>
                      <td className="py-3 px-4 text-slate-300">
                        <div>{t.from_user_name}</div>
                        <div className="text-[10px] text-slate-500">{t.from_user_agency}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div>{t.to_user_name}</div>
                        <div className="text-[10px] text-slate-500">{t.to_user_agency}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-300" title={t.reason}>
                        {t.reason}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {t.requested_at.replace('T', ' ').substring(0, 16)} UTC
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={t.status} size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {isPending && isRecipient ? (
                          <>
                            <button
                              onClick={() => handleAcceptTransfer(t.id)}
                              className="px-2.5 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 text-[11px] transition-colors"
                            >
                              Accept Custody
                            </button>
                            <button
                              onClick={() => handleRejectTransfer(t.id)}
                              className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-[11px] transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => onNavigate('custody-timeline', { evidenceId: t.evidence_id })}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
                          >
                            Timeline
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transfer Request Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Initiate Custody Transfer"
        subtitle="Requires authorized recipient acceptance to seal custody assignment"
      >
        <form onSubmit={handleCreateTransfer} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Select Evidence Item *
            </label>
            <select
              required
              value={selectedEvidenceId}
              onChange={(e) => setSelectedEvidenceId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            >
              {myEvidence.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.item_number} — {e.original_filename} ({e.case_number})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Designated Recipient (Authorized Investigator) *
            </label>
            <select
              required
              value={selectedToUserId}
              onChange={(e) => setSelectedToUserId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            >
              {investigators.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role}) — {u.agency}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Transfer Justification & Chain Notes *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
              placeholder="E.g., Transfer to forensic laboratory for physical memory chip extraction."
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
              {submitting ? 'Recording Event...' : 'Request Custody Transfer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
