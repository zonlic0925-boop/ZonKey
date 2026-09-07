import React, { useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { cropImage, replaceColor } from '../../lib/zonkey/imageCore'
import { downloadBlob, ImagePicker, type PickedImage } from './imageKit'
import { ErrorLine, Field, inputClass } from '../calcdev/kit'
import { CropStage, type RectImage } from './CropStage'

export const ImageCropView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<PickedImage | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rect, setRect] = useState<RectImage>({ x: 0, y: 0, width: 100, height: 100 })
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'info'; msg: string } | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      setImgSize({ width: 0, height: 0 })
      return
    }
    const url = URL.createObjectURL(file.file)
    setPreviewUrl(url)
    const image = new Image()
    image.onload = () => {
      setImgSize({ width: image.naturalWidth, height: image.naturalHeight })
      setRect({ x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight })
    }
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // 显示坐标（缩放后）与图像原图坐标之间的换算
  const run = async () => {
    if (!file) return
    const r = clampRect(rect, imgSize.width, imgSize.height)
    if (r.width < 4 || r.height < 4) {
      setError(t('imagecenter.cropTooSmall'))
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const output = await cropImage(file.file, r)
      const result = await downloadBlob(output.blob, output.fileName)
      // 壳内 save-as 被取消时 downloadBlob 正常返回——必须给用户明确反馈，
      // 否则「点了下载、什么都没发生」观感等同功能坏死（round-16 用户反馈②）
      if (result.delivered === 'saved') {
        setNotice({
          type: 'success',
          msg: result.savedPath ? t('export.savedTo', { path: result.savedPath }) : t('imagecenter.cropSavedFallback'),
        })
      } else if (result.delivered === 'cancelled') {
        setNotice({ type: 'info', msg: t('imagecenter.cropSavedFallback') })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('imagecenter.cropOutOfRange'))
    } finally {
      setBusy(false)
    }
  }

  const num = (value: number) => (Number.isFinite(value) ? Math.round(value) : 0)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.imageCrop')}</h3>
      <ImagePicker files={file ? [file] : []} onChange={(next) => setFile(next[0] ?? null)} />
      {previewUrl && imgSize.width > 0 && (
        <div className="space-y-3">
          {/* 响应式触屏裁剪画布：宽度随容器自适应（round-25 手机端完整可见） */}
          <CropStage
            src={previewUrl}
            naturalWidth={imgSize.width}
            naturalHeight={imgSize.height}
            value={rect}
            onChange={setRect}
            mode="free"
          />
          <div className="grid grid-cols-4 gap-2">
            <Field label="X"><input type="number" value={num(rect.x)} onChange={(e) => setRect(clampRect({ ...rect, x: Number(e.target.value) }, imgSize.width, imgSize.height))} className={inputClass} /></Field>
            <Field label="Y"><input type="number" value={num(rect.y)} onChange={(e) => setRect(clampRect({ ...rect, y: Number(e.target.value) }, imgSize.width, imgSize.height))} className={inputClass} /></Field>
            <Field label={t('imagecenter.width')}><input type="number" value={num(rect.width)} onChange={(e) => setRect(clampRect({ ...rect, width: Number(e.target.value) }, imgSize.width, imgSize.height))} className={inputClass} /></Field>
            <Field label={t('imagecenter.height')}><input type="number" value={num(rect.height)} onChange={(e) => setRect(clampRect({ ...rect, height: Number(e.target.value) }, imgSize.width, imgSize.height))} className={inputClass} /></Field>
          </div>
          <p className="text-xs text-mem-ink/60">{t('imagecenter.cropDragHint')}</p>
        </div>
      )}
      <MemphisButton variant="yellow" onClick={run} disabled={busy || !file}>
        {t('imagecenter.cropNow')}
      </MemphisButton>
      {notice && (
        <p className={`text-xs font-bold ${notice.type === 'success' ? 'text-mem-teal' : 'text-mem-ink/70'}`}>
          {notice.msg}
        </p>
      )}
      <ErrorLine message={error} />
    </div>
  )
}

const clampRect = (r: { x: number; y: number; width: number; height: number }, maxW: number, maxH: number) => {
  const width = Math.min(Math.max(4, Math.round(r.width)), maxW)
  const height = Math.min(Math.max(4, Math.round(r.height)), maxH)
  const x = Math.min(Math.max(0, Math.round(r.x)), maxW - width)
  const y = Math.min(Math.max(0, Math.round(r.y)), maxH - height)
  return { x, y, width, height }
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
        <span className="block mb-1 text-xs font-bold text-mem-ink/70">{t('imagecenter.tolerance')}: {tolerance}</span>
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
