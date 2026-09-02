import React, { useRef, useState } from 'react'
import { Images } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { TabsRow } from '../calcdev/kit'
import { createImagesPdfFileName, imagesToPdf, type PdfImagesPageSize } from '../../lib/zonkey/pdfCore'
import { BusyLine, downloadBytes } from './pdfKit'
import { ErrorLine } from '../calcdev/kit'

export const PdfImagesToPdfView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<File[]>([])
  const [pageSize, setPageSize] = useState<PdfImagesPageSize>('fit')
  const [marginPt, setMarginPt] = useState(24)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputName, setOutputName] = useState<string | null>(null)
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const move = (index: number, delta: number) => {
    setFiles((prev) => {
      const next = [...prev]
      const target = index + delta
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const run = async () => {
    if (files.length === 0) {
      setError(t('pdfcenter.needImages'))
      return
    }
    setBusy(true)
    setError(null)
    setOutputBytes(null)
    setOutputName(null)
    try {
      const result = await imagesToPdf({ files, pageSize, marginPt })
      setOutputBytes(result)
      setOutputName(createImagesPdfFileName(files.length, files[0]?.name))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Images className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfImagesToPdf')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.imagesToPdfHint')}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? [])
          setFiles((prev) => [...prev, ...picked])
          setOutputBytes(null)
          setOutputName(null)
          e.target.value = ''
        }}
      />
      <MemphisButton variant="sky" size="sm" onClick={() => inputRef.current?.click()}>
        {t('pdfcenter.pickImages')}
      </MemphisButton>

      {files.length > 0 && (
        <ul className="space-y-1.5 max-h-52 overflow-auto">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl text-xs">
              <span className="font-mono font-bold truncate">
                {index + 1}. {file.name}
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="px-1.5 border border-mem-ink/30 rounded-md disabled:opacity-30 hover:bg-mem-sky/20">↑</button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === files.length - 1} className="px-1.5 border border-mem-ink/30 rounded-md disabled:opacity-30 hover:bg-mem-sky/20">↓</button>
                <button type="button" onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))} className="px-1.5 border border-mem-ink/30 rounded-md hover:bg-mem-coral/20">✕</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <TabsRow
        options={[
          { id: 'fit', label: t('pdfcenter.pageSizeFit') },
          { id: 'a4', label: t('pdfcenter.pageSizeA4') },
        ]}
        value={pageSize}
        onChange={setPageSize}
      />
      <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
        <span className="shrink-0">{t('pdfcenter.margin')}</span>
        <input type="number" min={0} max={120} value={marginPt} onChange={(e) => setMarginPt(Number(e.target.value) || 0)} className="w-20 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white" />
        <span>pt</span>
      </label>

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length}>
        {t('pdfcenter.imagesToPdfNow')}
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />

      {outputBytes && outputName && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-mem-ink/70">{t('pdfcenter.imagesDone', { count: files.length })}</p>
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl text-xs">
            <span className="font-mono font-bold truncate">{outputName}</span>
            <MemphisButton size="sm" variant="teal" onClick={() => downloadBytes(outputBytes, outputName)}>
              {t('pdfcenter.save')}
            </MemphisButton>
          </div>
        </div>
      )}
    </div>
  )
}
