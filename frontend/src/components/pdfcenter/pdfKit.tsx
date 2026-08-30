import React, { useRef } from 'react'
import { FilePlus2, X } from 'lucide-react'
import JSZip from 'jszip'
import { MemphisButton } from '../common/MemphisButton'
import { downloadBlob } from '../../lib/deliver'

export interface PickedFile {
  file: File
  name: string
  size: number
}

export const PdfFilePicker: React.FC<{
  multiple?: boolean
  files: PickedFile[]
  onChange: (files: PickedFile[]) => void
  accept?: string
}> = ({ multiple = false, files, onChange, accept = 'application/pdf,.pdf' }) => {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).map((file) => ({ file, name: file.name, size: file.size }))
          onChange(multiple ? [...files, ...picked] : picked.slice(0, 1))
          e.target.value = ''
        }}
      />
      <MemphisButton variant="sky" size="sm" icon={<FilePlus2 className="w-4 h-4" />} onClick={() => inputRef.current?.click()}>
        {multiple ? '添加 PDF' : '选择 PDF'}
      </MemphisButton>
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((picked, index) => (
            <li key={`${picked.name}-${index}`} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl text-xs">
              <span className="font-mono font-bold truncate">{picked.name}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-mem-ink/50">{(picked.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  onClick={() => onChange(files.filter((_, i) => i !== index))}
                  className="p-0.5 rounded-md border border-mem-ink/30 hover:bg-mem-coral/20"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 统一交付出口：桌面壳走服务端中转 + 原生另存为，浏览器直接 a[download] */
export async function downloadBytes(bytes: Uint8Array, filename: string, mime = 'application/pdf') {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const blob = new Blob([buffer], { type: mime })
  try {
    await downloadBlob(blob, filename)
  } catch {
    // 服务端中转失败时回退浏览器下载通道（壳内 ALLOW_DOWNLOADS 已开启）
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}

export async function downloadFilesZip(files: { fileName: string; bytes: Uint8Array }[], zipName: string) {
  const zip = new JSZip()
  for (const file of files) zip.file(file.fileName, file.bytes)
  const blob = await zip.generateAsync({ type: 'blob' })
  await downloadBlob(blob, zipName)
}

export async function downloadImageZip(outputs: { fileName: string; bytes: Uint8Array }[], zipName: string) {
  return downloadFilesZip(outputs, zipName)
}

export const BusyLine: React.FC<{ busy: boolean; label: string }> = ({ busy, label }) =>
  busy ? (
    <p className="text-xs font-bold text-mem-sky animate-pulse">{label}</p>
  ) : null
