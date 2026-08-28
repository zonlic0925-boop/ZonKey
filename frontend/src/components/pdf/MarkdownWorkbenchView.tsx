import React, { useState } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { FileEdit, Download, Copy, Check } from 'lucide-react'

export const MarkdownWorkbenchView: React.FC = () => {
  const [markdown, setMarkdown] = useState(`# ZonScale 纯离线工作台说明

## 核心特性
- **100% 离线脱敏**：CAD 图纸与工程文档本地脱敏
- **多媒体生产力工具箱**：
  1. 密码学与安全哈希 (MD5/SHA/AES)
  2. 图像智能拼接与调色板提取
  3. WebAudio 纯本地音频 BPM 测速
  4. PDF 拆分/合并与转换

> 严守数据合规，保障企业核心资产安全。
`)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'document.md'
    a.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileEdit className="w-5 h-5 text-mem-lavender" />
          <span className="font-display font-black text-sm text-mem-ink">
            双栏实时 Markdown 工作台
          </span>
        </div>
        <div className="flex gap-2">
          <MemphisButton variant="white" onClick={handleCopy} size="sm" icon={copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}>
            {copied ? '已复制' : '复制 MD'}
          </MemphisButton>
          <MemphisButton variant="lavender" onClick={handleDownload} size="sm" icon={<Download className="w-3.5 h-3.5" />}>
            导出 .md 文件
          </MemphisButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Editor */}
        <MemphisCard className="p-4 bg-white space-y-2">
          <label className="block text-xs font-display font-bold text-mem-ink/70 uppercase">
            Markdown 源代码编辑
          </label>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            rows={14}
            className="w-full p-3 font-mono text-xs border-2 border-mem-ink rounded-lg focus:ring-2 focus:ring-mem-lavender leading-relaxed"
          />
        </MemphisCard>

        {/* Live Preview */}
        <MemphisCard className="p-5 bg-mem-lavender/10 space-y-2 flex flex-col">
          <label className="block text-xs font-display font-bold text-mem-ink/70 uppercase">
            排版预览
          </label>
          <div className="flex-1 bg-white border-2 border-mem-ink rounded-lg p-4 overflow-auto prose prose-sm max-w-none text-mem-ink font-body">
            <div className="whitespace-pre-wrap font-sans text-xs space-y-2">
              {markdown}
            </div>
          </div>
        </MemphisCard>
      </div>
    </div>
  )
}
