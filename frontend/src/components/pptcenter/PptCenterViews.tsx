import React, { useState } from 'react'
import JSZip from 'jszip'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  compressPptx,
  extractPptImages,
  extractPptText,
  type PptSlideText,
} from '../../lib/zonkey/pptCore'
import { downloadBlob } from '../imagecenter/imageKit'
import { ErrorLine } from '../calcdev/kit'

export const PptPicker: React.FC<{ onFile: (file: File) => void; disabled?: boolean }> = ({ onFile, disabled }) => (
  <input
    type="file"
    accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
    disabled={disabled}
    onChange={(e) => {
      const file = e.target.files?.[0]
      if (file) onFile(file)
      e.target.value = ''
    }}
    className="block w-full text-xs font-mono file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-2 file:border-mem-ink file:bg-white file:font-bold file:cursor-pointer cursor-pointer border-2 border-mem-ink rounded-xl p-1.5 bg-white"
  />
)

export const PptImagesView: React.FC = () => {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<{ name: string; blob: Blob }[]>([])

  const run = async (file: File) => {
    setBusy(true)
    setError(null)
    setItems([])
    try {
      const media = await extractPptImages(file)
      if (!media.length) {
        setError(t('pptcenter.noMedia'))
        return
      }
      setItems(media.map((item) => ({ name: item.fileName, blob: item.blob })))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const downloadZip = async () => {
    const zip = new JSZip()
    for (const item of items) zip.file(item.name, item.blob)
    downloadBlob(await zip.generateAsync({ type: 'blob' }), 'ppt_media.zip')
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.pptImages')}</h3>
      <PptPicker onFile={run} disabled={busy} />
      <ErrorLine message={error} />
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-mem-ink/70">{t('pptcenter.mediaFound', { count: items.length })}</p>
            <MemphisButton size="sm" variant="orange" onClick={downloadZip}>ZIP</MemphisButton>
          </div>
          <div className="grid grid-cols-5 gap-2 max-h-72 overflow-auto">
            {items.map((item, index) => (
              <a key={`${item.name}-${index}`} href={URL.createObjectURL(item.blob)} download={item.name} title={item.name}
                 className="block aspect-square border-2 border-mem-ink rounded-xl overflow-hidden bg-white hover:shadow-memphis-sm transition-shadow">
                <img src={URL.createObjectURL(item.blob)} alt={item.name} className="w-full h-full object-contain" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const PptTextView: React.FC = () => {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slides, setSlides] = useState<PptSlideText[]>([])

  const run = async (file: File) => {
    setBusy(true)
    setError(null)
    setSlides([])
    try {
      const result = await extractPptText(file)
      if (!result.length) {
        setError(t('pptcenter.noSlides'))
        return
      }
      setSlides(result)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const downloadText = () => {
    const text = slides
      .map((slide) => {
        const body = slide.lines.map((line) => `  ${line}`).join('\n')
        const notes = slide.notes.length ? `\n  [${t('pptcenter.notes')}] ${slide.notes.join(' ')}` : ''
        return `${t('pptcenter.slide')} ${slide.slideNumber}: ${slide.title}\n${body}${notes}`
      })
      .join('\n\n')
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), 'ppt_text.txt')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-display font-black text-mem-ink">{t('tools.pptText')}</h3>
        {slides.length > 0 && (
          <MemphisButton size="sm" variant="orange" onClick={downloadText}>{t('calcdev.copy') === 'Copy' ? 'Export .txt' : '导出 .txt'}</MemphisButton>
        )}
      </div>
      <PptPicker onFile={run} disabled={busy} />
      <ErrorLine message={error} />
      {slides.length > 0 && (
        <div className="space-y-2 max-h-[26rem] overflow-auto pr-1">
          {slides.map((slide) => (
            <div key={slide.slideNumber} className="p-3 bg-white border-2 border-mem-ink rounded-xl">
              <p className="text-xs font-bold text-mem-ink/60">{t('pptcenter.slide')} {slide.slideNumber}</p>
              {slide.lines.map((line, index) => (
                <p key={index} className={index === 0 ? 'text-sm font-bold text-mem-ink mt-0.5' : 'text-xs text-mem-ink/75 mt-1'}>{line}</p>
              ))}
              {slide.notes.length > 0 && (
                <p className="text-xs text-mem-ink/60 mt-1.5 border-t border-mem-ink/10 pt-1.5">{t('pptcenter.notes')}: {slide.notes.join(' ')}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export const PptCompressView: React.FC = () => {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ originalSize: number; compressedSize: number; fileName: string; blob: Blob } | null>(null)

  const run = async (file: File) => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const output = await compressPptx(file)
      setResult(output)
      downloadBlob(output.blob, output.fileName)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const saving = result ? Math.max(0, Math.round(((result.originalSize - result.compressedSize) / result.originalSize) * 100)) : null

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.pptCompress')}</h3>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pptcenter.compressHint')}</p>
      <PptPicker onFile={run} disabled={busy} />
      <ErrorLine message={error} />
      {result && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-mem-yellow/25 border-2 border-mem-ink rounded-xl">
            <p className="text-base font-black font-display">{(result.originalSize / 1024).toFixed(0)} KB</p>
            <p className="text-xs font-bold text-mem-ink/60">{t('pdfcenter.originalSize')}</p>
          </div>
          <div className="p-3 bg-mem-teal/15 border-2 border-mem-ink rounded-xl">
            <p className="text-base font-black font-display">{(result.compressedSize / 1024).toFixed(0)} KB</p>
            <p className="text-xs font-bold text-mem-ink/60">{t('pdfcenter.compressedSize')}</p>
          </div>
          <div className="p-3 bg-mem-lime/20 border-2 border-mem-ink rounded-xl">
            <p className="text-base font-black font-display">-{saving}%</p>
            <p className="text-xs font-bold text-mem-ink/60">{t('pdfcenter.saving')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
