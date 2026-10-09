import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock, ShieldCheck, ShieldAlert, Lock } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const norm = (status || '').toUpperCase();

  let bg = 'bg-slate-800 text-slate-300 border-slate-700';
  let Icon = AlertTriangle;

  if (norm === 'UNVERIFIED' || norm === 'NOT_VERIFIED' || norm === 'NONE') {
    bg = 'bg-slate-850 text-slate-400 border-slate-700/80';
    Icon = Clock;
  } else if (norm === 'PASS' || norm === 'PASSED' || norm === 'VALID' || norm === 'OPERATIONAL') {
    bg = 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40';
    Icon = CheckCircle2;
  } else if (norm === 'FAIL' || norm === 'FAILED' || norm === 'INVALID' || norm === 'TAMPERED') {
    bg = 'bg-rose-950/70 text-rose-300 border-rose-500/40';
    Icon = XCircle;
  } else if (norm === 'INCONCLUSIVE' || norm === 'PENDING' || norm === 'TRANSFER_PENDING') {
    bg = 'bg-amber-950/70 text-amber-300 border-amber-500/40';
    Icon = Clock;
  } else if (norm === 'IN_CUSTODY' || norm === 'SECURED') {
    bg = 'bg-sky-950/70 text-sky-300 border-sky-500/40';
    Icon = ShieldCheck;
  } else if (norm === 'CRITICAL' || norm === 'BREACH') {
    bg = 'bg-red-950/80 text-red-300 border-red-500/50 animate-pulse';
    Icon = ShieldAlert;
  } else if (norm === 'OPEN') {
    bg = 'bg-blue-950/60 text-blue-300 border-blue-500/40';
    Icon = Lock;
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2',
  }[size];

  return (
    <span className={`inline-flex items-center font-mono font-medium rounded-full border ${bg} ${sizeClasses}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      <span>{norm.replace(/_/g, ' ')}</span>
    </span>
  );
};
