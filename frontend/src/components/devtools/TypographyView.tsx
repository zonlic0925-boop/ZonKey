import React, { useState, useMemo } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { AnimatedCounter } from '../common/AnimatedCounter'
import {
  autoPanguSpacing,
  computeTextStats,
  generateStrongPassword,
} from '../../lib/core-text/typography'
import { Sparkles, KeyRound, Copy, Check, Type } from 'lucide-react'

export const TypographyView: React.FC = () => {
  const [inputText, setInputText] = useState(
    '欢迎使用ZonScale2.0，这是一个100%纯离线文件脱敏与生产力工作台。支持PDF、Word与各类多媒体文件无损处理。'
  )
  const [password, setPassword] = useState('')
  const [copied, setCopied] = useState(false)

  const stats = useMemo(() => computeTextStats(inputText), [inputText])

  const handleFormatPangu = () => {
    setInputText(autoPanguSpacing(inputText))
  }

  const handleGenPassword = () => {
    setPassword(generateStrongPassword(18))
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-6">
      {/* Stats Counter Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MemphisCard className="p-3 bg-mem-yellow/15">
          <span className="text-[11px] font-display font-black text-mem-ink/70">总字符数</span>
          <div className="text-xl font-display font-black text-mem-ink mt-0.5">
            <AnimatedCounter value={stats.chars} />
          </div>
        </MemphisCard>
        <MemphisCard className="p-3 bg-mem-teal/15">
          <span className="text-[11px] font-display font-black text-mem-ink/70">中文字符</span>
          <div className="text-xl font-display font-black text-mem-ink mt-0.5">
            <AnimatedCounter value={stats.cjkChars} />
          </div>
        </MemphisCard>
        <MemphisCard className="p-3 bg-mem-sky/15">
          <span className="text-[11px] font-display font-black text-mem-ink/70">总词数</span>
          <div className="text-xl font-display font-black text-mem-ink mt-0.5">
            <AnimatedCounter value={stats.words} />
          </div>
        </MemphisCard>
        <MemphisCard className="p-3 bg-mem-coral/15">
          <span className="text-[11px] font-display font-black text-mem-ink/70">预计阅读时长</span>
          <div className="text-xl font-display font-black text-mem-ink mt-0.5">
            ~<AnimatedCounter value={stats.readingTimeMinutes} /> 分钟
          </div>
        </MemphisCard>
      </div>

      {/* Typography Formatter */}
      <MemphisCard className="p-4 bg-white space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-display font-bold text-mem-ink/70 uppercase flex items-center gap-1.5">
            <Type className="w-4 h-4" /> 盘古中英排版美化 (自动在中英混排间插入空格)
          </label>
          <MemphisButton variant="yellow" onClick={handleFormatPangu} size="sm" icon={<Sparkles className="w-3.5 h-3.5" />}>
            一键美化排版
          </MemphisButton>
        </div>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={5}
          className="w-full p-3 font-mono text-sm border-2 border-mem-ink rounded-lg focus:ring-2 focus:ring-mem-yellow"
        />
      </MemphisCard>

      {/* Strong Password Generator */}
      <MemphisCard className="p-4 bg-mem-lime/20 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-display font-black text-mem-ink uppercase flex items-center gap-1.5">
            <KeyRound className="w-4 h-4" /> 本地安全强密码生成器 (100% 密码学安全随机)
          </label>
          <MemphisButton variant="lime" onClick={handleGenPassword} size="sm">
            生成 18 位高强度密码
          </MemphisButton>
        </div>

        {password && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={password}
              className="flex-1 p-2.5 font-mono text-sm font-bold border-2 border-mem-ink rounded-lg bg-white select-all text-mem-ink"
            />
            <MemphisButton variant="white" onClick={copyPassword} size="sm" icon={copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}>
              {copied ? '已复制' : '复制'}
            </MemphisButton>
          </div>
        )}
      </MemphisCard>
    </div>
  )
}
