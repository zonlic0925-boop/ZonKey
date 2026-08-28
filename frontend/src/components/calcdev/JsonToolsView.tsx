import React, { useState } from 'react'
import { Braces } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { describeDeveloperToolError, formatJsonText } from '../../lib/toolknit/developerCore'
import { AreaInput, CopyButton, ErrorLine, TabsRow } from './kit'

type Indent = '2' | '4' | 'tab'

export const JsonToolsView: React.FC = () => {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [indent, setIndent] = useState<Indent>('2')
  const [error, setError] = useState<string | null>(null)
  const [valid, setValid] = useState(false)

  const run = (action: 'format' | 'minify') => {
    try {
      setOutput(formatJsonText(input, indent))
      setError(null)
      setValid(false)
    } catch (err) {
      setError(describeDeveloperToolError(err, 'json-tools'))
      setOutput('')
    }
  }

  const validate = () => {
    try {
      JSON.parse(input)
      setError(null)
      setValid(true)
      setOutput('')
    } catch (err) {
      setValid(false)
      setError(describeDeveloperToolError(err, 'json-tools'))
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Braces className="w-5 h-5 text-mem-lavender" />
          <h3 className="font-display font-black text-mem-ink">{t('tools.jsonTools')}</h3>
        </div>
        <TabsRow<Indent>
          options={[
            { id: '2', label: t('calcdev.indent2') },
            { id: '4', label: t('calcdev.indent4') },
            { id: 'tab', label: t('calcdev.indentTab') },
          ]}
          value={indent}
          onChange={setIndent}
        />
      </div>

      <AreaInput value={input} onChange={setInput} rows={8} placeholder={'{"hello": "world"}'} />

      <div className="flex gap-2 flex-wrap">
        <MemphisButton variant="lavender" onClick={() => run('format')}>
          {t('calcdev.format')}
        </MemphisButton>
        <MemphisButton variant="sky" onClick={() => run('minify')}>
          {t('calcdev.minify')}
        </MemphisButton>
        <MemphisButton variant="teal" onClick={validate}>
          {t('calcdev.validate')}
        </MemphisButton>
        {output && <CopyButton text={output} />}
      </div>

      {valid && (
        <p className="text-xs font-bold text-mem-teal border-2 border-mem-teal/40 bg-mem-teal/10 rounded-xl px-3 py-2">
          {t('calcdev.jsonValid')}
        </p>
      )}
      <ErrorLine message={error} />

      {output && <AreaInput value={output} onChange={undefined} rows={10} readOnly />}
    </div>
  )
}
