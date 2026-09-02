import React, { useRef, useState } from 'react'
import { Stamp } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { TabsRow } from '../calcdev/kit'
import { addPdfWatermark, createPdfWatermarkedFileName } from '../../lib/zonkey/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine } from '../calcdev/kit'

const WM_COLORS = ['#808080', '#111111', '#dc2626', '#2563eb']

export const PdfWatermarkView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [type, setType] = useState<'text' | 'image'>('text')
  const [text, setText] = useState('CONFIDENTIAL')
  const [fontSize, setFontSize] = useState(48)
  const [color, setColor] = useState(WM_COLORS[0])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageScale, setImageScale] = useState(30)
  const [opacity, setOpacity] = useState(30)
  const [rotation, setRotation] = useState(45)
  const [tile, setTile] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputName, setOutputName] = useState<string | null>(null)
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const run = async () => {
    const picked = files[0]
    if (!picked) {
      setError(t('pdfcenter.needOneFile'))
      return
    }
    if (type === 'image' && !imageFile) {
      setError(t('pdfcenter.wmNeedImage'))
      return
    }
    setBusy(true)
    setError(null)
    setOutputBytes(null)
    setOutputName(null)
    try {
      const fileData = new Uint8Array(await picked.file.arrayBuffer())
      const result = await addPdfWatermark({
        fileData,
        type,
        text: type === 'text' ? text : undefined,
        imageFile: type === 'image' ? imageFile! : undefined,
        fontSize,
        color,
        imageScalePercent: imageScale,
        opacity: opacity / 100,
        rotation,
        tile,
      })
      setOutputBytes(result)
      setOutputName(createPdfWatermarkedFileName(picked.name))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Stamp className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfWatermark')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.watermarkHint')}</p>

      <PdfFilePicker files={files} onChange={(next) => { setFiles(next); setOutputBytes(null); setOutputName(null) }} />

      <TabsRow
        options={[
          { id: 'text', label: t('pdfcenter.wmText') },
          { id: 'image', label: t('pdfcenter.wmImage') },
        ]}
        value={type}
        onChange={setType}
      />

      {type === 'text' ? (
        <div className="space-y-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('pdfcenter.wmTextPlaceholder')}
            className="w-full px-3 py-2 border-2 border-mem-ink rounded-xl text-sm font-bold bg-white"
          />
          <div className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
            <span className="shrink-0">{t('pdfcenter.wmColor')}</span>
            {WM_COLORS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setColor(value)}
                className={`w-6 h-6 rounded-lg border-2 ${color === value ? 'border-mem-sky ring-2 ring-mem-sky/40' : 'border-mem-ink/40'}`}
                style={{ backgroundColor: value }}
                aria-label={value}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
            <span className="shrink-0">{t('pdfcenter.wmFontSize')}</span>
            <input type="number" min={8} max={200} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value) || 48)} className="w-20 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white" />
          </label>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              setImageFile(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          <MemphisButton variant="sky" size="sm" onClick={() => imageInputRef.current?.click()}>
            {imageFile ? imageFile.name : t('pdfcenter.wmPickImage')}
          </MemphisButton>
          <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
            <span className="shrink-0">{t('pdfcenter.wmScale')}</span>
            <input type="number" min={5} max={100} value={imageScale} onChange={(e) => setImageScale(Number(e.target.value) || 30)} className="w-20 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white" />
            <span>%</span>
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
          <span className="shrink-0">{t('pdfcenter.wmOpacity')}</span>
          <input type="range" min={5} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="flex-1" />
          <span className="w-10 text-right">{opacity}%</span>
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
          <span className="shrink-0">{t('pdfcenter.wmRotation')}</span>
          <select value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="flex-1 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
            {[0, 30, 45, 60, 90].map((angle) => (
              <option key={angle} value={angle}>{angle}°</option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
        <input type="checkbox" checked={tile} onChange={(e) => setTile(e.target.checked)} className="w-4 h-4 accent-mem-sky" />
        {t('pdfcenter.wmTile')}
      </label>

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length}>
        {t('pdfcenter.watermarkNow')}
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
