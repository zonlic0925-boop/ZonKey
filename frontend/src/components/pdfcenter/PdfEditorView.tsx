import React, { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, LayoutList, RotateCw, Trash2 } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { createPdfEditedFileName, rebuildPdfFromPages, type PdfEditorPageEntry } from '../../lib/toolknit/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine } from '../calcdev/kit'

interface EditorPageRow extends PdfEditorPageEntry {
  id: string
}

let editorRowCounter = 0

function createEditorRow(sourcePageIndex: number, rotation = 0): EditorPageRow {
  editorRowCounter += 1
  return { id: `page-${editorRowCounter}`, sourcePageIndex, rotation }
}

export const PdfEditorView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [pages, setPages] = useState<EditorPageRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const picked = files[0]
    if (!picked) {
      setPages([])
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const pdflib = await import('pdf-lib')
        const fileData = new Uint8Array(await picked.file.arrayBuffer())
        const pageCount = (await pdflib.PDFDocument.load(fileData.slice())).getPageCount()
        if (cancelled) return
        setPages(Array.from({ length: pageCount }, (_, index) => createEditorRow(index + 1)))
        setError(null)
      } catch (err) {
        if (!cancelled) setError(String((err as Error).message))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [files])

  const movePage = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= pages.length) return
    setPages((current) => {
      const next = [...current]
      const [row] = next.splice(index, 1)
      next.splice(target, 0, row)
      return next
    })
  }

  const rotatePage = (index: number) => {
    setPages((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, rotation: ((row.rotation ?? 0) + 90) % 360 } : row,
      ),
    )
  }

  const removePage = (index: number) => {
    setPages((current) => current.filter((_, rowIndex) => rowIndex !== index))
  }

  const run = async () => {
    const picked = files[0]
    if (!picked) {
      setError(t('pdfcenter.needOneFile'))
      return
    }
    if (pages.length === 0) {
      setError(t('pdfcenter.editorNeedPages'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const fileData = new Uint8Array(await picked.file.arrayBuffer())
      const edited = await rebuildPdfFromPages({
        fileData,
        pages: pages.map(({ sourcePageIndex, rotation }) => ({ sourcePageIndex, rotation })),
      })
      downloadBytes(edited, createPdfEditedFileName(picked.name))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <LayoutList className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfEditor')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.editorHint')}</p>

      <PdfFilePicker files={files} onChange={setFiles} />

      {pages.length > 0 && (
        <ul className="max-h-72 overflow-auto space-y-1.5">
          {pages.map((row, index) => (
            <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-2 border-mem-ink rounded-xl text-xs">
              <span className="font-mono font-bold">
                {t('pdfcenter.editorPageLabel', { index: index + 1, source: row.sourcePageIndex })}
                {(row.rotation ?? 0) > 0 ? ` · +${row.rotation}°` : ''}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => movePage(index, -1)} disabled={index === 0} className="p-1 rounded-md border border-mem-ink/30 hover:bg-mem-sky/20 disabled:opacity-30">
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => movePage(index, 1)} disabled={index === pages.length - 1} className="p-1 rounded-md border border-mem-ink/30 hover:bg-mem-sky/20 disabled:opacity-30">
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => rotatePage(index)} className="p-1 rounded-md border border-mem-ink/30 hover:bg-mem-sky/20">
                  <RotateCw className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => removePage(index)} className="p-1 rounded-md border border-mem-ink/30 hover:bg-mem-coral/20">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length || pages.length === 0}>
        {t('pdfcenter.editorExport')}
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />
    </div>
  )
}
