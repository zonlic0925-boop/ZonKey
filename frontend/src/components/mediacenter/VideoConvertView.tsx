import React, { useEffect, useState } from 'react'
import { FileVideo } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { ErrorLine } from '../calcdev/kit'
import {
  getMediaCapabilities,
  pollMediaJob,
  startVideoConvert,
  type MediaJobStatus,
  type MediaToolCapabilities,
} from '../../lib/api'
import { CapabilityGate, MediaOutputList, ProgressBar } from './mediaKit'

const TARGETS = ['mp4', 'mkv', 'mov', 'flv', 'ts', 'avi', 'webm', 'wmv'] as const

/** 视频格式转换：ffmpeg 后端编码（libx264/vp9/wmv2 等 profile），输出写入 output/ */
export const VideoConvertView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [target, setTarget] = useState<string>('mp4')
  const [caps, setCaps] = useState<MediaToolCapabilities | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<MediaJobStatus | null>(null)

  useEffect(() => {
    getMediaCapabilities().then(setCaps).catch(() => setCaps(null))
  }, [])

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setJob(null)
    try {
      const started = await startVideoConvert(file, target)
      const final = await pollMediaJob(started.job_id, (status) => setJob(status))
      if (final.status === 'error') setError(final.error || t('mediaJob.failed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mediaJob.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <FileVideo className="w-5 h-5 text-mem-teal" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.videoConvert')}</h3>
      </div>
      <p className="text-xs font-bold text-mem-ink/60">{t('mediacenter.vcHint')}</p>
      <CapabilityGate
        ok={!!caps?.ffmpeg}
        message={t('mediaJob.ffmpegMissing')}
      />

      <input
        type="file"
        accept="video/mp4,video/avi,video/x-matroska,video/quicktime,video/webm,video/x-flv,video/x-ms-wmv,video/mp2t,video/x-m4v,.mp4,.avi,.mkv,.mov,.webm,.flv,.wmv,.ts,.m4v"
        disabled={busy}
        onChange={(e) => {
          const picked = e.target.files?.[0]
          if (picked) setFile(picked)
          e.target.value = ''
        }}
        className="block w-full text-xs font-mono file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-2 file:border-mem-ink file:bg-white file:font-bold file:cursor-pointer cursor-pointer border-2 border-mem-ink rounded-xl p-1.5 bg-white"
      />
      {file && <p className="text-xs font-bold font-mono text-mem-ink/70">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}

      <div>
        <p className="text-xs font-bold text-mem-ink/60 uppercase mb-1.5">{t('mediacenter.vcTarget')}</p>
        <div className="flex flex-wrap gap-1.5">
          {TARGETS.map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => setTarget(format)}
              className={`px-3 py-1.5 text-xs font-black border-2 border-mem-ink rounded-lg uppercase ${
                target === format ? 'bg-mem-teal text-mem-ink' : 'bg-white text-mem-ink/70 hover:bg-mem-teal/30'
              }`}
            >
              {format}
            </button>
          ))}
        </div>
      </div>

      <MemphisButton variant="teal" onClick={run} disabled={busy || !file || !caps?.ffmpeg}>
        {t('mediacenter.vcStart')}
      </MemphisButton>

      {busy && job && (
        <div className="space-y-1">
          <ProgressBar progress={job.progress} />
          <p className="text-xs font-bold text-mem-ink/60">{t('mediaJob.progress', { progress: job.progress })}</p>
        </div>
      )}
      <ErrorLine message={error} />
      {job?.status === 'done' && <p className="text-xs font-bold text-mem-teal">{t('mediacenter.vcDone')}</p>}
      {job && <MediaOutputList outputs={job.outputs} />}
    </div>
  )
}
