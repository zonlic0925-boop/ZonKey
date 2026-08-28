import React, { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  calculateLumpSumCompound,
  calculateRecurringCompound,
} from '../../lib/toolknit/calcCore'
import { ErrorLine, Field, NumInput, ResultTile, TabsRow } from './kit'

type Mode = 'lump_sum' | 'recurring'

export const InterestCalcView: React.FC = () => {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('lump_sum')
  const [principal, setPrincipal] = useState(100000)
  const [monthly, setMonthly] = useState(2000)
  const [rate, setRate] = useState(3)
  const [years, setYears] = useState(10)
  const [perYear, setPerYear] = useState(12)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ final: number; principalTotal: number; interest: number } | null>(null)

  const run = () => {
    try {
      const r =
        mode === 'lump_sum'
          ? calculateLumpSumCompound(principal, rate, years, perYear)
          : calculateRecurringCompound(monthly, rate, years, principal)
      setResult({ final: r.finalAmount, principalTotal: r.totalPrincipal, interest: r.totalInterest })
      setError(null)
    } catch {
      setError(t('calcdev.invalidInput'))
      setResult(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-5 h-5 text-mem-teal" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.interestCalc')}</h3>
      </div>

      <TabsRow<Mode>
        options={[
          { id: 'lump_sum', label: t('calcdev.lumpSum') },
          { id: 'recurring', label: t('calcdev.recurring') },
        ]}
        value={mode}
        onChange={setMode}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label={mode === 'lump_sum' ? t('calcdev.principalYuan') : t('calcdev.initialPrincipal')}>
          <NumInput value={principal} onChange={setPrincipal} step="any" min={0} />
        </Field>
        {mode === 'recurring' && (
          <Field label={t('calcdev.monthlyContribution')}>
            <NumInput value={monthly} onChange={setMonthly} step="any" min={0} />
          </Field>
        )}
        <Field label={t('calcdev.annualRate')}>
          <NumInput value={rate} onChange={setRate} step="any" min={0} />
        </Field>
        <Field label={t('calcdev.loanYearsShort')}>
          <NumInput value={years} onChange={setYears} min={0} />
        </Field>
        {mode === 'lump_sum' && (
          <Field label={t('calcdev.compoundPerYear')}>
            <NumInput value={perYear} onChange={setPerYear} min={1} />
          </Field>
        )}
      </div>

      <MemphisButton variant="teal" onClick={run}>
        {t('calcdev.compute')}
      </MemphisButton>

      <ErrorLine message={error} />

      {result && (
        <div className="grid grid-cols-3 gap-3">
          <ResultTile value={result.final.toLocaleString()} label={t('calcdev.finalAmount')} tone="teal" />
          <ResultTile value={result.principalTotal.toLocaleString()} label={t('calcdev.totalPrincipal')} tone="yellow" />
          <ResultTile value={result.interest.toLocaleString()} label={t('calcdev.totalInterest')} tone="coral" />
        </div>
      )}
    </div>
  )
}
