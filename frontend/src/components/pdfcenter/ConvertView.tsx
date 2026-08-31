import React, { useEffect, useState } from 'react'
import { FileOutput } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { ErrorLine } from '../calcdev/kit'
import { CapabilityGate, MediaOutputList, ProgressBar } from '../mediacenter/mediaKit'
import {
  convertHtmlToPdf,
  convertRepair,
  getConvertCapability,
  pollConvertJob,
  startConvertJob,
  type ConvertCapability,
  type ConvertJobStatus,
  type ConvertOp,
} from '../../lib/api'
import { downloadBlob } from '../../lib/deliver'
import { WEB_SUPPORTED_OPS, runWebConversion, type WebConvertResult } from '../../lib/toolknit/convertWebCore'

const OPS: ConvertOp[] = [
  'pdf-to-word',
  'pdf-to-excel',
  'pdf-to-ppt',
  'office-to-pdf',
  'compress-deep',
  'ocr-export',
]

const DPI_CHOICES = [96, 120, 144, 150, 200]
const QUALITY_CHOICES = [50, 60, 70, 80, 90]

const ACCEPT: Record<string, string> = {
  'pdf-to-word': '.pdf',
  'pdf-to-excel': '.pdf',
  'pdf-to-ppt': '.pdf',
  'office-to-pdf': '.docx,.doc,.xlsx,.xls',
  'compress-deep': '.pdf',
  'ocr-export': '.pdf',
  'pdf-repair': '.pdf',
  'html-to-pdf': '.html,.htm,.md,.markdown,.txt',
}

