/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';

import { ErrorBoundary } from './components/common/ErrorBoundary';

// Pages
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Security } from './pages/Security';
import { Login } from './pages/Login';
import { InvestigatorDashboard } from './pages/InvestigatorDashboard';
import { EvidenceUpload } from './pages/EvidenceUpload';
import { EvidenceRepository } from './pages/EvidenceRepository';
import { EvidenceDetails } from './pages/EvidenceDetails';
import { CustodyTimeline } from './pages/CustodyTimeline';
import { TransferCustody } from './pages/TransferCustody';
import { VerifyEvidence } from './pages/VerifyEvidence';
import { Cases } from './pages/Cases';
import { VerificationReports } from './pages/VerificationReports';
import { Notifications } from './pages/Notifications';
import { UserProfile } from './pages/UserProfile';
import { AuditorDashboard } from './pages/AuditorDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserManagement } from './pages/UserManagement';
import { RoleManagement } from './pages/RoleManagement';
import { SecurityAuditLogs } from './pages/SecurityAuditLogs';
import { SystemHealth } from './pages/SystemHealth';
import { Checkpoints } from './pages/Checkpoints';
import { NotFound } from './pages/NotFound';

function MainApp() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [pageParams, setPageParams] = useState<any>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const navigate = (page: string, params: any = {}) => {
    setCurrentPage(page);
    setPageParams(params);
    setIsSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'home':
        return <Home onNavigate={navigate} />;
      case 'about':
        return <About />;
      case 'security':
        return <Security />;
      case 'login':
        return <Login onNavigate={navigate} />;
      case 'investigator-dashboard':
        return <InvestigatorDashboard onNavigate={navigate} />;
      case 'evidence-upload':
        return <EvidenceUpload onNavigate={navigate} />;
      case 'evidence-repository':
        return <EvidenceRepository onNavigate={navigate} />;
      case 'evidence-details':
        return <EvidenceDetails evidenceId={pageParams.id} onNavigate={navigate} />;
      case 'custody-timeline':
        return <CustodyTimeline initialEvidenceId={pageParams.evidenceId} onNavigate={navigate} />;
      case 'transfers':
        return <TransferCustody onNavigate={navigate} />;
      case 'verify-evidence':
        return <VerifyEvidence onNavigate={navigate} />;
      case 'cases':
        return <Cases selectedCaseId={pageParams.selectedCaseId} onNavigate={navigate} />;
      case 'reports':
        return <VerificationReports onNavigate={navigate} />;
      case 'notifications':
        return <Notifications onNavigate={navigate} />;
      case 'profile':
        return <UserProfile onNavigate={navigate} />;
      case 'auditor-dashboard':
        return <AuditorDashboard onNavigate={navigate} />;
      case 'admin-dashboard':
        return <AdminDashboard onNavigate={navigate} />;
      case 'users':
        return <UserManagement />;
      case 'roles':
        return <RoleManagement />;
      case 'audit-logs':
        return <SecurityAuditLogs />;
      case 'system-health':
        return <SystemHealth />;
      case 'checkpoints':
        return <Checkpoints initialEvidenceId={pageParams.evidenceId} onNavigate={navigate} />;
      default:
        return <NotFound onNavigate={navigate} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-cyan-400 font-mono text-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
          <span>INITIALIZING EVIDENCELOCK VAULT...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar
        currentPage={currentPage}
        onNavigate={navigate}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      <div className="flex flex-1 w-full min-h-[calc(100vh-4rem)]">
        <Sidebar
          currentPage={currentPage}
          onNavigate={navigate}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <main className="flex-1 p-4 md:p-8 bg-slate-950/60 min-w-0">
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        </main>
      </div>

      <Footer onNavigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ErrorBoundary>
  );
}
