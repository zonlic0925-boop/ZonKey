import React, { useState } from 'react';
import { Header } from './components/Header';
import { DrawingView } from './components/DrawingView';
import { DocPdfView } from './components/DocPdfView';
import { WordView } from './components/WordView';
import { RuleCenter } from './components/RuleCenter';
import { AuditLogView } from './components/AuditLogView';
import { MemphisDecor } from './components/MemphisDecor';
import { TabType } from './types';
import { CheckCircle2, AlertCircle, Info, X, WifiOff } from 'lucide-react';
import { useBackendStatus } from './lib/api';
import { useI18n } from './i18n';
import { APP_NAME, APP_TAGLINE } from './lib/brand';

export default function App() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<TabType>('drawing');
  const { online, status, refresh } = useBackendStatus();

  const [notification, setNotification] = useState<{
    msg: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showNotify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const systemStatus = {
    ocrAvailable: status?.ocr_available ?? false,
    activeRulesCount: status?.active_rules_count ?? 0,
  };

  return (
    <div className="relative w-full h-[100dvh] max-w-[100vw] overflow-hidden flex flex-col bg-mem-cream font-body text-mem-ink select-none">
      <MemphisDecor />

      {online === false && (
        <div className="relative z-50 px-4 py-2.5 bg-mem-coral border-b-[3px] border-mem-ink flex items-center justify-center gap-2 text-sm font-medium text-white">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>
            <strong className="font-brand tracking-wider">{APP_NAME}</strong>
            <span className="font-brand-script text-white/80 text-xs ml-1.5">{APP_TAGLINE}</span>
            {' '}
            {t('app.backendOffline')}
          </span>
        </div>
      )}

      <Header
        activeTab={activeTab}
        onTabChange={(tab: any) => {
          setActiveTab(tab);
          refresh();
        }}
        systemStatus={systemStatus}
        backendOnline={online}
      />

      <main className="relative z-10 flex-1 w-full min-h-0 overflow-hidden flex">
        {activeTab === 'drawing' && (
          <DrawingView onNotify={showNotify} backendOnline={online} />
        )}
        {activeTab === 'pdf_doc' && (
          <DocPdfView onNotify={showNotify} backendOnline={online} />
        )}
        {activeTab === 'word_doc' && (
          <WordView onNotify={showNotify} backendOnline={online} />
        )}
        {activeTab === 'rules' && (
          <RuleCenter onNotify={showNotify} backendOnline={online} />
        )}
        {activeTab === 'audit' && (
          <AuditLogView onNotify={showNotify} backendOnline={online} />
        )}
      </main>

      {notification && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-50 memphis-toast animate-in fade-in slide-in-from-bottom-5 max-w-full">
          {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-mem-teal" />}
          {notification.type === 'error' && <AlertCircle className="w-5 h-5 text-mem-coral" />}
          {notification.type === 'info' && <Info className="w-5 h-5 text-mem-sky" />}
          <span className="text-xs font-medium">{notification.msg}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-mem-ink/40 hover:text-mem-ink p-0.5 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
