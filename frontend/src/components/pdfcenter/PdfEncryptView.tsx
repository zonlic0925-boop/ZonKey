import React, { useState } from 'react'
import { Lock } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { encryptPdfFileAdvanced } from '../../lib/zonkey/pdfCore'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine, Field, inputClass } from '../calcdev/kit'

export const PdfEncryptView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [userPassword, setUserPassword] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [perms, setPerms] = useState({
    print: true,
    copy: true,
    modify: true,
    fill: true,
  });

  const run = async () => {
    const picked = files[0]
    if (!picked) {
      setError(t('pdfcenter.needOneFile'))
      return
    }
    if (!userPassword.trim() && !ownerPassword.trim()) {
      setError(t('pdfcenter.passwordRequired') || '请提供验证密码或所有者密码')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const encrypted = await encryptPdfFileAdvanced(
        picked.file,
        userPassword,
        ownerPassword || userPassword,
        perms
      );
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
      <p className="text-xs text-mem-ink/60 font-medium">使用高强度安全锁定，保护您的 PDF 防止未经授权的访问与修改。</p>

      <PdfFilePicker files={files} onChange={setFiles} />

      <Field label="打开文档的密码 (选填)">
        <input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} className={inputClass} placeholder="不填则所有人都可打开查看" />
      </Field>
      <Field label="权限管理主密码 (选填)">
        <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="设置用于去除限制的超级密码" className={inputClass} />
      </Field>

      {(userPassword || ownerPassword) && (
        <div className="p-4 border-2 border-mem-ink/20 rounded-md bg-white space-y-2">
           <h4 className="text-sm font-black mb-3">权限配置（所有人除主密码拥有者外的限制）：</h4>
           {[
             { k: 'print', l: '允许打印' },
             { k: 'copy', l: '允许复制文本与图片' },
             { k: 'modify', l: '允许修改文档内容' },
             { k: 'fill', l: '允许填写表单/添加批注' }
           ].map(({ k, l }) => (
             <label key={k} className="flex items-center gap-2 text-sm font-semibold select-none cursor-pointer">
                <input type="checkbox" checked={(perms as any)[k]} onChange={e => setPerms(p => ({...p, [k]: e.target.checked}))} className="w-4 h-4 text-mem-sky rounded border-2 border-mem-ink" />
                {l}
             </label>
           ))}
        </div>
      )}

      <MemphisButton variant="sky" onClick={run} disabled={busy || !files.length || (!userPassword && !ownerPassword)}>
        {t('pdfcenter.encryptNow')}
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />
    </div>
  )
}
