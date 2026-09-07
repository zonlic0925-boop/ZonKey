/**
 * 任务档案弹窗（round-26）——任务完成后自动弹出的统一交付仪式。
 *
 * 数据源：lib/zonkey/taskDone.ts 事件总线（subscribeTaskDone / useSyncExternalStore）。
 * 每条产物两个动作：
 * - 打开：壳内走 /api/export/open-file（os.startfile 系统默认程序）；
 *   浏览器对 image/pdf/text/zip 走新标签预览（blob URL 或 /api/download 流）。
 * - 下载：壳内走 /api/export/save-as 原生另存为；浏览器 a[download]
 *   （blob 直接下 / 服务端走 /api/download 流，手机浏览器自动进下载目录）。
 *
 * 自动弹出策略：任何任务 emitTaskDone 即弹（覆盖全工具交付层埋点）；
 * 关闭（确认/X/点遮罩）只清当前记录，下一个任务再弹。不做持久化。
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { CheckCircle2, Download, ExternalLink, FileAudio, FileImage, FileText, FileVideo, FileArchive, File as FileIcon, Save } from 'lucide-react'
import { useI18n } from '../i18n'
import {
  dismissTaskDone, getTaskDone, subscribeTaskDone,
  type TaskArtifact, type TaskDoneRecord,
} from '../lib/zonkey/taskDone'
import { buildDownloadUrl, apiFetch, openOutputFile, saveOutputFileAs } from '../lib/api'
import { downloadBlob, isShellMode, triggerServerFileDownload } from '../lib/deliver'

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  image: FileImage,
  pdf: FileText,
  zip: FileArchive,
  audio: FileAudio,
  video: FileVideo,
  text: FileText,
  file: FileIcon,
}

function formatBytes(n?: number): string {
  if (!n || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const p = (v: number) => String(v).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export const TaskDoneModal: React.FC = () => {
  const { t, locale } = useI18n()
  const record: TaskDoneRecord | null = useSyncExternalStore(subscribeTaskDone, getTaskDone)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  // blob 产物的预览/下载 URL：随记录生命周期创建与 revoke
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!record) return
    const urls: Record<string, string> = {}
    for (const a of record.artifacts) {
      if (a.blob) urls[a.name] = URL.createObjectURL(a.blob)
    }
    setBlobUrls(urls)
    return () => {
      for (const u of Object.values(urls)) URL.revokeObjectURL(u)
    }
  }, [record])

  // 另存成功提示自动消退
  useEffect(() => {
    if (!savedKey) return
    const timer = setTimeout(() => setSavedKey(null), 2500)
    return () => clearTimeout(timer)
  }, [savedKey])

  if (!record) return null

  const artifactUrl = (a: TaskArtifact): string =>
    a.blob ? blobUrls[a.name] ?? '' : buildDownloadUrl(a.outputDir, a.outputName ?? a.name)

  const open = async (a: TaskArtifact) => {
    const key = a.name
    setBusyKey(key)
    try {
      if (a.blob && !isShellMode()) {
        // 浏览器/手机：blob 产物新标签预览（图片/PDF/文本可显示）
        window.open(artifactUrl(a), '_blank')
      } else if (a.blob) {
        // 桌面壳：blob 先落盘中转（save-blob），再用系统默认程序打开
        const form = new FormData()
        form.append('file', a.blob, a.name)
        const data = await apiFetch<{ filename: string }>('/api/export/save-blob', { method: 'POST', body: form }, 300000)
        await openOutputFile(undefined, data.filename)
      } else {
        await openOutputFile(a.outputDir, a.outputName ?? a.name)
      }
    } catch {
      /* 打开失败静默——下载通道仍可用 */
    } finally {
      setBusyKey(null)
    }
  }

  const download = async (a: TaskArtifact) => {
    const key = a.name
    setBusyKey(key)
    try {
      if (a.blob) {
        // 统一交付层：壳内 = 服务端中转 + 原生另存为；浏览器 = a[download]
        const result = await downloadBlob(a.blob, a.name)
        if (result.delivered !== 'cancelled') setSavedKey(key)
      } else if (isShellMode()) {
        const result = await saveOutputFileAs(a.outputDir, a.outputName ?? a.name)
        if (!result.cancelled) setSavedKey(key)
      } else {
        triggerServerFileDownload(a.outputDir, a.outputName ?? a.name)
        setSavedKey(key)
      }
    } catch {
      /* 保持下载链接兜底 */
    } finally {
      setBusyKey(null)
    }
  }

  const timeStr = formatTime(record.finishedAt)

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-mem-ink/60"
      onClick={dismissTaskDone}
      data-testid="task-done-modal"
    >
      <div
        className="memphis-card bg-white w-full max-w-md max-h-[85dvh] flex flex-col border-4 border-mem-ink rounded-2xl shadow-memphis-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b-2 border-mem-ink bg-mem-teal/20 rounded-t-xl">
          <CheckCircle2 className="w-6 h-6 text-mem-teal shrink-0" />
          <div className="min-w-0">
            <h3 className="font-display font-black text-mem-ink leading-tight">{t('taskDone.title')}</h3>
            <p className="text-xs font-bold text-mem-ink/60 truncate">
              {record.toolLabel} · {timeStr}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissTaskDone}
            className="ml-auto w-8 h-8 shrink-0 flex items-center justify-center border-2 border-mem-ink rounded-lg font-black hover:bg-mem-coral/30"
            aria-label={t('taskDone.close')}
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4 space-y-2 overflow-y-auto">
          {record.artifacts.map((a) => {
            const Icon = KIND_ICON[a.kind] ?? FileIcon
            const sizeLabel = formatBytes(a.size ?? (a.blob ? a.blob.size : undefined))
            return (
              <div
                key={a.name}
                className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-white border-2 border-mem-ink rounded-xl"
              >
                <Icon className="w-5 h-5 text-mem-ink/70 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-xs font-bold text-mem-ink truncate">{a.name}</div>
                  {sizeLabel && <div className="text-[10px] font-bold text-mem-ink/50">{sizeLabel}</div>}
                  {savedKey === a.name && (
                    <div className="text-[10px] font-bold text-mem-teal">{t('taskDone.saved')}</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void open(a)}
                    disabled={busyKey === a.name}
                    className="flex items-center gap-1 px-2.5 py-1.5 border-2 border-mem-ink rounded-lg text-xs font-bold hover:bg-mem-coral/30 disabled:opacity-50"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('taskDone.open')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void download(a)}
                    disabled={busyKey === a.name}
                    className="flex items-center gap-1 px-2.5 py-1.5 border-2 border-mem-ink rounded-lg text-xs font-bold bg-mem-yellow/40 hover:bg-mem-yellow/60 disabled:opacity-50"
                  >
                    {a.blob ? <Download className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    {t('taskDone.download')}
                  </button>
                </div>
              </div>
            )
          })}
          <p className="text-[10px] font-medium text-mem-ink/40 pt-1">
            {t('taskDone.hint')}
          </p>
        </div>
        <div className="px-5 py-3 border-t-2 border-mem-ink flex justify-end">
          <button
            type="button"
            onClick={dismissTaskDone}
            className="px-4 py-2 border-2 border-mem-ink rounded-lg text-sm font-black bg-mem-teal text-mem-ink hover:brightness-105"
          >
            {t('taskDone.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
