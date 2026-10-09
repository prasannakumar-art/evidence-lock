import React from 'react';
import { BookOpen, Shield, Award, CheckCircle2, AlertTriangle, Scale } from 'lucide-react';

export const About: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-cyan-400" />
          <h1 className="text-xl font-bold text-slate-100 font-mono">
            Forensic Standards & Evidentiary Principles
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Alignment with international digital forensics frameworks and evidentiary admissibility standards.
        </p>
      </div>

      {/* ISO / NIST / FRE Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-xs font-mono">
            ISO
          </div>
          <h3 className="font-semibold text-slate-100 text-sm">ISO/IEC 27037:2012</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            International standard governing the identification, collection, acquisition, and preservation of digital evidence.
            Specifies that digital evidence must be protected from unauthorized modification through validated hashing and complete chain-of-custody documentation.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="w-9 h-9 rounded-lg bg-blue-950 text-blue-400 flex items-center justify-center font-bold text-xs font-mono">
            NIST
          </div>
          <h3 className="font-semibold text-slate-100 text-sm">NIST SP 800-86</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            National Institute of Standards and Technology guide to integrating forensic techniques into incident response.
            Defines forensic phases (Collection, Examination, Analysis, Reporting) and mandates cryptographic integrity validation throughout artifact lifecycles.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="w-9 h-9 rounded-lg bg-purple-950 text-purple-400 flex items-center justify-center font-bold text-xs font-mono">
            FRE
          </div>
          <h3 className="font-semibold text-slate-100 text-sm">FRE 902(13) & 902(14)</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Federal Rules of Evidence for self-authenticating digital records. Permits certified electronic records and data copied from an electronic device when supported by cryptographic hash verification and qualified certification.
          </p>
        </div>
      </div>

      {/* Mandatory Technical Disclaimer */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase tracking-wider">
          <Scale className="w-4 h-4" />
          Mandatory Evidentiary Disclaimer: Hash Matching vs. Admissibility
        </div>

        <div className="p-4 rounded-xl bg-slate-950 text-xs text-slate-300 leading-relaxed space-y-2 border border-slate-800">
          <p>
            <strong className="text-cyan-300">1. Verification Scope:</strong> A passing SHA-256 checksum and valid Merkle chain proves that the stored file bytes have not altered since the moment of intake into EVIDENCELOCK.
          </p>
          <p>
            <strong className="text-cyan-300">2. Pre-Acquisition State:</strong> It does NOT prove that the original evidence was genuine, untampered, or truthful prior to acquisition. A forged file will produce a valid hash if ingested into custody.
          </p>
          <p>
            <strong className="text-cyan-300">3. Non-Malicious Deviations:</strong> A hash mismatch indicates a difference in file bitstream. It proves an alteration occurred, but does not identify motive or prove malicious intent (e.g. disk media bit-rot, codec transformation, or accidental re-save).
          </p>
          <p>
            <strong className="text-cyan-300">4. Legal Admissibility:</strong> Admissibility in court remains subject to legal rules of evidence, jurisdiction requirements, and qualified forensic examiner testimony.
          </p>
        </div>
      </div>
    </div>
  );
};
