import React, { useMemo, useState } from 'react'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'
import {
  buildPiiPattern,
  PiiMatchMode,
  previewPiiRule,
} from '../lib/piiRuleBuilder'
import { APP_NAME } from '../lib/brand'
import { useI18n } from '../i18n'

export interface NewPiiRulePayload {
  id: string
  key: string
  name: string
  category: string
  pattern: string
  enabled: boolean
  description: string
  match_mode: PiiMatchMode
}

interface PiiRuleAddFormProps {
  disabled?: boolean
  onAdd: (rule: NewPiiRulePayload) => void
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void
}

type CategoryKey = 'custom' | 'privacy' | 'financial' | 'enterprise'

const CATEGORY_LABEL_KEYS: Record<CategoryKey, string> = {
  custom: 'piiForm.categoryCustom',
  privacy: 'piiForm.categoryPrivacy',
  financial: 'piiForm.categoryFinancial',
  enterprise: 'piiForm.categoryEnterprise',
}

const CATEGORY_KEYS = Object.keys(CATEGORY_LABEL_KEYS) as CategoryKey[]

const MODE_KEYS: Record<PiiMatchMode, { label: string; hint: string }> = {
  contains: { label: 'piiForm.modeContains', hint: 'piiForm.hintContains' },
  prefix_digits: { label: 'piiForm.modePrefixDigits', hint: 'piiForm.hintPrefixDigits' },
  digit_length: { label: 'piiForm.modeDigitLength', hint: 'piiForm.hintDigitLength' },
  advanced: { label: 'piiForm.modeAdvanced', hint: 'piiForm.hintAdvanced' },
}

export const PiiRuleAddForm: React.FC<PiiRuleAddFormProps> = ({ disabled, onAdd, onNotify }) => {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [categoryKey, setCategoryKey] = useState<CategoryKey>('custom')
  const [mode, setMode] = useState<PiiMatchMode>('contains')
  const [keyword, setKeyword] = useState('')
  const [prefix, setPrefix] = useState('')
  const [digitLength, setDigitLength] = useState('')
  const [advancedPattern, setAdvancedPattern] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const categoryLabel = (key: CategoryKey) => t(CATEGORY_LABEL_KEYS[key])

  const preview = useMemo(
    () =>
      previewPiiRule({
        name,
        category: categoryLabel(categoryKey),
        mode,
        keyword,
        prefix,
        digitLength: digitLength ? Number(digitLength) : undefined,
        advancedPattern,
      }),
    [name, categoryKey, mode, keyword, prefix, digitLength, advancedPattern, t]
  )

  const resetForm = () => {
    setName('')
    setCategoryKey('custom')
    setMode('contains')
    setKeyword('')
    setPrefix('')
    setDigitLength('')
    setAdvancedPattern('')
    setShowAdvanced(false)
  }

  const handleSubmit = () => {
    const ruleName = name.trim()
    if (!ruleName) {
      onNotify(t('piiForm.nameRequired'), 'info')
      return
    }

    try {
      const category = categoryLabel(categoryKey)
      const built = buildPiiPattern({
        name: ruleName,
        category,
        mode,
        keyword,
        prefix,
        digitLength: digitLength ? Number(digitLength) : undefined,
        advancedPattern,
      })

      const ruleKey = `rule_${Date.now()}`
      onAdd({
        id: ruleKey,
        key: ruleKey,
        name: ruleName,
        category,
        pattern: built.pattern,
        enabled: true,
        description: built.description,
        match_mode: built.match_mode,
      })
      resetForm()
      onNotify(t('piiForm.added', { appName: APP_NAME }), 'success')
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : t('piiForm.addFailed'), 'error')
    }
  }

  return (
    <div className="pt-4 pb-2 space-y-3 border-b-2 border-mem-ink/10">
      <div>
        <h3 className="text-xs font-bold text-mem-ink/80">{t('piiForm.title')}</h3>
        <p className="text-xs text-mem-ink/45 mt-0.5">{t('piiForm.subtitle')}</p>
      </div>

      <input
        type="text"
        placeholder={t('piiForm.namePlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="memphis-input text-xs w-full"
      />

      <div>
        <label className="text-xs font-semibold text-mem-ink/55 mb-1.5 block">{t('piiForm.matchModeLabel')}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {(Object.keys(MODE_KEYS) as PiiMatchMode[])
            .filter((m) => m !== 'advanced' || showAdvanced)
            .map((matchMode) => (
              <button
                key={matchMode}
                type="button"
                onClick={() => setMode(matchMode)}
                className={`text-left px-3 py-2 rounded-xl border-2 text-xs transition-all ${
                  mode === matchMode
                    ? 'bg-mem-teal/25 border-mem-teal shadow-memphis-sm font-semibold'
                    : 'bg-white border-mem-ink/15 hover:border-mem-ink/30'
                }`}
              >
                {t(MODE_KEYS[matchMode].label)}
              </button>
            ))}
        </div>
        <p className="text-xs text-mem-ink/45 mt-1.5">{t(MODE_KEYS[mode].hint)}</p>
      </div>

      {mode === 'contains' && (
        <input
          type="text"
          placeholder={t('piiForm.keywordPlaceholder')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className="memphis-input text-xs w-full"
        />
      )}

      {mode === 'prefix_digits' && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t('piiForm.prefixPlaceholder')}
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            className="memphis-input text-xs flex-1"
          />
          <input
            type="number"
            min={1}
            max={32}
            placeholder={t('piiForm.digitLengthOptionalPlaceholder')}
            value={digitLength}
            onChange={(e) => setDigitLength(e.target.value)}
            className="memphis-input text-xs w-28"
          />
        </div>
      )}

      {mode === 'digit_length' && (
        <input
          type="number"
          min={1}
          max={32}
          placeholder={t('piiForm.digitLengthPlaceholder')}
          value={digitLength}
          onChange={(e) => setDigitLength(e.target.value)}
          className="memphis-input text-xs w-full"
        />
      )}

      {mode === 'advanced' && (
        <textarea
          rows={2}
          placeholder={t('piiForm.advancedPlaceholder')}
          value={advancedPattern}
          onChange={(e) => setAdvancedPattern(e.target.value)}
          className="memphis-input text-xs w-full font-mono resize-none"
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-mem-ink/60">{t('piiForm.categoryLabel')}</label>
        <select
          value={categoryKey}
          onChange={(e) => setCategoryKey(e.target.value as CategoryKey)}
          className="memphis-input text-xs py-1.5 w-auto min-w-[7rem]"
        >
          {CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {categoryLabel(key)}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl bg-mem-cream/80 border-2 border-mem-ink/10 px-3 py-2 text-xs text-mem-ink/65">
        {t('piiForm.preview', { preview })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled}
          className="memphis-btn-secondary flex items-center gap-1.5 text-xs"
        >
          <Plus className="w-4 h-4" />
          {t('piiForm.submit')}
        </button>
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="memphis-btn-ghost flex items-center gap-1 text-xs text-mem-ink/60"
        >
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {showAdvanced ? t('piiForm.collapseAdvanced') : t('piiForm.expandAdvanced')}
        </button>
      </div>
    </div>
  )
}
