import React, { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  assessPasswordStrength,
  generatePassword,
  PASSWORD_LIMITS,
} from '../../lib/toolknit/passwordCore'
import { CopyButton, ErrorLine, Field, inputClass } from './kit'

const strengthColors: Record<string, string> = {
  weak: 'bg-mem-coral',
  fair: 'bg-mem-orange',
  strong: 'bg-mem-lime',
  veryStrong: 'bg-mem-teal',
}

export const PasswordGenView: React.FC = () => {
  const { t } = useI18n()
  const [length, setLength] = useState(16)
  const [uppercase, setUppercase] = useState(true)
  const [lowercase, setLowercase] = useState(true)
  const [numbers, setNumbers] = useState(true)
  const [symbols, setSymbols] = useState(true)
  const [excludeSimilar, setExcludeSimilar] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [strength, setStrength] = useState<ReturnType<typeof assessPasswordStrength> | null>(null)

  const checkboxes: [string, boolean, (v: boolean) => void][] = [
    [t('calcdev.uppercase'), uppercase, setUppercase],
    [t('calcdev.lowercase'), lowercase, setLowercase],
    [t('calcdev.numbers'), numbers, setNumbers],
    [t('calcdev.symbols'), symbols, setSymbols],
  ]

  const run = () => {
    try {
      const generated = generatePassword({ length, uppercase, lowercase, numbers, symbols, excludeSimilar })
      setPassword(generated.password)
      setStrength(assessPasswordStrength(generated.password.length, generated.charsetSize))
      setError(null)
    } catch (err) {
      const message = String((err as Error).message)
      setError(message.includes('At least one') ? t('calcdev.needOneCategory') : t('calcdev.categoryTooShort'))
      setPassword('')
      setStrength(null)
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="w-5 h-5 text-mem-lime" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.passwordGen')}</h3>
      </div>

      <Field label={`${t('calcdev.length')}: ${length}`}>
        <input
          type="range"
          min={PASSWORD_LIMITS.minLength}
          max={PASSWORD_LIMITS.maxLength}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-full accent-mem-ink"
        />
      </Field>

      <div className="grid grid-cols-2 gap-2 text-xs font-bold">
        {checkboxes.map(([label, checked, setChecked]) => (
          <label key={label} className="flex items-center gap-2 p-2 border-2 border-mem-ink/15 rounded-xl bg-white cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="accent-mem-ink" />
            {label}
          </label>
        ))}
        <label className="flex items-center gap-2 p-2 border-2 border-mem-ink/15 rounded-xl bg-white cursor-pointer">
          <input type="checkbox" checked={excludeSimilar} onChange={(e) => setExcludeSimilar(e.target.checked)} className="accent-mem-ink" />
          {t('calcdev.excludeSimilar')}
        </label>
      </div>

      <MemphisButton variant="lime" onClick={run}>
        {t('calcdev.generate')}
      </MemphisButton>

      <ErrorLine message={error} />

      {password && strength && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-white border-2 border-mem-ink rounded-xl">
            <code className="flex-1 text-sm font-mono font-bold break-all">{password}</code>
            <CopyButton text={password} />
          </div>
          <div>
            <div className="flex justify-between text-xs font-bold text-mem-ink/70 mb-1">
              <span>{t('calcdev.strength')}: {t(`calcdev.strength_${strength.label}`)}</span>
              <span>{t('calcdev.entropy')}: {strength.entropy.toFixed(0)} bits</span>
            </div>
            <div className="h-2.5 border-2 border-mem-ink rounded-full overflow-hidden bg-white">
              <div className={`h-full ${strengthColors[strength.label]}`} style={{ width: `${strength.percent}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
