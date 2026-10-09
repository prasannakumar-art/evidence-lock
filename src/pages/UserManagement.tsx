import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  UserCheck,
  UserX,
  Shield,
  KeyRound,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { User } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';

export const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // New user modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [agency, setAgency] = useState('Federal Digital Forensics Lab');
  const [role, setRole] = useState<'INVESTIGATOR' | 'AUDITOR' | 'ADMINISTRATOR'>('INVESTIGATOR');
  const [password, setPassword] = useState('SecurePass@2026!');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.admin.listUsers();
      setUsers(data.users);
    } catch (err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleActive = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('Administrators cannot deactivate their own session.');
      return;
    }
    const newActive = user.is_active === 1 ? false : true;
    try {
      await api.admin.updateUser(user.id, { isActive: newActive });
      await loadUsers();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleChangeRole = async (user: User, newRole: string) => {
    try {
      await api.admin.updateUser(user.id, { role: newRole });
      await loadUsers();
    } catch (err: any) {
      alert(`Role change failed: ${err.message}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !fullName || !password) {
      setError('Username, email, full name, and password are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.admin.createUser({
        username: username.trim(),
        email: email.trim(),
        fullName: fullName.trim(),
        badgeNumber: badgeNumber.trim(),
        agency: agency.trim(),
        role,
        password,
      });
      setIsModalOpen(false);
      setUsername('');
      setEmail('');
      setFullName('');
      setBadgeNumber('');
      await loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to provision user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              Personnel & User Access Directory
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Provision forensic officers, auditors, and administrators with strict role boundaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsModalOpen(true);
              setError(null);
            }}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 shadow-md shadow-cyan-950"
          >
            <Plus className="w-3.5 h-3.5" />
            Provision New User
          </button>
          <button
            onClick={loadUsers}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Officer Name</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Agency / Unit</th>
                <th className="py-3 px-4">Badge</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-200">
                      {u.full_name}
                      {isSelf && <span className="ml-2 text-[10px] text-cyan-400">(You)</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{u.username}</td>
                    <td className="py-3 px-4 text-slate-300">{u.agency}</td>
                    <td className="py-3 px-4 text-cyan-300">{u.badge_number || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) => handleChangeRole(u, e.target.value)}
                        className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono disabled:opacity-60"
                      >
                        <option value="INVESTIGATOR">INVESTIGATOR</option>
                        <option value="AUDITOR">AUDITOR</option>
                        <option value="ADMINISTRATOR">ADMINISTRATOR</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      {u.is_active === 1 ? (
                        <span className="text-emerald-400 text-xs flex items-center gap-1 font-mono">
                          <UserCheck className="w-3.5 h-3.5" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="text-rose-400 text-xs flex items-center gap-1 font-mono">
                          <UserX className="w-3.5 h-3.5" />
                          SUSPENDED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                            u.is_active === 1
                              ? 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60'
                              : 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60'
                          }`}
                        >
                          {u.is_active === 1 ? 'Suspend Account' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Provision Forensic User Account"
        subtitle="Enforces cryptographically hashed credentials and RBAC roles"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
                placeholder="Detective John Doe"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                Username *
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
                placeholder="det.jdoe"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                Official Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
                placeholder="jdoe@agency.gov"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                Badge / Credential ID
              </label>
              <input
                type="text"
                value={badgeNumber}
                onChange={(e) => setBadgeNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
                placeholder="BADGE-7741"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                Department / Agency
              </label>
              <input
                type="text"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
                placeholder="Cyber Crimes Unit"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
                Role Boundary *
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
              >
                <option value="INVESTIGATOR">INVESTIGATOR</option>
                <option value="AUDITOR">AUDITOR</option>
                <option value="ADMINISTRATOR">ADMINISTRATOR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1">
              Initial Passphrase *
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
              placeholder="••••••••••••"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-xs font-mono"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition-all"
            >
              {submitting ? 'Hashing & Provisioning...' : 'Provision Account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
