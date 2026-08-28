import React, { useState, useMemo } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'

const PRESET_PATTERNS = [
  { label: '手机号 (中国大陆)', pattern: '1[3-9]\\d{9}', flags: 'g' },
  { label: '电子邮箱', pattern: '[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}', flags: 'gi' },
  { label: '身份证号 (18位)', pattern: '\\d{17}[\\dXx]', flags: 'g' },
  { label: 'IPv4 地址', pattern: '(?:\\d{1,3}\\.){3}\\d{1,3}', flags: 'g' },
  { label: '中文字符', pattern: '[\\u4e00-\\u9fa5]+', flags: 'g' },
]

export const RegexTesterView: React.FC = () => {
  const [pattern, setPattern] = useState('\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b')
  const [flags, setFlags] = useState('g')
  const [testText, setTestText] = useState(
    'Contact support at contact@zonscale.local or admin@test.offline for assistance.'
  )

  const matchResult = useMemo(() => {
    if (!pattern) return { matches: [], error: null }
    try {
      const regex = new RegExp(pattern, flags)
      const matches: Array<{ text: string; index: number }> = []

      let match: RegExpExecArray | null
      if (flags.includes('g')) {
        while ((match = regex.exec(testText)) !== null) {
          matches.push({ text: match[0], index: match.index })
          if (match.index === regex.lastIndex) regex.lastIndex++
        }
      } else {
        match = regex.exec(testText)
        if (match) matches.push({ text: match[0], index: match.index })
      }

      return { matches, error: null }
    } catch (e: any) {
      return { matches: [], error: e.message }
    }
  }, [pattern, flags, testText])

  return (
    <div className="space-y-6">
      {/* Pattern Presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-display font-bold text-mem-ink/70">快速模版:</span>
        {PRESET_PATTERNS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setPattern(p.pattern)
              setFlags(p.flags)
            }}
            className="px-2.5 py-1 bg-white border border-mem-ink text-xs font-bold rounded-lg hover:bg-mem-yellow transition-colors shadow-memphis-sm"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Regex Input Card */}
      <MemphisCard className="p-4 bg-white space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-display font-bold text-mem-ink/70 mb-1 uppercase">
              正则表达式 Pattern
            </label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="输入正则表达式..."
              className="w-full p-2.5 font-mono text-sm border-2 border-mem-ink rounded-lg focus:ring-2 focus:ring-mem-coral"
            />
          </div>
          <div className="w-24">
            <label className="block text-xs font-display font-bold text-mem-ink/70 mb-1 uppercase">
              修饰符 Flags
            </label>
            <input
              type="text"
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              placeholder="g, i, m..."
              className="w-full p-2.5 font-mono text-sm border-2 border-mem-ink rounded-lg focus:ring-2 focus:ring-mem-coral"
            />
          </div>
        </div>

        {matchResult.error ? (
          <p className="text-xs text-red-600 font-bold flex items-center gap-1">
            <AlertCircle className="w-4 h-4" /> 语法错误: {matchResult.error}
          </p>
        ) : (
          <p className="text-xs text-green-700 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> 捕获命中 {matchResult.matches.length} 处匹配项
          </p>
        )}
      </MemphisCard>

      {/* Test String and Matches */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MemphisCard className="p-4 bg-white space-y-2">
          <label className="block text-xs font-display font-bold text-mem-ink/70 uppercase">
            待测试文本
          </label>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={8}
            className="w-full p-3 font-mono text-xs border-2 border-mem-ink rounded-lg focus:ring-2 focus:ring-mem-coral"
          />
        </MemphisCard>

        <MemphisCard className="p-4 bg-mem-coral/10 space-y-2">
          <label className="block text-xs font-display font-bold text-mem-ink/70 uppercase">
            捕获列表 ({matchResult.matches.length})
          </label>
          <div className="h-[210px] overflow-y-auto space-y-2 pr-1">
            {matchResult.matches.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-mem-ink/50 font-bold">
                暂无匹配内容
              </div>
            ) : (
              matchResult.matches.map((m, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-white border border-mem-ink rounded-lg flex items-center justify-between text-xs font-mono shadow-memphis-sm"
                >
                  <span className="text-mem-coral font-bold truncate max-w-[200px]">{m.text}</span>
                  <span className="text-mem-ink/50 text-[10px]">Index: {m.index}</span>
                </div>
              ))
            )}
          </div>
        </MemphisCard>
      </div>
    </div>
  )
}
