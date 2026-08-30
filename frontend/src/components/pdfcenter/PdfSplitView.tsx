import React, { useState } from 'react'
import { Scissors } from 'lucide-react'
import JSZip from 'jszip'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { TabsRow } from '../calcdev/kit'
import { parsePdfPageRanges, splitPdfByRanges, splitPdfPages, type PdfSourceDocument } from '../../lib/toolknit/pdfCore'
import { BusyLine, downloadBytes, downloadFilesZip, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine } from '../calcdev/kit'

type SplitOutput = { fileName: string; bytes: Uint8Array }

export const PdfSplitView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [mode, setMode] = useState<'perPage' | 'ranges'>('perPage')
  const [ranges, setRanges] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<SplitOutput[]>([])

  const run = async () => {
    const picked = files[0]
    if (!picked) {
      setError(t('pdfcenter.needOneFile'))
      return
    }
    setBusy(true)
    setError(null)
    setOutputs([])
    try {
      const fileData = new Uint8Array(await picked.file.arrayBuffer())
      const source = await import('pdf-lib')
      const pageCount = (await source.PDFDocument.load(fileData.slice())).getPageCount()
      const documents: PdfSourceDocument[] = [{ fileName: picked.name, fileData }]

      if (mode === 'ranges') {
        let parsed
        try {
          parsed = parsePdfPageRanges(ranges, pageCount)
        } catch {
          setError(t('pdfcenter.rangesInvalid'))
          return
        }
        const parts = await splitPdfByRanges({ fileData, sourceName: picked.name, ranges: parsed })
        setOutputs(parts.map(({ fileName, bytes }) => ({ fileName, bytes })))
      } else {
        const pages = Array.from({ length: pageCount }, (_, i) => ({ fileIndex: 0, pageIndex: i + 1 }))
        const result = await splitPdfPages({ documents, pages })
        setOutputs(result.map(({ fileName, bytes }) => ({ fileName, bytes })))
      }
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const downloadZip = async () => {
    if (outputs.length === 0) return
    const zipName = `${outputs[0]!.fileName.replace(/_page_\d+\.pdf$/, '').replace(/_part_\d+_p[\d-]+\.pdf$/, '') ?? 'split'}_pages.zip`
    await downloadFilesZip(outputs, zipName)
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Scissors className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfSplit')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">
        {mode === 'perPage' ? t('pdfcenter.splitHint') : t('pdfcenter.splitRangesHint')}
      </p>

      <PdfFilePicker files={files} onChange={(next) => { setFiles(next); setOutputs([]) }} />

      <TabsRow
        options={[
          { id: 'perPage', label: t('pdfcenter.splitModePerPage') },
          { id: 'ranges', label: t('pdfcenter.splitModeRanges') },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'ranges' && (
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
      )}

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length || (mode === 'ranges' && !ranges.trim())}>
        {mode === 'perPage' ? t('pdfcenter.splitNow') : t('pdfcenter.splitRangesNow')}
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />

      {outputs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-mem-ink/70">{t('pdfcenter.splitDone', { count: outputs.length })}</p>
            {outputs.length > 1 && (
              <MemphisButton size="sm" variant="teal" onClick={downloadZip}>
                ZIP ({outputs.length})
              </MemphisButton>
            )}
          </div>
          <ul className="max-h-64 overflow-auto space-y-1.5">
            {outputs.map((output) => (
              <li key={output.fileName} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl text-xs">
                <span className="font-mono font-bold truncate">{output.fileName}</span>
                <MemphisButton size="sm" variant="white" onClick={() => downloadBytes(output.bytes, output.fileName)}>
                  {t('pdfcenter.save')}
                </MemphisButton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
