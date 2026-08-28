import React, { useRef, useState } from 'react';
import { Header } from './components/Header';
import { DrawingView } from './components/DrawingView';
import { CalcDevCenter } from './components/calcdev/CalcDevCenter';
import { TextCenter } from './components/textcenter/TextCenter';
import { DocPdfView } from './components/DocPdfView';
import { WordView } from './components/WordView';
import { RuleCenter } from './components/RuleCenter';
import { AuditLogView } from './components/AuditLogView';
import { SubNavPills } from './components/navigation/SubNavPills';
import { CenterPlaceholder } from './components/common/CenterPlaceholder';
import { MemphisDecor } from './components/MemphisDecor';
import { CenterId, ToolId } from './types';
import { CENTER_TOOLS, getCenterMeta } from './lib/navigation';
import { CheckCircle2, AlertCircle, Info, X, WifiOff } from 'lucide-react';
import { useBackendStatus } from './lib/api';
import { useI18n } from './i18n';
import { APP_NAME, APP_TAGLINE } from './lib/brand';

export default function App() {
  const { t } = useI18n();
  const [activeCenter, setActiveCenter] = useState<CenterId>('redact');
  const [activeTool, setActiveTool] = useState<ToolId>('drawing');
  // 记住每个中心最后使用的工具，切回时不打断用户上下文
  const lastToolByCenter = useRef<Partial<Record<CenterId, ToolId>>>({ redact: 'drawing' });
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

  const handleCenterChange = (center: CenterId) => {
    if (center === activeCenter) return;
    lastToolByCenter.current[activeCenter] = activeTool;
    setActiveCenter(center);
    setActiveTool(lastToolByCenter.current[center] ?? CENTER_TOOLS[center][0].id);
    refresh();
  };

  const handleToolChange = (tool: ToolId) => {
    setActiveTool(tool);
    refresh();
  };

  const tools = CENTER_TOOLS[activeCenter];
  const centerMeta = getCenterMeta(activeCenter);

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
        activeCenter={activeCenter}
        onCenterChange={handleCenterChange}
        systemStatus={systemStatus}
        backendOnline={online}
      />

      {/* 二级子工具导航：所有中心固定渲染此条（等高），避免切换时布局跳变 */}
      <div className="relative z-30 shrink-0 w-full flex items-center px-3 py-2 bg-white/80 border-b-2 border-mem-ink/10">
        <SubNavPills
          key={activeCenter}
          options={tools.map((tool) => ({ id: tool.id, label: t(tool.labelKey) }))}
          activeId={activeTool}
          onChange={(id) => handleToolChange(id as ToolId)}
          colorVariant={centerMeta.accent}
        />
      </div>

      <main className="relative z-10 flex-1 w-full min-h-0 overflow-hidden flex">
        {activeCenter === 'redact' && (
          <>
            {activeTool === 'drawing' && (
              <DrawingView onNotify={showNotify} backendOnline={online} />
            )}
            {activeTool === 'pdf_doc' && (
              <DocPdfView onNotify={showNotify} backendOnline={online} />
            )}
            {activeTool === 'word_doc' && (
              <WordView onNotify={showNotify} backendOnline={online} />
            )}
            {activeTool === 'rules' && (
              <RuleCenter onNotify={showNotify} backendOnline={online} />
            )}
            {activeTool === 'audit' && (
              <AuditLogView onNotify={showNotify} backendOnline={online} />
            )}
          </>
        )}
        {activeCenter === 'calc_dev' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
            <CalcDevCenter tool={activeTool} />
          </div>
        )}
        {activeCenter === 'text_center' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
            <TextCenter tool={activeTool} />
          </div>
        )}
        {activeCenter !== 'redact' && activeCenter !== 'calc_dev' && activeCenter !== 'text_center' && (
          <CenterPlaceholder center={centerMeta} toolCount={tools.length} />
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
