import React, { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { cropImage, replaceColor } from '../../lib/toolknit/imageCore'
import { downloadBlob, ImagePicker, type PickedImage } from './imageKit'
import { ErrorLine, Field, inputClass } from '../calcdev/kit'

export const ImageCropView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<PickedImage | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rect, setRect] = useState({ x: 0, y: 0, width: 100, height: 100 })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file.file)
    setPreviewUrl(url)
    const image = new Image()
    image.onload = () => {
      setRect({ x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight })
    }
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const output = await cropImage(file.file, rect)
      downloadBlob(output.blob, output.fileName)
    } catch (err) {
      setError(t('imagecenter.cropOutOfRange'))
    } finally {
      setBusy(false)
    }
  }

  const num = (value: number) => (Number.isFinite(value) ? value : 0)

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.imageCrop')}</h3>
      <ImagePicker files={file ? [file] : []} onChange={(next) => setFile(next[0] ?? null)} />
      {previewUrl && (
        <div className="space-y-3">
          <img src={previewUrl} alt="" className="max-h-56 border-2 border-mem-ink rounded-xl" />
          <div className="grid grid-cols-4 gap-2">
            <Field label="X"><input type="number" value={num(rect.x)} onChange={(e) => setRect({ ...rect, x: Number(e.target.value) })} className={inputClass} /></Field>
            <Field label="Y"><input type="number" value={num(rect.y)} onChange={(e) => setRect({ ...rect, y: Number(e.target.value) })} className={inputClass} /></Field>
            <Field label={t('imagecenter.width')}><input type="number" value={num(rect.width)} onChange={(e) => setRect({ ...rect, width: Number(e.target.value) })} className={inputClass} /></Field>
            <Field label={t('imagecenter.height')}><input type="number" value={num(rect.height)} onChange={(e) => setRect({ ...rect, height: Number(e.target.value) })} className={inputClass} /></Field>
          </div>
        </div>
      )}
      <MemphisButton variant="yellow" onClick={run} disabled={busy || !file}>
        {t('imagecenter.cropNow')}
      </MemphisButton>
      <ErrorLine message={error} />
    </div>
  )
}

export const ImageColorReplaceView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<PickedImage | null>(null)
  const [from, setFrom] = useState('#ff0000')
  const [to, setTo] = useState('#4ecdc4')
  const [tolerance, setTolerance] = useState(60)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [replaced, setReplaced] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setReplaced(null)
    try {
      const output = await replaceColor(file.file, { from, to, tolerance })
      setReplaced(output.replacedPixels)
      const url = URL.createObjectURL(output.blob)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
      downloadBlob(output.blob, output.fileName)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.imageColorReplace')}</h3>
      <ImagePicker files={file ? [file] : []} onChange={(next) => setFile(next[0] ?? null)} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('imagecenter.fromColor')}>
          <div className="flex items-center gap-2">
            <input type="color" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-12 border-2 border-mem-ink rounded-lg" />
            <span className="text-xs font-mono font-bold">{from}</span>
          </div>
        </Field>
        <Field label={t('imagecenter.toColor')}>
          <div className="flex items-center gap-2">
            <input type="color" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-12 border-2 border-mem-ink rounded-lg" />
            <span className="text-xs font-mono font-bold">{to}</span>
          </div>
        </Field>
      </div>
      <div>
        <span className="block mb-1 text-[11px] font-bold text-mem-ink/70">{t('imagecenter.tolerance')}: {tolerance}</span>
        <input type="range" min={0} max={120} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="w-full accent-mem-ink" />
      </div>
      <MemphisButton variant="yellow" onClick={run} disabled={busy || !file}>
        {t('imagecenter.replaceNow')}
      </MemphisButton>
      <ErrorLine message={error} />
      {replaced !== null && <p className="text-xs font-bold text-mem-teal">{t('imagecenter.replacedPixels', { count: replaced.toLocaleString() })}</p>}
      {previewUrl && <img src={previewUrl} alt="" className="max-h-56 border-2 border-mem-ink rounded-xl" />}
    </div>
  )
}
