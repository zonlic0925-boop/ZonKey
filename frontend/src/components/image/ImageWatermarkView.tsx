import React, { useState, useRef } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { Upload, Droplets, Download } from 'lucide-react'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

export const ImageWatermarkView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [imgUrl, setImgUrl] = useState('')
  const [text, setText] = useState('WATERMARK')
  const [fontSize, setFontSize] = useState(32)
  const [opacity, setOpacity] = useState(0.2)
  const [angle, setAngle] = useState(-30)
  const [color, setColor] = useState('#888888')
  const [preview, setPreview] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f); setImgUrl(URL.createObjectURL(f)); setPreview('')
  }

  const generatePreview = () => {
    if (!imgUrl) return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      ctx.globalAlpha = opacity
      ctx.fillStyle = color; ctx.font = fontSize + 'px sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const step = fontSize * 5
      for (let y = -canvas.height; y < canvas.height * 2; y += step) {
        for (let x = -canvas.width; x < canvas.width * 2; x += step) {
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(angle * Math.PI / 180)
          ctx.fillText(text, 0, 0)
          ctx.restore()
        }
      }
      setPreview(canvas.toDataURL('image/png'))
    }
    img.src = imgUrl
  }

  const handleExport = () => {
    if (!preview) { generatePreview(); return }
    const a = document.createElement('a')
    a.href = preview; a.download = 'watermarked_' + (file?.name || 'image.png')
    a.click()
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="block text-xs font-bold mb-1">水印文字</label>
              <input type="text" value={text} onChange={e => setText(e.target.value)} className="w-full p-2 border-2 border-mem-ink rounded-lg text-xs" /></div>
            <div><label className="block text-xs font-bold mb-1">字号: {fontSize}</label>
              <input type="range" min={10} max={100} value={fontSize} onChange={e => setFontSize(+e.target.value)} className="w-full" /></div>
            <div><label className="block text-xs font-bold mb-1">透明度: {opacity.toFixed(2)}</label>
              <input type="range" min={5} max={80} value={opacity*100} onChange={e => setOpacity(+e.target.value/100)} className="w-full" /></div>
            <div><label className="block text-xs font-bold mb-1">角度: {angle}°</label>
              <input type="range" min={-90} max={90} value={angle} onChange={e => setAngle(+e.target.value)} className="w-full" /></div>
          </div>
          <div className="flex gap-3">
            <MemphisButton variant="sky" icon={<Droplets className="w-4 h-4" />} onClick={generatePreview}>预览水印</MemphisButton>
            <MemphisButton variant="teal" icon={<Download className="w-4 h-4" />} onClick={handleExport}>导出</MemphisButton>
          </div>
          {preview && <img src={preview} alt="watermarked" className="max-w-full max-h-[400px] border-2 border-mem-ink rounded-xl" />}
        </MemphisCard>
      )}
    </div>
  )
}
