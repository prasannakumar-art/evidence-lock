import React from 'react';
import {
  Shield,
  FileCheck2,
  GitCommit,
  KeySquare,
  Lock,
  ArrowRight,
  Database,
  Search,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HomeProps {
  onNavigate: (page: string) => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  return (
    <div className="space-y-12 max-w-6xl mx-auto py-6">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 md:p-12 text-center md:text-left">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 text-xs font-mono font-medium mb-4">
            <Shield className="w-3.5 h-3.5" />
            SECURE DIGITAL EVIDENCE & CHAIN-OF-CUSTODY PLATFORM
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-100 tracking-tight leading-tight font-mono">
            EVIDENCELOCK
          </h1>
          <p className="mt-3 text-lg md:text-xl text-cyan-300 font-mono font-medium">
            "Every File Has a History. Every Change Leaves Evidence."
          </p>
          <p className="mt-4 text-slate-400 text-sm md:text-base leading-relaxed">
            A production-grade digital forensics environment engineered to preserve evidentiary
            integrity, verify chunked SHA-256 bitstreams, enforce strict sequential Merkle chain-of-custody,
            detect altered or missing records, and seal cryptographic head checkpoints using asymmetric NIST P-256 ECDSA digital signatures.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center md:justify-start gap-4">
            {user ? (
              <button
                onClick={() => onNavigate(user.role === 'AUDITOR' ? 'auditor-dashboard' : user.role === 'ADMINISTRATOR' ? 'admin-dashboard' : 'investigator-dashboard')}
                className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-950 flex items-center gap-2 font-mono"
              >
                Enter {user.role} Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onNavigate('login')}
                className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-950 flex items-center gap-2 font-mono"
              >
                Sign In to Vault
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onNavigate('verify-evidence')}
              className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium text-sm transition-colors flex items-center gap-2"
            >
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              Interactive Verification Studio
            </button>
            <button
              onClick={() => onNavigate('security')}
              className="px-6 py-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Security Architecture
            </button>
          </div>
        </div>
      </section>

      {/* 4 Pillars of Evidentiary Trust */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all">
          <div>
            <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 flex items-center justify-center mb-4">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Chunked SHA-256 Hashing</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Complete raw file bytes are streamed in 64KB chunks to generate an immutable 256-bit cryptographic digest. Never trusts client filenames or filesystem metadata.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800/80 text-[11px] font-mono text-cyan-400">
            FIPS 180-4 Compliant
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-950/80 border border-blue-800/60 text-blue-400 flex items-center justify-center mb-4">
              <GitCommit className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Merkle Chain of Custody</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Every action is serialized into canonical RFC 8785 JSON, bound to its previous event hash, and ordered by sequence. Automatically detects reordered, altered, or deleted events.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800/80 text-[11px] font-mono text-blue-400">
            Cryptographic Audit Links
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all">
          <div>
            <div className="w-10 h-10 rounded-lg bg-purple-950/80 border border-purple-800/60 text-purple-400 flex items-center justify-center mb-4">
              <KeySquare className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Asymmetric Checkpoints</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Custody chain heads are sealed using NIST P-256 ECDSA digital signatures. The private signing key resides outside the database, ensuring no administrator can silently rewrite history.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800/80 text-[11px] font-mono text-purple-400">
            ECDSA P-256 Signatures
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all">
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Private Staged Storage</h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Evidence files are quarantined in staged storage, sanitized against path traversal, assigned internal UUID storage keys, and moved to private vaults only after validation.
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800/80 text-[11px] font-mono text-emerald-400">
            Zero Direct Path Access
          </div>
        </div>
      </section>

      {/* Forensic workflow summary */}
      <section className="rounded-xl bg-slate-900/40 border border-slate-800/80 p-8">
        <h3 className="text-lg font-bold text-slate-100 font-mono flex items-center gap-2">
          <Database className="w-5 h-5 text-cyan-400" />
          End-to-End Forensic Integrity Pipeline
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          How EvidenceLock maintains an unassailable digital chain of custody from seizure to courtroom.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
            <span className="font-mono text-cyan-400 font-bold">STAGE 01</span>
            <h4 className="font-semibold text-slate-200 text-sm">Secure Intake & Staging</h4>
            <p className="text-slate-400 leading-relaxed">
              Files are streamed into temporary quarantine. The system sanitizes filenames, calculates initial chunked SHA-256, commits to private storage, and creates the genesis custody event.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
            <span className="font-mono text-cyan-400 font-bold">STAGE 02</span>
            <h4 className="font-semibold text-slate-200 text-sm">Continuous Hash-Linked Custody</h4>
            <p className="text-slate-400 leading-relaxed">
              Every custody transfer, examination, or access is recorded as an immutable event. Each event commits to the previous event hash, forming an unbroken cryptographic timeline.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
            <span className="font-mono text-cyan-400 font-bold">STAGE 03</span>
            <h4 className="font-semibold text-slate-200 text-sm">Verification & Certification</h4>
            <p className="text-slate-400 leading-relaxed">
              Any investigator or auditor can trigger a 3-tier audit: 1. Bitstream SHA-256, 2. Merkle custody links, 3. Asymmetric ECDSA checkpoint signature, generating downloadable certified PDF reports.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
