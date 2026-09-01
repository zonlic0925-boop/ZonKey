/**
 * 首页导航页（应用默认落地页，手机/桌面通用）。
 *
 * 设计目标（用户需求 2026-09-01）：「不要一上来就是脱敏功能」——
 * 打开软件先看到全部功能分类，点击卡片跳转对应工具；常用工具走收藏区直达。
 *
 * - 8 大中心分类卡：中心级进入（落到该中心当前/首个工具），卡片列出
 *   工具数与就绪数，不虚报（planned 只计不显）；
 * - 我的收藏区：有收藏时置顶展示快捷直达（复用 FavoritesView 的跳转逻辑，
 *   空态不占版面，只留一行入口提示）；
 * - 快捷入口：规则中心 / 审计日志 / 收藏页三个原生功能不经过中心层级直达。
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Star,
  ArrowUpRight,
  ScrollText,
  ClipboardList,
  LayoutGrid,
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { CENTERS, CENTER_TOOLS } from '../../lib/navigation';
import type { MemphisAccent } from '../../lib/navigation';
import type { CenterId, ToolId } from '../../types';
import {
  getFavorites,
  subscribeFavorites,
} from '../../lib/toolknit/favoritesCore';
import { staggerContainer, staggerItem, snappySpring } from '../../motion/springs';

/** 卡片悬停/按压：与 Memphis 卡片语言一致的位移微动（transform/opacity only） */
const hoverLift = { x: -2, y: -2, transition: snappySpring };
const tapPress = { x: 2, y: 2, scale: 0.99, transition: { duration: 0.08 } };

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

interface HomeNavViewProps {
  onOpenCenter: (center: CenterId) => void;
  onOpenTool: (tool: ToolId) => void;
  onOpenFavorites: () => void;
}

export const HomeNavView: React.FC<HomeNavViewProps> = ({
  onOpenCenter,
  onOpenTool,
  onOpenFavorites,
}) => {
  const { t } = useI18n();
  const [favIds, setFavIds] = useState<ToolId[]>(() => getFavorites());

  useEffect(() => subscribeFavorites(() => setFavIds(getFavorites())), []);

  const favCards = favIds
    .map((id) => {
      for (const center of CENTERS) {
        const meta = CENTER_TOOLS[center.id].find((m) => m.id === id);
        if (meta) return { toolId: id, labelKey: meta.labelKey, center };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 8);

  const readyTotal = CENTERS.reduce(
    (n, c) => n + CENTER_TOOLS[c.id].filter((m) => m.availability === 'ready').length,
    0,
  );

  return (
    <div className="max-w-5xl mx-auto space-y-7 pb-8">
      {/* 头部 */}
      <motion.div variants={staggerContainer} initial="hidden" animate="visible">
        <motion.h1 variants={staggerItem} className="font-display font-black text-2xl text-mem-ink">
          {t('homeNav.title')}
        </motion.h1>
        <motion.p variants={staggerItem} className="mt-1 text-sm text-mem-ink/60 font-medium">
          {t('homeNav.subtitle', { count: readyTotal })}
        </motion.p>
      </motion.div>

      {/* 我的收藏（有收藏才显示，点击直达） */}
      {favCards.length > 0 && (
        <section>
          <button
            type="button"
            onClick={onOpenFavorites}
            className="flex items-center gap-2 mb-3 group"
          >
            <Star className="w-4 h-4 text-mem-yellow fill-mem-yellow" />
            <span className="font-display font-bold text-sm text-mem-ink group-hover:underline">
              {t('homeNav.myFavorites')}
            </span>
            <span className="px-1.5 py-0.5 rounded-full border border-mem-ink bg-mem-yellow/40 text-[10px] font-black">
              {favCards.length}
            </span>
          </button>
          <div className="flex gap-2 flex-wrap">
            {favCards.map(({ toolId, labelKey, center }) => {
              const Icon = center.icon;
              return (
                <motion.button
                  key={toolId}
                  type="button"
                  onClick={() => onOpenTool(toolId)}
                  whileHover={hoverLift}
                  whileTap={tapPress}
                  className="flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-lg border-2 border-mem-ink bg-white shadow-memphis-sm"
                >
                  <span className={`p-0.5 rounded border border-mem-ink/20 ${accentBg[center.accent]}`}>
                    <Icon className="w-3 h-3 text-mem-ink" />
                  </span>
                  <span className="text-xs font-semibold text-mem-ink">{t(labelKey)}</span>
                </motion.button>
              );
            })}
          </div>
        </section>
      )}

      {/* 8 大中心分类卡 */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {CENTERS.map((center) => {
          const Icon = center.icon;
          const tools = CENTER_TOOLS[center.id];
          const ready = tools.filter((m) => m.availability === 'ready').length;
          return (
            <motion.button
              key={center.id}
              type="button"
              variants={staggerItem}
              whileHover={hoverLift}
              whileTap={tapPress}
              onClick={() => onOpenCenter(center.id)}
              className="relative text-left px-4 py-4 rounded-2xl border-2 border-mem-ink bg-white shadow-memphis-sm hover:border-mem-ink"
            >
              <span className={`inline-flex p-2 rounded-xl border-2 border-mem-ink ${accentBg[center.accent]} mb-3`}>
                <Icon className="w-5 h-5 text-mem-ink" />
              </span>
              <span className="flex items-center gap-1 font-display font-bold text-sm text-mem-ink">
                {t(center.labelKey)}
                <ArrowUpRight className="w-3.5 h-3.5 text-mem-ink/30" />
              </span>
              <span className="block mt-1 text-[11px] font-bold text-mem-ink/50">
                {t('homeNav.toolCount', { ready, total: tools.length })}
              </span>
            </motion.button>
          );
        })}
      </motion.section>

      {/* 原生功能快捷入口 */}
      <motion.section variants={staggerContainer} initial="hidden" animate="visible">
        <motion.h2
          variants={staggerItem}
          className="font-display font-bold text-sm uppercase tracking-wide text-mem-ink/50 mb-3"
        >
          {t('homeNav.quickLinks')}
        </motion.h2>
        <motion.div variants={staggerItem} className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenTool('rules')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-mem-ink bg-white shadow-memphis-sm text-xs font-semibold text-mem-ink hover:bg-mem-teal/20 transition-colors"
          >
            <ScrollText className="w-3.5 h-3.5" />
            {t('header.navRules')}
          </button>
          <button
            type="button"
            onClick={() => onOpenTool('audit')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-mem-ink bg-white shadow-memphis-sm text-xs font-semibold text-mem-ink hover:bg-mem-teal/20 transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            {t('header.navAudit')}
          </button>
          <button
            type="button"
            onClick={onOpenFavorites}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-mem-ink bg-white shadow-memphis-sm text-xs font-semibold text-mem-ink hover:bg-mem-yellow/30 transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            {t('favorites.title')}
          </button>
        </motion.div>
      </motion.section>
    </div>
  );
};
