import React, { useState } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { Upload, Download, Image as ImageIcon } from 'lucide-react'
import { generateIcons } from '../../lib/toolknit/imageCore'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

export const IconGenView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [imgUrl, setImgUrl] = useState('')
  const [sizes, setSizes] = useState([16, 32, 48, 64, 128, 256])
  const [previews, setPreviews] = useState<{ size: number; url: string }[]>([])
  const [zipBlob, setZipBlob] = useState<Blob | null>(null)
  const [icoBlob, setIcoBlob] = useState<Blob | null>(null)
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState('')

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f); setImgUrl(URL.createObjectURL(f)); setPreviews([]); setZipBlob(null); setIcoBlob(null); setStatus('')
  }

  const handleGenerate = async () => {
    if (!file) return
    setProcessing(true); setStatus('正在生成多尺寸图标...')
    try {
      const result = await generateIcons(file, sizes)
      setPreviews(result.previews)
      setZipBlob(result.zipBlob)
      setIcoBlob(result.icoBlob)
      setStatus('生成完成！')
    } catch (e: any) { setStatus('生成失败: ' + e.message) }
    setProcessing(false)
  }

  return (
    <div className="space-y-6">
      <MemphisCard className="p-6 border-dashed border-2 border-mem-ink/40 text-center relative hover:border-mem-ink transition-colors bg-white">
        <input type="file" accept="image/*" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        <Upload className="w-8 h-8 mx-auto mb-2 text-mem-ink/60" />
        <p className="font-display font-black text-sm text-mem-ink">{file ? file.name : '选择源图片（建议 512×512 以上正方形）'}</p>
      </MemphisCard>

      {imgUrl && (
        <MemphisCard className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <img src={imgUrl} alt="source" className="w-20 h-20 border-2 border-mem-ink rounded-xl object-cover" />
            <div className="flex-1">
              <p className="text-xs font-bold mb-2">目标尺寸 (px):</p>
              <div className="flex flex-wrap gap-2">
                {[16,32,48,64,128,256,512].map(s => (
                  <label key={s} className="flex items-center gap-1 text-xs font-bold cursor-pointer">
                    <input type="checkbox" checked={sizes.includes(s)} onChange={e => {
                      if (e.target.checked) setSizes([...sizes, s].sort((a,b)=>a-b))
                      else setSizes(sizes.filter(x => x !== s))
                    }} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <MemphisButton variant="sky" icon={<ImageIcon className="w-4 h-4" />} onClick={handleGenerate} disabled={processing}>
            {processing ? '生成中...' : '生成图标'}
          </MemphisButton>
        </MemphisCard>
      )}

      {previews.length > 0 && (
        <MemphisCard className="p-4 space-y-4">
          <p className="font-display font-black text-xs">生成预览</p>
          <div className="flex flex-wrap gap-4 items-end">
            {previews.map(p => (
              <div key={p.size} className="flex flex-col items-center gap-1">
                <img src={p.url} alt={p.size + 'px'} style={{ width: Math.min(p.size, 128), height: Math.min(p.size, 128) }}
                  className="border border-mem-ink rounded bg-white object-contain" />
                <span className="text-[10px] font-mono font-bold">{p.size}px</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            {zipBlob && <MemphisButton variant="teal" size="sm" icon={<Download className="w-3 h-3" />}
              onClick={() => downloadBlob(zipBlob, 'icons.zip')}>下载 ZIP</MemphisButton>}
            {icoBlob && <MemphisButton variant="sky" size="sm" icon={<Download className="w-3 h-3" />}
              onClick={() => downloadBlob(icoBlob, 'favicon.ico')}>下载 ICO</MemphisButton>}
          </div>
          {status && <p className="text-xs font-bold text-green-700">{status}</p>}
        </MemphisCard>
      )}
    </div>
  )
}
