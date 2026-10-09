import React from 'react';
import { Shield, Lock, FileCheck2 } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="mt-auto border-t border-slate-900 bg-slate-950 px-6 py-8 text-xs text-slate-500 font-mono">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-300">EVIDENCELOCK</span>
            <p className="text-[11px] text-slate-400">
              "Every File Has a History. Every Change Leaves Evidence."
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[11px]">
          <button
            onClick={() => onNavigate('security')}
            className="hover:text-cyan-400 transition-colors"
          >
            Cryptographic Architecture
          </button>
          <button
            onClick={() => onNavigate('about')}
            className="hover:text-cyan-400 transition-colors"
          >
            Forensic Standards (ISO 27037)
          </button>
          <button
            onClick={() => onNavigate('verify-evidence')}
            className="hover:text-cyan-400 transition-colors"
          >
            Verification Studio
          </button>
        </div>

        <div className="text-[10px] text-slate-600 text-right">
          <div>FIPS 180-4 SHA-256 | ECDSA NIST P-256</div>
          <div>Strict Non-Repudiation Architecture</div>
        </div>
      </div>
    </footer>
  );
};
