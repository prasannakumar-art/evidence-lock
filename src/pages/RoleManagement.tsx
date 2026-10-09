import React, { useState, useEffect } from 'react';
import { Lock, Shield, CheckCircle2, XCircle, Info, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.admin.listRoles();
      setRoles(data.roles);
      setPermissions(data.allPermissions);
    } catch (err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              Role-Based Access Control (RBAC) Governance
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Backend-enforced permission matrices. Every privileged operation is verified at the API layer.
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Security Architecture Principle */}
      <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-xs font-mono text-cyan-300 flex items-center gap-3">
        <Info className="w-5 h-5 shrink-0 text-cyan-400" />
        <span>
          MANDATORY AUTHORIZATION PRINCIPLE: Permissions are strictly evaluated server-side on every REST route.
          Hiding UI elements is merely cosmetic—backend guards reject unauthorized calls with HTTP 403 Forbidden.
        </span>
      </div>

      {/* Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {roles.map((r) => (
          <div
            key={r.id}
            className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100 font-mono">{r.name}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold bg-slate-950 text-cyan-400 border border-slate-800">
                  {r.id}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{r.description}</p>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                Assigned Permissions ({r.permissions.length}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {r.permissions.map((pCode: string) => (
                  <span
                    key={pCode}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-slate-300 border border-slate-800"
                  >
                    {pCode.replace('PERM_', '')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Granular Permission Matrix Table */}
      <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h3 className="font-semibold text-slate-100 text-xs font-mono">
            Granular Capability Entitlement Matrix
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Permission Code</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4 text-center">Investigator</th>
                <th className="py-3 px-4 text-center">Auditor</th>
                <th className="py-3 px-4 text-center">Administrator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
              {permissions.map((p) => {
                const hasInvestigator = Boolean(roles.find((r) => r.name === 'INVESTIGATOR')?.permissions?.includes(p.code));
                const hasAuditor = Boolean(roles.find((r) => r.name === 'AUDITOR')?.permissions?.includes(p.code));
                const hasAdmin = Boolean(roles.find((r) => r.name === 'ADMINISTRATOR')?.permissions?.includes(p.code));

                return (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-cyan-300">{p.code}</td>
                    <td className="py-3 px-4 text-slate-400">{p.description}</td>
                    <td className="py-3 px-4 text-center">
                      {hasInvestigator ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {hasAuditor ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {hasAdmin ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
