import React from 'react'
import { ShieldCheck, RefreshCw } from 'lucide-react'
import { parseDownloadUrl, type NotifyFn } from '../lib/api'
import { useI18n } from '../i18n'
import { ExportDownloadButton } from './ExportDownloadButton'
import { PreviewTogglePanel } from './PreviewTogglePanel'

interface RedactActionBarProps {
  onExecuteRedact: () => void
  isProcessing: boolean
  isScanning?: boolean
  selectedCount: number
  previewMode?: 'before' | 'after'
  hasAfterPreview?: boolean
  onPreviewModeChange?: (mode: 'before' | 'after') => void
  onRescan?: () => void
  canRescan?: boolean
  downloadUrl?: string | null
  pdfDownloadUrl?: string | null
  downloadLabel?: string
  className?: string
  onNotify?: NotifyFn
}

export const RedactActionBar: React.FC<RedactActionBarProps> = ({
  onExecuteRedact,
  isProcessing,
  isScanning = false,
  selectedCount,
  previewMode = 'before',
  hasAfterPreview = false,
  onPreviewModeChange,
  onRescan,
  canRescan = false,
  downloadUrl,
  pdfDownloadUrl,
  downloadLabel,
  className = '',
  onNotify,
}) => {
  const { t } = useI18n()
  const canRedact = selectedCount > 0 && !isProcessing && !isScanning
  const isRerun = previewMode === 'after' && hasAfterPreview
  const downloadInfo = parseDownloadUrl(downloadUrl ?? null)
  const pdfOpenInfo = parseDownloadUrl(pdfDownloadUrl ?? null)

  return (
    <div className={`space-y-2 ${className}`}>
      {hasAfterPreview && previewMode === 'before' && (
        <p className="text-xs text-mem-ink/55 leading-snug px-0.5">{t('redact.manualSupplementHint')}</p>
      )}
      {hasAfterPreview && onPreviewModeChange && (
        <PreviewTogglePanel
          previewMode={previewMode}
          onPreviewModeChange={onPreviewModeChange}
          disabled={isProcessing || isScanning}
        />
      )}
      {canRescan && onRescan && (
        <button
          type="button"
          onClick={onRescan}
          disabled={isProcessing || isScanning}
          className="memphis-btn-secondary w-full flex items-center justify-center gap-2 text-xs disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? t('redact.rescanning') : t('redact.rescan')}</span>
        </button>
      )}
      {downloadInfo && (
        <ExportDownloadButton
          info={downloadInfo}
          openInfo={pdfOpenInfo}
          label={downloadLabel ?? t('export.labelPdf')}
          onNotify={onNotify}
        />
      )}
      <button
        onClick={onExecuteRedact}
        disabled={!canRedact}
        className="memphis-btn-primary w-full flex items-center justify-center gap-2 text-xs disabled:opacity-40"
      >
        <ShieldCheck className="w-4 h-4" />
        <span>
          {isProcessing
            ? t('redact.executing')
            : isScanning
              ? t('redact.scanning')
              : isRerun
                ? t('redact.rerun')
                : t('redact.execute')}
        </span>
      </button>
    </div>
  )
}
