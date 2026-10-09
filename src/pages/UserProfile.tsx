import React from 'react';
import { User, Shield, KeyRound, Award, Building, Mail, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/common/StatusBadge';

interface UserProfileProps {
  onNavigate?: (page: string) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onNavigate }) => {
  const { user, demoAccounts, switchDemoUser } = useAuth();

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-cyan-950 border border-cyan-800 text-cyan-400 flex items-center justify-center mx-auto shadow-xl shadow-cyan-950/50">
          <Shield className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-mono text-slate-100">Authentication Required</h2>
          <p className="text-xs text-slate-400 mt-1">Please sign in or choose an active forensic demo profile to inspect user capabilities.</p>
        </div>
        <div className="space-y-2">
          {demoAccounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => switchDemoUser(acc.username)}
              className="w-full p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left flex items-center justify-between text-xs transition-colors"
            >
              <div>
                <span className="font-semibold text-slate-200 block">{acc.full_name}</span>
                <span className="text-[10px] text-slate-500 font-mono">{acc.agency}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                {acc.role}
              </span>
            </button>
          ))}
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('login')}
            className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-all"
          >
            Go to Sign In
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Profile Header */}
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-cyan-950 border border-cyan-800/80 text-cyan-300 flex items-center justify-center font-bold text-2xl font-mono shadow-lg shadow-cyan-950/60">
            {user.full_name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-100 font-mono">{user.full_name}</h1>
              <StatusBadge status={user.role} size="sm" />
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              Badge: <span className="text-cyan-400 font-semibold">{user.badge_number || 'N/A'}</span>
            </p>
            <p className="text-xs text-slate-400 font-mono">{user.agency}</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
          <div className="text-slate-500 text-[10px] uppercase">Account Security Status</div>
          <div className="text-emerald-400 font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Active & Certified
          </div>
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-100 text-xs font-mono uppercase tracking-wider flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-cyan-400" />
            Authorized Capabilities & Permissions
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {user.permissions?.length || 0} Active Grants
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs font-mono">
          {user.permissions?.map((code) => (
            <div
              key={code}
              className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center gap-2 text-slate-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span className="truncate">{code.replace('PERM_', '')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cryptographic Session Properties */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs font-mono">
        <h3 className="font-semibold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          Forensic Session Authentication
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-400">
          <div>
            <span className="text-slate-500 block text-[10px]">Session Protection:</span>
            <span className="text-slate-200">HMAC-SHA256 Signed HTTPOnly Session Bearer</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Credential Hashing:</span>
            <span className="text-slate-200">Bcrypt with Work Factor 12 Salt</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Audit Level:</span>
            <span className="text-cyan-400">Continuous Tamper-Evident Security Log</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Assigned Role:</span>
            <span className="text-slate-200">{user.role}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
