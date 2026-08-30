import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { MemphisButton } from '../common/MemphisButton'
import { useI18n } from '../../i18n'
import { copyTextToClipboard } from '../../lib/deliver'

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className = '',
}) => (
  <label className={`block ${className}`}>
    <span className="block mb-1 text-[11px] font-bold text-mem-ink/70">{label}</span>
    {children}
  </label>
)

export const inputClass =
  'w-full px-2.5 py-2 border-2 border-mem-ink rounded-xl text-xs font-mono bg-white focus:outline-none focus:shadow-memphis-sm'

export const NumInput: React.FC<{
  value: number
  onChange: (v: number) => void
  step?: number | 'any'
  min?: number
  max?: number
}> = ({ value, onChange, step, min, max }) => (
  <input
    type="number"
    value={Number.isFinite(value) ? value : ''}
    step={step}
    min={min}
    max={max}
    onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
    className={inputClass}
  />
)

export const AreaInput: React.FC<{
  value: string
  onChange?: (v: string) => void
  rows?: number
  placeholder?: string
  readOnly?: boolean
}> = ({ value, onChange, rows = 4, placeholder, readOnly }) => (
  <textarea
    value={value}
    onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    rows={rows}
    readOnly={readOnly}
    placeholder={placeholder}
    className={`${inputClass} resize-y ${readOnly ? 'bg-mem-cream' : ''}`}
  />
)

export const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  return (
    <MemphisButton
      size="sm"
      variant="white"
      onClick={async () => {
        // 局域网 HTTP 等非安全上下文自动回退 execCommand
        await copyTextToClipboard(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-mem-teal" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? t('calcdev.copied') : t('calcdev.copy')}
    </MemphisButton>
  )
}

export const ResultTile: React.FC<{
  value: React.ReactNode
  label: string
  tone?: 'sky' | 'teal' | 'yellow' | 'coral' | 'lavender' | 'lime'
}> = ({ value, label, tone = 'sky' }) => {
  const tones: Record<string, string> = {
    sky: 'bg-mem-sky/15',
    teal: 'bg-mem-teal/15',
    yellow: 'bg-mem-yellow/25',
    coral: 'bg-mem-coral/10',
    lavender: 'bg-mem-lavender/15',
    lime: 'bg-mem-lime/20',
  }
  return (
    <div className={`p-3 ${tones[tone]} border-2 border-mem-ink rounded-xl text-center min-w-0`}>
      <p className="text-base md:text-lg font-black font-display text-mem-ink truncate">{value}</p>
      <p className="text-[10px] font-bold text-mem-ink/60 mt-0.5">{label}</p>
    </div>
  )
}

export const ErrorLine: React.FC<{ message?: string | null }> = ({ message }) =>
  message ? (
    <p className="text-xs font-bold text-mem-coral border-2 border-mem-coral/40 bg-mem-coral/10 rounded-xl px-3 py-2">
      {message}
    </p>
  ) : null

export interface TabOption<T extends string> {
  id: T
  label: string
}

export function TabsRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: TabOption<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <MemphisButton
          key={opt.id}
          size="sm"
          variant={value === opt.id ? 'sky' : 'white'}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </MemphisButton>
      ))}
    </div>
  )
}
