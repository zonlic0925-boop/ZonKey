import React from 'react'
import { CENTER_TOOLS } from '../../lib/navigation'
import type { ToolId } from '../../types'
import { useI18n } from '../../i18n'
import { FavoriteStar } from '../navigation/FavoriteStar'

const PPT_GROUPS = ['convert', 'extract', 'create'] as const

interface PptToolHomeProps {
  onSelect: (tool: ToolId) => void
  onNotify?: (msg: string, type: 'success' | 'error' | 'info') => void
}

/** PPT 工坊首页：转换 / 提取优化 / 生成 三组工具网格，卡片右上角可收藏（对齐 PDF 工坊首页） */
export const PptToolHome: React.FC<PptToolHomeProps> = ({ onSelect, onNotify }) => {
  const { t } = useI18n()
  const tools = CENTER_TOOLS.ppt_center.filter((m) => m.id !== 'ppt-home')

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-8">
      <div>
        <h2 className="font-display font-black text-2xl text-mem-ink">{t('pptGroups.homeTitle')}</h2>
        <p className="mt-1 text-sm text-mem-ink/60 font-medium">{t('pptGroups.homeHint')}</p>
      </div>

      {PPT_GROUPS.map((group) => {
        const groupTools = tools.filter((m) => m.group === group)
        if (groupTools.length === 0) return null
        return (
          <section key={group}>
            <h3 className="font-display font-bold text-sm uppercase tracking-wide text-mem-ink/50 mb-3">
              {t(`pptGroups.${group}`)}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {groupTools.map((tool) => (
                <div key={tool.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelect(tool.id)}
                    className="w-full text-left px-3 py-3 rounded-xl border-2 border-mem-ink bg-white shadow-memphis-sm hover:bg-mem-orange/10 hover:border-mem-orange transition-colors"
                  >
                    <span className="font-display font-semibold text-sm text-mem-ink leading-snug">
                      {t(tool.labelKey)}
                    </span>
                  </button>
                  <FavoriteStar toolId={tool.id} onNotify={onNotify} />
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
