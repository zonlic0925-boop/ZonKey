/**
 * 通用批处理编排器（批处理引擎 · 第二期：图像/PPT 中心接入）。
 *
 * 一期（PDF 工坊试水）的经验教训全部内建：
 * - 编排/进度/状态行/停止/汇总/ZIP 打包一次实现，跨中心复用；
 * - 中心差异收敛到 `BatchOpDef` 注册表 + `runOp` 分支 + i18n，与二期
 *   「只改注册表+分支+i18n 三处」的扩展约定一致（见 docs/AGENTS_HANDOFF.md）；
 * - 交付走统一出口 `downloadBlob`（桌面壳=服务端中转+原生另存为，浏览器=a[download]），
 *   ZIP 与产物在各端行为一致；
 * - `getEngineAvailability` 探活失败即视为离线：离线只禁「需要后端引擎」的操作，
 *   client 类操作照常可用（浏览器本地处理卖点成立）。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FilePlus2, Layers, Package, Square, X } from 'lucide-react'
import JSZip from 'jszip'
import { useI18n } from '../../i18n'
import { MemphisButton } from './MemphisButton'
import { ErrorLine } from '../calcdev/kit'
import { CapabilityGate, MediaOutputList, ProgressBar } from '../mediacenter/mediaKit'
import type { MediaJobOutput } from '../../lib/api'
import { downloadBlob } from '../../lib/deliver'
import type { Vars } from '../../i18n/context'

export type BatchCenter = 'pdf' | 'image' | 'ppt'
export type BatchKind = 'client' | 'server'
export type BatchStatus = 'pending' | 'running' | 'ok' | 'failed' | 'skipped'

export interface BatchOpDef {
  id: string
  /** 分组（i18n 键 `<center>Groups.<group>`），分组顺序=数组顺序 */
  group: string
  /** client = 浏览器内处理（ZIP 交付）；server = 后端引擎处理（output/ 交付） */
  kind: BatchKind
  accept: string
  labelKey: string
  /** 需要后端引擎在线的依赖（key 存在于 getEngineAvailability 返回里且为 false 时禁用） */
  requiresEngine?: string[]
}

export interface BatchEngineProps {
  center: BatchCenter
  titleKey: string
  hintKey: string
  unsupportedKey: string
  ops: BatchOpDef[]
  /** 探活：返回 null = 后端离线 */
  getEngineAvailability: () => Promise<Record<string, boolean> | null>
  runOp: (def: BatchOpDef, file: File) => Promise<BatchOpOutput[]>
  /** 操作特有校验（如密码/水印文字缺失），返回错误文案或 null */
  extraValidate?: (
    op: BatchOpDef,
    files: BatchPickedFile[],
    t: (key: string, vars?: Vars) => string
  ) => string | null
  /** 额外的禁用提示（如 OCR 引擎缺失），非 null 时显示并禁用开始 */
  gateNote?: string | null
  /** 当前选中操作变更通知（供外部派生禁用提示等） */
  onOpChange?: (opId: string | null) => void
  /** 参数控件（按需渲染） */
  paramControls?: (ctx: BatchParamCtx) => React.ReactNode
  /** 文件行内嵌缩略图（图像中心传入，其余省略） */
  fileThumb?: (file: File) => React.ReactNode
  accent?: 'sky' | 'yellow' | 'orange'
  icon?: React.ReactNode
}

export interface BatchParamCtx {
  def: BatchOpDef
  groupLabel: (group: string) => string
  t: (key: string, vars?: Vars) => string
}

export interface BatchPickedFile {
  file: File
  name: string
  size: number
}

export interface BatchOpOutput {
  /** blob 产物名（走 ZIP 打包交付） */
  fileName?: string
  blob?: Blob
  /** 服务端产物（output/ 交付列表），与 blob 二选一 */
  outputs?: MediaJobOutput[]
}

