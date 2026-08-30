import React, { useState } from 'react'
import { ScanLine } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { createPdfEnhancedFileName, enhancePdfScan, type PdfEnhanceMode } from '../../lib/toolknit/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine } from '../calcdev/kit'

const MODES: PdfEnhanceMode[] = ['contrast', 'grayscale', 'binarize']

export const PdfEnhanceView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [mode, setMode] = useState<PdfEnhanceMode>('contrast')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    const picked = files[0]
    if (!picked) {
      setError(t('pdfcenter.needOneFile'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const fileData = new Uint8Array(await picked.file.arrayBuffer())
      const enhanced = await enhancePdfScan({ fileData, mode, strength: 1.4, scale: 2 })
      downloadBytes(enhanced, createPdfEnhancedFileName(picked.name))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ScanLine className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfEnhance')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.enhanceHint')}</p>

      <PdfFilePicker files={files} onChange={setFiles} />

      <div className="flex items-center gap-1.5 flex-wrap">
        {MODES.map((value) => (
          <MemphisButton key={value} size="sm" variant={mode === value ? 'sky' : 'white'} onClick={() => setMode(value)}>
            {t(`pdfcenter.enhance_${value}`)}
          </MemphisButton>
        ))}
      </div>

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length}>
        {t('pdfcenter.enhanceNow')}
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />
    </div>
  )
}
