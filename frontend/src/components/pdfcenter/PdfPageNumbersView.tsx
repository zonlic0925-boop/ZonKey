import React, { useState } from 'react'
import { Hash } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { TabsRow } from '../calcdev/kit'
import { addPageNumbers, createPdfNumberedFileName, type PdfPageNumberFormat, type PdfPageNumberPosition } from '../../lib/toolknit/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine } from '../calcdev/kit'

const POSITION_OPTIONS: PdfPageNumberPosition[] = [
  'top-left', 'top-center', 'top-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

export const PdfPageNumbersView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [position, setPosition] = useState<PdfPageNumberPosition>('bottom-center')
  const [format, setFormat] = useState<PdfPageNumberFormat>('plain')
  const [fontSize, setFontSize] = useState(12)
  const [startAt, setStartAt] = useState(1)
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
      const result = await addPageNumbers({ fileData, position, format, fontSize, startAt })
      setOutputBytes(result)
      setOutputName(createPdfNumberedFileName(picked.name))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Hash className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfPageNumbers')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.pageNumbersHint')}</p>

      <PdfFilePicker files={files} onChange={(next) => { setFiles(next); setOutputBytes(null); setOutputName(null) }} />

      <TabsRow
        options={[
          { id: 'plain', label: '1' },
          { id: 'slash', label: '1 / N' },
          { id: 'page', label: 'Page 1' },
        ]}
        value={format}
        onChange={setFormat}
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
          <span className="shrink-0">{t('pdfcenter.position')}</span>
          <select value={position} onChange={(e) => setPosition(e.target.value as PdfPageNumberPosition)} className="flex-1 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
            {POSITION_OPTIONS.map((value) => (
              <option key={value} value={value}>{t(`pdfcenter.pos_${value.replace('-', '_')}`)}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
          <span className="shrink-0">{t('pdfcenter.wmFontSize')}</span>
          <input type="number" min={6} max={48} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value) || 12)} className="w-20 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white" />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
          <span className="shrink-0">{t('pdfcenter.startAt')}</span>
          <input type="number" min={1} value={startAt} onChange={(e) => setStartAt(Math.max(1, Number(e.target.value) || 1))} className="w-20 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white" />
        </label>
      </div>

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length}>
        {t('pdfcenter.pageNumbersNow')}
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
