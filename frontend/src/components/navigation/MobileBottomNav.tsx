/**
 * 手机端底部导航栏（md:hidden，桌面不渲染）。
 *
 * 5 槽：收藏 / 首页 / 智能脱敏 / PDF 工坊 / 更多（全部中心）。
 * - 拇指热区：min-h 52px，Memphis 硬边 + 白底毛玻璃；
 * - 活性态用 Framer layoutId 滑块（与 SubNavPills 同 spring，语言一致）；
 * - 「更多」弹出全部 8 中心的底部抽屉，选中后关闭。
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Home, Star, ShieldCheck, FileStack, LayoutGrid, X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { CENTERS, type MemphisAccent } from '../../lib/navigation';
import type { CenterId } from '../../types';
import { pillMorphSpring } from '../../motion/springs';
import {
  getFavorites,
  subscribeFavorites,
} from '../../lib/zonkey/favoritesCore';

const accentBg: Record<MemphisAccent, string> = {
  coral: 'bg-mem-coral/20',
  sky: 'bg-mem-sky/30',
  orange: 'bg-mem-orange/30',
  yellow: 'bg-mem-yellow/40',
  teal: 'bg-mem-teal/30',
  pink: 'bg-mem-pink/30',
  lavender: 'bg-mem-lavender/30',
  lime: 'bg-mem-lime/40',
};

export type MobileTabId = 'home' | 'favorites' | CenterId;

interface MobileBottomNavProps {
  activeTab: MobileTabId;
  /** home/favorites 为虚拟 Tab：切到 redact('drawing') 或 favorites 虚拟工具 */
  onTabChange: (tab: MobileTabId) => void;
  onOpenCenter: (center: CenterId) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenCenter,
}) => {
  const { t } = useI18n();
  const [favCount, setFavCount] = useState(() => getFavorites().length);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => subscribeFavorites(() => setFavCount(getFavorites().length)), []);

  const isCenterActive = (id: CenterId) => activeTab === id;
  const moreActive = activeTab !== 'home' && activeTab !== 'favorites'
    && activeCenterNotPrimary(activeTab);

  const tab = (
    key: string,
    label: string,
    Icon: React.ComponentType<{ className?: string }>,
    active: boolean,
    onClick: () => void,
    badge?: number,
    accent?: MemphisAccent,
  ) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[52px] rounded-xl zs-touch-target-mobile ${
        active ? '' : 'text-mem-ink/55'
      }`}
    >
      {active && (
        <motion.div
          layoutId="mobileTabActive"
          transition={pillMorphSpring}
          className={`absolute inset-x-1 inset-y-0.5 rounded-xl border-2 border-mem-ink shadow-memphis-sm ${
            accentBg[accent ?? 'yellow']
          }`}
        />
      )}
      <span className="relative z-10">
        <Icon className="w-5 h-5" />
      </span>
      <span className="relative z-10 text-[10px] font-bold leading-none whitespace-nowrap">
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-0.5 right-1/2 translate-x-4 z-20 min-w-[16px] px-1 h-4 flex items-center justify-center rounded-full bg-mem-coral border border-mem-ink text-[9px] font-black text-white">
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <>
      <nav
        aria-label={t('mobileNav.label')}
        className="md:hidden shrink-0 relative z-40 flex items-stretch gap-1 px-2 pt-1 pb-[max(4px,env(safe-area-inset-bottom))] bg-white/95 backdrop-blur border-t-[3px] border-mem-ink"
      >
        {tab('favorites', t('mobileNav.favorites'), Star, activeTab === 'favorites', () => onTabChange('favorites'), favCount, 'yellow')}
        {tab('home', t('mobileNav.home'), Home, activeTab === 'home', () => onTabChange('home'), undefined, 'teal')}
        {tab('redact', t('centers.redact'), ShieldCheck, isCenterActive('redact'), () => onOpenCenter('redact'), undefined, 'coral')}
        {tab('pdf_center', t('centers.pdfCenter'), FileStack, isCenterActive('pdf_center'), () => onOpenCenter('pdf_center'), undefined, 'sky')}
        {tab('more', t('mobileNav.more'), LayoutGrid, moreActive, () => setMoreOpen(true), undefined, 'lavender')}
      </nav>

      {/* 全部中心抽屉 */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-mem-ink/40" onClick={() => setMoreOpen(false)} />
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative z-10 w-full rounded-t-2xl border-t-[3px] border-mem-ink bg-white px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3"
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="font-display font-black text-sm text-mem-ink">{t('mobileNav.allCenters')}</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="zs-touch-target-mobile flex items-center justify-center w-9 h-9 rounded-xl border-2 border-mem-ink bg-white"
                aria-label={t('common.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {CENTERS.map((center) => {
                const Icon = center.icon;
                return (
                  <button
                    key={center.id}
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      onOpenCenter(center.id);
                    }}
                    className={`flex flex-col items-center gap-1.5 px-1 py-3 rounded-xl border-2 border-mem-ink text-mem-ink ${accentBg[center.accent]}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold leading-tight text-center">{t(center.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

/** 主 Tab 只展示 redact 与 pdf_center，其余中心归入「更多」 */
function activeCenterNotPrimary(tab: MobileTabId): boolean {
  return tab !== 'redact' && tab !== 'pdf_center';
}
