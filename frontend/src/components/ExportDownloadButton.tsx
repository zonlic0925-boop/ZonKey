import React, { useState } from 'react'
import { Download, ExternalLink } from 'lucide-react'
import { saveOutputFileAs, openOutputFile, type NotifyFn } from '../lib/api'
import { useI18n } from '../i18n'

export interface DownloadInfo {
  outputDir?: string
  name: string
}

interface ExportDownloadButtonProps {
  info: DownloadInfo
  openInfo?: DownloadInfo | null
  label?: string
  onNotify?: NotifyFn
  className?: string
  showOpen?: boolean
}

export const ExportDownloadButton: React.FC<ExportDownloadButtonProps> = ({
  info,
  openInfo,
  label,
  onNotify,
  className = 'memphis-btn-secondary w-full flex items-center justify-center gap-1.5 text-xs',
  showOpen = true,
}) => {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [opening, setOpening] = useState(false)
  const buttonLabel = label ?? t('export.labelPdf')
  const pdfOpen = openInfo ?? (info.name.toLowerCase().endsWith('.pdf') ? info : null)

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

  const handleOpen = async () => {
    if (!pdfOpen) return
    setOpening(true)
    try {
      await openOutputFile(pdfOpen.outputDir, pdfOpen.name)
      onNotify?.(t('export.openedPdf'), 'success')
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : t('export.openFailed'), 'error')
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {showOpen && pdfOpen && (
        <button
          type="button"
          onClick={() => void handleOpen()}
          disabled={opening || busy}
          className="memphis-btn-secondary w-full flex items-center justify-center gap-1.5 text-xs"
        >
          <ExternalLink className={`w-3.5 h-3.5 ${opening ? 'animate-pulse' : ''}`} />
          {opening ? t('export.opening') : t('export.openPdf')}
        </button>
      )}
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={busy || opening}
        className={className}
      >
        <Download className={`w-3.5 h-3.5 ${busy ? 'animate-pulse' : ''}`} />
        {busy ? t('export.exporting') : buttonLabel}
      </button>
    </div>
  )
}
