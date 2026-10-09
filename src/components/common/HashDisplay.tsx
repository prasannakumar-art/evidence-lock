import React, { useState } from 'react';
import { Copy, Check, Hash } from 'lucide-react';

interface HashDisplayProps {
  hash: string;
  label?: string;
  truncate?: boolean;
  highlightMismatch?: boolean;
}

export const HashDisplay: React.FC<HashDisplayProps> = ({
  hash,
  label,
  truncate = false,
  highlightMismatch = false,
}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!hash) {
    return <span className="text-slate-500 font-mono text-xs italic">N/A</span>;
  }

  const displayText = truncate
    ? `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`
    : hash;

  return (
    <div className="inline-flex flex-col gap-0.5 max-w-full">
      {label && <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">{label}</span>}
      <div
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-950/80 border text-xs font-mono select-all transition-colors ${
          highlightMismatch
            ? 'border-rose-500/60 text-rose-300 bg-rose-950/30'
            : 'border-slate-800 text-cyan-300/90 hover:border-slate-700'
        }`}
      >
        <Hash className="w-3 h-3 text-slate-500 shrink-0" />
        <span className="break-all tracking-tight" title={hash}>
          {displayText}
        </span>
        <button
          type="button"
          onClick={copyToClipboard}
          className="text-slate-500 hover:text-cyan-400 transition-colors p-0.5 rounded hover:bg-slate-800/80 shrink-0"
          title="Copy full 256-bit SHA-256 hash"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
};
