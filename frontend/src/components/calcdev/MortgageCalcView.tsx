import React, { useState } from 'react'
import { Landmark } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  buildMortgageSchedule,
  calculateMortgage,
  type MortgageMethod,
  type MortgageScheduleRow,
} from '../../lib/toolknit/calcCore'
import { ErrorLine, Field, NumInput, ResultTile, TabsRow } from './kit'

export const MortgageCalcView: React.FC = () => {
  const { t } = useI18n()
  const [amountWan, setAmountWan] = useState(100)
  const [rate, setRate] = useState(3.1)
  const [years, setYears] = useState(30)
  const [method, setMethod] = useState<MortgageMethod>('equal_payment')
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ReturnType<typeof calculateMortgage> | null>(null)
  const [schedule, setSchedule] = useState<MortgageScheduleRow[]>([])
  const [showAll, setShowAll] = useState(false)

  const run = () => {
    try {
      const principal = amountWan * 10000
      setSummary(calculateMortgage(principal, rate, years, method))
      setSchedule(buildMortgageSchedule(principal, rate, years, method))
      setShowAll(false)
      setError(null)
    } catch {
      setError(t('calcdev.invalidInput'))
      setSummary(null)
      setSchedule([])
    }
  }

  const rows = showAll ? schedule : schedule.slice(0, 12)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Landmark className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.mortgageCalc')}</h3>
      </div>

      <TabsRow<MortgageMethod>
        options={[
          { id: 'equal_payment', label: t('calcdev.equalPayment') },
          { id: 'equal_principal', label: t('calcdev.equalPrincipal') },
        ]}
        value={method}
        onChange={setMethod}
      />

      <div className="grid grid-cols-3 gap-3">
        <Field label={t('calcdev.loanAmount')}>
          <NumInput value={amountWan} onChange={setAmountWan} step="any" min={0} />
        </Field>
        <Field label={t('calcdev.annualRate')}>
          <NumInput value={rate} onChange={setRate} step="any" min={0} />
        </Field>
        <Field label={t('calcdev.loanYears')}>
          <NumInput value={years} onChange={setYears} min={0} />
        </Field>
      </div>

      <MemphisButton variant="sky" onClick={run}>
        {t('calcdev.compute')}
      </MemphisButton>

      <ErrorLine message={error} />

      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultTile value={summary.firstMonthPayment.toLocaleString()} label={t(method === 'equal_payment' ? 'calcdev.monthlyPayment' : 'calcdev.firstMonthPayment')} tone="sky" />
            {summary.lastMonthPayment !== null && (
              <ResultTile value={summary.lastMonthPayment.toLocaleString()} label={t('calcdev.lastMonthPayment')} tone="teal" />
            )}
            <ResultTile value={summary.totalInterest.toLocaleString()} label={t('calcdev.totalInterest')} tone="coral" />
            <ResultTile value={summary.totalPayment.toLocaleString()} label={t('calcdev.totalPayment')} tone="lavender" />
          </div>

          {schedule.length > 0 && (
            <div className="border-2 border-mem-ink rounded-2xl overflow-hidden bg-white">
              <div className="flex items-center justify-between px-3 py-2 bg-mem-cream border-b-2 border-mem-ink">
                <span className="text-xs font-black font-display">{t('calcdev.schedule')}</span>
                {schedule.length > 12 && (
                  <MemphisButton size="sm" variant="white" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? t('calcdev.scheduleBrief') : t('calcdev.scheduleFull')}
                  </MemphisButton>
                )}
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-left text-mem-ink/60 border-b border-mem-ink/20">
                      <th className="px-3 py-1.5">{t('calcdev.month')}</th>
                      <th className="px-3 py-1.5">{t('calcdev.monthlyPayment')}</th>
                      <th className="px-3 py-1.5">{t('calcdev.monthlyPrincipal')}</th>
                      <th className="px-3 py-1.5">{t('calcdev.monthlyInterest')}</th>
                      <th className="px-3 py-1.5">{t('calcdev.remaining')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.month} className="border-b border-mem-ink/5">
                        <td className="px-3 py-1.5">{row.month}</td>
                        <td className="px-3 py-1.5">{row.payment.toLocaleString()}</td>
                        <td className="px-3 py-1.5">{row.principal.toLocaleString()}</td>
                        <td className="px-3 py-1.5">{row.interest.toLocaleString()}</td>
                        <td className="px-3 py-1.5">{row.remaining.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
