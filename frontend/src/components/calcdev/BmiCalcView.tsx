import React, { useState } from 'react'
import { HeartPulse } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { calculateBmi, calculateBmr, calculateBodyFat } from '../../lib/toolknit/calcCore'
import { ErrorLine, Field, NumInput, ResultTile } from './kit'

export const BmiCalcView: React.FC = () => {
  const { t } = useI18n()
  const [height, setHeight] = useState(170)
  const [weight, setWeight] = useState(65)
  const [age, setAge] = useState(30)
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ bmi: number; category: string; bmr: number; bodyFat: number } | null>(null)

  const categoryKeys: Record<string, string> = {
    underweight: 'calcdev.underweight',
    normal: 'calcdev.normal',
    overweight: 'calcdev.overweight',
    obese: 'calcdev.obese',
  }

  const run = () => {
    try {
      const bmi = calculateBmi(height, weight)
      setResult({
        bmi: bmi.bmi,
        category: t(categoryKeys[bmi.category]),
        bmr: calculateBmr(weight, height, age, gender),
        bodyFat: calculateBodyFat(bmi.bmi, age, gender),
      })
      setError(null)
    } catch {
      setError(t('calcdev.invalidInput'))
      setResult(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <HeartPulse className="w-5 h-5 text-mem-coral" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.bmiCalc')}</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label={t('calcdev.heightCm')}>
          <NumInput value={height} onChange={setHeight} min={1} />
        </Field>
        <Field label={t('calcdev.weightKg')}>
          <NumInput value={weight} onChange={setWeight} step="any" min={1} />
        </Field>
        <Field label={t('calcdev.age')}>
          <NumInput value={age} onChange={setAge} min={1} />
        </Field>
        <Field label={t('calcdev.gender')}>
          <div className="flex gap-1.5">
            <MemphisButton size="sm" variant={gender === 'male' ? 'coral' : 'white'} onClick={() => setGender('male')}>
              {t('calcdev.male')}
            </MemphisButton>
            <MemphisButton size="sm" variant={gender === 'female' ? 'pink' : 'white'} onClick={() => setGender('female')}>
              {t('calcdev.female')}
            </MemphisButton>
          </div>
        </Field>
      </div>

      <MemphisButton variant="coral" onClick={run}>
        {t('calcdev.compute')}
      </MemphisButton>

      <ErrorLine message={error} />

      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ResultTile value={result.bmi} label={t('calcdev.bmiValue')} tone="coral" />
          <ResultTile value={result.category} label={t('calcdev.bmiCategory')} tone="yellow" />
          <ResultTile value={result.bmr} label={t('calcdev.bmrValue')} tone="teal" />
          <ResultTile value={`${result.bodyFat}%`} label={t('calcdev.bodyFat')} tone="lavender" />
        </div>
      )}
    </div>
  )
}
