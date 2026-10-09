import React from 'react';
import {
  LayoutDashboard,
  Upload,
  FolderGit2,
  FileCheck2,
  ArrowRightLeft,
  Briefcase,
  ShieldCheck,
  GitCommit,
  KeySquare,
  FileText,
  ShieldAlert,
  Users,
  Lock,
  History,
  HardDrive,
  BookOpen,
  Info,
  Home,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  isOpen = false,
  onClose,
}) => {
  const { user } = useAuth();

  const handleItemClick = (id: string) => {
    onNavigate(id);
    if (onClose) onClose();
  };

  const navSections = [
    {
      title: 'Operations',
      items: [
        { id: 'investigator-dashboard', label: 'Investigator Dashboard', icon: LayoutDashboard },
        { id: 'evidence-upload', label: 'Evidence Upload', icon: Upload, perm: 'EVIDENCE_UPLOAD' },
        { id: 'evidence-repository', label: 'Evidence Repository', icon: FolderGit2 },
        { id: 'verify-evidence', label: 'Verify Evidence', icon: FileCheck2 },
        { id: 'transfers', label: 'Transfer Custody', icon: ArrowRightLeft },
        { id: 'cases', label: 'Cases & Investigations', icon: Briefcase },
      ],
    },
    {
      title: 'Assurance & Auditing',
      items: [
        { id: 'auditor-dashboard', label: 'Auditor Dashboard', icon: ShieldCheck },
        { id: 'custody-timeline', label: 'Chain Timelines', icon: GitCommit },
        { id: 'checkpoints', label: 'Signed Checkpoints', icon: KeySquare },
        { id: 'reports', label: 'Verification Reports', icon: FileText },
      ],
    },
    {
      title: 'Administration',
      items: [
        { id: 'admin-dashboard', label: 'Admin Dashboard', icon: ShieldAlert },
        { id: 'users', label: 'User Directory', icon: Users },
        { id: 'roles', label: 'Roles & RBAC', icon: Lock },
        { id: 'audit-logs', label: 'Security Audit Logs', icon: History },
        { id: 'system-health', label: 'Storage & System Health', icon: HardDrive },
      ],
    },
    {
      title: 'Documentation',
      items: [
        { id: 'security', label: 'Security Architecture', icon: BookOpen },
        { id: 'about', label: 'Forensic Standards', icon: Info },
        { id: 'home', label: 'Overview & Portal', icon: Home },
      ],
    },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`bg-slate-950/95 border-r border-slate-800/80 flex flex-col shrink-0 overflow-y-auto select-none transition-all duration-200 z-50 ${
          isOpen
            ? 'fixed inset-y-0 left-0 w-72 shadow-2xl flex lg:static lg:w-64 lg:shadow-none'
            : 'hidden lg:flex lg:w-64'
        }`}
      >
        {/* Current user badge card */}
        {user && (
          <div className="p-4 mx-3 mt-3 mb-2 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-800/60 text-cyan-300 flex items-center justify-center font-mono font-bold text-sm shrink-0">
              {(user.role || 'IN').substring(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">{user.full_name || user.username}</div>
              <div className="text-[10px] text-cyan-400 font-mono flex items-center gap-1">
                <UserCheck className="w-3 h-3" />
                {user.role}
              </div>
            </div>
          </div>
        )}

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-2 space-y-6">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <h4 className="px-3 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                {section.title}
              </h4>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                        isActive
                          ? 'bg-cyan-950/70 text-cyan-300 border border-cyan-800/60 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? 'text-cyan-400' : 'text-slate-500'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Standards compliance banner */}
        <div className="p-4 border-t border-slate-900 text-[10px] text-slate-500 font-mono">
          <div className="text-slate-400 font-semibold mb-1">COMPLIANCE ASSURANCE</div>
          <div>NIST SP 800-86 | ISO 27037</div>
          <div>FRE 902(13)/(14) Certified</div>
        </div>
      </aside>
    </>
  );
};
