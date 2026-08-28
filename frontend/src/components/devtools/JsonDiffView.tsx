import React, { useState } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { Check, Sparkles, FileCode } from 'lucide-react'

export const JsonDiffView: React.FC = () => {
  const [jsonInput, setJsonInput] = useState(`{\n  "app": "ZonScale",\n  "version": 2.1,\n  "offline": true,\n  "features": ["Redaction", "DevTools", "ImageStudio"]\n}`)
  const [formatted, setFormatted] = useState('')
  const [error, setError] = useState('')

  const handleFormat = () => {
    try {
      setError('')
      const obj = JSON.parse(jsonInput)
      setFormatted(JSON.stringify(obj, null, 2))
    } catch (e: any) {
      setError('JSON 语法错误: ' + e.message)
      setFormatted('')
    }
  }

  const handleCompress = () => {
    try {
      setError('')
      const obj = JSON.parse(jsonInput)
      setFormatted(JSON.stringify(obj))
    } catch (e: any) {
      setError('JSON 语法错误: ' + e.message)
      setFormatted('')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <MemphisButton variant="lavender" onClick={handleFormat} icon={<Sparkles className="w-4 h-4" />}>
          美化格式化 (Pretty Print)
        </MemphisButton>
        <MemphisButton variant="white" onClick={handleCompress} icon={<FileCode className="w-4 h-4" />}>
          去除空格压缩 (Minify)
        </MemphisButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MemphisCard className="p-4 bg-white space-y-2">
          <label className="block text-xs font-display font-bold text-mem-ink/70 uppercase">
            原始 JSON 字符串
          </label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={12}
            className="w-full p-3 font-mono text-xs border-2 border-mem-ink rounded-lg focus:ring-2 focus:ring-mem-lavender"
          />
          {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
        </MemphisCard>

        <MemphisCard className="p-4 bg-mem-lavender/10 space-y-2">
          <label className="block text-xs font-display font-bold text-mem-ink/70 uppercase">
            格式化输出
          </label>
          <textarea
            readOnly
            value={formatted}
            placeholder="点击上方格式化按钮执行..."
            rows={12}
            className="w-full p-3 font-mono text-xs border-2 border-mem-ink rounded-lg bg-white select-all"
          />
        </MemphisCard>
      </div>
    </div>
  )
}
