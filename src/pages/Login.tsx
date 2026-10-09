import React, { useState } from 'react';
import { Shield, Lock, User as UserIcon, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LoginProps {
  onNavigate: (page: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigate }) => {
  const { login, demoAccounts, switchDemoUser } = useAuth();
  const [username, setUsername] = useState('investigator.chen');
  const [password, setPassword] = useState('Investigate@2026!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      onNavigate('investigator-dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (uname: string) => {
    setError(null);
    setLoading(true);
    try {
      await switchDemoUser(uname);
      onNavigate('investigator-dashboard');
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10"></div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-950/90 border border-cyan-800/80 text-cyan-400 mb-3 shadow-lg shadow-cyan-950">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-100 font-mono tracking-tight">EVIDENCELOCK</h2>
          <p className="text-xs text-slate-400 mt-1">Authorized Forensic Personnel Access</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
              Username or Agency Email
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none transition-colors"
                placeholder="investigator.chen"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
              Passphrase
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none transition-colors"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-sm transition-all shadow-md shadow-cyan-950 flex items-center justify-center gap-2 font-mono"
          >
            {loading ? 'Authenticating...' : 'Establish Secure Session'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Identities */}
        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
            Quick Demo Accounts (RBAC Testing):
          </p>
          <div className="space-y-2">
            {demoAccounts.map((acc) => (
              <button
                key={acc.id}
                type="button"
                onClick={() => handleQuickLogin(acc.username)}
                className="w-full text-left p-2.5 rounded-lg bg-slate-950/70 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between transition-colors text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-200">{acc.full_name}</div>
                  <div className="text-[10px] text-slate-400">{acc.agency}</div>
                </div>
                <span
                  className={`text-[9px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                    acc.role === 'ADMINISTRATOR'
                      ? 'bg-purple-950 text-purple-300 border border-purple-800'
                      : acc.role === 'AUDITOR'
                      ? 'bg-amber-950 text-amber-300 border border-amber-800'
                      : 'bg-blue-950 text-blue-300 border border-blue-800'
                  }`}
                >
                  {acc.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
