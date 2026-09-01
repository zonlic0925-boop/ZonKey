/**
 * 工具收藏星标按钮（工具首页卡片右上角）。
 *
 * - 点击 toggle；超上限时回调通知（App 层 toast）；
 * - 44px 触控目标（zs-touch-target-mobile）但视觉紧凑；
 * - spring pop 动效反馈收藏成功。
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { ToolId } from '../../types';
import { isFavorite, toggleFavorite } from '../../lib/toolknit/favoritesCore';

interface FavoriteStarProps {
  toolId: ToolId;
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void;
  /** 卡片右上角绝对定位（默认）；传入覆盖类则由调用方控制布局（如 SubNav 行内联） */
  className?: string;
}

export const FavoriteStar: React.FC<FavoriteStarProps> = ({ toolId, onNotify, className }) => {
  const { t } = useI18n();
  const [fav, setFav] = useState(() => isFavorite(toolId));
  const [pop, setPop] = useState(0);

  const handle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = toggleFavorite(toolId);
    if (result === null) {
      onNotify?.(t('favorites.limitReached'), 'error');
      return;
    }
    setFav(result);
    if (result) setPop((n) => n + 1);
  };

  return (
    <button
      type="button"
      onClick={handle}
      aria-pressed={fav}
      aria-label={fav ? t('favorites.remove') : t('favorites.add')}
      className={
        className ??
        'absolute top-1 right-1 z-10 flex items-center justify-center w-7 h-7 min-h-[36px] min-w-[36px] rounded-lg hover:bg-mem-yellow/40 transition-colors'
      }
    >
      <motion.span
        key={pop}
        initial={pop > 0 ? { scale: 0.6, rotate: -20 } : false}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      >
        <Star
          className={`w-4 h-4 ${
            fav ? 'text-mem-yellow fill-mem-yellow drop-shadow-[0_1px_0_rgba(26,26,46,0.6)]' : 'text-mem-ink/30'
          }`}
        />
      </motion.span>
    </button>
  );
};
