import React, { useState } from 'react'
import { Link2 } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  describeDeveloperToolError,
  decodeUrlComponent,
  encodeUrlComponent,
} from '../../lib/toolknit/developerCore'
import { AreaInput, CopyButton, ErrorLine } from './kit'

function encodeFull(value: string): string {
  return encodeURI(value)
}

function decodeFull(value: string): string {
  try {
    return decodeURI(value)
  } catch {
    throw new Error('developer-tool:invalid-url')
  }
}

export const UrlCodecView: React.FC = () => {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = (action: 'encodeComponent' | 'decodeComponent' | 'encodeFull' | 'decodeFull') => {
    try {
      const fn =
        action === 'encodeComponent' ? encodeUrlComponent
        : action === 'decodeComponent' ? decodeUrlComponent
        : action === 'encodeFull' ? encodeFull
        : decodeFull
      setOutput(fn(input))
      setError(null)
    } catch (err) {
      setError(describeDeveloperToolError(err))
      setOutput('')
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="w-5 h-5 text-mem-pink" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.urlCodec')}</h3>
      </div>

      <AreaInput value={input} onChange={setInput} rows={4} placeholder="https://example.com/search?q=ZonScale 脱敏" />

      <div className="flex gap-2 flex-wrap">
        <MemphisButton variant="pink" onClick={() => run('encodeComponent')}>
          {t('calcdev.encodeComponent')}
        </MemphisButton>
        <MemphisButton variant="white" onClick={() => run('decodeComponent')}>
          {t('calcdev.decodeComponent')}
        </MemphisButton>
        <MemphisButton variant="sky" onClick={() => run('encodeFull')}>
          {t('calcdev.encodeFull')}
        </MemphisButton>
        <MemphisButton variant="white" onClick={() => run('decodeFull')}>
          {t('calcdev.decodeFull')}
        </MemphisButton>
        {output && <CopyButton text={output} />}
      </div>

      <ErrorLine message={error} />
      {output && <AreaInput value={output} onChange={undefined} rows={4} readOnly />}
    </div>
  )
}
