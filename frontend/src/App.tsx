import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Header } from './components/Header';
import { WindowControls } from './components/WindowControls';
import { DrawingView } from './components/DrawingView';
import { CalcDevCenter } from './components/calcdev/CalcDevCenter';
import { TextCenter } from './components/textcenter/TextCenter';
import { PdfCenter } from './components/pdfcenter/PdfCenter';
import { PdfToolHome } from './components/pdfcenter/PdfToolHome';
import { ImageCenter } from './components/imagecenter/ImageCenter';
import { PptCenter } from './components/pptcenter/PptCenter';
import { MediaCenter } from './components/mediacenter/MediaCenter';
import { SystemCenter } from './components/systemcenter/SystemCenter';
import { DocPdfView } from './components/DocPdfView';
import { WordView } from './components/WordView';
import { RuleCenter } from './components/RuleCenter';
import { AuditLogView } from './components/AuditLogView';
import { SubNavPills } from './components/navigation/SubNavPills';
import { MobileBottomNav, type MobileTabId } from './components/navigation/MobileBottomNav';
import { FavoritesView } from './components/navigation/FavoritesView';
import { HomeNavView } from './components/navigation/HomeNavView';
import { FavoriteStar } from './components/navigation/FavoriteStar';
import { CenterPlaceholder } from './components/common/CenterPlaceholder';
import { ZsErrorBoundary } from './components/common/ZsErrorBoundary';
import { MemphisDecor } from './components/MemphisDecor';
import { FluidBackground } from './components/FluidBackground';
import { useTheme } from './lib/theme/ThemeProvider';
import { pageFadeSlide } from './motion/springs';
import { CenterId, ToolId } from './types';
import { CENTER_TOOLS, getCenterMeta } from './lib/navigation';
import type { ToolMeta } from './lib/navigation';
import { CheckCircle2, AlertCircle, Info, X, WifiOff, Home } from 'lucide-react';
import { useBackendStatus } from './lib/api';
import { useI18n } from './i18n';
import { APP_NAME, APP_TAGLINE } from './lib/brand';
import { OfflinePrivacyNotice, hasAcknowledgedPrivacyNotice } from './components/OfflinePrivacyNotice';

