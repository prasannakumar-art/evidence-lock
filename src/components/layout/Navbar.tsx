import React, { useState, useEffect } from 'react';
import {
  Shield,
  Bell,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Layers,
  KeyRound,
  ExternalLink,
  Menu,
  X,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { NotificationItem } from '../../types';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string, params?: any) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  isSidebarOpen = false,
  onToggleSidebar,
}) => {
  const { user, logout, switchDemoUser, demoAccounts } = useAuth();
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const data = await api.notifications.list();
      setNotifications(data.notifications);
      setUnreadCount(data.notifications.filter((n) => n.is_read === 0).length);
    } catch (e) {
      // Ignore
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000);
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkRead = async (id: string, link?: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (link) {
        if (link.startsWith('/evidence/')) {
          const evId = link.replace('/evidence/', '');
          onNavigate('evidence-details', { id: evId });
        } else if (link === '/transfers') {
          onNavigate('transfers');
        } else if (link === '/checkpoints') {
          onNavigate('checkpoints');
        }
        setShowNotifications(false);
      }
    } catch (e) {
      // Ignore
    }
  };

  return (
    <header className="h-16 bg-slate-950 border-b border-slate-800/80 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
      {/* Brand logo & tagline */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Toggle operations navigation menu"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 hover:bg-slate-850 lg:hidden transition-colors"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}

        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-950/50 group-hover:from-cyan-400 group-hover:to-blue-600 transition-all">
            <div className="w-full h-full bg-slate-950 rounded-[7px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-base text-slate-100 font-mono">
                EVIDENCELOCK
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-cyan-950/90 text-cyan-400 border border-cyan-800/60 uppercase">
                v2026.1
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block font-mono">
              Every File Has a History. Every Change Leaves Evidence.
            </p>
          </div>
        </button>
      </div>

      {/* Middle Direct Navigation Links for quick access */}
      <nav className="hidden md:flex items-center gap-1 text-xs font-mono">
        <button
          onClick={() => onNavigate('home')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            currentPage === 'home'
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Portal
        </button>
        <button
          onClick={() => onNavigate('verify-evidence')}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
            currentPage === 'verify-evidence'
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" />
          Verify Studio
        </button>
        <button
          onClick={() => onNavigate('security')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            currentPage === 'security'
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Security
        </button>
        <button
          onClick={() => onNavigate('about')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            currentPage === 'about'
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/60'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          Standards
        </button>
      </nav>

      {/* Forensic Integrity indicator */}
      <div className="hidden 2xl:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="text-slate-300 font-medium">CHAIN INTEGRITY ACTIVE</span>
        <span className="text-slate-600">|</span>
        <span className="text-cyan-400">ECDSA NIST P-256</span>
      </div>

      {/* Right User & Actions */}
      <div className="flex items-center gap-3">
        {user ? (
          <>
            {/* Quick Demo Role Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowDemoMenu(!showDemoMenu);
                  setShowNotifications(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 transition-colors"
                title="Switch role instantly to test RBAC authorization"
              >
                <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden md:inline font-mono text-[11px] font-semibold text-cyan-300">
                  {user.role}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showDemoMenu && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      Role-Based Access Tester
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Switch identities to test permissions instantly:
                    </p>
                  </div>
                  <div className="py-1 space-y-1">
                    {demoAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        onClick={() => {
                          switchDemoUser(acc.username);
                          setShowDemoMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${
                          user.id === acc.id
                            ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 font-medium'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{acc.full_name}</div>
                          <div className="text-[10px] text-slate-400">{acc.agency}</div>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
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
              )}
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowDemoMenu(false);
                }}
                className="relative p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-slate-100 transition-colors"
                title="Notifications"
              >
                <Bell className="w-4 h-4 text-slate-300" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white font-mono font-bold text-[9px] flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs">
                  <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
                    <span className="font-semibold text-slate-200">Forensic Alerts</span>
                    <button
                      onClick={() => {
                        onNavigate('notifications');
                        setShowNotifications(false);
                      }}
                      className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      View all
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/60">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-slate-500">No recent alerts.</p>
                    ) : (
                      notifications.slice(0, 5).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleMarkRead(n.id, n.link)}
                          className={`p-2.5 hover:bg-slate-800/80 cursor-pointer transition-colors ${
                            n.is_read === 0 ? 'bg-slate-850/60' : 'opacity-70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-200">{n.title}</span>
                            <span className="text-[9px] text-slate-500 font-mono">
                              {n.created_at.substring(11, 16)} UTC
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-2">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile pill */}
            <button
              onClick={() => onNavigate('profile')}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 flex items-center justify-center font-bold text-[10px]">
                {(user.full_name || user.username || 'U').charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <div className="font-medium text-slate-200 text-xs leading-none">
                  {user.full_name || user.username}
                </div>
                <div className="text-[10px] text-slate-400 font-mono leading-none mt-0.5">
                  {user.badge_number || user.role}
                </div>
              </div>
            </button>

            {/* Sign out */}
            <button
              onClick={() => logout()}
              className="p-2 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-900/50 transition-colors"
              title="Terminate Secure Session"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('login')}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs transition-all shadow-md shadow-cyan-950 flex items-center gap-1.5"
            >
              <UserIcon className="w-3.5 h-3.5" />
              Sign In
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
