import React, { useState } from 'react'
import { ImageDown } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { pdfToImages, type PdfImageFormat, type PdfImageOutput } from '../../lib/zonkey/pdfCore'
import { BusyLine, downloadBytes, downloadImageZip, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine } from '../calcdev/kit'

const FORMATS: PdfImageFormat[] = ['png', 'jpeg']

export const PdfToImageView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [format, setFormat] = useState<PdfImageFormat>('png')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outputs, setOutputs] = useState<PdfImageOutput[]>([])

  const run = async () => {
    const picked = files[0]
    if (!picked) {
      setError(t('pdfcenter.needOneFile'))
      return
    }
    setBusy(true)
    setError(null)
    setOutputs([])
    try {
      const fileData = new Uint8Array(await picked.file.arrayBuffer())
      const result = await pdfToImages({ fileData, sourceName: picked.name, format, scale: 2 })
      setOutputs(result)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const baseName = files[0]?.name.replace(/\.pdf$/i, '') ?? 'pdf'

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ImageDown className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfToImage')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.toImageHint')}</p>

      <PdfFilePicker files={files} onChange={(next) => { setFiles(next); setOutputs([]) }} />

      <div className="flex items-center gap-1.5 flex-wrap">
        {FORMATS.map((value) => (
          <MemphisButton key={value} size="sm" variant={format === value ? 'sky' : 'white'} onClick={() => setFormat(value)}>
            {value.toUpperCase()}
          </MemphisButton>
        ))}
      </div>

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length}>
        {t('pdfcenter.toImageNow')}
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />

      {outputs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-mem-ink/70">{t('pdfcenter.toImageDone', { count: outputs.length })}</p>
            {outputs.length > 1 && (
              <MemphisButton size="sm" variant="teal" onClick={() => downloadImageZip(outputs, `${baseName}_images.zip`)}>
                ZIP ({outputs.length})
              </MemphisButton>
            )}
          </div>
          <ul className="max-h-64 overflow-auto space-y-1.5">
            {outputs.map((output) => (
              <li key={output.fileName} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl text-xs">
                <span className="font-mono font-bold truncate">{output.fileName}</span>
                <MemphisButton size="sm" variant="white" onClick={() => downloadBytes(output.bytes, output.fileName, output.mime)}>
                  {t('pdfcenter.save')}
                </MemphisButton>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
