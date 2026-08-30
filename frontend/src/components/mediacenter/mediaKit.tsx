/** 音视讯中心公共件：长任务输出清单（服务端产物 → 另存为 / 打开 / 浏览器下载） */
import React, { useEffect, useState } from 'react'
import { Download, ExternalLink, Save } from 'lucide-react'
import { useI18n } from '../../i18n'
import { buildDownloadUrl, saveOutputFileAs, openOutputFile, type MediaJobOutput } from '../../lib/api'

export const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => (
  <div className="h-3 w-full bg-white border-2 border-mem-ink rounded-full overflow-hidden">
    <div
      className="h-full bg-mem-teal transition-[width] duration-300"
      style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
    />
  </div>
)

export const MediaOutputList: React.FC<{ outputs: MediaJobOutput[] }> = ({ outputs }) => {
  const { t } = useI18n()
  const [busyName, setBusyName] = useState<string | null>(null)
  const [savedName, setSavedName] = useState<string | null>(null)

  useEffect(() => {
    if (!savedName) return
    const timer = setTimeout(() => setSavedName(null), 2500)
    return () => clearTimeout(timer)
  }, [savedName])

  const saveAs = async (output: MediaJobOutput) => {
    setBusyName(output.name)
    try {
      const result = await saveOutputFileAs(output.dir, output.name)
      if (!result.cancelled) setSavedName(output.name)
    } catch {
      /* 浏览器/手机端无原生对话框 → 保留下载链接兜底 */
    } finally {
      setBusyName(null)
    }
  }

  const open = async (output: MediaJobOutput) => {
    setBusyName(output.name)
    try {
      await openOutputFile(output.dir, output.name)
    } catch {
      /* 忽略 */
    } finally {
      setBusyName(null)
    }
  }

  if (!outputs.length) return null
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-mem-ink/60 uppercase">{t('mediaJob.outputFiles')}</p>
      {outputs.map((output) => (
        <div
          key={`${output.dir}/${output.name}`}
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white border-2 border-mem-ink rounded-xl text-xs"
        >
          <span className="font-mono font-bold truncate min-w-0">{output.name}</span>
          <span className="flex items-center gap-1.5 shrink-0">
            {savedName === output.name && <span className="text-xs font-bold text-mem-teal">{t('mediaJob.saved')}</span>}
            <a
              href={buildDownloadUrl(output.dir, output.name)}
              download={output.name}
              className="flex items-center gap-1 px-2 py-1 border-2 border-mem-ink rounded-lg font-bold hover:bg-mem-yellow/30"
            >
              <Download className="w-3 h-3" />
              {t('mediaJob.download')}
            </a>
            <button
              type="button"
              onClick={() => void saveAs(output)}
              disabled={busyName === output.name}
              className="flex items-center gap-1 px-2 py-1 border-2 border-mem-ink rounded-lg font-bold hover:bg-mem-sky/30 disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              {t('mediaJob.saveAs')}
            </button>
            <button
              type="button"
              onClick={() => void open(output)}
              disabled={busyName === output.name}
              className="flex items-center gap-1 px-2 py-1 border-2 border-mem-ink rounded-lg font-bold hover:bg-mem-coral/30 disabled:opacity-50"
            >
              <ExternalLink className="w-3 h-3" />
              {t('mediaJob.open')}
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}

export const CapabilityGate: React.FC<{ ok: boolean; message: string }> = ({ ok, message }) => {
  if (ok) return null
  return (
    <div className="px-4 py-3 border-2 border-mem-ink rounded-xl bg-mem-coral/20 text-xs font-bold text-mem-ink">
      {message}
    </div>
  )
}
