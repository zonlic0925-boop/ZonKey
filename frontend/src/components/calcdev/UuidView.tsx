import React, { useState } from 'react'
import { Fingerprint } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { generateUuidV4 } from '../../lib/toolknit/developerCore'
import { CopyButton, Field, NumInput } from './kit'

export const UuidView: React.FC = () => {
  const { t } = useI18n()
  const [count, setCount] = useState(5)
  const [items, setItems] = useState<string[]>([])

  const run = () => {
    const n = Math.max(1, Math.min(100, Math.floor(count) || 1))
    setItems(Array.from({ length: n }, () => generateUuidV4()))
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Fingerprint className="w-5 h-5 text-mem-teal" />
        <h3 className="font-display font-black text-mem-ink">UUID v4</h3>
      </div>

      <div className="flex items-end gap-3">
        <Field label={t('calcdev.count')} className="w-32">
          <NumInput value={count} onChange={setCount} min={1} max={100} />
        </Field>
        <MemphisButton variant="teal" onClick={run}>
          {t('calcdev.generate')}
        </MemphisButton>
        {items.length > 0 && <CopyButton text={items.join('\n')} />}
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((uuid) => (
            <div key={uuid} className="flex items-center justify-between gap-3 p-2.5 bg-white border-2 border-mem-ink rounded-xl">
              <code className="text-xs font-mono font-bold truncate">{uuid}</code>
              <CopyButton text={uuid} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
