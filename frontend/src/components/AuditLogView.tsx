import React, { useState, useEffect } from 'react';
import {
  History,
  CheckCircle2,
  FileText,
  FileCode,
  ShieldAlert,
  Calendar,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

import { apiFetch } from '../lib/api';
import { useI18n } from '../i18n';

interface AuditLogViewProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  backendOnline?: boolean | null;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ onNotify, backendOnline }) => {
  const { t } = useI18n();
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    total_files: 0,
    total_redacted_items: 0,
    compliance_rate: '100%',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (backendOnline !== false) fetchAuditLogs();
    else setLoading(false);
  }, [backendOnline]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<any>('/api/audit/logs');
      setLogs(data.logs || []);
      setStats({
        total_files: data.total_files || 0,
        total_redacted_items: data.total_redacted_items || 0,
        compliance_rate: data.compliance_rate || '100%',
      });
    } catch {
      onNotify(t('audit.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { icon: FolderOpen, value: stats.total_files, labelKey: 'audit.totalFiles', bg: 'bg-mem-sky/30' },
    { icon: ShieldAlert, value: stats.total_redacted_items, labelKey: 'audit.totalRedacted', bg: 'bg-mem-coral/25' },
    { icon: CheckCircle2, value: stats.compliance_rate, labelKey: 'audit.complianceRate', bg: 'bg-mem-lime/30', accent: true },
  ];

  return (
    <div className="flex-1 w-full h-full p-6 overflow-hidden flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.labelKey} className="p-6 memphis-card flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-xl ${card.bg} border-2 border-mem-ink flex items-center justify-center`}
              >
                <Icon className="w-6 h-6 text-mem-ink" />
              </div>
              <div>
                <div className={`text-2xl font-display font-black ${card.accent ? 'text-mem-teal' : ''}`}>
                  {card.value}
                </div>
                <div className="text-xs text-mem-ink/50">{t(card.labelKey)}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex-1 memphis-card p-6 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b-2 border-mem-ink/10">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-mem-pink" />
            <div>
              <h2 className="text-sm font-display font-bold">{t('audit.title')}</h2>
              <p className="text-[11px] text-mem-ink/50">{t('audit.subtitle')}</p>
            </div>
          </div>
          <button onClick={fetchAuditLogs} className="memphis-btn-ghost p-2">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
          {loading && (
            <div className="h-full flex items-center justify-center text-mem-ink/40 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-mem-teal" />
              <span className="text-xs">{t('audit.loading')}</span>
            </div>
          )}

          {!loading && logs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-mem-ink/40 gap-2">
              <History className="w-8 h-8 opacity-30" />
              <span className="text-xs">{t('audit.empty')}</span>
            </div>
          )}

          {!loading &&
            logs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-white border-2 border-mem-ink/15 hover:border-mem-ink/40 hover:shadow-memphis-sm transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-mem-yellow/30 border-2 border-mem-ink/20 flex items-center justify-center">
                    {log.file_type?.includes('Word') ? (
                      <FileCode className="w-5 h-5 text-mem-pink" />
                    ) : (
                      <FileText className="w-5 h-5 text-mem-sky" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold flex items-center gap-2">
                      <span>{log.filename}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-mem-lime/40 border border-mem-ink/20">
                        {t('audit.completed')}
                      </span>
                    </div>
                    <div className="text-[11px] text-mem-ink/50 mt-1 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {log.timestamp}
                      </span>
                      <span>·</span>
                      <span>{t('audit.redactedCount', { count: log.redacted_count })}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-mem-ink/40 font-mono">#{log.id}</div>
                  <div className="text-[11px] text-mem-ink/50 mt-1 truncate max-w-[280px]">
                    {log.output_path}
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
