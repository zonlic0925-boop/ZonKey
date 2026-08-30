import React from 'react'
import { useI18n } from '../i18n'

interface PreviewTogglePanelProps {
  previewMode: 'before' | 'after'
  onPreviewModeChange: (mode: 'before' | 'after') => void
  disabled?: boolean
}

/** 脱敏前后预览切换 — 放在左侧功能栏，不遮挡图纸区域 */
export const PreviewTogglePanel: React.FC<PreviewTogglePanelProps> = ({
  previewMode,
  onPreviewModeChange,
  disabled = false,
}) => {
  const { t } = useI18n()

  return (
    <div
      className="space-y-1.5"
      role="group"
      aria-label={t('canvas.previewToggleTitle')}
    >
      <span className="text-xs font-bold text-mem-ink/60 uppercase tracking-wide">
        {t('canvas.previewToggleTitle')}
      </span>
      <div
        className={`flex rounded-xl border-2 border-mem-ink overflow-hidden shadow-memphis-sm bg-white ${
          disabled ? 'opacity-40 pointer-events-none' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => onPreviewModeChange('before')}
          className={`flex-1 px-2 py-1.5 text-xs font-bold transition-all ${
            previewMode === 'before'
              ? 'bg-mem-yellow text-mem-ink'
              : 'bg-white text-mem-ink/55 hover:bg-mem-cream'
          }`}
        >
          {t('canvas.previewToggleBefore')}
        </button>
        <button
          type="button"
          onClick={() => onPreviewModeChange('after')}
          className={`flex-1 px-2 py-1.5 text-xs font-bold border-l-2 border-mem-ink transition-all ${
            previewMode === 'after'
              ? 'bg-mem-teal text-mem-ink'
              : 'bg-white text-mem-ink/55 hover:bg-mem-cream'
          }`}
        >
          {t('canvas.previewToggleAfter')}
        </button>
      </div>
    </div>
  )
}
