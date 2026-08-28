import React, { useState } from 'react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  compressImage,
  convertImage,
  type CompressionQuality,
  type TargetFormat,
} from '../../lib/toolknit/imageCore'
import { downloadBlob, ImagePicker, SaveRow, type PickedImage } from './imageKit'
import { ErrorLine } from '../calcdev/kit'

function convertToFiles(picked: PickedImage[]): File[] {
  return picked.map((p) => p.file)
}

export const ImageConvertView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedImage[]>([])
  const [target, setTarget] = useState<TargetFormat>('png')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<{ blob: Blob; fileName: string }[]>([])

  const run = async () => {
    if (!files.length) {
      setError(t('imagecenter.needImage'))
      return
    }
    setBusy(true)
    setError(null)
    setResults([])
    try {
      const outputs: { blob: Blob; fileName: string }[] = []
      for (const picked of convertToFiles(files)) {
        outputs.push(await convertImage(picked, target))
      }
      setResults(outputs)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.imageConvert')}</h3>
      <ImagePicker multiple files={files} onChange={setFiles} />
      <div className="flex gap-1.5">
        {(['jpg', 'png', 'webp'] as TargetFormat[]).map((format) => (
          <MemphisButton key={format} size="sm" variant={target === format ? 'yellow' : 'white'} onClick={() => setTarget(format)}>
            {format.toUpperCase()}
          </MemphisButton>
        ))}
      </div>
      <MemphisButton variant="yellow" onClick={run} disabled={busy || !files.length}>
        {t('imagecenter.convertNow')}
      </MemphisButton>
      <ErrorLine message={error} />
      {results.length > 0 && (
        <ul className="space-y-1.5">
          {results.map((result) => <SaveRow key={result.fileName} blob={result.blob} fileName={result.fileName} />)}
        </ul>
      )}
    </div>
  )
}

export const ImageCompressView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedImage[]>([])
  const [quality, setQuality] = useState<CompressionQuality>('medium')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<{ blob: Blob; fileName: string }[]>([])
  const [savedPercent, setSavedPercent] = useState<number | null>(null)

  const run = async () => {
    if (!files.length) {
      setError(t('imagecenter.needImage'))
      return
    }
    setBusy(true)
    setError(null)
    setResults([])
    setSavedPercent(null)
    try {
      const inputs = convertToFiles(files)
      const outputs: { blob: Blob; fileName: string }[] = []
      let original = 0
      let compressed = 0
      for (const picked of inputs) {
        const output = await compressImage(picked, quality)
        outputs.push(output)
        original += picked.size
        compressed += output.blob.size
      }
      setResults(outputs)
      setSavedPercent(original > 0 ? Math.max(0, Math.round(((original - compressed) / original) * 100)) : 0)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.imageCompress')}</h3>
      <ImagePicker multiple files={files} onChange={setFiles} />
      <div className="flex gap-1.5">
        {(['high', 'medium', 'low'] as CompressionQuality[]).map((level) => (
          <MemphisButton key={level} size="sm" variant={quality === level ? 'yellow' : 'white'} onClick={() => setQuality(level)}>
            {t(`imagecenter.quality_${level}`)}
          </MemphisButton>
        ))}
      </div>
      <MemphisButton variant="yellow" onClick={run} disabled={busy || !files.length}>
        {t('imagecenter.compressNow')}
      </MemphisButton>
      <ErrorLine message={error} />
      {savedPercent !== null && (
        <p className="text-xs font-bold text-mem-teal">{t('imagecenter.totalSaving', { count: savedPercent })}</p>
      )}
      {results.length > 0 && (
        <ul className="space-y-1.5">
          {results.map((result) => <SaveRow key={result.fileName} blob={result.blob} fileName={result.fileName} />)}
        </ul>
      )}
    </div>
  )
}
