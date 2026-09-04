import React, { useEffect, useMemo, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import JSZip from 'jszip'
import { Layers, Square, Package } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { ErrorLine } from '../calcdev/kit'
import { CapabilityGate, MediaOutputList, ProgressBar } from '../mediacenter/mediaKit'
import {
  getConvertCapability,
  convertRepair,
  pollConvertJob,
  startConvertJob,
  type ConvertCapability,
  type ConvertJobStatus,
  type ConvertOp,
  type MediaJobOutput,
} from '../../lib/api'
import { downloadBlob } from '../../lib/deliver'
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
import { PdfFilePicker, type PickedFile } from './pdfKit'

type BatchGroupId = 'organize' | 'convert' | 'edit' | 'security'
type BatchKind = 'client' | 'server' | 'repair' | 'protect'

interface BatchOpDef {
  id: string
  group: BatchGroupId
  kind: BatchKind
  accept: string
  labelKey: string
  convertOp?: ConvertOp
}

const BATCH_OPS: BatchOpDef[] = [
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
  { id: 'pdf-repair', group: 'convert', kind: 'repair', accept: '.pdf', labelKey: 'tools.pdfRepair' },
  { id: 'pdf-watermark', group: 'edit', kind: 'client', accept: '.pdf', labelKey: 'tools.pdfWatermark' },
  { id: 'pdf-encrypt', group: 'security', kind: 'protect', accept: '.pdf', labelKey: 'tools.pdfEncrypt' },
  { id: 'pdf-decrypt', group: 'security', kind: 'client', accept: '.pdf', labelKey: 'tools.pdfDecrypt' },
]

const BATCH_GROUPS: BatchGroupId[] = ['organize', 'convert', 'edit', 'security']

const WM_COLORS = ['#808080', '#111111', '#dc2626', '#2563eb']
const NUMBER_POSITIONS: PdfPageNumberPosition[] = ['bottom-center', 'bottom-right', 'bottom-left', 'top-center', 'top-right', 'top-left']
const NUMBER_FORMATS: PdfPageNumberFormat[] = ['plain', 'slash', 'page']
const ENHANCE_MODES: PdfEnhanceMode[] = ['contrast', 'grayscale', 'binarize']

interface BatchRow {
  id: string
  name: string
  status: 'pending' | 'running' | 'ok' | 'failed' | 'skipped'
  message?: string
}

interface ZipResult {
  blob: Blob
  name: string
  count: number
}

/** 批处理引擎（第一期 · PDF 工坊试水）：逐文件顺序编排，本地产物打包 ZIP、服务端产物走统一交付列表 */
export const PdfBatchView: React.FC = () => {
  const { t } = useI18n()
  const [opId, setOpId] = useState<string | null>(null)
  const [files, setFiles] = useState<PickedFile[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<BatchRow[]>([])
  const [zipResult, setZipResult] = useState<ZipResult | null>(null)
  const [serverOutputs, setServerOutputs] = useState<MediaJobOutput[]>([])
  const [caps, setCaps] = useState<ConvertCapability | null>(null)
  const [doneSummary, setDoneSummary] = useState<string | null>(null)
  const stopRef = useRef(false)

  // 操作参数（选中操作后按需读取）
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

  useEffect(() => {
    getConvertCapability().then(setCaps).catch(() => setCaps(null))
  }, [])

  const op = useMemo(() => BATCH_OPS.find((o) => o.id === opId) ?? null, [opId])
  const needsBackend = !!op && (op.kind === 'server' || op.kind === 'repair' || op.kind === 'protect')
  const backendBlocked = needsBackend && !caps
  const ocrBlocked = opId === 'ocr-export' && !!caps && !caps.rapidocr

  const selectOp = (id: string) => {
    setOpId(id)
    setRows([])
    setZipResult(null)
    setServerOutputs([])
    setDoneSummary(null)
    setError(null)
  }

  const resetRunState = () => {
    setZipResult(null)
    setServerOutputs([])
    setDoneSummary(null)
    setError(null)
  }

  const validate = (): string | null => {
    if (!op) return t('pdfcenter.batch.errNoOp')
    if (!files.length) return t('pdfcenter.batch.errNoFiles')
    const exts = op.accept.split(',')
    for (const picked of files) {
      const lower = picked.name.toLowerCase()
      if (!exts.some((ext) => lower.endsWith(ext.replace(/^\./, '.')) || lower.endsWith(ext))) {
        return t('pdfcenter.batch.errTypeMismatch', { name: picked.name })
      }
    }
    if (opId === 'pdf-watermark' && wmType === 'text' && !wmText.trim()) return t('pdfcenter.batch.needWatermarkText')
    if (opId === 'pdf-watermark' && wmType === 'image' && !wmImage) return t('pdfcenter.batch.needWatermarkImage')
    if (opId === 'pdf-decrypt' && !password.trim()) return t('pdfcenter.batch.needPassword')
    if (opId === 'pdf-encrypt' && !userPw.trim() && !ownerPw.trim()) return t('pdfcenter.batch.needOwnerPassword')
    if (opId === 'pdf-extract' && !rangeInput.trim()) return t('pdfcenter.batch.needRange')
    return null
  }

  /** 本地 op：单文件 → 若干产物字节（全部在浏览器内完成） */
  const runClientOp = async (def: BatchOpDef, picked: PickedFile): Promise<{ fileName: string; bytes: Uint8Array }[]> => {
    const fileData = new Uint8Array(await picked.file.arrayBuffer())
    const base = picked.name.replace(/\.pdf$/i, '')
    switch (def.id) {
      case 'pdf-compress': {
        const out = await compressPdfFile(fileData, level)
        return [{ fileName: `${base}_compressed.pdf`, bytes: out }]
      }
      case 'pdf-rotate': {
        const doc = await PDFDocument.load(fileData.slice())
        const pages = Array.from({ length: doc.getPageCount() }, (_, i) => ({ pageIndex: i + 1, rotation: angle }))
        const out = await rotatePdfPages({ fileData, pages })
        return [{ fileName: `${base}_rotated.pdf`, bytes: out }]
      }
      case 'pdf-watermark': {
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
        return [{ fileName: createPdfWatermarkedFileName(picked.name), bytes: out }]
      }
      case 'pdf-decrypt': {
        const out = await decryptPdfFile(fileData, password)
        return [{ fileName: `${base}_decrypted.pdf`, bytes: out }]
      }
      case 'pdf-page-numbers': {
        const out = await addPageNumbers({ fileData, position, format: numberFormat })
        return [{ fileName: createPdfNumberedFileName(picked.name), bytes: out }]
      }
      case 'pdf-enhance': {
        const out = await enhancePdfScan({ fileData, mode: enhanceMode })
        return [{ fileName: createPdfEnhancedFileName(picked.name), bytes: out }]
      }
      case 'pdf-crop': {
        const out = await cropPdfPages({ fileData, marginPercent })
        return [{ fileName: createPdfCroppedFileName(picked.name), bytes: out }]
      }
      case 'pdf-split': {
        const doc = await PDFDocument.load(fileData.slice())
        const documents = [{ fileName: picked.name, fileData }]
        const pages = Array.from({ length: doc.getPageCount() }, (_, i) => ({ fileIndex: 0, pageIndex: i + 1 }))
        const parts = await splitPdfPages({ documents, pages })
        return parts.map((part) => ({ fileName: part.fileName, bytes: part.bytes }))
      }
      case 'pdf-extract': {
        const doc = await PDFDocument.load(fileData.slice())
        const ranges = parsePdfPageRanges(rangeInput.trim(), doc.getPageCount())
        const out = await extractPdfPages({ fileData, sourceName: picked.name, ranges })
        return [{ fileName: createPdfExtractedFileName(picked.name), bytes: out }]
      }
      case 'pdf-to-image': {
        const images = await pdfToImages({ fileData, sourceName: picked.name, format: imgFormat, scale: imgScale })
        return images.map((image) => ({ fileName: image.fileName, bytes: image.bytes }))
      }
      default:
        throw new Error(`unsupported client op: ${def.id}`)
    }
  }

  /** 保护 op：走后端同步端点（加密算法在引擎侧），单文件 → 单产物字节 */
  const runProtectOp = async (picked: PickedFile): Promise<{ fileName: string; bytes: Uint8Array }[]> => {
    const out = await encryptPdfFileAdvanced(picked.file, userPw, ownerPw.trim() || userPw, perms)
    const base = picked.name.replace(/\.pdf$/i, '')
    return [{ fileName: `${base}_encrypted.pdf`, bytes: out }]
  }

  /** 服务端 op：复用现有 convert job 队列，逐个文件起任务，产物落 output/ 走统一交付 */
  const runServerOp = async (def: BatchOpDef, picked: PickedFile, outputs: MediaJobOutput[]): Promise<void> => {
    if (def.kind === 'repair') {
      const result = await convertRepair(picked.file)
      outputs.push({ name: result.download_name, dir: result.output_dir })
      return
    }
    const started = await startConvertJob(def.convertOp as ConvertOp, picked.file, {
      dpi,
      quality,
      imageFormat: pptFormat,
      ocrOutput: ocrOut,
    })
    const final: ConvertJobStatus = await pollConvertJob(started.job_id, () => {})
    if (final.status === 'error') {
      throw new Error(final.error || t('convert.failed'))
    }
    outputs.push(...final.outputs)
  }

  const run = async () => {
    const invalid = validate()
    if (invalid) {
      setError(invalid)
      return
    }
    const def = op!
    stopRef.current = false
    setBusy(true)
    resetRunState()
    const initialRows: BatchRow[] = files.map((picked, index) => ({
      id: `${picked.name}-${index}`,
      name: picked.name,
      status: 'pending',
    }))
    setRows(initialRows)

    const clientOutputs: { fileName: string; bytes: Uint8Array }[] = []
    const outputs: MediaJobOutput[] = []
    let okCount = 0
    let failCount = 0
    try {
      for (let index = 0; index < files.length; index += 1) {
        if (stopRef.current) {
          setRows((prev) => prev.map((row, i) => (i > index - 1 && row.status === 'pending' ? { ...row, status: 'skipped' } : row)))
          break
        }
        const picked = files[index]
        setRows((prev) => prev.map((row, i) => (i === index ? { ...row, status: 'running' } : row)))
        try {
          if (def.kind === 'client') {
            clientOutputs.push(...(await runClientOp(def, picked)))
          } else if (def.kind === 'protect') {
            clientOutputs.push(...(await runProtectOp(picked)))
          } else {
            await runServerOp(def, picked, outputs)
          }
          okCount += 1
          setRows((prev) => prev.map((row, i) => (i === index ? { ...row, status: 'ok' } : row)))
        } catch (err) {
          failCount += 1
          const message = err instanceof Error ? err.message : String(err)
          setRows((prev) => prev.map((row, i) => (i === index ? { ...row, status: 'failed', message } : row)))
        }
      }
      if (clientOutputs.length > 0) {
        const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
        const zipName = `ZonKey_batch_${def.id}_${stamp}.zip`
        const zip = new JSZip()
        for (const out of clientOutputs) zip.file(out.fileName, out.bytes)
        const blob = await zip.generateAsync({ type: 'blob' })
        setZipResult({ blob, name: zipName, count: clientOutputs.length })
      }
      if (outputs.length > 0) setServerOutputs(outputs)
      setDoneSummary(t('pdfcenter.batch.doneSummary', { ok: okCount, fail: failCount }))
      if (stopRef.current) setError(t('pdfcenter.batch.stoppedNote'))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const stop = () => {
    stopRef.current = true
  }

  const completedCount = rows.filter((row) => row.status === 'ok' || row.status === 'failed').length
  const totalCount = rows.length

  const statusChip = (status: BatchRow['status']) => {
    const map: Record<BatchRow['status'], { label: string; cls: string }> = {
      pending: { label: t('pdfcenter.batch.rowPending'), cls: 'bg-white text-mem-ink/50 border-mem-ink/30' },
      running: { label: t('pdfcenter.batch.rowRunning'), cls: 'bg-mem-sky/20 text-mem-ink border-mem-sky animate-pulse' },
      ok: { label: t('pdfcenter.batch.rowOk'), cls: 'bg-mem-teal/20 text-mem-ink border-mem-teal' },
      failed: { label: t('pdfcenter.batch.rowFailed'), cls: 'bg-mem-coral/20 text-mem-ink border-mem-coral' },
      skipped: { label: t('pdfcenter.batch.rowSkipped'), cls: 'bg-mem-yellow/20 text-mem-ink/70 border-mem-yellow' },
    }
    const chip = map[status]
    return (
      <span className={`shrink-0 px-1.5 py-0.5 rounded-md border-2 text-[10px] font-black ${chip.cls}`}>{chip.label}</span>
    )
  }

  const numberPositionLabel = (value: PdfPageNumberPosition) => t(`pdfcenter.batch.pos_${value.replace(/-/g, '_')}`)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfBatch')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.batch.hint')}</p>
      <p className="text-xs text-mem-ink/40 font-medium">{t('pdfcenter.batch.unsupported')}</p>

      <section className="space-y-2">
        <p className="text-xs font-bold text-mem-ink/60 uppercase">{t('pdfcenter.batch.step1')}</p>
        {BATCH_GROUPS.map((group) => {
          const groupOps = BATCH_OPS.filter((o) => o.group === group)
          if (!groupOps.length) return null
          return (
            <div key={group} className="flex items-start gap-2">
              <span className="shrink-0 w-14 pt-1.5 text-[11px] font-black text-mem-ink/50">{t(`pdfGroups.${group}`)}</span>
              <div className="flex flex-wrap gap-1.5">
                {groupOps.map((o) => (
                  <MemphisButton
                    key={o.id}
                    size="sm"
                    variant={opId === o.id ? 'sky' : 'white'}
                    onClick={() => selectOp(o.id)}
                    disabled={busy}
                  >
                    {t(o.labelKey)}
                  </MemphisButton>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      {op && (
        <>
          <section className="space-y-2">
            <p className="text-xs font-bold text-mem-ink/60 uppercase">
              {t('pdfcenter.batch.step2')}
              <span className="ml-2 text-mem-ink/40 normal-case">{t('pdfcenter.batch.fileCount', { count: files.length })}</span>
            </p>
            <PdfFilePicker
              multiple
              accept={op.accept}
              files={files}
              onChange={(next) => {
                setFiles(next)
                resetRunState()
                setRows([])
              }}
            />
          </section>

          <section className="space-y-2">
            <p className="text-xs font-bold text-mem-ink/60 uppercase">{t('pdfcenter.batch.step3')}</p>

            {(opId === 'pdf-compress' || opId === 'compress-deep') && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {(['low', 'medium', 'high'] as PdfCompressLevel[]).map((value) => (
                  <MemphisButton key={value} size="sm" variant={level === value ? 'sky' : 'white'} onClick={() => setLevel(value)}>
                    {t(`pdfcenter.level_${value}`)}
                  </MemphisButton>
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
                  <MemphisButton key={value} size="sm" variant={angle === value ? 'sky' : 'white'} onClick={() => setAngle(value)}>
                    +{value}°
                  </MemphisButton>
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
                    {NUMBER_POSITIONS.map((value) => <option key={value} value={value}>{numberPositionLabel(value)}</option>)}
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
                  <MemphisButton key={value} size="sm" variant={enhanceMode === value ? 'sky' : 'white'} onClick={() => setEnhanceMode(value)}>
                    {t(`pdfcenter.batch.enhance_${value}`)}
                  </MemphisButton>
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
                  <MemphisButton size="sm" variant={wmType === 'text' ? 'sky' : 'white'} onClick={() => setWmType('text')}>{t('pdfcenter.batch.wmTypeText')}</MemphisButton>
                  <MemphisButton size="sm" variant={wmType === 'image' ? 'sky' : 'white'} onClick={() => setWmType('image')}>{t('pdfcenter.batch.wmTypeImage')}</MemphisButton>
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
                    <MemphisButton size="sm" variant="sky" onClick={() => wmImageInputRef.current?.click()}>
                      {wmImage ? wmImage.name : t('pdfcenter.wmPickImage')}
                    </MemphisButton>
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
          </section>

          {needsBackend && (
            <p className="text-xs font-bold text-mem-ink/50">{t('pdfcenter.batch.serverNote')}</p>
          )}
          {backendBlocked && <CapabilityGate ok={false} message={t('pdfcenter.batch.offlineNote')} />}
          {ocrBlocked && <CapabilityGate ok={false} message={t('convert.ocrUnavailable')} />}

          <div className="flex items-center gap-2">
            <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length || backendBlocked || ocrBlocked}>
              {t('pdfcenter.batch.start')}
            </MemphisButton>
            {busy && (
              <MemphisButton variant="coral" icon={<Square className="w-3.5 h-3.5" />} onClick={stop}>
                {t('pdfcenter.batch.stop')}
              </MemphisButton>
            )}
          </div>

          {busy && totalCount > 0 && (
            <div className="space-y-1">
              <ProgressBar progress={Math.round((completedCount / totalCount) * 100)} />
              <p className="text-xs font-bold text-mem-ink/60">
                {t('pdfcenter.batch.running', { current: Math.min(completedCount + 1, totalCount), total: totalCount })}
              </p>
            </div>
          )}
          <ErrorLine message={error} />

          {doneSummary && <p className="text-xs font-bold text-mem-teal">{doneSummary}</p>}

          {rows.length > 0 && (
            <ul className="space-y-1.5">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl text-xs">
                  <span className="font-mono font-bold truncate" title={row.message || row.name}>{row.name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    {row.message && row.status === 'failed' && (
                      <span className="max-w-[220px] truncate text-mem-coral font-bold" title={row.message}>{row.message}</span>
                    )}
                    {statusChip(row.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {zipResult && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-white border-2 border-mem-ink rounded-xl text-xs">
              <span className="flex items-center gap-2 font-bold truncate">
                <Package className="w-4 h-4 text-mem-sky shrink-0" />
                {t('pdfcenter.batch.zipReady', { count: zipResult.count })}
              </span>
              <MemphisButton size="sm" variant="teal" onClick={() => downloadBlob(zipResult.blob, zipResult.name)}>
                {t('pdfcenter.batch.saveZip')}
              </MemphisButton>
            </div>
          )}

          {serverOutputs.length > 0 && <MediaOutputList outputs={serverOutputs} />}
        </>
      )}
    </div>
  )
}
