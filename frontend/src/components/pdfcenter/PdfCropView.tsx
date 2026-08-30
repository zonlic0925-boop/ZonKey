import React, { useState } from 'react'
import { Crop } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { cropPdfPages, createPdfCroppedFileName } from '../../lib/toolknit/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine } from '../calcdev/kit'

export const PdfCropView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [marginPercent, setMarginPercent] = useState(5)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputName, setOutputName] = useState<string | null>(null)
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null)

  const run = async () => {
    const picked = files[0]
    if (!picked) {
      setError(t('pdfcenter.needOneFile'))
      return
    }
    setBusy(true)
    setError(null)
    setOutputBytes(null)
    setOutputName(null)
    try {
      const fileData = new Uint8Array(await picked.file.arrayBuffer())
      const result = await cropPdfPages({ fileData, marginPercent })
      setOutputBytes(result)
      setOutputName(createPdfCroppedFileName(picked.name))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Crop className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfCrop')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.cropHint')}</p>

      <PdfFilePicker files={files} onChange={(next) => { setFiles(next); setOutputBytes(null); setOutputName(null) }} />

      <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
        <span className="shrink-0">{t('pdfcenter.cropMargin')}</span>
        <input type="range" min={0} max={40} value={marginPercent} onChange={(e) => setMarginPercent(Number(e.target.value))} className="flex-1" />
        <span className="w-12 text-right">{marginPercent}%</span>
      </label>

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length}>
        {t('pdfcenter.cropNow')}
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />

      {outputBytes && outputName && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl text-xs">
          <span className="font-mono font-bold truncate">{outputName}</span>
          <MemphisButton size="sm" variant="teal" onClick={() => downloadBytes(outputBytes, outputName)}>
            {t('pdfcenter.save')}
          </MemphisButton>
        </div>
      )}
    </div>
  )
}
