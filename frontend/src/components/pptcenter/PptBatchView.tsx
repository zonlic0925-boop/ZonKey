/**
 * PPT 批处理视图（批处理引擎 · 二期 · PPT 中心）。
 *
 * 操作注册表（扩展约定：只改本文件 BATCH_OPS + runOp 分支 + i18n）：
 * - ppt-to-pdf / ppt-to-image：走 /api/ppt/render 同步端点（server，需桌面引擎在线，
 *   浏览器/手机离线时如实标注并禁用——PPT 渲染引擎在桌面侧）；
 * - ppt-images：提取演示文稿内嵌图片打包 ZIP（纯前端 JSZip）；
 * - ppt-compress：瘦身重压缩（纯前端 JSZip）；
 * - ppt-text（按页导出文本）/ 大纲 / 草稿：逐文件导出文本语义与批处理冲突，不进批量。
 */
import React, { useState } from 'react'
import { Image as ImageIcon, Presentation } from 'lucide-react'
import { useI18n } from '../../i18n'
import { apiFetch, type MediaJobOutput } from '../../lib/api'
import {
  BatchEngine,
  type BatchOpDef,
  type BatchOpOutput,
  type BatchParamCtx,
} from '../common/BatchEngine'
import { extractPptImages, compressPptx } from '../../lib/zonkey/pptCore'

const PPT_BATCH_OPS: BatchOpDef[] = [
  { id: 'ppt-to-pdf', group: 'convert', kind: 'server', accept: '.pptx', labelKey: 'tools.pptToPdf' },
  { id: 'ppt-to-image', group: 'convert', kind: 'server', accept: '.pptx', labelKey: 'tools.pptToImage' },
  { id: 'ppt-images', group: 'extract', kind: 'client', accept: '.pptx', labelKey: 'tools.pptImages' },
  { id: 'ppt-compress', group: 'extract', kind: 'client', accept: '.pptx', labelKey: 'tools.pptCompress' },
]

/** PPT 渲染能力（与本视图的 server 操作绑定，PPT 渲染引擎在桌面侧） */
async function getPptAvailability(): Promise<Record<string, boolean> | null> {
  try {
    const caps = await apiFetch<{ libreoffice: boolean; powerpoint_com: boolean }>(
      '/api/ppt/render/capability',
      undefined,
      10000
    )
    return { render: caps.libreoffice || caps.powerpoint_com }
  } catch {
    return null
  }
}

function renderPptx(file: File, target: 'pdf' | 'images', imageFormat: 'png' | 'jpeg', dpi: number): Promise<{ download_name: string; output_dir: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('target', target)
  form.append('image_format', imageFormat)
  form.append('dpi', String(dpi))
  return apiFetch('/api/ppt/render', { method: 'POST', body: form }, 300000)
}

export const PptBatchView: React.FC = () => {  const { t } = useI18n()
  const [imageFormat, setImageFormat] = useState<'png' | 'jpeg'>('png')
  const [dpi, setDpi] = useState(150)

  const runPptOp = async (def: BatchOpDef, file: File): Promise<BatchOpOutput[]> => {
    switch (def.id) {
      case 'ppt-to-pdf':
      case 'ppt-to-image': {
        const result = await renderPptx(file, def.id === 'ppt-to-pdf' ? 'pdf' : 'images', imageFormat, dpi)
        const output: MediaJobOutput = { name: result.download_name, dir: result.output_dir }
        return [{ fileName: result.download_name, outputs: [output] }]
      }
      case 'ppt-images': {
        const items = await extractPptImages(file)
        if (!items.length) throw new Error(t('pptcenter.noMedia'))
        return items.map((item) => ({ fileName: item.fileName, blob: item.blob }))
      }
      case 'ppt-compress': {
        const result = await compressPptx(file)
        return [{ fileName: result.fileName, blob: result.blob }]
      }
      default:
        throw new Error(`unsupported client op: ${def.id}`)
    }
  }

  const paramControls = (ctx: BatchParamCtx) => {
    const current = ctx.def.id
    return (
      <>
        {current === 'ppt-to-image' && (
          <div className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
            <span className="shrink-0">{t('pptcenter.batch.imageFormat')}</span>
            <select value={imageFormat} onChange={(e) => setImageFormat(e.target.value as 'png' | 'jpeg')} className="px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
            <span className="shrink-0">DPI</span>
            <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))} className="px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
              {[96, 120, 144, 150, 200].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        )}
        {current === 'ppt-compress' && (
          <p className="text-xs font-bold text-mem-ink/50">{t('pptcenter.compressHint')}</p>
        )}
      </>
    )
  }

  return (
    <BatchEngine
      center="ppt"
      titleKey="tools.pptBatch"
      hintKey="pptcenter.batch.hint"
      unsupportedKey="pptcenter.batch.unsupported"
      ops={PPT_BATCH_OPS}
      getEngineAvailability={getPptAvailability}
      runOp={runPptOp}
      paramControls={paramControls}
      accent="orange"
      icon={<Presentation className="w-5 h-5 text-mem-orange" />}
    />
  )
}
