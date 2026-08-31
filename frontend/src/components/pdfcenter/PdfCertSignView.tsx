import React, { useState } from 'react'
import { BadgeCheck } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine, Field, inputClass } from '../calcdev/kit'

export const PdfCertSignView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [certFile, setCertFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [keyPass, setKeyPass] = useState('')
  const [reason, setReason] = useState('')
  const [location, setLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    if (!files[0] || !certFile || !keyFile) return
    setBusy(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', files[0].file)
      formData.append('cert_pem', certFile)
      formData.append('key_pem', keyFile)
      formData.append('key_pass', keyPass)
      formData.append('reason', reason)
      formData.append('location', location)
      const res = await fetch('/api/convert/sign-pades', {
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

  const fileLabel = (f: File | null) => (f ? f.name : '未选择')

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <BadgeCheck className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">证书签名 (PAdES)</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">
        使用你自己的 X.509 证书（PEM 格式）+ 私钥为 PDF 附加不可篡改的 PAdES 签名。证书由你自行提供与保管，本工具离线签名、不做时间戳服务（TSA）与在线证书链校验。
      </p>

      <PdfFilePicker files={files} onChange={setFiles} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="证书文件 (.pem / .crt / .cer)">
          <label className="block text-sm">
            <input
              type="file"
              accept=".pem,.crt,.cer"
              onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
              className={inputClass}
            />
            <span className="text-xs text-mem-ink/50">{fileLabel(certFile)}</span>
          </label>
        </Field>
        <Field label="私钥文件 (.pem / .key)">
          <label className="block text-sm">
            <input
              type="file"
              accept=".pem,.key"
              onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
              className={inputClass}
            />
            <span className="text-xs text-mem-ink/50">{fileLabel(keyFile)}</span>
          </label>
        </Field>
      </div>
      <Field label="私钥密码 (无密码可留空)">
        <input type="password" value={keyPass} onChange={(e) => setKeyPass(e.target.value)} className={inputClass} placeholder="私钥设有密码时填写" />
      </Field>
      <Field label="签署原因 (可选)">
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} placeholder="例如：审批通过" />
      </Field>
      <Field label="签署地点 (可选)">
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} placeholder="例如：上海" />
      </Field>

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length || !certFile || !keyFile}>
        应用证书并签署
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />
    </div>
  )
}
