import React, { useState } from 'react'
import { Scissors } from 'lucide-react'
import JSZip from 'jszip'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { splitPdfPages, type PdfSourceDocument, type PdfSplitOutput } from '../../lib/toolknit/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine } from '../calcdev/kit'

export const PdfSplitView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<PdfSplitOutput[]>([])

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
      const pages = Array.from({ length: pageCount }, (_, i) => ({ fileIndex: 0, pageIndex: i + 1 }))
      const documents: PdfSourceDocument[] = [{ fileName: picked.name, fileData }]
      const result = await splitPdfPages({ documents, pages })
      setOutputs(result)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const downloadZip = async () => {
    const zip = new JSZip()
    for (const output of outputs) zip.file(output.fileName, output.bytes)
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${outputs[0]?.fileName.replace(/_page_\d+\.pdf$/, '') ?? 'split'}_pages.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Scissors className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfSplit')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.splitHint')}</p>

      <PdfFilePicker files={files} onChange={(next) => { setFiles(next); setOutputs([]) }} />

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length}>
        {t('pdfcenter.splitNow')}
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
