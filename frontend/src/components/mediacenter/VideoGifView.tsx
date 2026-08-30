import React, { useEffect, useMemo, useState } from 'react'
import { Film } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { ErrorLine, Field } from '../calcdev/kit'
import {
  getMediaCapabilities,
  pollMediaJob,
  startVideoGif,
  type MediaJobStatus,
  type MediaToolCapabilities,
} from '../../lib/api'
import { CapabilityGate, MediaOutputList, ProgressBar } from './mediaKit'

const FPS_OPTIONS = [6, 8, 12, 16, 20]
const WIDTH_OPTIONS = [360, 480, 640, 960, 1280]
const QUALITY_OPTIONS = ['high', 'balanced', 'small', 'tiny'] as const
const QUALITY_SIZE_FACTOR: Record<string, number> = { high: 0.21, balanced: 0.14, small: 0.095, tiny: 0.068 }
const MAX_CLIP_SECONDS = 30

/** 视频截取 GIF：前端 <video> 选区，后端 ffmpeg 两遍调色板生成 */
export const VideoGifView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [startS, setStartS] = useState(0)
  const [endS, setEndS] = useState(Math.min(5, MAX_CLIP_SECONDS))
  const [fps, setFps] = useState(12)
  const [width, setWidth] = useState(640)
  const [quality, setQuality] = useState<string>('balanced')
  const [caps, setCaps] = useState<MediaToolCapabilities | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<MediaJobStatus | null>(null)

  useEffect(() => {
    getMediaCapabilities().then(setCaps).catch(() => setCaps(null))
  }, [])

  useEffect(() => {
    if (!file) {
      setVideoUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const clipSeconds = Math.max(0, endS - startS)
  const estimateBytes = useMemo(
    () =>
      duration > 0
        ? Math.round(clipSeconds * fps * width * QUALITY_SIZE_FACTOR[quality] * 0.62)
        : 0,
    [duration, clipSeconds, fps, width, quality]
  )

  const pickFile = (picked: File | null) => {
    setFile(picked)
    setError(null)
    setJob(null)
    setStartS(0)
    setEndS(Math.min(5, MAX_CLIP_SECONDS))
    setDuration(0)
  }

  const run = async () => {
    if (!file) return
    if (endS <= startS) {
      setError(t('mediacenter.vgRangeInvalid'))
      return
    }
    setBusy(true)
    setError(null)
    setJob(null)
    try {
      const started = await startVideoGif(file, { startS, endS, fps, width, quality })
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
        <Film className="w-5 h-5 text-mem-teal" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.videoGif')}</h3>
      </div>
      <p className="text-xs font-bold text-mem-ink/60">{t('mediacenter.vgHint')}</p>
      <CapabilityGate ok={!!caps?.ffmpeg} message={t('mediaJob.ffmpegMissing')} />

      <input
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv,.m4v"
        disabled={busy}
        onChange={(e) => {
          pickFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
        className="block w-full text-xs font-mono file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-2 file:border-mem-ink file:bg-white file:font-bold file:cursor-pointer cursor-pointer border-2 border-mem-ink rounded-xl p-1.5 bg-white"
      />

      {videoUrl && (
        <video
          src={videoUrl}
          controls
          className="w-full max-h-64 border-2 border-mem-ink rounded-xl bg-black"
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration || 0
            setDuration(dur)
            setEndS(Math.min(Math.min(5, MAX_CLIP_SECONDS), dur))
          }}
        />
      )}
      {duration > 0 && (
        <p className="text-xs font-bold font-mono text-mem-ink/70">{t('mediacenter.sourceDuration')}: {duration.toFixed(1)}s</p>
      )}

      <Field label={`${t('mediacenter.vgRange')} (${t('mediacenter.vgMax30')})`}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-[11px] font-bold">{t('mediacenter.vgStart')}</span>
            <input
              type="range" min={0} max={Math.max(duration, 0.1)} step={0.1} value={startS}
              onChange={(e) => setStartS(Math.min(Number(e.target.value), endS - 0.2))}
              className="flex-1 accent-mem-teal min-w-0"
            />
            <span className="w-12 shrink-0 text-xs font-mono font-bold text-right">{startS.toFixed(1)}s</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-[11px] font-bold">{t('mediacenter.vgEnd')}</span>
            <input
              type="range" min={0} max={Math.max(duration, 0.1)} step={0.1} value={endS}
              onChange={(e) => setEndS(Math.max(Number(e.target.value), startS + 0.2))}
              className="flex-1 accent-mem-coral min-w-0"
            />
            <span className="w-12 shrink-0 text-xs font-mono font-bold text-right">{endS.toFixed(1)}s</span>
          </div>
        </div>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label={t('mediacenter.vgFps')}>
          <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className="w-full px-2 py-1.5 text-xs font-bold border-2 border-mem-ink rounded-lg bg-white">
            {FPS_OPTIONS.map((option) => <option key={option} value={option}>{option} fps</option>)}
          </select>
        </Field>
        <Field label={t('mediacenter.vgWidth')}>
          <select value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full px-2 py-1.5 text-xs font-bold border-2 border-mem-ink rounded-lg bg-white">
            {WIDTH_OPTIONS.map((option) => <option key={option} value={option}>{option} px</option>)}
          </select>
        </Field>
        <Field label={t('mediacenter.vgQuality')}>
          <select value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full px-2 py-1.5 text-xs font-bold border-2 border-mem-ink rounded-lg bg-white">
            {QUALITY_OPTIONS.map((option) => (
              <option key={option} value={option}>{t(`mediacenter.vgQuality_${option}`)}</option>
            ))}
          </select>
        </Field>
      </div>

      {estimateBytes > 0 && (
        <p className="text-xs font-bold text-mem-ink/60">
          {t('mediacenter.vgEstimate', { size: estimateBytes > 1024 * 1024 ? `${(estimateBytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(estimateBytes / 1024)} KB` })}
        </p>
      )}

      <MemphisButton variant="teal" onClick={run} disabled={busy || !file || !caps?.ffmpeg || duration <= 0}>
        {t('mediacenter.vgGenerate')}
      </MemphisButton>

      {busy && job && (
        <div className="space-y-1">
          <ProgressBar progress={job.progress} />
          <p className="text-xs font-bold text-mem-ink/60">{t('mediaJob.progress', { progress: job.progress })}</p>
        </div>
      )}
      <ErrorLine message={error} />
      {job?.status === 'done' && <p className="text-xs font-bold text-mem-teal">{t('mediacenter.vgDone')}</p>}
      {job && <MediaOutputList outputs={job.outputs} />}
    </div>
  )
}
