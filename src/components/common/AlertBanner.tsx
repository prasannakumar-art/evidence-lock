import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertBannerProps {
  type?: AlertType;
  title?: string;
  message: string;
  details?: string;
  onClose?: () => void;
  className?: string;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type = 'info',
  title,
  message,
  details,
  onClose,
  className = '',
}) => {
  const styles = {
    success: {
      bg: 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
      titleColor: 'text-emerald-300',
    },
    error: {
      bg: 'bg-rose-950/60 border-rose-500/50 text-rose-200',
      icon: <XCircle className="w-5 h-5 text-rose-400 shrink-0" />,
      titleColor: 'text-rose-300',
    },
    warning: {
      bg: 'bg-amber-950/60 border-amber-500/50 text-amber-200',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
      titleColor: 'text-amber-300',
    },
    info: {
      bg: 'bg-cyan-950/60 border-cyan-500/50 text-cyan-200',
      icon: <Info className="w-5 h-5 text-cyan-400 shrink-0" />,
      titleColor: 'text-cyan-300',
    },
  }[type];

  return (
    <div
      role="alert"
      className={`p-4 rounded-xl border flex items-start justify-between gap-3 font-sans transition-all animate-in fade-in duration-200 ${styles.bg} ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5">{styles.icon}</div>
        <div className="min-w-0 space-y-1">
          {title && <h4 className={`text-xs font-bold uppercase tracking-wider font-mono ${styles.titleColor}`}>{title}</h4>}
          <p className="text-xs leading-relaxed">{message}</p>
          {details && (
            <p className="text-[11px] font-mono opacity-80 break-words mt-1 bg-black/30 p-2 rounded border border-white/5">
              {details}
            </p>
          )}
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
