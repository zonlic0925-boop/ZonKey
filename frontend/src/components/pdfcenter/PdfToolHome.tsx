import React from 'react'
import { CENTER_TOOLS } from '../../lib/navigation'
import type { ToolId } from '../../types'
import { useI18n } from '../../i18n'

const PDF_GROUPS = ['organize', 'convert', 'edit', 'security'] as const

interface PdfToolHomeProps {
  onSelect: (tool: ToolId) => void
}

/** PDF 工坊首页：按 iLovePDF 四组展示工具网格 */
export const PdfToolHome: React.FC<PdfToolHomeProps> = ({ onSelect }) => {
  const { t } = useI18n()
  const tools = CENTER_TOOLS.pdf_center.filter((m) => m.id !== 'pdf-home')

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-8">
      <div>
        <h2 className="font-display font-black text-2xl text-mem-ink">{t('pdfGroups.homeTitle')}</h2>
        <p className="mt-1 text-sm text-mem-ink/60 font-medium">{t('pdfGroups.homeHint')}</p>
      </div>

      {PDF_GROUPS.map((group) => {
        const groupTools = tools.filter((m) => m.group === group)
        if (groupTools.length === 0) return null
        return (
          <section key={group}>
            <h3 className="font-display font-bold text-sm uppercase tracking-wide text-mem-ink/50 mb-3">
              {t(`pdfGroups.${group}`)}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {groupTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => onSelect(tool.id)}
                  className="text-left px-3 py-3 rounded-xl border-2 border-mem-ink bg-white shadow-memphis-sm hover:bg-mem-sky/10 hover:border-mem-sky transition-colors"
                >
                  <span className="font-display font-semibold text-sm text-mem-ink leading-snug">
                    {t(tool.labelKey)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
