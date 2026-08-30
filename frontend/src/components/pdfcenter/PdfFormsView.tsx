import React, { useState, useEffect } from 'react'
import { PDFDocument } from 'pdf-lib'
import { FileText } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { BusyLine, downloadBytes, PdfFilePicker, type PickedFile } from './pdfKit'
import { ErrorLine, Field, inputClass } from '../calcdev/kit'

interface FormField {
  name: string
  type: string
  value: string | boolean
}

export const PdfFormsView: React.FC = () => {
  const { t } = useI18n()
  const [files, setFiles] = useState<PickedFile[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<FormField[]>([])
  const [docBuffer, setDocBuffer] = useState<Uint8Array | null>(null)

  useEffect(() => {
    const parseForm = async () => {
      if (!files[0]) {
        setFields([])
        setDocBuffer(null)
        return
      }
      setBusy(true)
      try {
        const buf = new Uint8Array(await files[0].file.arrayBuffer())
        setDocBuffer(buf)
        const pdfDoc = await PDFDocument.load(buf)
        const form = pdfDoc.getForm()
        const pdfFields = form.getFields()
        const parsed = pdfFields.map(f => {
          const type = f.constructor.name
          return { name: f.getName(), type, value: '' }
        })
        setFields(parsed)
        if (!parsed.length) {
            setError("未在文件中检测到交互式表单（无填空域）")
        } else {
            setError(null)
        }
      } catch (e) {
        setError("无法解析此 PDF 文件的表单数据。")
      }
      setBusy(false)
    }
    parseForm()
  }, [files])

  const setFieldValue = (name: string, val: string | boolean) => {
      setFields(prev => prev.map(f => f.name === name ? { ...f, value: val } : f))
  }

  const run = async () => {
    if (!docBuffer || !files.length) return
    setBusy(true)
    setError(null)
    try {
      const pdfDoc = await PDFDocument.load(docBuffer)
      const form = pdfDoc.getForm()
      
      for (const field of fields) {
         try {
             if (field.type === 'PDFTextField' || field.type === 'PDFDropdown') {
                 form.getTextField(field.name).setText(String(field.value))
             } else if (field.type === 'PDFCheckBox') {
                 if (field.value) form.getCheckBox(field.name).check()
                 else form.getCheckBox(field.name).uncheck()
             }
         } catch (ignored) { /* skip */ }
      }
      form.flatten()
      const bytes = await pdfDoc.save()
      const baseName = files[0].name.replace(/\.pdf$/i, '')
      downloadBytes(bytes, `${baseName}_filled.pdf`)
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">在线表单填写</h3>
      </div>
      <p className="text-xs text-mem-ink/60 font-medium">提取 PDF 内的交互式表单，填写并生成无法再编辑的静态合并件。</p>

      <PdfFilePicker files={files} onChange={setFiles} />

      {fields.length > 0 && (
          <div className="bg-white border-2 border-mem-ink p-4 space-y-3 rounded max-h-[300px] overflow-y-auto w-full">
              <h4 className="font-semibold text-sm border-b-2 border-mem-ink/20 pb-2 mb-2">表单字段 ({fields.length})</h4>
              {fields.map(f => (
                  <Field key={f.name} label={f.name}>
                      {f.type === 'PDFCheckBox' ? (
                          <input type="checkbox" checked={!!f.value} onChange={e => setFieldValue(f.name, e.target.checked)} className="w-5 h-5 border-2 border-mem-ink text-mem-sky"/>
                      ) : (
                          <input value={f.value as string} onChange={e => setFieldValue(f.name, e.target.value)} className={inputClass} placeholder={`Type: ${f.type}`} />
                      )}
                  </Field>
              ))}
          </div>
      )}

      <MemphisButton variant="sky" onClick={run} disabled={busy || !fields.length}>
        应用修改并输出
      </MemphisButton>
      <BusyLine busy={busy} label={t('pdfcenter.processing')} />
      <ErrorLine message={error} />
    </div>
  )
}
