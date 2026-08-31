/**
 * 收藏中心页（手机端为主，桌面也可用）。
 *
 * - 网格直达卡片：点卡片跳转工具；右上星标可取消收藏；
 * - 空状态教学：告诉用户去哪里点亮星标（Operate 纪律：空状态教界面，不是"没有内容"）；
 * - 卡片显示所属中心 + 引擎可用性（后端离线时纯前端工具不受影响，不做二次分层，避免噪音）。
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, ArrowUpRight, MousePointerClick } from 'lucide-react';
import { useI18n } from '../../i18n';
import { CENTER_TOOLS, CENTERS, getCenterMeta } from '../../lib/navigation';
import type { ToolId } from '../../types';
import {
  getFavorites,
  removeFavorite,
  subscribeFavorites,
} from '../../lib/toolknit/favoritesCore';

interface FavoritesViewProps {
  onOpenTool: (tool: ToolId) => void;
}

const accentChip: Record<string, string> = {
  coral: 'bg-mem-coral/20',
  sky: 'bg-mem-sky/30',
  orange: 'bg-mem-orange/30',
  yellow: 'bg-mem-yellow/40',
  teal: 'bg-mem-teal/30',
  pink: 'bg-mem-pink/30',
  lavender: 'bg-mem-lavender/30',
  lime: 'bg-mem-lime/40',
};

export const FavoritesView: React.FC<FavoritesViewProps> = ({ onOpenTool }) => {
  const { t } = useI18n();
  const [favIds, setFavIds] = useState<ToolId[]>(() => getFavorites());

  useEffect(() => subscribeFavorites(() => setFavIds(getFavorites())), []);

  const cards = favIds
    .map((id) => {
      for (const center of CENTERS) {
        const meta = CENTER_TOOLS[center.id].find((m) => m.id === id);
        if (meta) return { toolId: id, labelKey: meta.labelKey, center };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-6">
      <div className="flex items-center gap-2">
        <Star className="w-5 h-5 text-mem-yellow fill-mem-yellow" />
        <h2 className="font-display font-black text-xl text-mem-ink">{t('favorites.title')}</h2>
        <span className="px-2 py-0.5 rounded-full border-2 border-mem-ink bg-mem-yellow/40 text-xs font-black">
          {cards.length}
        </span>
      </div>
      <p className="text-xs font-bold text-mem-ink/60 -mt-3">{t('favorites.hint')}</p>

      {cards.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 px-6 py-10 rounded-2xl border-2 border-dashed border-mem-ink/30 bg-white/70 text-center">
          <span className="flex items-center justify-center w-12 h-12 rounded-2xl border-2 border-mem-ink bg-mem-yellow/40">
            <MousePointerClick className="w-6 h-6 text-mem-ink" />
          </span>
          <p className="font-display font-bold text-sm text-mem-ink">{t('favorites.emptyTitle')}</p>
          <p className="text-xs font-medium text-mem-ink/60 max-w-xs leading-relaxed">
            {t('favorites.emptyHint')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {cards.map(({ toolId, labelKey, center }) => {
            const Icon = center.icon;
            return (
              <motion.div
                key={toolId}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="relative"
              >
                <button
                  type="button"
                  onClick={() => onOpenTool(toolId)}
                  className="w-full text-left px-3 py-3 pr-9 rounded-xl border-2 border-mem-ink bg-white shadow-memphis-sm active:translate-y-0.5 active:shadow-none transition-all"
                >
                  <span className="flex items-center gap-1.5 mb-1.5">
                    <span className={`p-1 rounded-md border border-mem-ink/20 ${accentChip[center.accent]}`}>
                      <Icon className="w-3.5 h-3.5 text-mem-ink" />
                    </span>
                    <span className="text-[10px] font-bold text-mem-ink/50 truncate">
                      {t(center.labelKey)}
                    </span>
                  </span>
                  <span className="flex items-start gap-1">
                    <span className="font-display font-semibold text-sm text-mem-ink leading-snug">
                      {t(labelKey)}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-mem-ink/35 shrink-0 mt-0.5" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => removeFavorite(toolId)}
                  aria-label={t('favorites.remove')}
                  className="absolute top-1.5 right-1.5 flex items-center justify-center w-8 h-8 rounded-lg bg-mem-yellow/60 border border-mem-ink active:scale-90 transition-transform"
                >
                  <Star className="w-4 h-4 text-mem-ink fill-mem-ink" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