/** 内置通用文件选择器（跨中心同款交互：追加式多选、逐行删除、KB 大小） */
export const BatchFilePicker: React.FC<{
  accept: string
  multiple: boolean
  files: BatchPickedFile[]
  onChange: (files: BatchPickedFile[]) => void
  pickLabel: string
  thumb?: (file: File) => React.ReactNode
}> = ({ accept, multiple = false, files, onChange, pickLabel, thumb }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).map((file) => ({ file, name: file.name, size: file.size }))
          onChange(multiple ? [...files, ...picked] : picked.slice(0, 1))
          e.target.value = ''
        }}
      />
      <MemphisButton variant="white" size="sm" icon={<FilePlus2 className="w-4 h-4" />} onClick={() => inputRef.current?.click()}>
        {pickLabel}
      </MemphisButton>
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((picked, index) => (
            <li
              key={`${picked.name}-${index}`}
              className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl text-xs"
            >
              <span className="flex items-center gap-2 min-w-0">
                {thumb?.(picked.file)}
                <span className="font-mono font-bold truncate">{picked.name}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-mem-ink/60">{(picked.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  onClick={() => onChange(files.filter((_, i) => i !== index))}
                  className="p-0.5 rounded-md border border-mem-ink/30 hover:bg-mem-coral/20"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface BatchRow {
  id: string
  name: string
  status: BatchStatus
  message?: string
}

interface ZipResult {
  blob: Blob
  name: string
  count: number
}

/** 通用运行前校验：空队列/扩展名失配。返回错误文案或 null */
export function validateBatchSelection(
  op: BatchOpDef,
  files: BatchPickedFile[],
  t: (key: string, vars?: Vars) => string
): string | null {
  if (!files.length) return t('batchEngine.errNoFiles')
  const exts = op.accept.split(',')
  for (const picked of files) {
    const lower = picked.name.toLowerCase()
    const ok = exts.some((ext) => {
      const clean = ext.trim().replace(/^\./, '.').toLowerCase()
      return lower.endsWith(clean)
    })
    if (!ok) return t('batchEngine.errTypeMismatch', { name: picked.name })
  }
  return null
}

export const BatchEngine: React.FC<BatchEngineProps> = ({
  center,
  titleKey,
  hintKey,
  unsupportedKey,
  ops,
  getEngineAvailability,
  runOp,
  paramControls,
  extraValidate,
  gateNote,
  onOpChange,
  fileThumb,
  accent = 'sky',
  icon,
}) => {
  const { t } = useI18n()
  const [opId, setOpId] = useState<string | null>(null)
  const [files, setFiles] = useState<BatchPickedFile[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<BatchRow[]>([])
  const [zipResult, setZipResult] = useState<ZipResult | null>(null)
  const [serverOutputs, setServerOutputs] = useState<MediaJobOutput[]>([])
  const [doneSummary, setDoneSummary] = useState<string | null>(null)
  const [avail, setAvail] = useState<Record<string, boolean> | null>(null)
  const stopRef = useRef(false)

  useEffect(() => {
    let alive = true
    getEngineAvailability()
      .then((value) => {
        if (alive) setAvail(value)
      })
      .catch(() => {
        if (alive) setAvail(null)
      })
    return () => {
      alive = false
    }
    // 仅启动时探活一次（探活属一次性能力声明，不随渲染重跑）
  }, [])

  const op = useMemo(() => ops.find((o) => o.id === opId) ?? null, [opId, ops])
  useEffect(() => {
    onOpChange?.(opId)
  }, [opId, onOpChange])
  const needsBackend = !!op && (op.kind === 'server' || !!op.requiresEngine?.length)
  const backendBlocked = needsBackend && !avail
  const gateBlocked = backendBlocked || !!gateNote
  const groups = useMemo(() => [...new Set(ops.map((o) => o.group))], [ops])

  const groupLabel = (group: string) => {
    const prefix = center === 'pdf' ? 'pdfGroups' : center === 'image' ? 'imageGroups' : 'pptGroups'
    return t(`${prefix}.${group}`)
  }

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
    if (!op) return t('batchEngine.errNoOp')
    const base = validateBatchSelection(op, files, t)
    if (base) return base
    return extraValidate ? extraValidate(op, files, t) : null
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
          setRows((prev) =>
            prev.map((row, i) =>
              i >= index && row.status === 'pending' ? { ...row, status: 'skipped' } : row
            )
          )
          break
        }
        const picked = files[index]
        setRows((prev) => prev.map((row, i) => (i === index ? { ...row, status: 'running' } : row)))
        try {
          const produced = await runOp(def, picked.file)
          for (const result of produced) {
            if (result.outputs?.length) {
              outputs.push(...result.outputs)
            } else if (result.blob && result.fileName) {
              clientOutputs.push({ fileName: result.fileName, bytes: new Uint8Array(await result.blob.arrayBuffer()) })
            } else {
              throw new Error('batch op produced no deliverable output')
            }
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
        const zip = new JSZip()
        for (const out of clientOutputs) zip.file(out.fileName, out.bytes)
        const blob = await zip.generateAsync({ type: 'blob' })
        setZipResult({ blob, name: `ZonKey_batch_${def.id}_${stamp}.zip`, count: clientOutputs.length })
      }
      if (outputs.length > 0) setServerOutputs(outputs)
      setDoneSummary(t('batchEngine.doneSummary', { ok: okCount, fail: failCount }))
      if (stopRef.current) setError(t('batchEngine.stoppedNote'))
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

  const statusChip = (status: BatchStatus) => {
    const map: Record<BatchStatus, { label: string; cls: string }> = {
      pending: { label: t('batchEngine.rowPending'), cls: 'bg-white text-mem-ink/50 border-mem-ink/30' },
      running: { label: t('batchEngine.rowRunning'), cls: 'bg-mem-sky/20 text-mem-ink border-mem-sky animate-pulse' },
      ok: { label: t('batchEngine.rowOk'), cls: 'bg-mem-teal/20 text-mem-ink border-mem-teal' },
      failed: { label: t('batchEngine.rowFailed'), cls: 'bg-mem-coral/20 text-mem-ink border-mem-coral' },
      skipped: { label: t('batchEngine.rowSkipped'), cls: 'bg-mem-yellow/20 text-mem-ink/70 border-mem-yellow' },
    }
    const chip = map[status]
    return <span className={`shrink-0 px-1.5 py-0.5 rounded-md border-2 text-[10px] font-black ${chip.cls}`}>{chip.label}</span>
  }

  const groupFilter = (group: string) => ops.filter((o) => o.group === group)
  const paramCtx: BatchParamCtx = { def: op!, groupLabel, t }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        {icon ?? <Layers className="w-5 h-5 text-mem-sky" />}
        <h3 className="font-display font-black text-mem-ink">{t(titleKey)}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t(hintKey)}</p>
      <p className="text-xs text-mem-ink/40 font-medium">{t(unsupportedKey)}</p>

      <section className="space-y-2">
        <p className="text-xs font-bold text-mem-ink/60 uppercase">{t('batchEngine.step1')}</p>
        {groups.map((group) => {
          const groupOps = groupFilter(group)
          if (!groupOps.length) return null
          return (
            <div key={group} className="flex items-start gap-2">
              <span className="shrink-0 w-14 pt-1.5 text-[11px] font-black text-mem-ink/50">{groupLabel(group)}</span>
              <div className="flex flex-wrap gap-1.5">
                {groupOps.map((o) => (
                  <MemphisButton
                    key={o.id}
                    size="sm"
                    variant={opId === o.id ? accent : 'white'}
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
              {t('batchEngine.step2')}
              <span className="ml-2 text-mem-ink/40 normal-case">{t('batchEngine.fileCount', { count: files.length })}</span>
            </p>
            <BatchFilePicker
              accept={op.accept}
              multiple
              files={files}
              onChange={setFiles}
              pickLabel={t('batchEngine.addFiles')}
              thumb={fileThumb}
            />
          </section>

          <section className="space-y-2">
            <p className="text-xs font-bold text-mem-ink/60 uppercase">{t('batchEngine.step3')}</p>
            {paramControls ? paramControls(paramCtx) : null}
          </section>

          {needsBackend && <p className="text-xs font-bold text-mem-ink/50">{t('batchEngine.serverNote')}</p>}
          {backendBlocked && <CapabilityGate ok={false} message={t('batchEngine.offlineNote')} />}
          {gateNote && <CapabilityGate ok={false} message={gateNote} />}

          <div className="flex items-center gap-2">
            <MemphisButton variant={accent} onClick={run} disabled={busy || !files.length || gateBlocked}>
              {t('batchEngine.start')}
            </MemphisButton>
            {busy && (
              <MemphisButton variant="coral" icon={<Square className="w-3.5 h-3.5" />} onClick={stop}>
                {t('batchEngine.stop')}
              </MemphisButton>
            )}
          </div>

          {busy && totalCount > 0 && (
            <div className="space-y-1">
              <ProgressBar progress={Math.round((completedCount / totalCount) * 100)} />
              <p className="text-xs font-bold text-mem-ink/60">
                {t('batchEngine.running', { current: Math.min(completedCount + 1, totalCount), total: totalCount })}
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
                {t('batchEngine.zipReady', { count: zipResult.count })}
              </span>
              <MemphisButton size="sm" variant="teal" onClick={() => downloadBlob(zipResult.blob, zipResult.name)}>
                {t('batchEngine.saveZip')}
              </MemphisButton>
            </div>
          )}

          {serverOutputs.length > 0 && <MediaOutputList outputs={serverOutputs} />}
        </>
      )}
    </div>
  )
}
