import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  demoAccounts: User[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchDemoUser: (username: string) => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  hasPermission: (permissionCode: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_DEMO_ACCOUNTS: User[] = [
  { id: 'USR_INV_CHEN', username: 'investigator.chen', full_name: 'Sarah Chen', badge_number: 'BADGE-8842', agency: 'DFIR Incident Response Division', role: 'INVESTIGATOR', email: 's.chen@cybercrimes.gov', is_active: 1, created_at: '', updated_at: '' },
  { id: 'USR_AUD_REYES', username: 'auditor.reyes', full_name: 'Marcus Reyes', badge_number: 'AUD-402', agency: 'Office of Inspector General', role: 'AUDITOR', email: 'm.reyes@judicialaudit.gov', is_active: 1, created_at: '', updated_at: '' },
  { id: 'USR_ADMIN_01', username: 'admin', full_name: 'Alex Vance', badge_number: 'SEC-001', agency: 'Federal Forensic Inspection Service', role: 'ADMINISTRATOR', email: 'admin@evidencelock.gov', is_active: 1, created_at: '', updated_at: '' },
  { id: 'USR_INV_DAWSON', username: 'investigator.dawson', full_name: 'Liam Dawson', badge_number: 'BADGE-9104', agency: 'Digital Forensic Laboratory', role: 'INVESTIGATOR', email: 'l.dawson@cybercrimes.gov', is_active: 1, created_at: '', updated_at: '' },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [demoAccounts, setDemoAccounts] = useState<User[]>(DEFAULT_DEMO_ACCOUNTS);

  const fetchCurrentUser = async () => {
    try {
      const data = await api.auth.me();
      if (data && data.user) {
        setUser(data.user);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchDemoAccounts = async () => {
    try {
      const data = await api.auth.getDemoAccounts();
      if (data && data.demoAccounts && data.demoAccounts.length > 0) {
        setDemoAccounts(data.demoAccounts);
      }
    } catch (err) {
      // Fallback remains DEFAULT_DEMO_ACCOUNTS
    }
  };

  useEffect(() => {
    fetchCurrentUser();
    fetchDemoAccounts();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.auth.login({ username, password });
    localStorage.setItem('evidencelock_token', res.token);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (e) {
      // Proceed
    }
    localStorage.removeItem('evidencelock_token');
    setUser(null);
  };

  const switchDemoUser = async (username: string) => {
    const res = await api.auth.switchDemoUser(username);
    localStorage.setItem('evidencelock_token', res.token);
    setUser(res.user);
  };

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (!user) return false;
    if (user.role === 'ADMINISTRATOR') return true;
    return !!(user.permissions && user.permissions.includes(permissionCode));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        demoAccounts,
        login,
        logout,
        switchDemoUser,
        hasRole,
        hasPermission,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
