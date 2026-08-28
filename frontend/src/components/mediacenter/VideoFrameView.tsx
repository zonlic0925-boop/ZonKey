import React, { useState } from 'react'
import { Clapperboard } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { captureVideoFrame } from '../../lib/toolknit/mediaCore'
import { downloadBlob } from '../imagecenter/imageKit'
import { ErrorLine, Field, inputClass } from '../calcdev/kit'

export const VideoFrameView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<File | null>(null)
  const [timestamp, setTimestamp] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setSaved(null)
    try {
      const output = await captureVideoFrame(file, timestamp)
      downloadBlob(output.blob, output.fileName)
      const url = URL.createObjectURL(output.blob)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
      setSaved(`${output.fileName} · ${output.width}×${output.height}`)
    } catch (err) {
      setError(t('mediacenter.frameFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Clapperboard className="w-5 h-5 text-mem-teal" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.videoFrame')}</h3>
      </div>
      <input
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        disabled={busy}
        onChange={(e) => {
          const picked = e.target.files?.[0]
          if (picked) setFile(picked)
          e.target.value = ''
        }}
        className="block w-full text-xs font-mono file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-2 file:border-mem-ink file:bg-white file:font-bold file:cursor-pointer cursor-pointer border-2 border-mem-ink rounded-xl p-1.5 bg-white"
      />
      <Field label={`${t('mediacenter.timestamp')} (s)`}>
        <input type="number" step="0.1" min={0} value={timestamp} onChange={(e) => setTimestamp(Number(e.target.value))} className={inputClass} />
      </Field>
      <MemphisButton variant="teal" onClick={run} disabled={busy || !file}>
        {t('mediacenter.captureNow')}
      </MemphisButton>
      <ErrorLine message={error} />
      {saved && <p className="text-xs font-bold text-mem-teal">{saved}</p>}
      {previewUrl && <img src={previewUrl} alt="" className="max-h-56 border-2 border-mem-ink rounded-xl" />}
    </div>
  )
}
