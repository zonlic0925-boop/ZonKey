import React, { useState } from 'react'
import JSZip from 'jszip'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  extractPalette,
  generateIcons,
  stitchImages,
  type PaletteColor,
  type StitchDirection,
} from '../../lib/zonkey/imageCore'
import { downloadBlob, ImagePicker, SaveRow, type PickedImage } from './imageKit'
import { ErrorLine } from '../calcdev/kit'

export const ImageStitchView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedImage[]>([])
  const [direction, setDirection] = useState<StitchDirection>('vertical')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ blob: Blob; fileName: string } | null>(null)

  const run = async () => {
    if (files.length < 2) {
      setError(t('imagecenter.needTwoImages'))
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await stitchImages(files.map((picked) => picked.file), direction))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.imageStitch')}</h3>
      <ImagePicker multiple files={files} onChange={setFiles} />
      <div className="flex gap-1.5">
        {(['vertical', 'horizontal', 'grid'] as StitchDirection[]).map((value) => (
          <MemphisButton key={value} size="sm" variant={direction === value ? 'yellow' : 'white'} onClick={() => setDirection(value)}>
            {t(`imagecenter.stitch_${value}`)}
          </MemphisButton>
        ))}
      </div>
      <MemphisButton variant="yellow" onClick={run} disabled={busy || files.length < 2}>
        {t('imagecenter.stitchNow')}
      </MemphisButton>
      <ErrorLine message={error} />
      {result && (
        <ul className="space-y-1.5">
          <li className="space-y-1.5">
            <img src={URL.createObjectURL(result.blob)} alt="" className="max-h-48 border-2 border-mem-ink rounded-xl" />
            <SaveRow blob={result.blob} fileName={result.fileName} />
          </li>
        </ul>
      )}
    </div>
  )
}

export const IconGenView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<PickedImage | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<{ size: number; blob: Blob; fileName: string }[]>([])

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    setOutputs([])
    try {
      setOutputs(await generateIcons(file.file))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const downloadZip = async () => {
    const zip = new JSZip()
    for (const output of outputs) zip.file(output.fileName, output.blob)
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'icons.zip')
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.iconGen')}</h3>
      <ImagePicker files={file ? [file] : []} onChange={(next) => setFile(next[0] ?? null)} />
      <MemphisButton variant="yellow" onClick={run} disabled={busy || !file}>
        {t('imagecenter.iconGenNow')}
      </MemphisButton>
      <ErrorLine message={error} />
      {outputs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-mem-ink/70">{t('imagecenter.iconSizes')}</p>
            <MemphisButton size="sm" variant="teal" onClick={downloadZip}>ZIP</MemphisButton>
          </div>
          <ul className="space-y-1.5">
            {outputs.map((output) => <SaveRow key={output.fileName} blob={output.blob} fileName={output.fileName} />)}
          </ul>
        </div>
      )}
    </div>
  )
}

export const ColorPaletteView: React.FC = () => {
  const { t } = useI18n()
  const [file, setFile] = useState<PickedImage | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [palette, setPalette] = useState<PaletteColor[]>([])

  const run = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      setPalette(await extractPalette(file.file))
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.colorExtractor')}</h3>
      <ImagePicker files={file ? [file] : []} onChange={(next) => setFile(next[0] ?? null)} />
      <MemphisButton variant="yellow" onClick={run} disabled={busy || !file}>
        {t('imagecenter.extractNow')}
      </MemphisButton>
      <ErrorLine message={error} />
      {palette.length > 0 && (
        <div className="space-y-1.5">
          {palette.map((color) => (
            <div key={color.hex} className="flex items-center gap-3 px-3 py-2 bg-white border-2 border-mem-ink rounded-xl">
              <span className="w-8 h-8 rounded-lg border-2 border-mem-ink shrink-0" style={{ backgroundColor: color.hex }} />
              <code className="text-xs font-mono font-bold">{color.hex}</code>
              <span className="text-xs font-bold text-mem-ink/60 ml-auto">{Math.round(color.ratio * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
