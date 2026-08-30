import React, { useEffect, useState } from 'react'
import { Mic } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { ErrorLine, Field } from '../calcdev/kit'
import {
  getMediaCapabilities,
  pollMediaJob,
  startTranscription,
  type MediaJobStatus,
  type MediaToolCapabilities,
} from '../../lib/api'
import { CapabilityGate, MediaOutputList, ProgressBar } from '../mediacenter/mediaKit'

/** 语音转写（音视频提取文字）：faster-whisper 纯离线识别，输出 TXT + SRT */
export const TranscriptionView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [language, setLanguage] = useState('auto')
  const [modelSize, setModelSize] = useState('base')
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
      const started = await startTranscription(file, language, modelSize)
      const final = await pollMediaJob(started.job_id, (status) => setJob(status))
      if (final.status === 'error') setError(final.error || t('mediaJob.failed'))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('mediaJob.failed'))
    } finally {
      setBusy(false)
    }
  }

  const stageLabel = job
    ? job.stage === 'loading-model'
      ? t('textcenter.trStageModel')
      : t('textcenter.trStageTranscribing', { progress: job.progress })
    : ''

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Mic className="w-5 h-5 text-mem-pink" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.transcription')}</h3>
      </div>
      <p className="text-xs font-bold text-mem-ink/60">{t('textcenter.trHint')}</p>
      <CapabilityGate ok={!!caps?.asr_engine} message={t('mediaJob.asrMissing')} />

      <input
        type="file"
        accept="audio/*,video/*,.mp3,.aac,.wav,.flac,.m4a,.ogg,.opus,.wma,.mp4,.mkv,.mov,.webm,.ts"
        disabled={busy}
        onChange={(e) => {
          const picked = e.target.files?.[0]
          if (picked) setFile(picked)
          e.target.value = ''
        }}
        className="block w-full text-xs font-mono file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-2 file:border-mem-ink file:bg-white file:font-bold file:cursor-pointer cursor-pointer border-2 border-mem-ink rounded-xl p-1.5 bg-white"
      />
      {file && <p className="text-xs font-bold font-mono text-mem-ink/70">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label={t('textcenter.trLanguage')}>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-2 py-1.5 text-xs font-bold border-2 border-mem-ink rounded-lg bg-white">
            <option value="auto">{t('textcenter.trAuto')}</option>
            <option value="zh">{t('textcenter.trZh')}</option>
            <option value="en">{t('textcenter.trEn')}</option>
          </select>
        </Field>
        <Field label={t('textcenter.trModel')}>
          <select value={modelSize} onChange={(e) => setModelSize(e.target.value)} className="w-full px-2 py-1.5 text-xs font-bold border-2 border-mem-ink rounded-lg bg-white">
            <option value="base">{t('textcenter.trModel_base')}</option>
            <option value="small">{t('textcenter.trModel_small')}</option>
            <option value="medium">{t('textcenter.trModel_medium')}</option>
          </select>
        </Field>
      </div>

      <MemphisButton variant="pink" onClick={run} disabled={busy || !file || !caps?.asr_engine}>
        {t('textcenter.trStart')}
      </MemphisButton>

      {busy && (
        <div className="space-y-1">
          <ProgressBar progress={job?.progress ?? 5} />
          <p className="text-xs font-bold text-mem-ink/60">{stageLabel}</p>
        </div>
      )}
      <ErrorLine message={error} />
      {job?.status === 'done' && (
        <p className="text-xs font-bold text-mem-teal">
          {t('textcenter.trDone', { lang: job.detected_language || '?' })}
        </p>
      )}
      {job && <MediaOutputList outputs={job.outputs} />}
    </div>
  )
}
