import React, { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { cropImage, replaceColor } from '../../lib/zonkey/imageCore'
import { downloadBlob, ImagePicker, type PickedImage } from './imageKit'
import { ErrorLine, Field, inputClass } from '../calcdev/kit'

export const ImageCropView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<PickedImage | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rect, setRect] = useState({ x: 0, y: 0, width: 100, height: 100 })
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 })
  // 画布显示尺寸（图片原尺寸等比缩放到 max-w ~600px）
  const [canvas, setCanvas] = useState({ width: 0, height: 0 })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    mode: 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | 'new'
    startX: number
    startY: number
    startRect: { x: number; y: number; width: number; height: number }
  } | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      setCanvas({ width: 0, height: 0 })
      return
    }
    const url = URL.createObjectURL(file.file)
    setPreviewUrl(url)
    const image = new Image()
    image.onload = () => {
      const maxW = 600
      const scale = Math.min(1, maxW / Math.max(image.naturalWidth, 1))
      const cw = Math.max(1, Math.round(image.naturalWidth * scale))
      const ch = Math.max(1, Math.round(image.naturalHeight * scale))
      setImgSize({ width: image.naturalWidth, height: image.naturalHeight })
      setCanvas({ width: cw, height: ch })
      setRect({ x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight })
    }
    image.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // 显示坐标（缩放后）与图像原图坐标之间的换算
  const toImage = (px: number) => (imgSize.width && canvas.width ? Math.round((px / canvas.width) * imgSize.width) : px)
  const toImageY = (py: number) => (imgSize.height && canvas.height ? Math.round((py / canvas.height) * imgSize.height) : py)

  const run = async () => {
    if (!file) return
    const r = clampRect(rect, imgSize.width, imgSize.height)
    if (r.width < 4 || r.height < 4) {
      setError(t('imagecenter.cropTooSmall'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const output = await cropImage(file.file, r)
      downloadBlob(output.blob, output.fileName)
    } catch (err) {
      setError(t('imagecenter.cropOutOfRange'))
    } finally {
      setBusy(false)
    }
  }

  // 事件坐标 → 原图坐标（stage 尺寸 == canvas 显示尺寸，纯比例换算）
  const stageToImage = (clientX: number, clientY: number) => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const r = stage.getBoundingClientRect()
    return {
      x: toImage(clientX - r.left),
      y: toImageY(clientY - r.top),
    }
  }

  const onPointerDown = (e: React.PointerEvent, mode: NonNullable<typeof dragRef.current>['mode']) => {
    if (!file || !imgSize.width) return
    e.preventDefault()
    e.stopPropagation()
    const p = stageToImage(e.clientX, e.clientY)
    const startRect = mode === 'new' ? { x: p.x, y: p.y, width: 0, height: 0 } : { ...rect }
    dragRef.current = {
      mode,
      startX: p.x,
      startY: p.y,
      startRect,
    }
    // capture 必须设在 stage 上：move/up 处理器都绑在 stage，
    // 若 capture 设在手柄元素，后续 move 只发手柄、stage 收不到。
    stageRef.current?.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || !file || !imgSize.width) return
    const p = stageToImage(e.clientX, e.clientY)
    const dx = p.x - drag.startX
    const dy = p.y - drag.startY
    const { mode, startRect: s } = drag
    let next = { ...s }

    if (mode === 'move') {
      const nx = s.x + dx
      const ny = s.y + dy
      next.x = Math.min(Math.max(0, nx), Math.max(0, imgSize.width - s.width))
      next.y = Math.min(Math.max(0, ny), Math.max(0, imgSize.height - s.height))
    } else if (mode === 'new') {
      // 空白处拖拽画新框：拖拽矩形对角线，归一化到正宽高并夹在图像内
      const x0 = Math.min(s.x, p.x)
      const y0 = Math.min(s.y, p.y)
      const x1 = Math.max(s.x, p.x)
      const y1 = Math.max(s.y, p.y)
      next = {
        x: Math.max(0, Math.min(x0, imgSize.width - 4)),
        y: Math.max(0, Math.min(y0, imgSize.height - 4)),
        width: Math.min(Math.max(4, x1 - x0), imgSize.width - Math.max(0, Math.min(x0, imgSize.width - 4))),
        height: Math.min(Math.max(4, y1 - y0), imgSize.height - Math.max(0, Math.min(y0, imgSize.height - 4))),
      }
    } else {
      if (mode.includes('e')) {
        next.width = Math.min(Math.max(4, s.width + dx), imgSize.width - s.x)
      }
      if (mode.includes('s')) {
        next.height = Math.min(Math.max(4, s.height + dy), imgSize.height - s.y)
      }
      if (mode.includes('w')) {
        const nx = s.x + dx
        const maxX = s.x + s.width - 4
        const clampedX = Math.max(0, Math.min(nx, maxX))
        next.x = clampedX
        next.width = s.width + s.x - clampedX
      }
      if (mode.includes('n')) {
        const ny = s.y + dy
        const maxY = s.y + s.height - 4
        const clampedY = Math.max(0, Math.min(ny, maxY))
        next.y = clampedY
        next.height = s.height + s.y - clampedY
      }
    }
    setRect(next)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null
      stageRef.current?.releasePointerCapture?.(e.pointerId)
    }
  }

  const num = (value: number) => (Number.isFinite(value) ? Math.round(value) : 0)

  // 显示坐标换算（rect 存原图像素，渲染时除以缩放比）
  const fromImage = (px: number) => (imgSize.width && canvas.width ? (px / imgSize.width) * canvas.width : px)
  const fromImageY = (py: number) => (imgSize.height && canvas.height ? (py / imgSize.height) * canvas.height : py)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.imageCrop')}</h3>
      <ImagePicker files={file ? [file] : []} onChange={(next) => setFile(next[0] ?? null)} />
      {previewUrl && imgSize.width > 0 && (
        <div className="space-y-3">
          <div
            ref={stageRef}
            className="relative overflow-hidden border-2 border-mem-ink rounded-xl select-none touch-none cursor-crosshair"
            style={{ width: canvas.width, height: canvas.height, WebkitUserSelect: 'none', userSelect: 'none' }}
            onPointerDown={(e) => onPointerDown(e, 'new')}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <img
              src={previewUrl}
              alt=""
              draggable={false}
              className="block w-full h-full pointer-events-none object-fill"
            />
            {/* 遮罩层（四角） */}
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
              <div className="absolute bg-mem-ink/50" style={{ left: 0, top: 0, width: '100%', height: fromImageY(rect.y) }} />
              <div className="absolute bg-mem-ink/50" style={{ left: 0, top: fromImageY(rect.y + rect.height), width: '100%', bottom: 0 }} />
              <div className="absolute bg-mem-ink/50" style={{ left: 0, top: fromImageY(rect.y), width: fromImage(rect.x), height: fromImageY(rect.height) }} />
              <div className="absolute bg-mem-ink/50" style={{ left: fromImage(rect.x + rect.width), top: fromImageY(rect.y), right: 0, height: fromImageY(rect.height) }} />
            </div>
            {/* 裁剪框：仅拖动框体 = 移动范围 */}
            <div
              className="absolute border-2 border-mem-pink cursor-move touch-none"
              style={{ left: fromImage(rect.x), top: fromImageY(rect.y), width: fromImage(rect.width), height: fromImageY(rect.height), zIndex: 3 }}
              onPointerDown={(e) => onPointerDown(e, 'move')}
            />
            {/* 八向手柄 */}
            {handles.map((h) => (
              <div
                key={h.key}
                className="absolute w-3 h-3 bg-white border-2 border-mem-pink rounded-sm touch-none"
                style={{ ...h.pos(rect, fromImage, fromImageY), cursor: `${h.cur}-resize`, zIndex: 4 }}
                onPointerDown={(e) => onPointerDown(e, h.mode)}
              />
            ))}
          </div>
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

type HandleMode = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const handles: Array<{ key: string; mode: HandleMode; cur: string; pos: (r: { x: number; y: number; width: number; height: number }, fx: (n: number) => number, fy: (n: number) => number) => React.CSSProperties }> = [
  // 手柄放框内 2px：stage overflow-hidden 会把半挂在边缘外的手柄裁掉，
  // 全图裁剪框下边缘手柄只剩 4px 可点；框内放置保证 12px 完整可点。
  { key: 'n', mode: 'n', cur: 'n', pos: (r, fx, fy) => ({ left: fx(r.x + r.width / 2) - 6, top: fy(r.y) + 2 }) },
  { key: 's', mode: 's', cur: 's', pos: (r, fx, fy) => ({ left: fx(r.x + r.width / 2) - 6, top: fy(r.y + r.height) - 14 }) },
  { key: 'e', mode: 'e', cur: 'e', pos: (r, fx, fy) => ({ left: fx(r.x + r.width) - 14, top: fy(r.y + r.height / 2) - 6 }) },
  { key: 'w', mode: 'w', cur: 'w', pos: (r, fx, fy) => ({ left: fx(r.x) + 2, top: fy(r.y + r.height / 2) - 6 }) },
  { key: 'ne', mode: 'ne', cur: 'ne', pos: (r, fx, fy) => ({ left: fx(r.x + r.width) - 14, top: fy(r.y) + 2 }) },
  { key: 'nw', mode: 'nw', cur: 'nw', pos: (r, fx, fy) => ({ left: fx(r.x) + 2, top: fy(r.y) + 2 }) },
  { key: 'se', mode: 'se', cur: 'se', pos: (r, fx, fy) => ({ left: fx(r.x + r.width) - 14, top: fy(r.y + r.height) - 14 }) },
  { key: 'sw', mode: 'sw', cur: 'sw', pos: (r, fx, fy) => ({ left: fx(r.x) + 2, top: fy(r.y + r.height) - 14 }) },
]

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
