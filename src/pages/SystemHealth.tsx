import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  KeySquare,
  ShieldCheck,
  Cpu,
  Database,
  RefreshCw,
  FolderLock,
  Lock,
} from 'lucide-react';
import { api } from '../services/api';
import { SystemHealth as HealthType } from '../types';

export const SystemHealth: React.FC = () => {
  const [health, setHealth] = useState<HealthType | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHealth = async () => {
    setLoading(true);
    try {
      const data = await api.admin.systemHealth();
      setHealth(data);
    } catch (err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              Storage Vault & Cryptographic Engine Health
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry on private storage quarantine, relational database, and asymmetric signing keypair.
          </p>
        </div>

        <button
          onClick={loadHealth}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Private Evidence Storage Vault */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2 font-mono">
                <FolderLock className="w-4 h-4 text-cyan-400" />
                Private Evidence Vault Storage
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                RESTRICTED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">Vault Filesystem Path:</span>
                <span className="text-slate-300">{health.storage.evidenceVault.path}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Total Stored Files:</span>
                <span className="text-cyan-300 font-bold">{health.storage.evidenceVault.fileCount} Files</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Disk Consumption:</span>
                <span className="text-slate-200 font-bold">{health.storage.evidenceVault.formattedSize}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Raw Byte Volume:</span>
                <span className="text-slate-400">
                  {health.storage.evidenceVault.totalSizeBytes.toLocaleString()} bytes
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 text-[11px] font-mono text-slate-400 border border-slate-800/80">
              Direct public web access to raw files is blocked. Bitstreams are served strictly via authenticated streaming endpoints.
            </div>
          </div>

          {/* Staging Quarantine Area */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2 font-mono">
                <HardDrive className="w-4 h-4 text-amber-400" />
                Staged Intake Quarantine
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                TRANSIENT
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">Quarantine Path:</span>
                <span className="text-slate-300">{health.storage.stagingArea.path}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Staged Temp Files:</span>
                <span className="text-amber-300 font-bold">{health.storage.stagingArea.fileCount} Pending</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Staging Size:</span>
                <span className="text-slate-200">{health.storage.stagingArea.formattedSize}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Auto-Quarantine Expiry:</span>
                <span className="text-slate-400">60 Minutes TTL</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 text-[11px] font-mono text-slate-400 border border-slate-800/80">
              Zero-byte and aborted uploads are cleaned automatically from quarantine without corrupting the evidence vault.
            </div>
          </div>

          {/* Relational Database Engine */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2 font-mono">
                <Database className="w-4 h-4 text-cyan-400" />
                Relational Database Engine
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                ACID COMPLIANT
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">Engine Mode:</span>
                <span className="text-cyan-300">{health.storage.database.engine}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Database File Size:</span>
                <span className="text-slate-200 font-bold">{health.storage.database.formattedSize}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block text-[10px]">Integrity Guarantees:</span>
                <span className="text-slate-300">
                  Foreign key cascading, strict sequence uniqueness, atomic transaction rollback
                </span>
              </div>
            </div>
          </div>

          {/* Asymmetric Cryptographic Signing Keypair */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-slate-100 text-sm flex items-center gap-2 font-mono">
                <KeySquare className="w-4 h-4 text-purple-400" />
                Asymmetric Checkpoint Signer
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                ECDSA P-256
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">Active Key Fingerprint:</span>
                <span className="text-cyan-400 font-bold">{health.cryptography.activeKeyId}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Hashing Algorithm:</span>
                <span className="text-slate-200">{health.cryptography.hashingEngine}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Private Key Storage:</span>
                <span className="text-emerald-400 font-semibold">
                  {health.cryptography.privateKeySecured ? 'Secured Outside Database' : 'Missing'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Public Verification Key:</span>
                <span className="text-emerald-400 font-semibold">
                  {health.cryptography.publicKeyAccessible ? 'Published & Accessible' : 'Missing'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 text-[11px] font-mono text-slate-400 border border-slate-800/80">
              Private signing keys are stored in restricted filesystem storage outside database tables, preventing administrative history alteration.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
