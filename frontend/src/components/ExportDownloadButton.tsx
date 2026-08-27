import React, { useState } from 'react'
import { Download } from 'lucide-react'
import { saveOutputFileAs, type NotifyFn } from '../lib/api'
import { useI18n } from '../i18n'

export interface DownloadInfo {
  outputDir?: string
  name: string
}

interface ExportDownloadButtonProps {
  info: DownloadInfo
  label?: string
  onNotify?: NotifyFn
  className?: string
}

export const ExportDownloadButton: React.FC<ExportDownloadButtonProps> = ({
  info,
  label,
  onNotify,
  className = 'memphis-btn-secondary w-full flex items-center justify-center gap-1.5 text-xs',
}) => {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const buttonLabel = label ?? t('export.labelPdf')

  const handleExport = async () => {
    setBusy(true)
    try {
      const result = await saveOutputFileAs(info.outputDir, info.name)
      if (result.cancelled) {
        onNotify?.(t('export.cancelled'), 'info')
        return
      }
      if (result.savedPath) {
        onNotify?.(t('export.savedTo', { path: result.savedPath }), 'success')
      }
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : t('export.failed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleExport()}
      disabled={busy}
      className={className}
    >
      <Download className={`w-3.5 h-3.5 ${busy ? 'animate-pulse' : ''}`} />
      {busy ? t('export.exporting') : buttonLabel}
    </button>
  )
}
