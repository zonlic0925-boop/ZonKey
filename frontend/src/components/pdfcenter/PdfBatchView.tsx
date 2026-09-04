/**
 * PDF 批处理视图（批处理引擎 · 一期 19 操作 · 现跑在通用编排器 BatchEngine 上）。
 *
 * 扩展约定：扩新操作只改本文件 PDF_BATCH_OPS 注册表 + runPdfOp 分支 + i18n。
 * 通道语义：
 * - client：浏览器内 pdf-lib/pdfCore 处理 → 产物打包 ZIP 交付；
 * - protect：加密走后端同步端点（引擎侧算法）→ 产物进 ZIP；
 * - repair / server：走 convert 队列（产物落 output/）→ 统一交付列表。
 * 交互式/跨文件语义操作（合并/页面整理/编辑器/填表/证书签名/图片转PDF/html-to-pdf）不进批量。
 */
import React, { useCallback, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { Layers } from 'lucide-react'
import { useI18n } from '../../i18n'
import {
  BatchEngine,
  type BatchOpDef,
  type BatchOpOutput,
  type BatchParamCtx,
  type BatchPickedFile,
} from '../common/BatchEngine'
import {
  getConvertCapability,
  convertRepair,
  pollConvertJob,
  startConvertJob,
  type ConvertJobStatus,
  type ConvertOp,
  type MediaJobOutput,
} from '../../lib/api'
import {
  addPageNumbers,
  addPdfWatermark,
  compressPdfFile,
  createPdfCroppedFileName,
  createPdfEnhancedFileName,
  createPdfExtractedFileName,
  createPdfNumberedFileName,
  createPdfWatermarkedFileName,
  cropPdfPages,
  decryptPdfFile,
  encryptPdfFileAdvanced,
  enhancePdfScan,
  extractPdfPages,
  parsePdfPageRanges,
  pdfToImages,
  rotatePdfPages,
  splitPdfPages,
  type PdfCompressLevel,
  type PdfEnhanceMode,
  type PdfPageNumberFormat,
  type PdfPageNumberPosition,
} from '../../lib/zonkey/pdfCore'

export interface PdfBatchOpDef extends BatchOpDef {
  convertOp?: ConvertOp
}

const PDF_BATCH_OPS: PdfBatchOpDef[] = [
  { id: 'pdf-split', group: 'organize', kind: 'client', accept: '.pdf', labelKey: 'tools.pdfSplit' },
  { id: 'pdf-extract', group: 'organize', kind: 'client', accept: '.pdf', labelKey: 'tools.pdfExtract' },
  { id: 'pdf-rotate', group: 'organize', kind: 'client', accept: '.pdf', labelKey: 'tools.pdfRotate' },
  { id: 'pdf-crop', group: 'organize', kind: 'client', accept: '.pdf', labelKey: 'tools.pdfCrop' },
  { id: 'pdf-page-numbers', group: 'organize', kind: 'client', accept: '.pdf', labelKey: 'tools.pdfPageNumbers' },
  { id: 'pdf-compress', group: 'convert', kind: 'client', accept: '.pdf', labelKey: 'tools.pdfCompress' },
  { id: 'pdf-enhance', group: 'convert', kind: 'client', accept: '.pdf', labelKey: 'tools.pdfEnhance' },
  { id: 'pdf-to-image', group: 'convert', kind: 'client', accept: '.pdf', labelKey: 'tools.pdfToImage' },
  { id: 'pdf-to-word', group: 'convert', kind: 'server', accept: '.pdf', labelKey: 'tools.pdfToWord', convertOp: 'pdf-to-word' },
  { id: 'pdf-to-excel', group: 'convert', kind: 'server', accept: '.pdf', labelKey: 'tools.pdfToExcel', convertOp: 'pdf-to-excel' },
  { id: 'pdf-to-ppt', group: 'convert', kind: 'server', accept: '.pdf', labelKey: 'tools.pdfToPpt', convertOp: 'pdf-to-ppt' },
  { id: 'word-to-pdf', group: 'convert', kind: 'server', accept: '.docx,.doc', labelKey: 'tools.wordToPdf', convertOp: 'word-to-pdf' },
  { id: 'excel-to-pdf', group: 'convert', kind: 'server', accept: '.xlsx,.xls', labelKey: 'tools.excelToPdf', convertOp: 'excel-to-pdf' },
  { id: 'compress-deep', group: 'convert', kind: 'server', accept: '.pdf', labelKey: 'tools.compressDeep', convertOp: 'compress-deep' },
  { id: 'ocr-export', group: 'convert', kind: 'server', accept: '.pdf', labelKey: 'tools.ocrExport', convertOp: 'ocr-export' },
  { id: 'pdf-repair', group: 'convert', kind: 'server', accept: '.pdf', labelKey: 'tools.pdfRepair' },
  { id: 'pdf-watermark', group: 'edit', kind: 'client', accept: '.pdf', labelKey: 'tools.pdfWatermark' },
  { id: 'pdf-encrypt', group: 'security', kind: 'server', accept: '.pdf', labelKey: 'tools.pdfEncrypt' },
  { id: 'pdf-decrypt', group: 'security', kind: 'client', accept: '.pdf', labelKey: 'tools.pdfDecrypt' },
]

// 服务端/修复/保护操作需要引擎在线；ocr-export 还额外要求 rapidocr
const SERVER_OP_SET = new Set(
  PDF_BATCH_OPS.filter((o) => o.kind === 'server' || (o as PdfBatchOpDef).convertOp).map((o) => o.id)
)

const WM_COLORS = ['#808080', '#111111', '#dc2626', '#2563eb']
const NUMBER_POSITIONS: PdfPageNumberPosition[] = ['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left']
const NUMBER_FORMATS: PdfPageNumberFormat[] = ['plain', 'slash', 'page']
const ENHANCE_MODES: PdfEnhanceMode[] = ['contrast', 'grayscale', 'binarize']

function bytesToBlob(bytes: Uint8Array, mime = 'application/pdf'): Blob {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return new Blob([buffer], { type: mime })
}

function pdfBaseName(name: string): string {
  return name.replace(/\.pdf$/i, '')
}

export const PdfBatchView: React.FC = () => {
  const { t } = useI18n()
  const [caps, setCaps] = useState<Awaited<ReturnType<typeof getConvertCapability>> | null>(null)
  const [opId, setOpId] = useState<string | null>(null)

  // 操作参数
  const [level, setLevel] = useState<PdfCompressLevel>('medium')
  const [angle, setAngle] = useState(90)
  const [wmType, setWmType] = useState<'text' | 'image'>('text')
  const [wmText, setWmText] = useState('CONFIDENTIAL')
  const [wmFontSize, setWmFontSize] = useState(48)
  const [wmColor, setWmColor] = useState(WM_COLORS[0])
  const [wmOpacity, setWmOpacity] = useState(30)
  const [wmRotation, setWmRotation] = useState(45)
  const [wmTile, setWmTile] = useState(false)
  const [wmImage, setWmImage] = useState<File | null>(null)
  const wmImageInputRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [userPw, setUserPw] = useState('')
  const [ownerPw, setOwnerPw] = useState('')
  const [perms, setPerms] = useState({ print: true, copy: true, modify: true, fill: true })
  const [position, setPosition] = useState<PdfPageNumberPosition>('bottom-center')
  const [numberFormat, setNumberFormat] = useState<PdfPageNumberFormat>('plain')
  const [enhanceMode, setEnhanceMode] = useState<PdfEnhanceMode>('contrast')
  const [rangeInput, setRangeInput] = useState('1-1')
  const [marginPercent, setMarginPercent] = useState(5)
  const [imgFormat, setImgFormat] = useState<'png' | 'jpeg'>('png')
  const [imgScale, setImgScale] = useState(2)
  const [dpi, setDpi] = useState(144)
  const [quality, setQuality] = useState(70)
  const [ocrOut, setOcrOut] = useState<'txt' | 'pdf'>('txt')
  const [pptFormat, setPptFormat] = useState<'png' | 'jpeg'>('png')

  const getAvailability = useCallback(async () => {
    try {
      const value = await getConvertCapability()
      setCaps(value)
      return { backend: true, rapidocr: !!value.rapidocr }
    } catch {
      setCaps(null)
      return null
    }
  }, [])
  const handleOpChange = (id: string | null) => setOpId(id)

  const extraValidate = (op: BatchOpDef, files: BatchPickedFile[]): string | null => {
    if (op.id === 'pdf-watermark' && wmType === 'text' && !wmText.trim()) return t('pdfcenter.batch.needWatermarkText')
    if (op.id === 'pdf-watermark' && wmType === 'image' && !wmImage) return t('pdfcenter.batch.needWatermarkImage')
    if (op.id === 'pdf-decrypt' && !password.trim()) return t('pdfcenter.batch.needPassword')
    if (op.id === 'pdf-encrypt' && !userPw.trim() && !ownerPw.trim()) return t('pdfcenter.batch.needOwnerPassword')
    if (op.id === 'pdf-extract' && !rangeInput.trim()) return t('pdfcenter.batch.needRange')
    return null
  }

  const runPdfOp = async (def: BatchOpDef, file: File): Promise<BatchOpOutput[]> => {
    const base = pdfBaseName(file.name)
    switch (def.id) {
      case 'pdf-compress': {
        const out = await compressPdfFile(new Uint8Array(await file.arrayBuffer()), level)
        return [{ fileName: `${base}_compressed.pdf`, blob: bytesToBlob(out) }]
      }
      case 'pdf-rotate': {
        const fileData = new Uint8Array(await file.arrayBuffer())
        const doc = await PDFDocument.load(fileData.slice())
        const pages = Array.from({ length: doc.getPageCount() }, (_, i) => ({ pageIndex: i + 1, rotation: angle }))
        const out = await rotatePdfPages({ fileData, pages })
        return [{ fileName: `${base}_rotated.pdf`, blob: bytesToBlob(out) }]
      }
      case 'pdf-watermark': {
        const fileData = new Uint8Array(await file.arrayBuffer())
        const out = await addPdfWatermark({
          fileData,
          type: wmType,
          text: wmType === 'text' ? wmText.trim() : undefined,
          imageFile: wmType === 'image' ? wmImage! : undefined,
          fontSize: wmFontSize,
          color: wmColor,
          opacity: wmOpacity / 100,
          rotation: wmRotation,
          tile: wmTile,
        })
        return [{ fileName: createPdfWatermarkedFileName(file.name), blob: bytesToBlob(out) }]
      }
      case 'pdf-decrypt': {
        const fileData = new Uint8Array(await file.arrayBuffer())
        const out = await decryptPdfFile(fileData, password)
        return [{ fileName: `${base}_decrypted.pdf`, blob: bytesToBlob(out) }]
      }
      case 'pdf-page-numbers': {
        const fileData = new Uint8Array(await file.arrayBuffer())
        const out = await addPageNumbers({ fileData, position, format: numberFormat })
        return [{ fileName: createPdfNumberedFileName(file.name), blob: bytesToBlob(out) }]
      }
      case 'pdf-enhance': {
        const fileData = new Uint8Array(await file.arrayBuffer())
        const out = await enhancePdfScan({ fileData, mode: enhanceMode })
        return [{ fileName: createPdfEnhancedFileName(file.name), blob: bytesToBlob(out) }]
      }
      case 'pdf-crop': {
        const fileData = new Uint8Array(await file.arrayBuffer())
        const out = await cropPdfPages({ fileData, marginPercent })
        return [{ fileName: createPdfCroppedFileName(file.name), blob: bytesToBlob(out) }]
      }
      case 'pdf-split': {
        const fileData = new Uint8Array(await file.arrayBuffer())
        const doc = await PDFDocument.load(fileData.slice())
        const documents = [{ fileName: file.name, fileData }]
        const pages = Array.from({ length: doc.getPageCount() }, (_, i) => ({ fileIndex: 0, pageIndex: i + 1 }))
        const parts = await splitPdfPages({ documents, pages })
        return parts.map((part) => ({ fileName: part.fileName, blob: bytesToBlob(part.bytes) }))
      }
      case 'pdf-extract': {
        const fileData = new Uint8Array(await file.arrayBuffer())
        const doc = await PDFDocument.load(fileData.slice())
        const ranges = parsePdfPageRanges(rangeInput.trim(), doc.getPageCount())
        const out = await extractPdfPages({ fileData, sourceName: file.name, ranges })
        return [{ fileName: createPdfExtractedFileName(file.name), blob: bytesToBlob(out) }]
      }
      case 'pdf-to-image': {
        const fileData = new Uint8Array(await file.arrayBuffer())
        const images = await pdfToImages({ fileData, sourceName: file.name, format: imgFormat, scale: imgScale })
        const mime = imgFormat === 'jpeg' ? 'image/jpeg' : 'image/png'
        return images.map((image) => ({ fileName: image.fileName, blob: bytesToBlob(image.bytes, mime) }))
      }
      case 'pdf-encrypt': {
        const out = await encryptPdfFileAdvanced(file, userPw, ownerPw.trim() || userPw, perms)
        return [{ fileName: `${base}_encrypted.pdf`, blob: bytesToBlob(out) }]
      }
      case 'pdf-repair': {
        const result = await convertRepair(file)
        const output: MediaJobOutput = { name: result.download_name, dir: result.output_dir }
        return [{ fileName: result.download_name, outputs: [output] }]
      }
      default: {
        if (SERVER_OP_SET.has(def.id)) {
          const convertOp = (def as PdfBatchOpDef).convertOp
          if (!convertOp) throw new Error(`unsupported server op: ${def.id}`)
          const started = await startConvertJob(convertOp, file, {
            dpi,
            quality,
            imageFormat: pptFormat,
            ocrOutput: ocrOut,
          })
          const final: ConvertJobStatus = await pollConvertJob(started.job_id, () => {})
          if (final.status === 'error') {
            throw new Error(final.error || t('convert.failed'))
          }
          return final.outputs.map((output) => ({
            fileName: output.name,
            outputs: [{ name: output.name, dir: output.dir ?? '' } as MediaJobOutput],
          }))
        }
        throw new Error(`unsupported client op: ${def.id}`)
      }
    }
  }

  const paramControls = (ctx: BatchParamCtx) => {
    const opId = ctx.def.id
    return (
      <>
        {(opId === 'pdf-compress' || opId === 'compress-deep') && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['low', 'medium', 'high'] as PdfCompressLevel[]).map((value) => (
              <button
                key={value}
                type="button"
                className={`px-2 py-1 border-2 border-mem-ink rounded-lg text-xs font-bold ${level === value ? 'bg-mem-sky text-white' : 'bg-white text-mem-ink/60'}`}
                onClick={() => setLevel(value)}
              >
                {t(`pdfcenter.level_${value}`)}
              </button>
            ))}
          </div>
        )}
        {opId === 'compress-deep' && (
          <div className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
            <span className="shrink-0">DPI</span>
            <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))} className="px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
              {[96, 120, 144, 200].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        )}
        {opId === 'pdf-rotate' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {[90, 180, 270].map((value) => (
              <button
                key={value}
                type="button"
                className={`px-2 py-1 border-2 border-mem-ink rounded-lg text-xs font-bold ${angle === value ? 'bg-mem-sky text-white' : 'bg-white text-mem-ink/60'}`}
                onClick={() => setAngle(value)}
              >
                +{value}°
              </button>
            ))}
          </div>
        )}
        {opId === 'pdf-crop' && (
          <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
            <span className="shrink-0">{t('pdfcenter.batch.margin')}</span>
            <input type="number" min={0} max={40} value={marginPercent} onChange={(e) => setMarginPercent(Number(e.target.value) || 0)} className="w-20 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white" />
          </label>
        )}
        {opId === 'pdf-extract' && (
          <input
            type="text"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
            placeholder={t('pdfcenter.batch.rangePlaceholder')}
            className="w-full px-3 py-2 border-2 border-mem-ink rounded-xl text-sm font-mono font-bold bg-white"
          />
        )}
        {opId === 'pdf-page-numbers' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
              <span className="shrink-0">{t('pdfcenter.batch.position')}</span>
              <select value={position} onChange={(e) => setPosition(e.target.value as PdfPageNumberPosition)} className="flex-1 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
                {NUMBER_POSITIONS.map((value) => <option key={value} value={value}>{t(`pdfcenter.batch.pos_${value.replace(/-/g, '_')}`)}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
              <span className="shrink-0">{t('pdfcenter.batch.numberFormat')}</span>
              <select value={numberFormat} onChange={(e) => setNumberFormat(e.target.value as PdfPageNumberFormat)} className="flex-1 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
                {NUMBER_FORMATS.map((value) => <option key={value} value={value}>{t(`pdfcenter.batch.fmt_${value}`)}</option>)}
              </select>
            </label>
          </div>
        )}
        {opId === 'pdf-enhance' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {ENHANCE_MODES.map((value) => (
              <button
                key={value}
                type="button"
                className={`px-2 py-1 border-2 border-mem-ink rounded-lg text-xs font-bold ${enhanceMode === value ? 'bg-mem-sky text-white' : 'bg-white text-mem-ink/60'}`}
                onClick={() => setEnhanceMode(value)}
              >
                {t(`pdfcenter.batch.enhance_${value}`)}
              </button>
            ))}
          </div>
        )}
        {opId === 'pdf-to-image' && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
              <span className="shrink-0">{t('pdfcenter.batch.imageFormat')}</span>
              <select value={imgFormat} onChange={(e) => setImgFormat(e.target.value as 'png' | 'jpeg')} className="flex-1 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
              <span className="shrink-0">{t('pdfcenter.batch.imageScale')}</span>
              <select value={imgScale} onChange={(e) => setImgScale(Number(e.target.value))} className="flex-1 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
                {[1, 2, 3].map((value) => <option key={value} value={value}>{value}x</option>)}
              </select>
            </label>
          </div>
        )}
        {opId === 'pdf-watermark' && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={`px-2 py-1 border-2 border-mem-ink rounded-lg text-xs font-bold ${wmType === 'text' ? 'bg-mem-sky text-white' : 'bg-white text-mem-ink/60'}`}
                onClick={() => setWmType('text')}
              >
                {t('pdfcenter.batch.wmTypeText')}
              </button>
              <button
                type="button"
                className={`px-2 py-1 border-2 border-mem-ink rounded-lg text-xs font-bold ${wmType === 'image' ? 'bg-mem-sky text-white' : 'bg-white text-mem-ink/60'}`}
                onClick={() => setWmType('image')}
              >
                {t('pdfcenter.batch.wmTypeImage')}
              </button>
            </div>
            {wmType === 'text' ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={wmText}
                  onChange={(e) => setWmText(e.target.value)}
                  placeholder={t('pdfcenter.wmTextPlaceholder')}
                  className="w-full px-3 py-2 border-2 border-mem-ink rounded-xl text-sm font-bold bg-white"
                />
                <div className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
                  <span className="shrink-0">{t('pdfcenter.wmColor')}</span>
                  {WM_COLORS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setWmColor(value)}
                      className={`w-6 h-6 rounded-lg border-2 ${wmColor === value ? 'border-mem-sky ring-2 ring-mem-sky/40' : 'border-mem-ink/40'}`}
                      style={{ backgroundColor: value }}
                      aria-label={value}
                    />
                  ))}
                  <span className="ml-2 shrink-0">{t('pdfcenter.wmFontSize')}</span>
                  <input type="number" min={8} max={200} value={wmFontSize} onChange={(e) => setWmFontSize(Number(e.target.value) || 48)} className="w-16 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white" />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  ref={wmImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    setWmImage(e.target.files?.[0] ?? null)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  className={`px-2 py-1 border-2 border-mem-ink rounded-lg text-xs font-bold ${wmImage ? 'bg-mem-sky text-white' : 'bg-white text-mem-ink/60'}`}
                  onClick={() => wmImageInputRef.current?.click()}
                >
                  {wmImage ? wmImage.name : t('pdfcenter.wmPickImage')}
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
                <span className="shrink-0">{t('pdfcenter.wmOpacity')}</span>
                <input type="range" min={5} max={100} value={wmOpacity} onChange={(e) => setWmOpacity(Number(e.target.value))} className="flex-1" />
                <span className="w-10 text-right">{wmOpacity}%</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
                <span className="shrink-0">{t('pdfcenter.wmRotation')}</span>
                <select value={wmRotation} onChange={(e) => setWmRotation(Number(e.target.value))} className="flex-1 px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
                  {[0, 30, 45, 60, 90].map((value) => <option key={value} value={value}>{value}°</option>)}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
              <input type="checkbox" checked={wmTile} onChange={(e) => setWmTile(e.target.checked)} className="w-4 h-4 accent-mem-sky" />
              {t('pdfcenter.wmTile')}
            </label>
          </div>
        )}
        {opId === 'pdf-decrypt' && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('pdfcenter.batch.passwordPlaceholder')}
            className="w-full px-3 py-2 border-2 border-mem-ink rounded-xl text-sm font-bold bg-white"
          />
        )}
        {opId === 'pdf-encrypt' && (
          <div className="space-y-2">
            <input
              type="password"
              value={userPw}
              onChange={(e) => setUserPw(e.target.value)}
              placeholder={t('pdfcenter.batch.userPwPlaceholder')}
              className="w-full px-3 py-2 border-2 border-mem-ink rounded-xl text-sm font-bold bg-white"
            />
            <input
              type="password"
              value={ownerPw}
              onChange={(e) => setOwnerPw(e.target.value)}
              placeholder={t('pdfcenter.batch.ownerPwPlaceholder')}
              className="w-full px-3 py-2 border-2 border-mem-ink rounded-xl text-sm font-bold bg-white"
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-mem-ink/70">
              {([
                ['print', t('pdfcenter.batch.permPrint')],
                ['copy', t('pdfcenter.batch.permCopy')],
                ['modify', t('pdfcenter.batch.permModify')],
                ['fill', t('pdfcenter.batch.permFill')],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={perms[key]}
                    onChange={(e) => setPerms((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4 accent-mem-sky"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}
        {opId === 'pdf-to-ppt' && (
          <div className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
            <span className="shrink-0">DPI</span>
            <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))} className="px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
              {[96, 120, 144, 150, 200].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <select value={pptFormat} onChange={(e) => setPptFormat(e.target.value as 'png' | 'jpeg')} className="px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
            </select>
          </div>
        )}
        {opId === 'ocr-export' && (
          <div className="flex items-center gap-2 text-xs font-bold text-mem-ink/70">
            <span className="shrink-0">{t('convert.ocrOutput')}</span>
            <select value={ocrOut} onChange={(e) => setOcrOut(e.target.value as 'txt' | 'pdf')} className="px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
              <option value="txt">TXT</option>
              <option value="pdf">{t('convert.ocrOutputPdf')}</option>
            </select>
            <span className="shrink-0">DPI</span>
            <select value={dpi} onChange={(e) => setDpi(Number(e.target.value))} className="px-2 py-1 border-2 border-mem-ink rounded-lg bg-white">
              {[150, 200, 300].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </div>
        )}
      </>
    )
  }

  const gateNote =
    opId === 'ocr-export' && !!caps && !caps.rapidocr ? t('convert.ocrUnavailable') : null

  return (
    <BatchEngine      center="pdf"
      titleKey="tools.pdfBatch"
      hintKey="pdfcenter.batch.hint"
      unsupportedKey="pdfcenter.batch.unsupported"
      ops={PDF_BATCH_OPS}
      getEngineAvailability={getAvailability}
      runOp={runPdfOp}
      paramControls={paramControls}
      extraValidate={extraValidate}
      gateNote={gateNote}
      onOpChange={handleOpChange}
      accent="sky"
      icon={<Layers className="w-5 h-5 text-mem-sky" />}
    />
  )
}