export default function App() {
  const { t } = useI18n();
  const { texture } = useTheme();
  // 默认落地页 = 首页导航（home-nav）：先看分类再进功能，不直接进脱敏画布
  const [activeCenter, setActiveCenter] = useState<CenterId>('redact');
  const [activeTool, setActiveTool] = useState<ToolId>('home-nav');
  // 记住每个中心最后使用的工具，切回时不打断用户上下文；home-nav 是虚拟视图不记录
  const lastToolByCenter = useRef<Partial<Record<CenterId, ToolId>>>({ redact: 'drawing' });
  const { online, status, refresh } = useBackendStatus();
  // 首次打开弹出「隐私与联网声明」；确认后 localStorage 记忆，页眉盾牌可重开
  const [privacyNoticeOpen, setPrivacyNoticeOpen] = useState(() => !hasAcknowledgedPrivacyNotice());

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
    if (center === activeCenter && activeTool !== 'home-nav' && activeTool !== 'favorites-view') return;
    lastToolByCenter.current[activeCenter] = activeTool === 'home-nav' || activeTool === 'favorites-view'
      ? (lastToolByCenter.current[activeCenter] ?? 'drawing')
      : activeTool;
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

  // 手机端底部导航：favorites/home-nav 为虚拟视图；home 回首页导航页
  const mobileTab: MobileTabId =
    activeCenter === 'redact' && activeTool === 'favorites-view'
      ? 'favorites'
      : activeCenter === 'redact' && activeTool === 'home-nav'
        ? 'home'
        : activeCenter;

  const openCenterFromMobile = (center: CenterId) => {
    handleCenterChange(center);
  };

  /** 首页导航「回到首页」按钮 */
  const openHomeNav = () => {
    if (activeCenter !== 'redact') {
      lastToolByCenter.current[activeCenter] = activeTool;
      setActiveCenter('redact');
    }
    setActiveTool('home-nav');
    refresh();
  };

  /** 收藏直达：定位到工具所属中心并切换（含 redact 原生工具） */
  const openFavoriteTool = (toolId: ToolId) => {
    if (toolId === 'favorites-view' || toolId === 'home-nav') return;
    for (const center of Object.keys(CENTER_TOOLS) as CenterId[]) {
      const meta = CENTER_TOOLS[center].find((m) => m.id === toolId) as ToolMeta | undefined;
      if (meta) {
        if (center !== activeCenter) {
          lastToolByCenter.current[activeCenter] = activeTool;
          setActiveCenter(center);
        }
        setActiveTool(toolId);
        refresh();
        return;
      }
    }
  };

  return (
    <div className="zs-theme-root relative w-full h-[100dvh] max-w-[100vw] overflow-hidden flex flex-col bg-mem-cream font-body text-mem-ink select-none">
      <MemphisDecor />
      {/* 背景外观层（用户可选）：fluid=流动渐变 blob；其余为静态纹理。
          铺在装饰层之下、内容之下，不接指针。 */}
      {texture === 'fluid' ? (
        <FluidBackground />
      ) : texture !== 'none' ? (
        <div
          aria-hidden="true"
          className={`zs-texture pointer-events-none z-0 ${
            texture === 'grid' ? 'zs-texture-grid' : texture === 'dots' ? 'zs-texture-dots' : 'zs-texture-paper'
          }`}
        />
      ) : null}
      <WindowControls />

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
        onOpenPrivacy={() => setPrivacyNoticeOpen(true)}
      />

      {/* 二级子工具导航：home-nav 视图隐藏（首页有自己的分类卡），其余中心固定渲染（等高）避免跳变 */}
      {!(activeCenter === 'redact' && activeTool === 'home-nav') && (
        <div className="relative z-30 shrink-0 w-full flex items-center px-3 py-2 bg-white/80 border-b-2 border-mem-ink/10">
          <SubNavPills
            key={activeCenter}
            options={tools.map((tool) => ({
              id: tool.id,
              label: t(tool.labelKey),
              group:
                activeCenter === 'pdf_center' && tool.group
                  ? t(`pdfGroups.${tool.group}`)
                  : undefined,
            }))}
            activeId={activeTool}
            onChange={(id) => handleToolChange(id as ToolId)}
            colorVariant={centerMeta.accent}
            trailingSlot={
              activeCenter === 'redact' && activeTool !== 'favorites-view' ? (
                <span className="ml-0.5 mr-1 shrink-0 flex items-center">
                  <FavoriteStar
                    toolId={activeTool}
                    onNotify={showNotify}
                    className="flex items-center justify-center w-7 h-7 rounded-lg border-2 border-mem-ink/20 bg-white hover:bg-mem-yellow/40 hover:border-mem-ink transition-colors"
                  />
                </span>
              ) : undefined
            }
          />
          {/* 回首页：任何中心/工具下都可一键回到首页导航（首页自身除外） */}
          {!(activeCenter === 'redact' && activeTool === 'home-nav') && (
            <button
              type="button"
              onClick={openHomeNav}
              className="ml-2 shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-2 border-mem-ink/30 bg-white text-xs font-semibold text-mem-ink/60 hover:border-mem-ink hover:text-mem-ink transition-colors"
              title={t('homeNav.title')}
            >
              <Home className="w-3.5 h-3.5" />
              {t('mobileNav.home')}
            </button>
          )}
        </div>
      )}

      <main className="relative z-10 flex-1 w-full min-h-0 overflow-hidden flex">
        <motion.div
          key={`${activeCenter}:${activeTool}`}
          variants={pageFadeSlide}
          initial="initial"
          animate="animate"
          className="flex-1 min-h-0 flex flex-col"
        >
        <ZsErrorBoundary resetKey={`${activeCenter}:${activeTool}`}>
        {activeCenter === 'redact' && activeTool === 'home-nav' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
            <HomeNavView
              onOpenCenter={handleCenterChange}
              onOpenTool={openFavoriteTool}
              onOpenFavorites={() => handleToolChange('favorites-view' as ToolId)}
            />
          </div>
        ) : activeCenter === 'redact' && activeTool === 'favorites-view' ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
            <FavoritesView onOpenTool={openFavoriteTool} />
          </div>
        ) : (
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
        {activeCenter === 'pdf_center' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
            {activeTool === 'pdf-home' ? (
              <PdfToolHome onSelect={handleToolChange} onNotify={showNotify} />
            ) : (
              <PdfCenter tool={activeTool} />
            )}
          </div>
        )}
        {activeCenter === 'image_center' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
            <ImageCenter tool={activeTool} />
          </div>
        )}
        {activeCenter === 'ppt_center' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
            <PptCenter tool={activeTool} />
          </div>
        )}
        {activeCenter === 'media_center' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
            <MediaCenter tool={activeTool} />
          </div>
        )}
        {activeCenter === 'system_tools' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
            <SystemCenter tool={activeTool} />
          </div>
        )}
        {activeCenter !== 'redact' && activeCenter !== 'calc_dev' && activeCenter !== 'text_center' && activeCenter !== 'pdf_center' && activeCenter !== 'image_center' && activeCenter !== 'ppt_center' && activeCenter !== 'media_center' && activeCenter !== 'system_tools' && (
          <CenterPlaceholder center={centerMeta} toolCount={tools.length} />
        )}
        </>
        )}
        </ZsErrorBoundary>
        </motion.div>
      </main>

      <MobileBottomNav
        activeTab={mobileTab}
        onTabChange={(tab) => {
          if (tab === 'favorites') {
            // 收藏是 redact 中心下的虚拟视图：先回中心再切 tool，避免落进占位符
            if (activeCenter !== 'redact') handleCenterChange('redact');
            handleToolChange('favorites-view' as ToolId);
          } else if (tab === 'home') {
            openHomeNav();
          } else {
            openCenterFromMobile(tab as CenterId);
          }
        }}
        onOpenCenter={openCenterFromMobile}
      />

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

      <OfflinePrivacyNotice open={privacyNoticeOpen} onClose={() => setPrivacyNoticeOpen(false)} />
    </div>
  );
}
