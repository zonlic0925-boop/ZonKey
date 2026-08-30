import React, { useState } from 'react'
import { Lock } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { encryptPdfFile } from '../../lib/toolknit/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine, Field, inputClass } from '../calcdev/kit'

export const PdfEncryptView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [userPassword, setUserPassword] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    const picked = files[0]
    if (!picked) {
      setError(t('pdfcenter.needOneFile'))
      return
    }
    if (!userPassword.trim()) {
      setError(t('pdfcenter.passwordRequired'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const fileData = new Uint8Array(await picked.file.arrayBuffer())
      const encrypted = await encryptPdfFile(fileData, userPassword, ownerPassword || userPassword)
      const baseName = picked.name.replace(/\.pdf$/i, '')
      downloadBytes(encrypted, `${baseName}_encrypted.pdf`)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.pdfEncrypt')}</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">{t('pdfcenter.encryptHint')}</p>

      <PdfFilePicker files={files} onChange={setFiles} />

      <Field label={t('pdfcenter.userPassword')}>
        <input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} className={inputClass} />
      </Field>
      <Field label={t('pdfcenter.ownerPasswordOptional')}>
        <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder={t('pdfcenter.sameAsUser')} className={inputClass} />
      </Field>

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length}>
        {t('pdfcenter.encryptNow')}
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />
    </div>
  )
}
