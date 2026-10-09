import React, { useState, useEffect } from 'react';
import {
  GitCommit,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Clock,
  User,
  Hash,
  RefreshCw,
  Bug,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';
import { CustodyEvent, Evidence } from '../types';
import { HashDisplay } from '../components/common/HashDisplay';
import { StatusBadge } from '../components/common/StatusBadge';

interface CustodyTimelineProps {
  initialEvidenceId?: string;
  onNavigate: (page: string, params?: any) => void;
}

export const CustodyTimeline: React.FC<CustodyTimelineProps> = ({ initialEvidenceId, onNavigate }) => {
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState(initialEvidenceId || '');
  const [events, setEvents] = useState<CustodyEvent[]>([]);
  const [chainIntegrity, setChainIntegrity] = useState<any | null>(null);
  const [auditResult, setAuditResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [auditing, setAuditing] = useState(false);

  useEffect(() => {
    api.evidence.list()
      .then((res) => {
        setEvidenceList(res.items || []);
        if (!selectedEvidenceId && res.items && res.items.length > 0) {
          setSelectedEvidenceId(res.items[0].id);
        }
      })
      .catch(() => {
        // Retain empty list if service is temporarily unavailable
        setEvidenceList([]);
      });
  }, []);

  const loadTimeline = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setAuditResult(null);
    try {
      const data = await api.custody.getEvents(id);
      setEvents(data.events);
      setChainIntegrity(data.chainIntegrity);
    } catch (err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEvidenceId) {
      loadTimeline(selectedEvidenceId);
    }
  }, [selectedEvidenceId]);

  const handleVerifyChain = async () => {
    if (!selectedEvidenceId) return;
    setAuditing(true);
    try {
      const res = await api.custody.verifyChain(selectedEvidenceId);
      setAuditResult(res);
      await loadTimeline(selectedEvidenceId);
    } catch (err: any) {
      alert(`Chain audit failed: ${err.message}`);
    } finally {
      setAuditing(false);
    }
  };

  const handleSimulateTamperEvent = async (seqNumber: number) => {
    if (!selectedEvidenceId) return;
    try {
      await api.evidence.tamperEventTest(selectedEvidenceId, seqNumber);
      alert(`Tampered event seq #${seqNumber} payload in database. Run chain audit now to observe the broken hash link!`);
      await loadTimeline(selectedEvidenceId);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const selectedEvidence = evidenceList.find((e) => e.id === selectedEvidenceId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      {/* Header and selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              Chain-of-Custody Merkle Timeline
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Sequential cryptographic hash-linked chain with deterministic RFC 8785 canonical serialization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedEvidenceId}
            onChange={(e) => setSelectedEvidenceId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
          >
            {evidenceList.map((e) => (
              <option key={e.id} value={e.id}>
                {e.item_number} — {e.original_filename}
              </option>
            ))}
          </select>

          <button
            onClick={handleVerifyChain}
            disabled={auditing}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-1.5 shadow-md shadow-cyan-950"
          >
            <ShieldCheck className="w-4 h-4" />
            {auditing ? 'Auditing Merkle Links...' : 'Audit Entire Chain'}
          </button>
        </div>
      </div>

      {/* Selected Evidence Item Summary */}
      {selectedEvidence && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-500 text-[10px] block">Item / Case:</span>
            <span className="font-bold text-cyan-300">
              {selectedEvidence.item_number} ({selectedEvidence.case_number})
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Custodian of Record:</span>
            <span className="text-slate-200">{selectedEvidence.current_custodian_name}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Genesis Digest:</span>
            <HashDisplay hash={selectedEvidence.original_sha256} truncate />
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Head Hash:</span>
            <span className="text-slate-300">
              {chainIntegrity?.headHash ? `${chainIntegrity.headHash.substring(0, 16)}...` : 'N/A'}
            </span>
          </div>
        </div>
      )}

      {/* Audit Banner if executed */}
      {auditResult && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            auditResult.result === 'PASS'
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {auditResult.result === 'PASS' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
            )}
            <div>
              <h4 className="font-bold font-mono text-xs">
                CHAIN VERIFICATION: {auditResult.result} ({auditResult.eventCount} Events Audited)
              </h4>
              <p className="text-[11px] opacity-90 mt-0.5">
                {auditResult.result === 'PASS'
                  ? 'All sequential previous-hash pointers and deterministic hashes match perfectly.'
                  : auditResult.discrepancies.join(' | ')}
              </p>
            </div>
          </div>
          <StatusBadge status={auditResult.result} size="md" />
        </div>
      )}

      {/* Visual Timeline Tree */}
      <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
        {events.map((event, idx) => {
          const isGenesis = event.sequence_number === 1;
          const isBroken = event.isHashValid === false || event.isLinkValid === false;

          return (
            <div key={event.id} className="relative group">
              {/* Timeline Node Icon */}
              <div
                className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-mono font-bold transition-all ${
                  isBroken
                    ? 'bg-rose-950 border-rose-500 text-rose-300 animate-bounce'
                    : isGenesis
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                    : 'bg-slate-950 border-slate-700 text-slate-300 group-hover:border-cyan-400'
                }`}
              >
                {event.sequence_number}
              </div>

              {/* Event Card */}
              <div
                className={`p-6 rounded-2xl border transition-all ${
                  isBroken
                    ? 'bg-rose-950/20 border-rose-500/80 shadow-lg shadow-rose-950/30'
                    : 'bg-slate-900 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      SEQ #{event.sequence_number}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-950 text-slate-200 border border-slate-800">
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                    {isGenesis && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800">
                        GENESIS ROOT
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {event.timestamp.replace('T', ' ').substring(0, 19)} UTC
                    </span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      {event.actor_name} ({event.actor_badge || event.actor_role})
                    </span>
                  </div>
                </div>

                {/* Reason / Details */}
                <div className="py-3 text-xs text-slate-300">
                  <p className="font-medium text-slate-200">{event.reason || 'No additional reason provided'}</p>
                </div>

                {/* Cryptographic Link Badges */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-500">Previous Event Hash Link:</span>
                    <span
                      className={`break-all ${
                        event.isLinkValid === false ? 'text-rose-400 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {event.previous_event_hash}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-500">Calculated Event Hash (Canonical RFC 8785):</span>
                    <span
                      className={`break-all font-semibold ${
                        event.isHashValid === false ? 'text-rose-400 font-bold' : 'text-cyan-300'
                      }`}
                    >
                      {event.event_hash}
                    </span>
                  </div>
                </div>

                {/* Parsed JSON payload drawer */}
                {event.action_details_parsed && (
                  <div className="mt-4 pt-3 border-t border-slate-800/60">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Deterministic Canonical Payload (JSON):
                    </span>
                    <pre className="p-3 rounded-lg bg-slate-950 text-cyan-200/90 text-[11px] font-mono overflow-x-auto border border-slate-800/60">
                      {JSON.stringify(event.action_details_parsed, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Audit Tamper Demo Trigger */}
                <div className="mt-3 pt-2 border-t border-slate-800/40 flex justify-end">
                  <button
                    onClick={() => handleSimulateTamperEvent(event.sequence_number)}
                    className="text-[10px] font-mono text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1"
                    title="Audit demonstration: tamper with this event in database to test Merkle link verification"
                  >
                    <Bug className="w-3 h-3" />
                    Simulate Event Tampering
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
