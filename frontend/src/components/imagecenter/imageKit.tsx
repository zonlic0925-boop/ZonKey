import React, { useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { MemphisButton } from '../common/MemphisButton'

export interface PickedImage {
  file: File
  name: string
  size: number
}

export const ImagePicker: React.FC<{
  multiple?: boolean
  files: PickedImage[]
  onChange: (files: PickedImage[]) => void
}> = ({ multiple = false, files, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/bmp,image/gif"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []).map((file) => ({ file, name: file.name, size: file.size }))
          onChange(multiple ? [...files, ...picked] : picked.slice(0, 1))
          e.target.value = ''
        }}
      />
      <MemphisButton variant="yellow" size="sm" icon={<ImagePlus className="w-4 h-4" />} onClick={() => inputRef.current?.click()}>
        {multiple ? '添加图片' : '选择图片'}
      </MemphisButton>
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((picked, index) => (
            <li key={`${picked.name}-${index}`} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl text-xs">
              <span className="flex items-center gap-2 min-w-0">
                <img src={URL.createObjectURL(picked.file)} alt="" className="w-7 h-7 rounded-md border border-mem-ink/30 object-cover shrink-0" />
                <span className="font-mono font-bold truncate">{picked.name}</span>
              </span>
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

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const SaveRow: React.FC<{ blob: Blob; fileName: string }> = ({ blob, fileName }) => (
  <li className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl text-xs">
    <span className="font-mono font-bold truncate">{fileName}</span>
    <span className="flex items-center gap-2 shrink-0">
      <span className="text-mem-ink/50">{(blob.size / 1024).toFixed(1)} KB</span>
      <MemphisButton size="sm" variant="white" onClick={() => downloadBlob(blob, fileName)}>
        保存
      </MemphisButton>
    </span>
  </li>
)
