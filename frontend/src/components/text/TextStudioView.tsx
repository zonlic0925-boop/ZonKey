import React, { useState } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { Type, BarChart2, Copy, FileDown } from 'lucide-react'
import { analyzeText, diffTexts } from '../../lib/toolknit/textCore'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a')
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
}

type TextMode = 'stats' | 'diff'

export const TextStudioView: React.FC = () => {
  const [mode, setMode] = useState<TextMode>('stats')
  const [inputA, setInputA] = useState('')
  const [inputB, setInputB] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [diffResult, setDiffResult] = useState<{ type: string; value: string }[]>([])

  const handleStats = () => {
    if (!inputA.trim()) return
    setStats(analyzeText(inputA))
  }

  const handleDiff = () => {
    if (!inputA.trim() && !inputB.trim()) return
    setDiffResult(diffTexts(inputA, inputB))
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <MemphisButton variant={mode === 'stats' ? 'sky' : 'white'} size="sm" icon={<BarChart2 className="w-4 h-4" />}
          onClick={() => { setMode('stats'); setDiffResult([]) }}>文本统计</MemphisButton>
        <MemphisButton variant={mode === 'diff' ? 'sky' : 'white'} size="sm" icon={<Type className="w-4 h-4" />}
          onClick={() => { setMode('diff'); setStats(null) }}>文本对比</MemphisButton>
      </div>

      {mode === 'stats' && (
        <MemphisCard className="p-4 space-y-4">
          <textarea value={inputA} onChange={e => setInputA(e.target.value)} rows={8} placeholder="粘贴或输入需要统计的文本..."
            className="w-full p-3 border-2 border-mem-ink rounded-xl text-sm font-mono resize-y focus:ring-2 focus:ring-mem-sky" />
          <MemphisButton variant="teal" icon={<BarChart2 className="w-4 h-4" />} onClick={handleStats}>分析</MemphisButton>
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '总字符', value: stats.totalChars },
                { label: '中文字符', value: stats.chineseChars },
                { label: '英文单词', value: stats.englishWords },
                { label: '数字', value: stats.digits },
                { label: '行数', value: stats.lines },
                { label: '段落', value: stats.paragraphs },
                { label: '预计阅读', value: stats.readingTimeMinutes + ' 分钟' },
                { label: '空白字符', value: stats.whitespace },
              ].map(item => (
                <div key={item.label} className="p-3 bg-mem-sky/10 border-2 border-mem-ink rounded-xl text-center">
                  <p className="text-2xl font-display font-black text-mem-ink">{item.value}</p>
                  <p className="text-[10px] font-bold text-mem-ink/60 mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </MemphisCard>
      )}

      {mode === 'diff' && (
        <MemphisCard className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-display font-black mb-1">文本 A（原文）</label>
              <textarea value={inputA} onChange={e => setInputA(e.target.value)} rows={8} placeholder="原始文本..."
                className="w-full p-3 border-2 border-mem-ink rounded-xl text-sm font-mono resize-y" />
            </div>
            <div>
              <label className="block text-xs font-display font-black mb-1">文本 B（修改后）</label>
              <textarea value={inputB} onChange={e => setInputB(e.target.value)} rows={8} placeholder="修改后文本..."
                className="w-full p-3 border-2 border-mem-ink rounded-xl text-sm font-mono resize-y" />
            </div>
          </div>
          <MemphisButton variant="teal" icon={<Type className="w-4 h-4" />} onClick={handleDiff}>对比</MemphisButton>
          {diffResult.length > 0 && (
            <div className="p-3 bg-white border-2 border-mem-ink rounded-xl font-mono text-sm whitespace-pre-wrap max-h-80 overflow-y-auto">
              {diffResult.map((d, i) => (
                <span key={i} className={
                  d.type === 'added' ? 'bg-green-200 text-green-900' :
                  d.type === 'removed' ? 'bg-red-200 text-red-900 line-through' : ''
                }>{d.value}</span>
              ))}
            </div>
          )}
        </MemphisCard>
      )}
    </div>
  )
}
