/**
 * 工具箱·引擎类小工具视图（走 /api/toolbox/* 后端端点，产物统一交付层出口）：
 * 二维码生成/识别 / 图片打码 / 证件照换底色 / 重复文件查找 / PDF 书签编辑 / TTS 朗读。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  QrCode,
  ScanLine,
  EyeOff,
  IdCard,
  CopyX,
  BookMarked,
  AudioLines,
  FolderOpen,
  Download,
} from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { ErrorLine, Field, NumInput, AreaInput, inputClass } from '../calcdev/kit'
import { ImagePicker } from '../imagecenter/imageKit'
import { CropStage, type RectImage } from '../imagecenter/CropStage'
import { apiFetch, pickExportFolder, probeBackendAlive } from '../../lib/api'
import { downloadBlob, useBackendOnline } from '../../lib/deliver'
import { emitTaskDoneBlob, emitTaskDoneOutput } from '../../lib/zonkey/taskDone'
import { runIdPhotoWeb, ID_PHOTO_SIZE_MM, type IdPhotoSizePreset } from '../../lib/zonkey/idPhotoWebCore'
import { generateQrWeb, readQrWeb } from '../../lib/zonkey/qrWebCore'
import type { PickedImage } from '../imagecenter/imageKit'

const selectClass = `${inputClass} appearance-none`


// ---------------------------------------------------------------------------
// 二维码生成 / 识别
// ---------------------------------------------------------------------------

const QR_ECC_LEVELS = ['L', 'M', 'Q', 'H'] as const

export const QrGenerateView: React.FC = () => {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [ecc, setEcc] = useState<(typeof QR_ECC_LEVELS)[number]>('M')
  const [boxSize, setBoxSize] = useState(10)
  const [dark, setDark] = useState('#000000')
  const [light, setLight] = useState('#FFFFFF')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const backendOnline = useBackendOnline()

  const generate = async () => {
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      let blob: Blob
      if (backendOnline === false) {
        // 后端离线（手机网页版/Pages）：浏览器引擎兜底（node-qrcode 动态加载）
        blob = await generateQrWeb(text, { ecc, boxSize, dark, light })
      } else {
        const form = new FormData()
        form.append('text', text)
        form.append('ecc', ecc)
        form.append('box_size', String(boxSize))
        form.append('dark_color', dark)
        form.append('light_color', light)
        const res = await fetch('/api/toolbox/qr/generate', { method: 'POST', body: form })
        if (!res.ok) throw new Error(await res.text().catch(() => res.statusText))
        blob = await res.blob()
      }
      emitTaskDoneBlob(t('tools.qrGenerate'), blob, 'qrcode.png')
      setImgUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
    } catch (err) {
      setError(String((err as Error).message))
      setImgUrl(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <QrCode className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.qrGenerate')}</h3>
      </div>
      {backendOnline === false && (
        <div className="px-4 py-3 border-2 border-mem-ink rounded-xl bg-mem-yellow/30 text-xs font-bold text-mem-ink">
          {t('toolbox.qrWebEngineNote')}
        </div>
      )}
      <Field label={t('toolbox.qrContent')}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className={inputClass}
          placeholder={t('toolbox.qrContentHint')}
        />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label={t('toolbox.qrEcc')}>
          <select value={ecc} onChange={(e) => setEcc(e.target.value as typeof ecc)} className={selectClass}>
            {QR_ECC_LEVELS.map((lv) => (
              <option key={lv} value={lv}>{lv} — {t(`toolbox.qrEcc_${lv}`)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('toolbox.qrSize')}>
          <NumInput value={boxSize} onChange={(v) => setBoxSize(Number.isNaN(v) ? 10 : Math.min(40, Math.max(2, v)))} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('toolbox.qrDark')}>
            <input type="color" value={dark} onChange={(e) => setDark(e.target.value)} className="w-full h-9 border-2 border-mem-ink rounded-xl bg-white cursor-pointer" />
          </Field>
          <Field label={t('toolbox.qrLight')}>
            <input type="color" value={light} onChange={(e) => setLight(e.target.value)} className="w-full h-9 border-2 border-mem-ink rounded-xl bg-white cursor-pointer" />
          </Field>
        </div>
      </div>
      <MemphisButton variant="sky" onClick={generate} disabled={busy || !text.trim()}>
        {t('calcdev.generate')}
      </MemphisButton>
      <ErrorLine message={error} />
      {imgUrl && (
        <div className="flex flex-col items-center gap-3 p-4 bg-white border-2 border-mem-ink rounded-xl">
          <img src={imgUrl} alt="QR" className="max-w-56 h-auto border border-mem-ink/20 rounded" />
          <MemphisButton
            size="sm"
            variant="teal"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={async () => {
              const blob = await (await fetch(imgUrl)).blob()
              downloadBlob(blob, 'qrcode.png')
            }}
          >
            {t('toolbox.qrDownload')}
          </MemphisButton>
        </div>
      )}
    </div>
  )
}

interface QrReadResult {
  text: string
  format: string
}

export const QrReadView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedImage[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<QrReadResult[] | null>(null)
  const backendOnline = useBackendOnline()

  const read = async () => {
    if (!files[0]) return
    setBusy(true)
    setError(null)
    setResults(null)
    try {
      let data: { found: number; results: QrReadResult[] }
      if (backendOnline === false) {
        // 后端离线（手机网页版/Pages）：浏览器引擎兜底（jsQR 单码，小图 2× 重试）
        const found = await readQrWeb(files[0].file)
        data = { found: found.length, results: found }
      } else {
        const form = new FormData()
        form.append('file', files[0].file)
        data = await apiFetch<{ found: number; results: QrReadResult[] }>('/api/toolbox/qr/read', { method: 'POST', body: form }, 120000)
      }
      setResults(data.results)
      if (!data.results.length) setError(t('toolbox.qrNotFound'))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ScanLine className="w-5 h-5 text-mem-teal" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.qrRead')}</h3>
      </div>
      {backendOnline === false && (
        <div className="px-4 py-3 border-2 border-mem-ink rounded-xl bg-mem-yellow/30 text-xs font-bold text-mem-ink">
          {t('toolbox.qrWebEngineNote')}
        </div>
      )}
      <ImagePicker files={files} onChange={setFiles} />
      <MemphisButton variant="teal" onClick={read} disabled={busy || !files.length}>
        {t('toolbox.qrRecognize')}
      </MemphisButton>
      <ErrorLine message={error} />
      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className="px-3 py-2.5 bg-white border-2 border-mem-ink rounded-xl">
              <div className="flex items-center justify-between gap-2">
                <span className="px-1.5 py-0.5 text-[10px] font-black rounded border border-mem-ink/40 bg-mem-teal/20">{r.format}</span>
                <MemphisButton size="sm" variant="white" onClick={() => navigator.clipboard.writeText(r.text).catch(() => {})}>
                  {t('calcdev.copy')}
                </MemphisButton>
              </div>
              <p className="mt-1.5 font-mono text-sm break-all">{r.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 图片打码 / 局部模糊（框选 → 三种模式）
// ---------------------------------------------------------------------------

interface MaskRegion {
  x: number
  y: number
  w: number
  h: number
}

type MaskMode = 'mosaic' | 'blur' | 'solid'

export const ImageMaskView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedImage[]>([])
  const [mode, setMode] = useState<MaskMode>('mosaic')
  const [strength, setStrength] = useState(20)
  const [regions, setRegions] = useState<MaskRegion[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultName, setResultName] = useState('')
  const dragRef = useRef<{ startX: number; startY: number; pointerId: number } | null>(null)
  const [dragNow, setDragNow] = useState<MaskRegion | null>(null)

  const file = files[0]
  // objectURL 必须随 file 稳定复用：渲染体里直接 createObjectURL 每帧泄漏一个句柄
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file.file) : null), [file])
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl) }, [fileUrl])

  const toImageCoords = (clientX: number, clientY: number, img: HTMLImageElement) => {
    const rect = img.getBoundingClientRect()
    const scaleX = img.naturalWidth / rect.width
    const scaleY = img.naturalHeight / rect.height
    return {
      x: Math.round((clientX - rect.left) * scaleX),
      y: Math.round((clientY - rect.top) * scaleY),
    }
  }

  // Pointer Events 统一鼠标/触屏/笔：触屏不派发 mouse 序列，且默认手势会抢走拖拽
  const onPointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const p = toImageCoords(e.clientX, e.clientY, e.currentTarget)
    dragRef.current = { startX: p.x, startY: p.y, pointerId: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragNow({ x: p.x, y: p.y, w: 0, h: 0 })
  }

  const onPointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
    const p = toImageCoords(e.clientX, e.clientY, e.currentTarget)
    const s = dragRef.current
    setDragNow({
      x: Math.min(s.startX, p.x),
      y: Math.min(s.startY, p.y),
      w: Math.abs(p.x - s.startX),
      h: Math.abs(p.y - s.startY),
    })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
    if (dragNow && dragNow.w > 4 && dragNow.h > 4) setRegions((prev) => [...prev, dragNow])
    dragRef.current = null
    setDragNow(null)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* 已隐式释放 */ }
  }

  const run = async () => {
    if (!file || !regions.length) return
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file.file)
      form.append('regions', JSON.stringify(regions))
      form.append('mode', mode)
      form.append('strength', String(strength))
      const res = await fetch('/api/toolbox/image/mask', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText))
      const blob = await res.blob()
      const maskName = `${file.name.replace(/\.[^.]+$/, '')}_masked.png`
      setResultName(maskName)
      emitTaskDoneBlob(t('tools.imageMask'), blob, maskName)
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const modeDefs: Array<{ id: MaskMode; key: string }> = [
    { id: 'mosaic', key: 'toolbox.maskMosaic' },
    { id: 'blur', key: 'toolbox.maskBlur' },
    { id: 'solid', key: 'toolbox.maskSolid' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <EyeOff className="w-5 h-5 text-mem-coral" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.imageMask')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('toolbox.maskIntro')}</p>
      <ImagePicker files={files} onChange={(f) => { setFiles(f); setRegions([]); setResultUrl(null) }} />

      {file && fileUrl && (
        <>
          <div className="flex gap-1.5 flex-wrap items-center">
            {modeDefs.map((m) => (
              <MemphisButton key={m.id} size="sm" variant={mode === m.id ? 'coral' : 'white'} onClick={() => setMode(m.id)}>
                {t(m.key)}
              </MemphisButton>
            ))}
            <span className="ml-2 flex items-center gap-1.5 text-xs font-bold text-mem-ink/70">
              {t('toolbox.maskStrength')}
              <input type="range" min={2} max={80} value={strength} onChange={(e) => setStrength(Number(e.target.value))} className="w-28 accent-mem-coral" />
              <span className="font-mono w-8 text-right">{strength}</span>
            </span>
          </div>
          <p className="text-xs text-mem-ink/50 font-medium">{t('toolbox.maskDragHint')}</p>

          <div
            className="relative inline-block max-w-full border-2 border-mem-ink rounded-xl overflow-hidden select-none touch-none"
            onPointerUp={onPointerUp}
            onPointerCancel={() => { dragRef.current = null; setDragNow(null) }}
          >
            <img
              src={fileUrl}
              alt=""
              className="max-w-full max-h-[480px] block"
              draggable={false}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
            />
            {regions.map((r, i) => (
              <RegionBox key={i} region={r} img={fileUrl} onRemove={() => setRegions((prev) => prev.filter((_, k) => k !== i))} />
            ))}
            {dragNow && dragNow.w > 0 && (
              <RegionBox region={dragNow} img={fileUrl} preview />
            )}
          </div>

          {regions.length > 0 && (
            <div className="flex gap-1.5 flex-wrap items-center">
              <span className="text-xs font-bold text-mem-ink/60">{t('toolbox.maskRegions', { count: regions.length })}</span>
              <MemphisButton size="sm" variant="white" onClick={() => setRegions([])}>{t('toolbox.maskClear')}</MemphisButton>
            </div>
          )}

          <MemphisButton variant="coral" onClick={run} disabled={busy || !regions.length}>
            {t('toolbox.maskApply')}
          </MemphisButton>
          <ErrorLine message={error} />
          {resultUrl && (
            <div className="flex flex-col items-center gap-3 p-4 bg-white border-2 border-mem-ink rounded-xl">
              <img src={resultUrl} alt="" className="max-w-full max-h-72" />
              <MemphisButton
                size="sm"
                variant="teal"
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={async () => {
                  const blob = await (await fetch(resultUrl)).blob()
                  downloadBlob(blob, resultName)
                }}
              >
                {t('toolbox.qrDownload')}
              </MemphisButton>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const RegionBox: React.FC<{
  region: MaskRegion
  img: string
  onRemove?: () => void
  preview?: boolean
}> = ({ region, img, onRemove, preview }) => {
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  React.useEffect(() => {
    const probe = new Image()
    probe.onload = () => setDims({ w: probe.naturalWidth, h: probe.naturalHeight })
    probe.src = img
  }, [img])
  if (!dims.w || !dims.h) return null
  // 预览区域按容器实际渲染尺寸换算（RegionBox 以 % 定位天然适配缩放）
  return (
    <div
      className={`absolute border-2 ${preview ? 'border-mem-yellow' : 'border-mem-coral'} ${preview ? 'bg-mem-yellow/20' : 'bg-mem-coral/10'} pointer-events-none`}
      style={{
        left: `${(region.x / dims.w) * 100}%`,
        top: `${(region.y / dims.h) * 100}%`,
        width: `${(region.w / dims.w) * 100}%`,
        height: `${(region.h / dims.h) * 100}%`,
      }}
    >
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-mem-coral border-2 border-mem-ink text-white text-[10px] font-black pointer-events-auto"
        >
          ×
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 证件照换底色 + 尺寸
// ---------------------------------------------------------------------------

const ID_SIZES: IdPhotoSizePreset[] = ['one-inch', 'two-inch', 'small-two-inch', 'one-inch-large']
const ID_BG_PRESETS = ['#438EDB', '#FFFFFF', '#FF0000', '#0000FF']
// 尺寸表真源在 idPhotoWebCore（与后端 ID_PHOTO_SIZES 对齐，浏览器引擎/预览共用）
const ID_SIZE_MM = ID_PHOTO_SIZE_MM

export const IdPhotoView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedImage[]>([])
  // 后端在线探测：null=探测中 / false=离线（Pages 等纯静态环境）→ 浏览器引擎兜底
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    probeBackendAlive().then((ok) => { if (!cancelled) setBackendOnline(ok) })
    return () => { cancelled = true }
  }, [])
  const [bg, setBg] = useState('#438EDB')
  const [size, setSize] = useState<IdPhotoSizePreset>('one-inch')
  // 处理模式：replace=换底色+人像裁剪（旧行为）；keep=仅裁剪尺寸，保留衣着与
  // 背景原样（round-26：用户实拍衣服色接近底色估色时被整片消除的出口）
  const [bgMode, setBgMode] = useState<'replace' | 'keep'>('replace')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  // 裁剪区域（原图像素）：round-25 新增触屏可用的手动裁切——旧版只有后端
  // 全自动裁剪，手机上「怎么拖都没反应」因为没有可交互的裁切 UI
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [rect, setRect] = useState<RectImage | null>(null)

  const file = files[0]
  useEffect(() => {
    if (!file) {
      setFileUrl(null)
      setImgSize({ w: 0, h: 0 })
      setRect(null)
      return
    }
    const url = URL.createObjectURL(file.file)
    setFileUrl(url)
    const probe = new Image()
    probe.onload = () => {
      setImgSize({ w: probe.naturalWidth, h: probe.naturalHeight })
      setRect({ x: 0, y: 0, width: probe.naturalWidth, height: probe.naturalHeight })
    }
    probe.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const run = async () => {
    if (!files[0]) return
    setBusy(true)
    setError(null)
    setResultUrl(null)
    try {
      if (backendOnline === false) {
        // 后端离线（手机网页版/Pages）：浏览器引擎兜底（基础版色距抠像/纯几何裁剪）
        const result = await runIdPhotoWeb(files[0].file, {
          bgColor: bg,
          sizePreset: size,
          bgMode,
          crop: rect,
        })
        emitTaskDoneBlob(t('tools.idPhoto'), result.blob, result.fileName)
        setResultUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(result.blob)
        })
        return
      }
      const form = new FormData()
      form.append('file', files[0].file)
      form.append('bg_color', bg)
      form.append('size_preset', size)
      form.append('bg_mode', bgMode)
      // 用户拖过裁剪框才传裁剪参数；未动 = 全自动人像裁剪（旧行为）
      if (rect) {
        form.append('crop_x', String(Math.round(rect.x)))
        form.append('crop_y', String(Math.round(rect.y)))
        form.append('crop_w', String(Math.round(rect.width)))
        form.append('crop_h', String(Math.round(rect.height)))
      }
      const res = await fetch('/api/toolbox/id-photo', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText))
      const blob = await res.blob()
      emitTaskDoneBlob(t('tools.idPhoto'), blob, 'id_photo.png')
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <IdCard className="w-5 h-5 text-mem-yellow" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.idPhoto')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('toolbox.idIntro')}</p>
      {backendOnline === false && (
        <div className="px-4 py-3 border-2 border-mem-ink rounded-xl bg-mem-yellow/30 text-xs font-bold text-mem-ink">
          {t('toolbox.idWebEngineNote')}
        </div>
      )}
      <ImagePicker files={files} onChange={(f) => { setFiles(f); setResultUrl(null) }} />
      {/* 手动裁切画布：触屏拖画/移动/八向手柄，默认全图（不裁=自动人像定位） */}
      {fileUrl && imgSize.w > 0 && rect && (
        <div className="space-y-1.5">
          <CropStage
            src={fileUrl}
            naturalWidth={imgSize.w}
            naturalHeight={imgSize.h}
            value={rect}
            onChange={setRect}
            mode="free"
          />
          <p className="text-xs text-mem-ink/50 font-medium">{t('toolbox.idCropHint')}</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label={t('toolbox.idMode')}>
          <select
            value={bgMode}
            onChange={(e) => setBgMode(e.target.value as typeof bgMode)}
            className={selectClass}
          >
            <option value="replace">{t('toolbox.idMode_replace')}</option>
            <option value="keep">{t('toolbox.idMode_keep')}</option>
          </select>
        </Field>
        <Field label={t('toolbox.idSize')}>
          <select value={size} onChange={(e) => setSize(e.target.value as typeof size)} className={selectClass}>
            {ID_SIZES.map((s) => (
              <option key={s} value={s}>{t(`toolbox.idSize_${s}`)}</option>
            ))}
          </select>
        </Field>
      </div>
      {bgMode === 'keep' && (
        <p className="text-xs text-mem-ink/60 font-medium bg-mem-teal/10 border border-mem-teal/40 rounded-lg px-3 py-2">
          {t('toolbox.idModeKeepHint')}
        </p>
      )}
      {bgMode === 'replace' && (
        <Field label={t('toolbox.idBg')}>
          <div className="flex items-center gap-2">
            {ID_BG_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBg(c)}
                className={`w-8 h-8 rounded-lg border-2 ${bg === c ? 'border-mem-ink shadow-memphis-sm' : 'border-mem-ink/30'}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="w-8 h-8 border-2 border-mem-ink rounded-lg cursor-pointer" title={t('toolbox.idBgCustom')} />
          </div>
        </Field>
      )}
      {/* 尺寸预览：同一比例尺按真实毫米比例渲染，不同档大小/形状可直接对比 */}
      <div className="flex items-center gap-4 px-4 py-3 bg-white border-2 border-mem-ink rounded-xl">
        <div
          className="border-2 border-mem-ink rounded-sm shrink-0"
          style={{
            width: ID_SIZE_MM[size].w * (96 / 49),
            height: ID_SIZE_MM[size].h * (96 / 49),
            backgroundColor: bgMode === 'keep' ? 'rgba(0,0,0,0.08)' : bg,
          }}
        />
        <div className="text-xs font-bold text-mem-ink/70">
          {t(`toolbox.idSize_${size}`)}
          <div className="font-mono text-[10px] text-mem-ink/50 mt-0.5">{ID_SIZE_MM[size].w}×{ID_SIZE_MM[size].h} mm @ 300DPI</div>
        </div>
      </div>
      <MemphisButton variant="yellow" onClick={run} disabled={busy || !files.length}>
        {t('toolbox.idApply')}
      </MemphisButton>
      <ErrorLine message={error} />
      {resultUrl && (
        <div className="flex flex-col items-center gap-3 p-4 bg-white border-2 border-mem-ink rounded-xl">
          <img src={resultUrl} alt="" className="max-w-40 border border-mem-ink/20" />
          <MemphisButton
            size="sm"
            variant="teal"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={async () => {
              const blob = await (await fetch(resultUrl)).blob()
              downloadBlob(blob, 'id_photo.png')
            }}
          >
            {t('toolbox.qrDownload')}
          </MemphisButton>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 重复文件查找
// ---------------------------------------------------------------------------

interface DupGroup {
  path: string
  name: string
  size: number
  dir: string
}

export const DuplicateFinderView: React.FC = () => {
  const { t } = useI18n()
  const [dir, setDir] = useState('')
  const [minKb, setMinKb] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groups, setGroups] = useState<DupGroup[][]>([])
  const [stats, setStats] = useState<{ scanned: number; wasted: number } | null>(null)

  const pick = async () => {
    const picked = await pickExportFolder()
    if (picked) setDir(picked)
  }

  const scan = async () => {
    if (!dir) return
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('directory', dir)
      form.append('min_size_kb', String(minKb))
      const data = await apiFetch<{ scanned: number; groups: DupGroup[][]; wasted_bytes: number }>(
        '/api/toolbox/duplicates/scan', { method: 'POST', body: form }, 600000,
      )
      setGroups(data.groups)
      setStats({ scanned: data.scanned, wasted: data.wasted_bytes })
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const fmtSize = (bytes: number) => {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${bytes} B`
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <CopyX className="w-5 h-5 text-mem-lime" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.dupFinder')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('toolbox.dupIntro')}</p>
      <Field label={t('toolbox.dupDir')}>
        <div className="flex gap-2">
          <input value={dir} onChange={(e) => setDir(e.target.value)} className={inputClass} placeholder="C:\Users\..." spellCheck={false} />
          <MemphisButton size="sm" variant="white" icon={<FolderOpen className="w-3.5 h-3.5" />} onClick={pick}>
            {t('toolbox.dupBrowse')}
          </MemphisButton>
        </div>
      </Field>
      <Field label={t('toolbox.dupMinSize')}>
        <NumInput value={minKb} onChange={(v) => setMinKb(Number.isNaN(v) ? 1 : Math.max(0, Math.floor(v)))} />
      </Field>
      <MemphisButton variant="lime" onClick={scan} disabled={busy || !dir}>
        {t('toolbox.dupScan')}
      </MemphisButton>
      <ErrorLine message={error} />
      {stats && (
        <div className="px-3 py-2 bg-white border-2 border-mem-ink rounded-xl text-xs font-bold">
          {t('toolbox.dupStats', { scanned: stats.scanned, groups: groups.length, wasted: fmtSize(stats.wasted) })}
        </div>
      )}
      {groups.map((g, i) => (
        <div key={i} className="px-3 py-2.5 bg-white border-2 border-mem-ink/30 rounded-xl">
          <p className="text-xs font-bold text-mem-ink/70 mb-1.5">
            {t('toolbox.dupGroup', { count: g.length, size: fmtSize(g[0].size) })}
          </p>
          <ul className="space-y-1">
            {g.map((f) => (
              <li key={f.path} className="font-mono text-xs break-all text-mem-ink/80" title={f.path}>
                {f.path}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PDF 书签编辑
// ---------------------------------------------------------------------------

interface BookmarkItem {
  title: string
  page: number
  depth: number
}

export const PdfBookmarkView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<BookmarkItem[]>([])
  const [pageCount, setPageCount] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async (f: File) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const form = new FormData()
      form.append('file', f)
      const data = await apiFetch<{ page_count: number; items: BookmarkItem[] }>(
        '/api/toolbox/pdf/bookmarks-get', { method: 'POST', body: form }, 300000,
      )
      setItems(data.items)
      setPageCount(data.page_count)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const save = async (mode: 'replace' | 'append') => {
    if (!file || !items.length) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('items', JSON.stringify(items))
      form.append('mode', mode)
      const res = await fetch('/api/toolbox/pdf/bookmarks-set', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText))
      const dispo = res.headers.get('content-disposition') || ''
      const match = dispo.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
      const outName = match ? decodeURIComponent(match[1]) : `${file.name.replace(/\.pdf$/i, '')}_bookmarks.pdf`
      const blob = await res.blob()
      emitTaskDoneBlob(t('tools.pdfBookmarks'), blob, outName)
      await downloadBlob(blob, outName)
      setNotice(t('toolbox.bmSaved'))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const update = (idx: number, patch: Partial<BookmarkItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

  const addRow = () => setItems((prev) => [...prev, { title: '', page: 0, depth: 0 }])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BookMarked className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfBookmarks')}</h3>
      </div>
      <Field label={t('toolbox.bmPick')}>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null
            setFile(f)
            setItems([])
            setPageCount(0)
            if (f) load(f)
            e.target.value = ''
          }}
          className="text-xs"
        />
      </Field>
      {pageCount > 0 && (
        <p className="text-xs text-mem-ink/60 font-medium">{t('toolbox.bmPageCount', { count: pageCount })}</p>
      )}
      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={Math.max(0, pageCount - 1)}
                value={it.depth}
                onChange={(e) => update(i, { depth: Math.max(0, Number(e.target.value) || 0) })}
                className={`${inputClass} w-16`}
                title={t('toolbox.bmDepth')}
              />
              <input
                value={it.title}
                onChange={(e) => update(i, { title: e.target.value })}
                className={`${inputClass} flex-1`}
                placeholder={t('toolbox.bmTitle')}
              />
              <input
                type="number"
                min={0}
                max={Math.max(0, pageCount - 1)}
                value={it.page}
                onChange={(e) => update(i, { page: Math.max(0, Number(e.target.value) || 0) })}
                className={`${inputClass} w-20`}
                title={t('toolbox.bmPage')}
              />
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((_, k) => k !== i))}
                className="shrink-0 px-2 py-1.5 rounded-lg border-2 border-mem-ink/30 text-xs hover:bg-mem-coral/20"
              >
                ×
              </button>
            </div>
          ))}
          <div className="flex gap-1.5 flex-wrap">
            <MemphisButton size="sm" variant="white" onClick={addRow}>{t('toolbox.bmAdd')}</MemphisButton>
            <span className="text-[10px] text-mem-ink/50 self-center">{t('toolbox.bmColsHint')}</span>
          </div>
          <div className="flex gap-2 pt-1">
            <MemphisButton variant="sky" onClick={() => save('replace')} disabled={busy}>
              {t('toolbox.bmReplace')}
            </MemphisButton>
            <MemphisButton variant="white" onClick={() => save('append')} disabled={busy}>
              {t('toolbox.bmAppend')}
            </MemphisButton>
          </div>
        </div>
      )}
      {notice && <p className="text-xs font-bold text-mem-teal">{notice}</p>}
      <ErrorLine message={error} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// TTS 文字转朗读
// ---------------------------------------------------------------------------

interface VoiceInfo {
  id: string
  name: string
}

export const TtsView: React.FC = () => {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [voices, setVoices] = useState<VoiceInfo[]>([])
  const [voiceId, setVoiceId] = useState('')
  const [rate, setRate] = useState(0)
  const [fmt, setFmt] = useState<'wav' | 'mp3'>('wav')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    apiFetch<{ available: boolean; voices: VoiceInfo[] }>('/api/toolbox/tts/voices', undefined, 15000)
      .then((data) => {
        if (data.available) {
          setVoices(data.voices)
          if (data.voices.length) setVoiceId(data.voices[0].id)
        }
      })
      .catch(() => {})
  }, [])

  const synth = async () => {
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('text', text)
      form.append('voice_id', voiceId)
      form.append('rate', String(rate))
      form.append('format_choice', fmt)
      const res = await fetch('/api/toolbox/tts/synthesize', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText))
      const blob = await res.blob()
      emitTaskDoneBlob(t('tools.tts'), blob, `tts_${Date.now()}.${fmt === 'mp3' ? 'mp3' : 'wav'}`)
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <AudioLines className="w-5 h-5 text-mem-pink" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.tts')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('toolbox.ttsIntro')}</p>
      <Field label={t('toolbox.ttsText')}>
        <AreaInput value={text} onChange={setText} rows={6} placeholder={t('toolbox.ttsTextHint')} />
      </Field>
      {voices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label={t('toolbox.ttsVoice')}>
            <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className={selectClass}>
              {voices.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t('toolbox.ttsRate', { rate })}>
            <input type="range" min={-10} max={10} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full accent-mem-pink mt-2" />
          </Field>
          <Field label={t('toolbox.ttsFormat')}>
            <select value={fmt} onChange={(e) => setFmt(e.target.value as 'wav' | 'mp3')} className={selectClass}>
              <option value="wav">WAV</option>
              <option value="mp3">MP3{fmt === 'mp3' ? '' : ''}</option>
            </select>
          </Field>
        </div>
      )}
      {voices.length === 0 && (
        <p className="text-xs font-bold text-mem-coral border-2 border-mem-coral/40 bg-mem-coral/10 rounded-xl px-3 py-2">
          {t('toolbox.ttsUnavailable')}
        </p>
      )}
      <MemphisButton variant="pink" onClick={synth} disabled={busy || !text.trim() || !voices.length}>
        {t('toolbox.ttsSynth')}
      </MemphisButton>
      <ErrorLine message={error} />
      {audioUrl && (
        <div className="flex flex-col gap-3 p-4 bg-white border-2 border-mem-ink rounded-xl">
          <audio ref={audioRef} src={audioUrl} controls className="w-full" />
          <MemphisButton
            size="sm"
            variant="teal"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={async () => {
              const blob = await (await fetch(audioUrl)).blob()
              downloadBlob(blob, `tts_${Date.now()}.${fmt === 'mp3' ? 'mp3' : 'wav'}`)
            }}
          >
            {t('toolbox.qrDownload')}
          </MemphisButton>
        </div>
      )}
    </div>
  )
}
