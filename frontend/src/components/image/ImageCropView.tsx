import React, { useState, useRef, useCallback } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { Upload, Crop, Download } from 'lucide-react'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

export const ImageCropView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [imgUrl, setImgUrl] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cropBox, setCropBox] = useState({ x: 50, y: 50, w: 200, h: 150 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, bx: 0, by: 0 })
  const [imgDim, setImgDim] = useState({ w: 0, h: 0 })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const url = URL.createObjectURL(f)
    setImgUrl(url)
    const img = new Image()
    img.onload = () => setImgDim({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
  }

  const handleExport = () => {
    if (!file || !imgUrl) return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scaleX = img.naturalWidth / (document.getElementById('crop-preview')?.clientWidth || img.naturalWidth)
      const scaleY = img.naturalHeight / (document.getElementById('crop-preview')?.clientHeight || img.naturalHeight)
      const sx = cropBox.x * scaleX, sy = cropBox.y * scaleY
      const sw = cropBox.w * scaleX, sh = cropBox.h * scaleY
      canvas.width = sw; canvas.height = sh
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      canvas.toBlob(blob => { if (blob) downloadBlob(blob, 'cropped_' + file.name) }, 'image/png')
    }
    img.src = imgUrl
  }

  return (
    <div className="space-y-6">
      <MemphisCard className="p-6 border-dashed border-2 border-mem-ink/40 text-center relative hover:border-mem-ink transition-colors bg-white">
        <input type="file" accept="image/*" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        <Upload className="w-8 h-8 mx-auto mb-2 text-mem-ink/60" />
        <p className="font-display font-black text-sm text-mem-ink">{file ? file.name : '选择图片文件'}</p>
      </MemphisCard>

      {imgUrl && (
        <MemphisCard className="p-4 space-y-4">
          <div id="crop-preview" className="relative inline-block border-2 border-mem-ink rounded-xl overflow-hidden"
            onMouseDown={e => {
              const rect = (e.target as HTMLElement).closest('#crop-preview')?.getBoundingClientRect()
              if (!rect) return
              setDragging(true)
              setDragStart({ x: e.clientX, y: e.clientY, bx: cropBox.x, by: cropBox.y })
            }}
            onMouseMove={e => {
              if (!dragging) return
              setCropBox(prev => ({
                ...prev,
                x: Math.max(0, dragStart.bx + e.clientX - dragStart.x),
                y: Math.max(0, dragStart.by + e.clientY - dragStart.y)
              }))
            }}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
          >
            <img src={imgUrl} alt="preview" className="max-w-full max-h-[400px] block" />
            <div className="absolute border-2 border-dashed border-mem-coral bg-mem-coral/10"
              style={{ left: cropBox.x, top: cropBox.y, width: cropBox.w, height: cropBox.h, cursor: 'move' }} />
          </div>
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div><label className="font-bold">X</label><input type="number" value={cropBox.x} onChange={e => setCropBox({...cropBox, x: +e.target.value})}
              className="w-full p-1 border border-mem-ink rounded text-xs" /></div>
            <div><label className="font-bold">Y</label><input type="number" value={cropBox.y} onChange={e => setCropBox({...cropBox, y: +e.target.value})}
              className="w-full p-1 border border-mem-ink rounded text-xs" /></div>
            <div><label className="font-bold">宽</label><input type="number" value={cropBox.w} onChange={e => setCropBox({...cropBox, w: +e.target.value})}
              className="w-full p-1 border border-mem-ink rounded text-xs" /></div>
            <div><label className="font-bold">高</label><input type="number" value={cropBox.h} onChange={e => setCropBox({...cropBox, h: +e.target.value})}
              className="w-full p-1 border border-mem-ink rounded text-xs" /></div>
          </div>
          <MemphisButton variant="teal" icon={<Crop className="w-4 h-4" />} onClick={handleExport}>裁切并下载</MemphisButton>
        </MemphisCard>
      )}
    </div>
  )
}
