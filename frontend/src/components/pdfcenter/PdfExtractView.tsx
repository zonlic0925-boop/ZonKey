import React, { useState } from 'react'
import { FileOutput } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { extractPdfPages, createPdfExtractedFileName, parsePdfPageRanges } from '../../lib/zonkey/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine } from '../calcdev/kit'

export const PdfExtractView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [ranges, setRanges] = useState('')
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
      const source = await import('pdf-lib')
      const pageCount = (await source.PDFDocument.load(fileData.slice())).getPageCount()
      const parsed = parsePdfPageRanges(ranges, pageCount)
      const result = await extractPdfPages({ fileData, sourceName: picked.name, ranges: parsed })
      setOutputBytes(result)
      setOutputName(createPdfExtractedFileName(picked.name))
    } catch (err) {
      setError(String((err as Error).message).includes('Invalid page range') ? t('pdfcenter.rangesInvalid') : String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileOutput className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfExtract')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.extractHint')}</p>

      <PdfFilePicker files={files} onChange={(next) => { setFiles(next); setOutputBytes(null); setOutputName(null) }} />

      <label className="block space-y-1">
        <span className="text-xs font-bold text-mem-ink/70">{t('pdfcenter.rangesLabel')}</span>
        <input
          type="text"
          value={ranges}
          onChange={(e) => setRanges(e.target.value)}
          placeholder="1-3,5,8-"
          className="w-full px-3 py-2 border-2 border-mem-ink rounded-xl text-sm font-mono font-bold bg-white"
        />
      </label>

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length || !ranges.trim()}>
        {t('pdfcenter.extractNow')}
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
