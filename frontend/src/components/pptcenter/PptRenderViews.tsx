import React, { useState } from 'react'
import { FileOutput, Images } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { apiFetch } from '../../lib/api'
import { useBackendOnline } from '../../lib/deliver'
import { ExportDownloadButton } from '../ExportDownloadButton'
import { ErrorLine } from '../calcdev/kit'
import { PptPicker } from './PptCenterViews'

export interface PptRenderResult {
  status: string
  renderer: string
  download_name: string
  output_dir: string
  target: 'pdf' | 'images'
  page_count?: number
  image_format?: string
}

function renderPptx(file: File, target: 'pdf' | 'images', imageFormat = 'png', dpi = 150): Promise<PptRenderResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('target', target)
  form.append('image_format', imageFormat)
  form.append('dpi', String(dpi))
  return apiFetch<PptRenderResult>('/api/ppt/render', { method: 'POST', body: form }, 300000)
}

const RENDERER_LABELS: Record<string, string> = {
  libreoffice: 'LibreOffice',
  'powerpoint-com': 'PowerPoint',
}

export const PptToPdfView: React.FC = () => {
  const { t } = useI18n()
  const backendOnline = useBackendOnline()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PptRenderResult | null>(null)

  const run = async (file: File) => {
    // PPTX 渲染必须本机引擎（LibreOffice/PowerPoint COM），浏览器无法实现——离线明确引导而非裸 405
    if (backendOnline === false) {
      setError(t('pptcenter.backendOffline'))
      setResult(null)
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await renderPptx(file, 'pdf'))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileOutput className="w-5 h-5 text-mem-orange" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pptToPdf')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pptcenter.toPdfHint')}</p>
      {backendOnline === false && (
        <div className="px-4 py-3 border-2 border-mem-ink rounded-xl bg-mem-sky/20 text-xs font-bold text-mem-ink">
          {t('pptcenter.backendOffline')}
        </div>
      )}
      <PptPicker onFile={run} disabled={busy} />
      <ErrorLine message={error} />
      {result && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-mem-ink/70">
            {t('pptcenter.renderDone', { renderer: RENDERER_LABELS[result.renderer] ?? result.renderer })}
          </p>
          <ExportDownloadButton info={{ outputDir: result.output_dir, name: result.download_name }} showOpen />
        </div>
      )}
      {busy && <p className="text-xs font-bold text-mem-orange animate-pulse">{t('pdfcenter.processing')}</p>}
    </div>
  )
}

export const PptToImageView: React.FC = () => {
  const { t } = useI18n()
  const backendOnline = useBackendOnline()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [format, setFormat] = useState<'png' | 'jpeg'>('png')
  const [result, setResult] = useState<PptRenderResult | null>(null)

  const run = async (file: File) => {
    // 同 PPT 转 PDF：本机渲染引擎，浏览器无法实现——离线明确引导而非裸 405
    if (backendOnline === false) {
      setError(t('pptcenter.backendOffline'))
      setResult(null)
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await renderPptx(file, 'images', format, 150))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Images className="w-5 h-5 text-mem-orange" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pptToImage')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pptcenter.toImageHint')}</p>
      {backendOnline === false && (
        <div className="px-4 py-3 border-2 border-mem-ink rounded-xl bg-mem-sky/20 text-xs font-bold text-mem-ink">
          {t('pptcenter.backendOffline')}
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(['png', 'jpeg'] as const).map((value) => (
          <MemphisButton key={value} size="sm" variant={format === value ? 'orange' : 'white'} onClick={() => setFormat(value)}>
            {value.toUpperCase()}
          </MemphisButton>
        ))}
      </div>
      <PptPicker onFile={run} disabled={busy} />
      <ErrorLine message={error} />
      {result && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-mem-ink/70">
            {t('pptcenter.toImageDone', { count: result.page_count ?? 0 })}
          </p>
          <ExportDownloadButton
            info={{ outputDir: result.output_dir, name: result.download_name }}
            label={t('export.labelZip')}
            showOpen={false}
          />
        </div>
      )}
      {busy && <p className="text-xs font-bold text-mem-orange animate-pulse">{t('pdfcenter.processing')}</p>}
    </div>
  )
}
