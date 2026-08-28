import React, { useState } from 'react'
import { RotateCw } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { createPdfRotateFileName, rotatePdfPages } from '../../lib/toolknit/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine, Field, inputClass } from '../calcdev/kit'

/** 解析 "1,3-5" 形式的页码表达式（1 起始） */
export function parsePageRanges(expression: string, maxPage: number): number[] {
  const trimmed = expression.trim()
  const pages = new Set<number>()
  if (!trimmed || trimmed.toLowerCase() === 'all') {
    for (let i = 1; i <= maxPage; i += 1) pages.add(i)
    return [...pages]
  }
  for (const part of trimmed.split(/[,，]/)) {
    const range = part.trim().match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      if (start < 1 || end < start || end > maxPage) throw new Error(`page-out-of-range: ${part}`)
      for (let i = start; i <= end; i += 1) pages.add(i)
    } else {
      const page = Number(part)
      if (!Number.isInteger(page) || page < 1 || page > maxPage) throw new Error(`page-out-of-range: ${part}`)
      pages.add(page)
    }
  }
  return [...pages].sort((a, b) => a - b)
}

const ANGLES = [90, 180, 270] as const

export const PdfRotateView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [range, setRange] = useState('all')
  const [angle, setAngle] = useState<number>(90)
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
      const pdflib = await import('pdf-lib')
      const fileData = new Uint8Array(await picked.file.arrayBuffer())
      const pageCount = (await pdflib.PDFDocument.load(fileData.slice())).getPageCount()
      const pageNumbers = parsePageRanges(range, pageCount)
      const rotated = await rotatePdfPages({
        fileData,
        pages: pageNumbers.map((pageIndex) => ({ pageIndex, rotation: angle })),
      })
      downloadBytes(rotated, createPdfRotateFileName(picked.name, pageNumbers.length === pageCount ? undefined : pageNumbers[0]))
    } catch (err) {
      const message = String((err as Error).message)
      setError(message.startsWith('page-out-of-range') ? t('pdfcenter.pageOutOfRange') : message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <RotateCw className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfRotate')}</h3>
      </div>

      <PdfFilePicker files={files} onChange={setFiles} />

      <div className="grid grid-cols-2 gap-3">
        <Field label={t('pdfcenter.pageRange')}>
          <input value={range} onChange={(e) => setRange(e.target.value)} placeholder="all / 1,3-5" className={inputClass} />
        </Field>
        <Field label={t('pdfcenter.rotateAngle')}>
          <div className="flex gap-1.5">
            {ANGLES.map((value) => (
              <MemphisButton key={value} size="sm" variant={angle === value ? 'sky' : 'white'} onClick={() => setAngle(value)}>
                +{value}°
              </MemphisButton>
            ))}
          </div>
        </Field>
      </div>

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length}>
        {t('pdfcenter.rotateNow')}
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />
    </div>
  )
}
