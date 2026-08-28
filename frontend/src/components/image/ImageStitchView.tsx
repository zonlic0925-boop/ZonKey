import React, { useState } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { stitchImages } from '../../lib/core-image/canvas-tools'
import { Upload, Download, Grid, ArrowDown, ArrowRight, Trash2 } from 'lucide-react'

export const ImageStitchView: React.FC = () => {
  const [images, setImages] = useState<HTMLImageElement[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [direction, setDirection] = useState<'vertical' | 'horizontal' | 'grid'>('vertical')
  const [stitchedUrl, setStitchedUrl] = useState('')
  const [gap, setGap] = useState(10)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const url = reader.result as string
        const img = new Image()
        img.src = url
        img.onload = () => {
          setImages((prev) => [...prev, img])
          setImageUrls((prev) => [...prev, url])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const handleStitch = async () => {
    if (images.length === 0) return
    const result = await stitchImages(images, direction, gap, '#FFFFFF')
    setStitchedUrl(result)
  }

  const clearImages = () => {
    setImages([])
    setImageUrls([])
    setStitchedUrl('')
  }

  return (
    <div className="space-y-6">
      {/* Direction & Settings */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <MemphisButton
            variant={direction === 'vertical' ? 'yellow' : 'white'}
            onClick={() => setDirection('vertical')}
            icon={<ArrowDown className="w-4 h-4" />}
            size="sm"
          >
            垂直纵向长图
          </MemphisButton>
          <MemphisButton
            variant={direction === 'horizontal' ? 'yellow' : 'white'}
            onClick={() => setDirection('horizontal')}
            icon={<ArrowRight className="w-4 h-4" />}
            size="sm"
          >
            水平横向拼接
          </MemphisButton>
          <MemphisButton
            variant={direction === 'grid' ? 'yellow' : 'white'}
            onClick={() => setDirection('grid')}
            icon={<Grid className="w-4 h-4" />}
            size="sm"
          >
            智能多宫格
          </MemphisButton>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-display font-bold text-mem-ink/70">间距: {gap}px</label>
          <input
            type="range"
            min="0"
            max="50"
            value={gap}
            onChange={(e) => setGap(Number(e.target.value))}
            className="w-24 accent-mem-yellow"
          />
          {images.length > 0 && (
            <MemphisButton variant="coral" onClick={clearImages} size="sm" icon={<Trash2 className="w-4 h-4" />}>
              清空
            </MemphisButton>
          )}
        </div>
      </div>

      {/* Upload Zone */}
      {images.length === 0 ? (
        <MemphisCard className="p-8 border-dashed border-2 border-mem-ink/40 text-center relative hover:border-mem-ink transition-colors bg-white">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleUpload}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <Upload className="w-10 h-10 mx-auto mb-2 text-mem-ink/60" />
          <p className="font-display font-black text-sm text-mem-ink">点击或拖拽上传多张图片</p>
          <p className="text-xs text-mem-ink/50 mt-1">支持 PNG, JPG, WebP 纯本地 Canvas 拼接渲染</p>
        </MemphisCard>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-display font-bold text-mem-ink/70">
              已选 {images.length} 张图片
            </span>
            <MemphisButton variant="yellow" onClick={handleStitch} size="sm">
              立即生成拼接图
            </MemphisButton>
          </div>

          <div className="flex gap-2 overflow-x-auto p-2 bg-white border-2 border-mem-ink rounded-xl">
            {imageUrls.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt="thumb"
                className="w-20 h-20 object-cover border border-mem-ink/30 rounded-lg flex-shrink-0"
              />
            ))}
          </div>
        </div>
      )}

      {/* Result Preview */}
      {stitchedUrl && (
        <MemphisCard className="p-4 bg-mem-yellow/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display font-black text-xs text-mem-ink">拼接渲染预览</span>
            <a
              href={stitchedUrl}
              download="stitched_image.png"
              className="px-3 py-1.5 bg-mem-teal text-white border-2 border-mem-ink rounded-lg font-display font-black text-xs flex items-center gap-1.5 shadow-memphis-sm hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
            >
              <Download className="w-3.5 h-3.5" /> 保存高清图片
            </a>
          </div>
          <div className="max-h-[500px] overflow-auto border-2 border-mem-ink rounded-xl bg-white p-2 flex justify-center">
            <img src={stitchedUrl} alt="stitched" className="max-w-full object-contain" />
          </div>
        </MemphisCard>
      )}
    </div>
  )
}
