import React, { useState } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { extractPaletteFromImage, ColorSwatch } from '../../lib/core-image/canvas-tools'
import { Pipette, Copy, Check, Upload } from 'lucide-react'

export const ColorPaletteView: React.FC = () => {
  const [imageUrl, setImageUrl] = useState('')
  const [palette, setPalette] = useState<ColorSwatch[]>([])
  const [copiedColor, setCopiedColor] = useState<string | null>(null)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      setImageUrl(url)

      const img = new Image()
      img.src = url
      img.onload = () => {
        const swatches = extractPaletteFromImage(img, 8)
        setPalette(swatches)
      }
    }
    reader.readAsDataURL(file)
  }

  const copyColor = (hex: string) => {
    navigator.clipboard.writeText(hex)
    setCopiedColor(hex)
    setTimeout(() => setCopiedColor(null), 1500)
  }

  return (
    <div className="space-y-6">
      <MemphisCard className="p-6 border-dashed border-2 border-mem-ink/40 text-center relative hover:border-mem-ink transition-colors bg-white">
        <input
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <Pipette className="w-8 h-8 mx-auto mb-2 text-mem-ink/60" />
        <p className="font-display font-black text-sm text-mem-ink">
          {imageUrl ? '点击更换图片' : '上传图片提取主色调配色方案'}
        </p>
        <p className="text-xs text-mem-ink/50 mt-1">
          Canvas 本地色彩量化，秒级提取 8 种最具代表性的品牌色
        </p>
      </MemphisCard>

      {imageUrl && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MemphisCard className="p-3 bg-white flex items-center justify-center">
            <img src={imageUrl} alt="source" className="max-h-60 object-contain rounded-lg border border-mem-ink/20" />
          </MemphisCard>

          <MemphisCard className="p-4 bg-mem-sun/15 space-y-3">
            <span className="font-display font-black text-xs text-mem-ink uppercase">
              提取主题色卡 ({palette.length})
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {palette.map((c) => (
                <div
                  key={c.hex}
                  onClick={() => copyColor(c.hex)}
                  className="p-2 bg-white border-2 border-mem-ink rounded-xl cursor-pointer hover:-translate-y-0.5 transition-transform shadow-memphis-sm group"
                >
                  <div
                    className="h-12 rounded-lg border border-mem-ink/20 mb-2 relative flex items-center justify-center"
                    style={{ backgroundColor: c.hex }}
                  >
                    {copiedColor === c.hex && (
                      <span className="bg-mem-ink text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                        已复制!
                      </span>
                    )}
                  </div>
                  <p className="font-mono font-bold text-xs text-center text-mem-ink">{c.hex}</p>
                  <p className="font-mono text-[9px] text-center text-mem-ink/60 truncate">{c.hsl}</p>
                </div>
              ))}
            </div>
          </MemphisCard>
        </div>
      )}
    </div>
  )
}
