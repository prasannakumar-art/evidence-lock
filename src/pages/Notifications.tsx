import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { NotificationItem } from '../types';

interface NotificationsProps {
  onNavigate: (page: string, params?: any) => void;
}

export const Notifications: React.FC<NotificationsProps> = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.notifications.list();
      setNotifications(data.notifications);
    } catch (err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkAsRead = async (id: string, link?: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      if (link) {
        if (link.startsWith('/evidence/')) {
          const evId = link.replace('/evidence/', '');
          onNavigate('evidence-details', { id: evId });
        } else if (link === '/transfers') {
          onNavigate('transfers');
        } else if (link === '/checkpoints') {
          onNavigate('checkpoints');
        }
      }
    } catch (err) {
      // Ignore
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-slate-100 font-mono">
              Forensic Alerts & Notifications
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Custody transfer alerts, verification exceptions, and security warnings.
          </p>
        </div>

        <button
          onClick={loadNotifications}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="rounded-xl bg-slate-900 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            No system notifications recorded.
          </div>
        ) : (
          notifications.map((n) => {
            const isRead = n.is_read === 1;
            return (
              <div
                key={n.id}
                onClick={() => handleMarkAsRead(n.id, n.link)}
                className={`p-5 flex items-start justify-between gap-4 cursor-pointer transition-colors ${
                  !isRead ? 'bg-slate-950/70 hover:bg-slate-850' : 'hover:bg-slate-800/30 opacity-70'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5">
                    {n.type === 'TRANSFER_REQUEST' ? (
                      <Clock className="w-5 h-5 text-amber-400" />
                    ) : n.type === 'VERIFICATION_ALERT' ? (
                      <CheckCircle2 className="w-5 h-5 text-cyan-400" />
                    ) : n.type === 'SECURITY_WARNING' ? (
                      <AlertTriangle className="w-5 h-5 text-rose-400" />
                    ) : (
                      <Info className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-slate-100 text-xs">{n.title}</h4>
                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-slate-500 font-mono mt-2 block">
                      {n.created_at.replace('T', ' ').substring(0, 19)} UTC
                    </span>
                  </div>
                </div>

                {n.link && (
                  <button className="px-3 py-1 rounded bg-slate-800 text-cyan-300 text-[11px] font-mono shrink-0 flex items-center gap-1">
                    Inspect
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
