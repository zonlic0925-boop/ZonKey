import React from 'react'
import { Construction, ShieldCheck } from 'lucide-react'
import type { CenterMeta } from '../../lib/navigation'
import { useI18n } from '../../i18n'

interface CenterPlaceholderProps {
  center: CenterMeta
  toolCount: number
}

const accentBadge: Record<string, string> = {
  coral: 'bg-mem-coral text-white',
  sky: 'bg-mem-sky text-white',
  pink: 'bg-mem-pink text-mem-ink',
  yellow: 'bg-mem-yellow text-mem-ink',
  teal: 'bg-mem-teal text-mem-ink',
  lime: 'bg-mem-lime text-mem-ink',
  lavender: 'bg-mem-lavender text-white',
  orange: 'bg-mem-orange text-mem-ink',
}

/**
 * 尚未接入工具的中心占位页。
 * 垂直切片每接入一个工具，对应视图即替换此占位。
 */
export const CenterPlaceholder: React.FC<CenterPlaceholderProps> = ({ center, toolCount }) => {
  const { t } = useI18n()
  const Icon = center.icon

  return (
    <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
      <div className="max-w-xl w-full bg-white border-[3px] border-mem-ink rounded-2xl shadow-memphis p-6 md:p-8 text-center">
        <div
          className={`mx-auto w-16 h-16 rounded-2xl border-[3px] border-mem-ink shadow-memphis-sm flex items-center justify-center ${accentBadge[center.accent]}`}
        >
          <Icon className="w-8 h-8" />
        </div>

        <h2 className="mt-4 font-display font-black text-xl md:text-2xl text-mem-ink">
          {t(center.labelKey)}
        </h2>

        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-mem-ink bg-mem-yellow/60 text-xs font-bold text-mem-ink">
          <Construction className="w-3.5 h-3.5" />
          <span>{t('placeholder.badge')}</span>
        </div>

        <p className="mt-4 text-sm text-mem-ink/70 leading-relaxed">
          {t('placeholder.body', { count: toolCount })}
        </p>

        <div className="mt-5 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-mem-cream border-2 border-mem-ink/15 text-xs text-mem-ink/70">
          <ShieldCheck className="w-4 h-4 text-mem-teal shrink-0" />
          <span>{t('placeholder.privacy')}</span>
        </div>
      </div>
    </div>
  )
}
