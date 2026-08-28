import React, { useState } from 'react'
import { FileStack } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  assertPdfFileCount,
  createPdfMergedFileName,
  mergePdfFiles,
  type PdfSourceDocument,
} from '../../lib/toolknit/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine } from '../calcdev/kit'

export const PdfMergeView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (files.length < 2) {
      setError(t('pdfcenter.needTwoFiles'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const documents: PdfSourceDocument[] = []
      for (const picked of files) {
        documents.push({ fileName: picked.name, fileData: new Uint8Array(await picked.file.arrayBuffer()) })
      }
      assertPdfFileCount(files, 2, files.reduce((sum, f) => sum + f.size, 0))
      const merged = await mergePdfFiles(documents)
      downloadBytes(merged, createPdfMergedFileName())
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileStack className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfMerge')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.mergeHint')}</p>

      <PdfFilePicker multiple files={files} onChange={setFiles} />

      <MemphisButton variant="sky" onClick={run} disabled={busy}>
        {t('pdfcenter.mergeNow')}
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />
    </div>
  )
}
