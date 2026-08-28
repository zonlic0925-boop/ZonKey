import React, { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { ErrorLine, Field, CopyButton, inputClass } from './kit'

interface Converted {
  local: string
  utc: string
  iso: string
  relative: string
}

function relativeTime(ms: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  const diff = ms - Date.now()
  const abs = Math.abs(diff)
  const units: [number, string][] = [
    [1000 * 60 * 60 * 24 * 365, 'year'],
    [1000 * 60 * 60 * 24 * 30, 'month'],
    [1000 * 60 * 60 * 24, 'day'],
    [1000 * 60 * 60, 'hour'],
    [1000 * 60, 'minute'],
    [1000, 'second'],
  ]
  for (const [unitMs, name] of units) {
    if (abs >= unitMs || name === 'second') {
      const value = Math.round(abs / unitMs)
      return t(diff >= 0 ? 'calcdev.inFuture' : 'calcdev.agoAgo', { unit: t(`calcdev.unit_${name}`), count: value })
    }
  }
  return ''
}

function convertInput(raw: string, t: (k: string, v?: Record<string, string | number>) => string): Converted {
  const text = raw.trim()
  if (!text) throw new Error('invalid')
  let ms: number
  if (/^-?\d+$/.test(text)) {
    const num = Number(text)
    ms = Math.abs(num) < 1e11 ? num * 1000 : num
  } else {
    ms = new Date(text).getTime()
  }
  if (!Number.isFinite(ms)) throw new Error('invalid')
  const date = new Date(ms)
  return {
    local: date.toLocaleString(),
    utc: date.toUTCString(),
    iso: date.toISOString(),
    relative: relativeTime(ms, t),
  }
}

export const TimestampCalcView: React.FC = () => {
  const { t } = useI18n()
  const [now, setNow] = useState(() => new Date())
  const [input, setInput] = useState('')
  const [result, setResult] = useState<Converted | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const run = () => {
    try {
      setResult(convertInput(input, t))
      setError(null)
    } catch {
      setError(t('calcdev.invalidDate'))
      setResult(null)
    }
  }

  const rows: [string, string][] = result
    ? [
        [t('calcdev.localTime'), result.local],
        [t('calcdev.utcTime'), result.utc],
        ['ISO 8601', result.iso],
        [t('calcdev.relative'), result.relative],
      ]
    : []

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Clock3 className="w-5 h-5 text-mem-lavender" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.timestampCalc')}</h3>
      </div>

      <div className="p-3 bg-mem-lavender/10 border-2 border-mem-ink rounded-xl space-y-1.5 text-xs font-mono">
        <div className="flex items-center justify-between gap-2">
          <span>{t('calcdev.nowSec')}: <b>{Math.floor(now.getTime() / 1000)}</b></span>
          <CopyButton text={String(Math.floor(now.getTime() / 1000))} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>{t('calcdev.nowMs')}: <b>{now.getTime()}</b></span>
          <CopyButton text={String(now.getTime())} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>ISO 8601: <b>{now.toISOString()}</b></span>
          <CopyButton text={now.toISOString()} />
        </div>
      </div>

      <Field label={t('calcdev.inputHintTs')}>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="1787900000 / 2026-08-28T10:00:00Z"
            className={inputClass}
          />
          <MemphisButton variant="lavender" onClick={run} className="shrink-0">
            {t('calcdev.convert')}
          </MemphisButton>
        </div>
      </Field>

      <ErrorLine message={error} />

      {result && (
        <div className="space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 p-2.5 bg-white border-2 border-mem-ink rounded-xl">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-mem-ink/60">{label}</p>
                <p className="text-xs font-mono font-bold text-mem-ink truncate">{value}</p>
              </div>
              <CopyButton text={value} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
