import React, { useState } from 'react'
import { Binary } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { describeDeveloperToolError, decodeBase64Utf8, encodeBase64Utf8 } from '../../lib/toolknit/developerCore'
import { AreaInput, CopyButton, ErrorLine, TabsRow } from './kit'

export const Base64View: React.FC = () => {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const encode = () => {
    try {
      let encoded = encodeBase64Utf8(input)
      encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      setOutput(encoded)
      setError(null)
    } catch (err) {
      setError(describeDeveloperToolError(err))
      setOutput('')
    }
  }

  const decode = () => {
    try {
      let text = input.trim().replace(/\s+/g, '')
      text = text.replace(/-/g, '+').replace(/_/g, '/')
      while (text.length % 4 !== 0) text += '='
      setOutput(decodeBase64Utf8(text))
      setError(null)
    } catch (err) {
      setError(describeDeveloperToolError(err))
      setOutput('')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Binary className="w-5 h-5 text-mem-sky" />
        <h3 className="font-display font-black text-mem-ink">Base64</h3>
      </div>

      <AreaInput value={input} onChange={setInput} rows={5} placeholder={t('calcdev.base64InputHint')} />

      <div className="flex gap-2 flex-wrap">
        <MemphisButton variant="sky" onClick={encode}>
          {t('calcdev.encode')} (URL-safe)
        </MemphisButton>
        <MemphisButton variant="teal" onClick={decode}>
          {t('calcdev.decode')}
        </MemphisButton>
        {output && <CopyButton text={output} />}
      </div>

      <ErrorLine message={error} />
      {output && <AreaInput value={output} onChange={undefined} rows={5} readOnly />}
    </div>
  )
}
