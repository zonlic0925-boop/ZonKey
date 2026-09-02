import React, { useState } from 'react'
import { FileArchive } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { compressPdfFile, type PdfCompressLevel } from '../../lib/zonkey/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine, ResultTile } from '../calcdev/kit'

const LEVELS: PdfCompressLevel[] = ['low', 'medium', 'high']

export const PdfCompressView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [level, setLevel] = useState<PdfCompressLevel>('medium')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ original: number; compressed: number } | null>(null)

  const run = async () => {
    const picked = files[0]
    if (!picked) {
      setError(t('pdfcenter.needOneFile'))
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const original = new Uint8Array(await picked.file.arrayBuffer())
      const compressed = await compressPdfFile(original, level)
      setResult({ original: original.length, compressed: compressed.length })
      const baseName = picked.name.replace(/\.pdf$/i, '')
      downloadBytes(compressed, `${baseName}_compressed.pdf`)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const saving = result ? Math.max(0, Math.round(((result.original - result.compressed) / result.original) * 100)) : null

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileArchive className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfCompress')}</h3>
      </div>

      <PdfFilePicker files={files} onChange={(next) => { setFiles(next); setResult(null) }} />

      <div className="flex items-center gap-1.5 flex-wrap">
        {LEVELS.map((value) => (
          <MemphisButton key={value} size="sm" variant={level === value ? 'sky' : 'white'} onClick={() => setLevel(value)}>
            {t(`pdfcenter.level_${value}`)}
          </MemphisButton>
        ))}
      </div>

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length}>
        {t('pdfcenter.compressNow')}
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />

      {result && (
        <div className="grid grid-cols-3 gap-3">
          <ResultTile value={(result.original / 1024).toFixed(1) + ' KB'} label={t('pdfcenter.originalSize')} tone="yellow" />
          <ResultTile value={(result.compressed / 1024).toFixed(1) + ' KB'} label={t('pdfcenter.compressedSize')} tone="teal" />
          <ResultTile value={`-${saving}%`} label={t('pdfcenter.saving')} tone="lime" />
        </div>
      )}
    </div>
  )
}
