import React from 'react';
import {
  Shield,
  Lock,
  KeySquare,
  FileCheck2,
  AlertTriangle,
  Database,
  GitCommit,
  CheckCircle2,
} from 'lucide-react';

export const Security: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      <div>
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-cyan-400" />
          <h1 className="text-xl font-bold text-slate-100 font-mono">
            Cryptographic Architecture & Threat Model
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Technical specifications of evidentiary integrity primitives, key isolation, and adversary defenses.
        </p>
      </div>

      {/* Critical Core Concept: Hash-Linked Databases vs. Immutability */}
      <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-800/60 space-y-3">
        <div className="flex items-center gap-2 text-amber-300 font-mono text-xs font-bold uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          Cryptographic Principle: Why Hash-Chains Alone Are Not Immutable
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          A fundamental digital forensics mistake is claiming a hash-linked database is "inherently immutable".
          Any adversary with database root access could theoretically rewrite historical records and recompute all hashes forward.
          <strong className="text-amber-200 block mt-1">
            EVIDENCELOCK prevents this by anchoring chain heads into independently signed cryptographic checkpoints using an asymmetric private key stored outside the database.
          </strong>
          Once a checkpoint is signed and published, an attacker cannot rewrite history without invalidating the cryptographic signature of the external checkpoint anchor.
        </p>
      </div>

      {/* 4 Pillars of Cryptography */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase">
            <FileCheck2 className="w-4 h-4" />
            1. Chunked Streaming SHA-256 (FIPS 180-4)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            All evidence files are ingested using a 64KB chunked stream directly into crypto digests. The original file bytes are stored separately in private storage, and the resulting 256-bit hash is sealed into the genesis custody record. Never relies on frontend checksums or unverified file headers.
          </p>
          <div className="text-[11px] font-mono text-cyan-300 bg-slate-950 p-2.5 rounded border border-slate-800">
            digest = SHA-256(raw_file_bytes)
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-blue-400 font-mono text-xs font-bold uppercase">
            <GitCommit className="w-4 h-4" />
            2. Canonical Deterministic JSON (RFC 8785)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Standard JSON serialization is non-deterministic (key order varies by runtime). EVIDENCELOCK implements recursive dictionary key sorting per RFC 8785 so identical event payloads produce identical UTF-8 bitstreams across any runtime.
          </p>
          <div className="text-[11px] font-mono text-blue-300 bg-slate-950 p-2.5 rounded border border-slate-800">
            event_hash = SHA-256(prev_hash + ":" + CanonicalJSON(payload))
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-purple-400 font-mono text-xs font-bold uppercase">
            <KeySquare className="w-4 h-4" />
            3. Asymmetric Checkpoint Signatures (NIST P-256)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Custody chain heads are sealed using Elliptic Curve Digital Signature Algorithm (ECDSA) over the secp256r1 prime256v1 curve. The private signing key resides with restrictive permissions outside database tables, and the public key is published for independent auditor verification.
          </p>
          <div className="text-[11px] font-mono text-purple-300 bg-slate-950 p-2.5 rounded border border-slate-800">
            signature = ECDSA_Sign(K_private, CanonicalJSON(checkpoint))
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold uppercase">
            <Lock className="w-4 h-4" />
            4. Private Staged Vault & Path Sanitization
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Uploaded files are quarantined in a temporary staging area with randomized identifiers. The system sanitizes null bytes, directory traversal patterns (<code className="text-emerald-300 font-mono">../</code>), and invalid characters before generating a UUID storage key in the restricted private vault.
          </p>
          <div className="text-[11px] font-mono text-emerald-300 bg-slate-950 p-2.5 rounded border border-slate-800">
            storage_path = /storage/evidence/ev_UUID.ext
          </div>
        </div>
      </div>

      {/* Threat Model Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="font-semibold text-slate-100 text-xs font-mono uppercase tracking-wider">
            Adversary Threat Model & Architectural Defenses
          </h3>
        </div>
        <div className="overflow-x-auto text-xs font-mono">
          <table className="w-full text-left">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Threat / Attack Vector</th>
                <th className="py-3 px-4">Consequence if Defenseless</th>
                <th className="py-3 px-4">EVIDENCELOCK Architectural Defense</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td className="py-3 px-4 font-bold text-rose-300">Bitstream Alteration on Disk</td>
                <td className="py-3 px-4 text-slate-400">Silent corruption or planted digital files</td>
                <td className="py-3 px-4 text-emerald-400">
                  Chunked SHA-256 recalculation immediately detects even a single bit mismatch against genesis record.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-rose-300">Custody History Rewrite</td>
                <td className="py-3 px-4 text-slate-400">Covering tracks of unauthorized evidence access</td>
                <td className="py-3 px-4 text-emerald-400">
                  Merkle hash-chain and asymmetric ECDSA checkpoint signatures reject modified or reordered history.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-rose-300">Path Traversal (LFI)</td>
                <td className="py-3 px-4 text-slate-400">Arbitrary server file overwrite (/etc/passwd)</td>
                <td className="py-3 px-4 text-emerald-400">
                  User filenames are never used as disk paths. Sanitization and internal UUID keys isolate storage.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-rose-300">Conflicting Transfers</td>
                <td className="py-3 px-4 text-slate-400">Race conditions and dual custody confusion</td>
                <td className="py-3 px-4 text-emerald-400">
                  Optimistic sequence version verification in ACID transactions rolls back conflicting concurrent actions.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
