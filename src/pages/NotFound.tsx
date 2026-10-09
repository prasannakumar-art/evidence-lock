import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

interface NotFoundProps {
  onNavigate: (page: string) => void;
}

export const NotFound: React.FC<NotFoundProps> = ({ onNavigate }) => {
  return (
    <div className="py-24 text-center max-w-md mx-auto space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 text-rose-400 flex items-center justify-center mx-auto">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-black text-slate-100 font-mono">404 - DOCKET NOT FOUND</h1>
      <p className="text-xs text-slate-400">
        The requested evidentiary path or forensic record does not exist in the active registry.
      </p>
      <button
        onClick={() => onNavigate('home')}
        className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-all inline-flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Portal
      </button>
    </div>
  );
};
