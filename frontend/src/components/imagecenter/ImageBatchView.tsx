/**
 * 图像批处理视图（批处理引擎 · 二期 · 图像中心）。
 *
 * 操作注册表（扩展约定：只改本文件 BATCH_OPS + runOp 分支 + i18n）：
 * - image-convert / image-compress：浏览器内 canvas 处理（client，网页/EXE 全端可用）；
 * - image-color-replace：批量统一换色（品牌色替换/去底等高频场景），from/to/tolerance 参数化；
 * - 裁剪 / 多图拼接 / 图标生成 / 主题取色 / 色彩空间对比：交互式或跨文件语义，不进批量。
 */
import React, { useCallback, useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import { useI18n } from '../../i18n'
import {
  BatchEngine,
  type BatchOpDef,
  type BatchOpOutput,
  type BatchParamCtx,
} from '../common/BatchEngine'
import {
  compressImage,
  convertImage,
  replaceColor,
  type CompressionQuality,
  type TargetFormat,
} from '../../lib/zonkey/imageCore'

const IMAGE_BATCH_OPS: BatchOpDef[] = [
  { id: 'image-convert', group: 'convert', kind: 'client', accept: '.jpg,.jpeg,.png,.webp,.bmp,.gif', labelKey: 'tools.imageConvert' },
  { id: 'image-compress', group: 'convert', kind: 'client', accept: '.jpg,.jpeg,.png,.webp', labelKey: 'tools.imageCompress' },
  { id: 'image-color-replace', group: 'edit', kind: 'client', accept: '.jpg,.jpeg,.png,.webp,.bmp,.gif', labelKey: 'tools.imageColorReplace' },
]

export const ImageBatchView: React.FC = () => {
  const { t } = useI18n()
  const [target, setTarget] = useState<TargetFormat>('png')
  const [quality, setQuality] = useState<CompressionQuality>('medium')
  const [fromColor, setFromColor] = useState('#ffffff')
  const [toColor, setToColor] = useState('#2563eb')
  const [tolerance, setTolerance] = useState(24)

  const runImageOp = async (def: BatchOpDef, file: File): Promise<BatchOpOutput[]> => {
    switch (def.id) {
      case 'image-convert': {
        const out = await convertImage(file, target)
        return [{ fileName: out.fileName, blob: out.blob }]
      }
      case 'image-compress': {
        const out = await compressImage(file, quality)
        return [{ fileName: out.fileName, blob: out.blob }]
      }
      case 'image-color-replace': {
        const out = await replaceColor(file, { from: fromColor, to: toColor, tolerance })
        return [{ fileName: out.fileName, blob: out.blob }]
      }
      default:
        throw new Error(`unsupported client op: ${def.id}`)
    }
  }

  // 图像批处理全部为浏览器内操作，无需后端探活（探活失败也照常可用）
  const getAvailability = useCallback(async () => ({ backend: true }), [])

  const paramControls = (ctx: BatchParamCtx) => {
    const current = ctx.def.id
    return (
      <>
        {current === 'image-convert' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['jpg', 'png', 'webp'] as TargetFormat[]).map((format) => (
              <button
                key={format}
                type="button"
                className={`px-2 py-1 border-2 border-mem-ink rounded-lg text-xs font-bold ${target === format ? 'bg-mem-yellow text-mem-ink' : 'bg-white text-mem-ink/60'}`}
                onClick={() => setTarget(format)}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        {current === 'image-compress' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['high', 'medium', 'low'] as CompressionQuality[]).map((level) => (
              <button
                key={level}
                type="button"
                className={`px-2 py-1 border-2 border-mem-ink rounded-lg text-xs font-bold ${quality === level ? 'bg-mem-yellow text-mem-ink' : 'bg-white text-mem-ink/60'}`}
                onClick={() => setQuality(level)}
              >
                {t(`imagecenter.quality_${level}`)}
              </button>
            ))}
          </div>
        )}
        {current === 'image-color-replace' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <label className="flex flex-col gap-1 text-xs font-bold text-mem-ink/70">
              <span className="flex items-center gap-2">
                {t('imagecenter.batch.fromColor')}
                <input type="color" value={fromColor} onChange={(e) => setFromColor(e.target.value)} className="w-8 h-7 rounded border-2 border-mem-ink bg-white" />
              </span>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-mem-ink/70">
              <span className="flex items-center gap-2">
                {t('imagecenter.batch.toColor')}
                <input type="color" value={toColor} onChange={(e) => setToColor(e.target.value)} className="w-8 h-7 rounded border-2 border-mem-ink bg-white" />
              </span>
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-mem-ink/70">
              <span className="flex items-center gap-2">
                {t('imagecenter.batch.tolerance')}
                <input type="range" min={0} max={100} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="flex-1" />
                <span className="w-8 text-right">{tolerance}</span>
              </span>
            </label>
          </div>
        )}
      </>
    )
  }

  const fileThumb = (file: File) => (
    <img src={URL.createObjectURL(file)} alt="" className="w-7 h-7 rounded-md border border-mem-ink/30 object-cover shrink-0" />
  )

  return (
    <BatchEngine
      center="image"
      titleKey="tools.imageBatch"
      hintKey="imagecenter.batch.hint"
      unsupportedKey="imagecenter.batch.unsupported"
      ops={IMAGE_BATCH_OPS}
      getEngineAvailability={getAvailability}
      runOp={runImageOp}
      paramControls={paramControls}
      fileThumb={fileThumb}
      accent="yellow"
      icon={<ImageIcon className="w-5 h-5 text-mem-yellow" />}
    />
  )
}