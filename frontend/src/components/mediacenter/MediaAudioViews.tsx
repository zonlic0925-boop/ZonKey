import React, { useState } from 'react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  clipAudioToWav,
  convertAudioToWav,
  detectBpm,
  extractAudioFromVideo,
  type BpmResult,
} from '../../lib/zonkey/mediaCore'
import { downloadBlob } from '../imagecenter/imageKit'
import { ErrorLine, Field, inputClass, ResultTile } from '../calcdev/kit'

const AudioPicker: React.FC<{ onFile: (file: File) => void; accept?: string; busy?: boolean }> = ({ onFile, accept = 'audio/*', busy }) => (
  <input
    type="file"
    accept={accept}
    disabled={busy}
    onChange={(e) => {
      const file = e.target.files?.[0]
      if (file) onFile(file)
      e.target.value = ''
    }}
    className="block w-full text-xs font-mono file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-2 file:border-mem-ink file:bg-white file:font-bold file:cursor-pointer cursor-pointer border-2 border-mem-ink rounded-xl p-1.5 bg-white"
  />
)

function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  const minutes = Math.floor(seconds / 60)
  const rest = (seconds - minutes * 60).toFixed(1)
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`
}

export const BpmDetectView: React.FC = () => {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<BpmResult | null>(null)

  const run = async (file: File) => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await detectBpm(file))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.bpmDetect')}</h3>
      <AudioPicker onFile={run} busy={busy} />
      <ErrorLine message={error} />
      {busy && <p className="text-xs font-bold text-mem-sky animate-pulse">{t('pdfcenter.processing')}</p>}
      {result && (
        result.bpm === null ? (
          <p className="text-xs font-bold text-mem-ink/60">{t('mediacenter.bpmNotFound')}</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <ResultTile value={result.bpm} label="BPM" tone="teal" />
              <ResultTile value={`${Math.round(result.confidence * 100)}%`} label={t('mediacenter.confidence')} tone="yellow" />
            </div>
            {result.candidates.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {result.candidates.slice(1, 5).map((candidate) => (
                  <span key={candidate.bpm} className="px-2 py-0.5 text-xs font-bold border-2 border-mem-ink rounded-lg bg-mem-cream">
                    {candidate.bpm} BPM · {Math.round(candidate.confidence * 100)}%
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}

export const AudioClipView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [range, setRange] = useState({ startSeconds: 0, endSeconds: 10 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setSaved(null)
    try {
      const output = await clipAudioToWav(file, range)
      downloadBlob(output.blob, output.fileName)
      setSaved(`${output.fileName} · ${t('mediacenter.sourceDuration')}: ${fmtDuration(output.duration)}`)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.audioClip')}</h3>
      <AudioPicker onFile={setFile} busy={busy} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('mediacenter.startSeconds')}>
          <input type="number" step="0.1" min={0} value={range.startSeconds} onChange={(e) => setRange({ ...range, startSeconds: Number(e.target.value) })} className={inputClass} />
        </Field>
        <Field label={t('mediacenter.endSeconds')}>
          <input type="number" step="0.1" min={0} value={range.endSeconds} onChange={(e) => setRange({ ...range, endSeconds: Number(e.target.value) })} className={inputClass} />
        </Field>
      </div>
      <MemphisButton variant="teal" onClick={run} disabled={busy || !file}>
        {t('mediacenter.clipNow')}
      </MemphisButton>
      <ErrorLine message={error} />
      {saved && <p className="text-xs font-bold text-mem-teal">{saved}</p>}
    </div>
  )
}

export const AudioConvertView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setSaved(null)
    try {
      const output = await convertAudioToWav(file)
      downloadBlob(output.blob, output.fileName)
      setSaved(`${output.fileName} · ${fmtDuration(output.duration)}`)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.audioConvert')}</h3>
      <p className="text-xs text-mem-ink/60 font-medium">{t('mediacenter.convertHint')}</p>
      <AudioPicker onFile={setFile} busy={busy} />
      <MemphisButton variant="teal" onClick={run} disabled={busy || !file}>
        {t('mediacenter.convertNow')}
      </MemphisButton>
      <ErrorLine message={error} />
      {saved && <p className="text-xs font-bold text-mem-teal">{saved}</p>}
    </div>
  )
}

export const AudioExtractView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setSaved(null)
    try {
      const output = await extractAudioFromVideo(file)
      downloadBlob(output.blob, output.fileName)
      setSaved(`${output.fileName} · ${fmtDuration(output.duration)}`)
    } catch (err) {
      setError(t('mediacenter.extractFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.audioExtract')}</h3>
      <AudioPicker onFile={setFile} accept="video/mp4,video/webm,video/quicktime,audio/*" busy={busy} />
      <MemphisButton variant="teal" onClick={run} disabled={busy || !file}>
        {t('mediacenter.extractNow')}
      </MemphisButton>
      <ErrorLine message={error} />
      {saved && <p className="text-xs font-bold text-mem-teal">{saved}</p>}
    </div>
  )
}
