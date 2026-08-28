import React, { useState } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { Image as ImageIcon, FileText, Upload, Download, Copy } from 'lucide-react'
import { extractPptImages, extractPptText } from '../../lib/toolknit/officeCore'
import JSZip from 'jszip'

type PptMode = 'images' | 'text'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export const PptExtractView: React.FC = () => {
  const [mode, setMode] = useState<PptMode>('images')
  const [file, setFile] = useState<File | null>(null)
  const [images, setImages] = useState<{ name: string; blob: Blob; size: number; url?: string }[]>([])
  const [slides, setSlides] = useState<{ slideIndex: number; text: string }[]>([])
  const [status, setStatus] = useState('')
  const [processing, setProcessing] = useState(false)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setImages([]); setSlides([]); setStatus('') }
  }

  const handleExtractImages = async () => {
    if (!file) return
    setProcessing(true); setStatus('正在提取图片...')
    try {
      const result = await extractPptImages(file)
      const withUrls = result.map(img => ({ ...img, url: URL.createObjectURL(img.blob) }))
      setImages(withUrls)
      setStatus(`提取完成，共 ${result.length} 张图片`)
    } catch (e: any) { setStatus('提取失败: ' + e.message) }
    setProcessing(false)
  }

  const handleExtractText = async () => {
    if (!file) return
    setProcessing(true); setStatus('正在提取文本...')
    try {
      const result = await extractPptText(file)
      setSlides(result)
      setStatus(`提取完成，共 ${result.length} 页幻灯片`)
    } catch (e: any) { setStatus('提取失败: ' + e.message) }
    setProcessing(false)
  }

  const downloadAllImages = async () => {
    const zip = new JSZip()
    for (const img of images) {
      const buf = await img.blob.arrayBuffer()
      zip.file(img.name, buf)
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'ppt_images.zip')
  }

  const copyAllText = () => {
    const all = slides.map(s => `=== 幻灯片 ${s.slideIndex} ===\n\n${s.text}`).join('\n\n')
    navigator.clipboard.writeText(all)
    setStatus('已复制到剪贴板')
  }

  const downloadText = () => {
    const all = slides.map(s => `=== 幻灯片 ${s.slideIndex} ===\n\n${s.text}`).join('\n\n')
    downloadBlob(new Blob([all], { type: 'text/plain;charset=utf-8' }), 'ppt_text.txt')
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <MemphisButton variant={mode === 'images' ? 'sky' : 'white'} size="sm" icon={<ImageIcon className="w-4 h-4" />}
          onClick={() => { setMode('images'); setImages([]); setSlides([]); setStatus('') }}>PPT 图片提取</MemphisButton>
        <MemphisButton variant={mode === 'text' ? 'sky' : 'white'} size="sm" icon={<FileText className="w-4 h-4" />}
          onClick={() => { setMode('text'); setImages([]); setSlides([]); setStatus('') }}>PPT 文本提取</MemphisButton>
      </div>

      <MemphisCard className="p-6 border-dashed border-2 border-mem-ink/40 text-center relative hover:border-mem-ink transition-colors bg-white">
        <input type="file" accept=".pptx" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        <Upload className="w-8 h-8 mx-auto mb-2 text-mem-ink/60" />
        <p className="font-display font-black text-sm text-mem-ink">
          {file ? file.name : '选择或拖拽 PPTX 文件'}
        </p>
      </MemphisCard>

      {file && (
        <div className="flex gap-2">
          <MemphisButton variant="sky" onClick={mode === 'images' ? handleExtractImages : handleExtractText} disabled={processing}>
            {processing ? '正在提取...' : mode === 'images' ? '提取图片' : '提取文本'}
          </MemphisButton>
        </div>
      )}

      {images.length > 0 && (
        <MemphisCard className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display font-black text-xs">提取结果 ({images.length} 张)</span>
            <MemphisButton variant="teal" size="sm" icon={<Download className="w-3 h-3" />} onClick={downloadAllImages}>全部下载 ZIP</MemphisButton>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {images.map((img, i) => (
              <div key={i} className="border-2 border-mem-ink rounded-xl overflow-hidden bg-white shadow-memphis-sm">
                <img src={img.url} alt={img.name} className="w-full h-24 object-cover" />
                <div className="p-1.5 text-center">
                  <p className="text-[10px] font-mono truncate">{img.name}</p>
                  <button onClick={() => downloadBlob(img.blob, img.name)} className="text-[10px] text-mem-sky font-bold hover:underline">下载</button>
                </div>
              </div>
            ))}
          </div>
        </MemphisCard>
      )}

      {slides.length > 0 && (
        <MemphisCard className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display font-black text-xs">文本内容 ({slides.length} 页)</span>
            <div className="flex gap-2">
              <MemphisButton variant="teal" size="sm" icon={<Copy className="w-3 h-3" />} onClick={copyAllText}>复制全部</MemphisButton>
              <MemphisButton variant="sky" size="sm" icon={<Download className="w-3 h-3" />} onClick={downloadText}>下载 TXT</MemphisButton>
            </div>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {slides.map(s => (
              <div key={s.slideIndex} className="border border-mem-ink/30 rounded-lg p-3 bg-white">
                <p className="font-display font-black text-xs text-mem-sky mb-1">幻灯片 {s.slideIndex}</p>
                <pre className="text-xs font-mono whitespace-pre-wrap text-mem-ink/80">{s.text || '(无文本)'}</pre>
              </div>
            ))}
          </div>
        </MemphisCard>
      )}

      {status && <p className="text-xs font-bold text-green-700">{status}</p>}
    </div>
  )
}
