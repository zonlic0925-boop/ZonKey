import React, { useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine } from '../calcdev/kit'

export const PdfCertSignView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!files[0]) return
    setBusy(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', files[0].file)
      const res = await fetch('http://127.0.0.1:8765/api/convert/sign-pades', {
          method: 'POST',
          body: formData
      })
      if (!res.ok) throw new Error(await res.text().catch(() => res.statusText))
      const bytes = new Uint8Array(await res.arrayBuffer())
      const baseName = files[0].name.replace(/\.pdf$/i, '')
      downloadBytes(bytes, `${baseName}_signed.pdf`)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BadgeCheck className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">证书签名 (PAdES)</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">使用高强度安全特性，签署不可篡改的加密电子防伪 PDF 文件。底层技术提供：pyHanko。</p>

      <PdfFilePicker files={files} onChange={setFiles} />

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length}>
        应用证书并签署
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />
    </div>
  )
}