/** 文档转换工坊：8 个后端转换工具（job 轮询 + 同步端点），产物落 output/ 走统一交付 */
export const ConvertView: React.FC<{ op: string }> = ({ op }) => {
  const { t } = useI18n()
  const [caps, setCaps] = useState<ConvertCapability | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [dpi, setDpi] = useState(144)
  const [quality, setQuality] = useState(70)
  const [ocrOut, setOcrOut] = useState<'txt' | 'pdf'>('txt')
  const [pptFormat, setPptFormat] = useState<'png' | 'jpeg'>('png')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<ConvertJobStatus | null>(null)
  const [outputs, setOutputs] = useState<{ name: string; dir: string }[]>([])
  const [webResult, setWebResult] = useState<WebConvertResult | null>(null)
  const [webStage, setWebStage] = useState('')

  useEffect(() => {
    getConvertCapability().then(setCaps).catch(() => setCaps(null))
  }, [])

  // 切工具时清空运行态，保留能力探测
  useEffect(() => {
    setFile(null)
    setContent('')
    setError(null)
    setJob(null)
    setOutputs([])
    setWebResult(null)
    setWebStage('')
  }, [op])

  const isRepair = op === 'pdf-repair'
  const isHtml = op === 'html-to-pdf'
  const isJobOp = !isRepair && !isHtml

  // 后端离线时：浏览器引擎可承接的工具自动降级，其余引导桌面版
  const backendOffline = !caps
  const webFallback = backendOffline && WEB_SUPPORTED_OPS.has(op)

  const run = async () => {
    setBusy(true)
    setError(null)
    setJob(null)
    setOutputs([])
    setWebResult(null)
    setWebStage('')
    try {
      if (webFallback) {
        if (!file && !(isHtml && content.trim())) throw new Error(t('convert.errNoFile'))
        const result = await runWebConversion(op, file, {
          dpi,
          quality,
          imageFormat: pptFormat,
          content,
          title,
        }, (stage) => setWebStage(stage))
        setWebResult(result)
        await downloadBlob(result.blob, result.filename)
        return
      }
      if (isRepair) {
        if (!file) throw new Error(t('convert.errNoFile'))
        const result = await convertRepair(file)
        setOutputs([{ name: result.download_name, dir: result.output_dir }])
      } else if (isHtml) {
        if (!file && !content.trim()) throw new Error(t('convert.errNoInput'))
        const result = await convertHtmlToPdf({ content, file, title: title || undefined })
        setOutputs([{ name: result.download_name, dir: result.output_dir }])
      } else {
        if (!file) throw new Error(t('convert.errNoFile'))
        const started = await startConvertJob(op as ConvertOp, file, {
          dpi,
          quality,
          imageFormat: pptFormat,
          ocrOutput: ocrOut,
        })
        const final = await pollConvertJob(started.job_id, (s) => setJob(s))
        if (final.status === 'error') {
          setError(final.error || t('convert.failed'))
        } else {
          setOutputs(final.outputs)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('convert.failed'))
    } finally {
      setBusy(false)
    }
  }

  const gateMessage = caps
    ? ''
    : webFallback
      ? ''
      : t('convert.backendOffline')
  const ocrBlocked = isJobOp && op === 'ocr-export' && !!caps && !caps.rapidocr
  // 浏览器兜底模式下也允许粘贴内容（html-to-pdf）
  const inputBlocked = busy || (webFallback
    ? false
    : (!!caps && ocrBlocked) || (!file && !(isHtml && content.trim())))

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <FileOutput className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t(`convert.op.${op}`)}</h3>
      </div>
      <p className="text-xs font-bold text-mem-ink/60">{t(`convert.hint.${op}`)}</p>

      <CapabilityGate ok={!!caps} message={gateMessage} />
      {webFallback && (
        <div className="px-4 py-3 border-2 border-mem-ink rounded-xl bg-mem-sky/20 text-xs font-bold text-mem-ink">
          {t('convert.webEngineNote')}
        </div>
      )}
      {backendOffline && !webFallback && (
        <div className="px-4 py-3 border-2 border-mem-ink rounded-xl bg-mem-sky/20 text-xs font-bold text-mem-ink">
          {t('convert.desktopOnlyNote')}
        </div>
      )}
      {ocrBlocked && <CapabilityGate ok={false} message={t('convert.ocrUnavailable')} />}

      <input
        type="file"
        accept={ACCEPT[op] || ''}
        disabled={busy}
        onChange={(e) => {
          const picked = e.target.files?.[0]
          setFile(picked || null)
          e.target.value = ''
        }}
        className="block w-full text-xs font-mono file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-2 file:border-mem-ink file:bg-white file:font-bold file:cursor-pointer cursor-pointer border-2 border-mem-ink rounded-xl p-1.5 bg-white"
      />
      {file && (
        <p className="text-xs font-bold font-mono text-mem-ink/70">
          {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
        </p>
      )}

      {isHtml && (
        <>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('convert.htmlTitlePlaceholder')}
            className="w-full text-xs font-bold border-2 border-mem-ink rounded-xl px-3 py-2 bg-white placeholder:text-mem-ink/40"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder={t('convert.htmlContentPlaceholder')}
            className="w-full text-xs font-mono border-2 border-mem-ink rounded-xl px-3 py-2 bg-white placeholder:text-mem-ink/40"
          />
          <p className="text-xs font-bold text-mem-ink/60">{t('convert.htmlOptionalFile')}</p>
        </>
      )}

      {op === 'pdf-to-ppt' && (
        <ParamRow label={t('convert.dpi')}>
          {DPI_CHOICES.map((v) => (
            <Chip key={v} active={dpi === v} onClick={() => setDpi(v)} label={String(v)} />
          ))}
          <Chip active={pptFormat === 'png'} onClick={() => setPptFormat('png')} label="PNG" />
          <Chip active={pptFormat === 'jpeg'} onClick={() => setPptFormat('jpeg')} label="JPEG" />
        </ParamRow>
      )}

      {op === 'compress-deep' && (
        <>
          <ParamRow label={t('convert.dpi')}>
            {DPI_CHOICES.filter((v) => v <= 200).map((v) => (
              <Chip key={v} active={dpi === v} onClick={() => setDpi(v)} label={String(v)} />
            ))}
          </ParamRow>
          <ParamRow label={t('convert.quality')}>
            {QUALITY_CHOICES.map((v) => (
              <Chip key={v} active={quality === v} onClick={() => setQuality(v)} label={String(v)} />
            ))}
          </ParamRow>
        </>
      )}

      {op === 'ocr-export' && (
        <>
          <ParamRow label={t('convert.ocrOutput')}>
            <Chip active={ocrOut === 'txt'} onClick={() => setOcrOut('txt')} label="TXT" />
            <Chip active={ocrOut === 'pdf'} onClick={() => setOcrOut('pdf')} label={t('convert.ocrOutputPdf')} />
          </ParamRow>
          <ParamRow label={t('convert.dpi')}>
            {[150, 200, 300].map((v) => (
              <Chip key={v} active={dpi === v} onClick={() => setDpi(v)} label={String(v)} />
            ))}
          </ParamRow>
        </>
      )}

      <MemphisButton variant="sky" onClick={run} disabled={inputBlocked}>
        {busy ? t('convert.running') : t('convert.start')}
      </MemphisButton>

      {busy && webFallback && webStage && (
        <p className="text-xs font-bold text-mem-ink/60">{t('convert.stage', { stage: webStage })}</p>
      )}
      {busy && job && (
        <div className="space-y-1">
          <ProgressBar progress={job.progress} />
          <p className="text-xs font-bold text-mem-ink/60">
            {t('convert.stage', { stage: job.stage })}
          </p>
        </div>
      )}
      <ErrorLine message={error} />

      {job?.status === 'done' && (
        <div className="space-y-1">
          <p className="text-xs font-bold text-mem-teal">{t('convert.done')}</p>
          {job.engine && <p className="text-xs font-bold text-mem-ink/60">{t('convert.engine', { engine: job.engine })}</p>}
          {typeof job.compression_ratio_pct === 'number' && (
            <p className="text-xs font-bold text-mem-ink/60">
              {t('convert.sizeResult', {
                origin: Math.round((job as { original_bytes?: number }).original_bytes! / 1024),
                now: Math.round(((job as { compressed_bytes?: number }).compressed_bytes ?? 0) / 1024),
                ratio: job.compression_ratio_pct,
              })}
            </p>
          )}
          {job.note && <p className="text-xs font-bold text-mem-ink/70">{job.note}</p>}
        </div>
      )}
      {webResult && !busy && (
        <div className="space-y-1">
          <p className="text-xs font-bold text-mem-teal">{t('convert.done')}</p>
          <p className="text-xs font-bold text-mem-ink/60">{t('convert.engine', { engine: webResult.engine })}</p>
          <p className="text-xs font-bold text-mem-ink/70">{t('convert.webDownloaded', { name: webResult.filename })}</p>
          <MemphisButton
            variant="paper"
            onClick={() => downloadBlob(webResult.blob, webResult.filename)}
          >
            {t('mediaJob.download')}
          </MemphisButton>
        </div>
      )}
      {outputs.length > 0 && !busy && <MediaOutputList outputs={outputs} />}
    </div>
  )
}

const ParamRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p className="text-xs font-bold text-mem-ink/60 uppercase mb-1.5">{label}</p>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
)

const Chip: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-black border-2 border-mem-ink rounded-lg ${
      active ? 'bg-mem-sky text-mem-ink' : 'bg-white text-mem-ink/70 hover:bg-mem-sky/30'
    }`}
  >
    {label}
  </button>
)
