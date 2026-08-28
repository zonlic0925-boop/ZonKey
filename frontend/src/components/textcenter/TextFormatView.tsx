import React, { useState } from 'react'
import { Pilcrow } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { executeTextFormat, type TextFormatAction } from '../../lib/toolknit/textFormatCore'
import { AreaInput, CopyButton, ErrorLine } from '../calcdev/kit'

const ACTIONS: { id: TextFormatAction; labelKey: string }[] = [
  { id: 'uppercase', labelKey: 'textcenter.uppercase' },
  { id: 'lowercase', labelKey: 'textcenter.lowercase' },
  { id: 'titlecase', labelKey: 'textcenter.titlecase' },
  { id: 'capitalize', labelKey: 'textcenter.capitalize' },
  { id: 'trimSpaces', labelKey: 'textcenter.trimSpaces' },
  { id: 'trimLines', labelKey: 'textcenter.trimLines' },
  { id: 'removeEmptyLines', labelKey: 'textcenter.removeEmptyLines' },
  { id: 'removeDuplicateLines', labelKey: 'textcenter.removeDuplicateLines' },
  { id: 'sortAsc', labelKey: 'textcenter.sortAsc' },
  { id: 'sortDesc', labelKey: 'textcenter.sortDesc' },
  { id: 'addLineNumbers', labelKey: 'textcenter.addLineNumbers' },
  { id: 'removeLineNumbers', labelKey: 'textcenter.removeLineNumbers' },
  { id: 'reverseLines', labelKey: 'textcenter.reverseLines' },
  { id: 'reverseText', labelKey: 'textcenter.reverseText' },
  { id: 'toHalfWidth', labelKey: 'textcenter.toHalfWidth' },
  { id: 'toFullWidth', labelKey: 'textcenter.toFullWidth' },
]

export const TextFormatView: React.FC = () => {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = (action: TextFormatAction) => {
    try {
      setOutput(executeTextFormat(action, input))
      setError(null)
    } catch {
      setError(t('calcdev.invalidInput'))
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Pilcrow className="w-5 h-5 text-mem-yellow" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.textFormat')}</h3>
      </div>

      <AreaInput value={input} onChange={setInput} rows={7} placeholder={t('textcenter.formatPlaceholder')} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {ACTIONS.map((action) => (
          <MemphisButton key={action.id} size="sm" variant="white" onClick={() => run(action.id)}>
            {t(action.labelKey)}
          </MemphisButton>
        ))}
      </div>

      <ErrorLine message={error} />

      {output && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <CopyButton text={output} />
          </div>
          <AreaInput value={output} onChange={undefined} rows={7} readOnly />
        </div>
      )}
    </div>
  )
}
