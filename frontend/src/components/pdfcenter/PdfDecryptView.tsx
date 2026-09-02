import React, { useState } from 'react'
import { LockOpen } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { decryptPdfFile } from '../../lib/zonkey/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine, Field, inputClass } from '../calcdev/kit'

export const PdfDecryptView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    const picked = files[0]
    if (!picked) {
      setError(t('pdfcenter.needOneFile'))
      return
    }
    if (!password.trim()) {
      setError(t('pdfcenter.passwordRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const fileData = new Uint8Array(await picked.file.arrayBuffer())
      const decrypted = await decryptPdfFile(fileData, password)
      const baseName = picked.name.replace(/\.pdf$/i, '')
      downloadBytes(decrypted, `${baseName}_decrypted.pdf`)
    } catch (err) {
      setError(t('pdfcenter.decryptFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <LockOpen className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfDecrypt')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.decryptHint')}</p>

      <PdfFilePicker files={files} onChange={setFiles} />

      <Field label={t('pdfcenter.openPassword')}>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </Field>

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length}>
        {t('pdfcenter.decryptNow')}
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />
    </div>
  )
}
