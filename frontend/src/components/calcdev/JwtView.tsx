import React, { useState } from 'react'
import { KeySquare } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { decodeJwt, describeDeveloperToolError } from '../../lib/zonkey/developerCore'
import { AreaInput, CopyButton, ErrorLine } from './kit'

interface JwtViewData {
  header: unknown
  payload: Record<string, unknown>
  signature: string
}

function formatUnix(value: unknown, t: (k: string) => string): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const ms = value < 1e11 ? value * 1000 : value
  return new Date(ms).toLocaleString()
}

export const JwtView: React.FC = () => {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [data, setData] = useState<JwtViewData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = () => {
    try {
      const decoded = decodeJwt(input)
      setData(decoded)
      setError(null)
    } catch (err) {
      setError(describeDeveloperToolError(err))
      setData(null)
    }
  }

  const expText = data ? formatUnix(data.payload.exp, t) : null
  const iatText = data ? formatUnix(data.payload.iat, t) : null
  const expired =
    data && typeof data.payload.exp === 'number'
      ? (data.payload.exp < 1e11 ? data.payload.exp * 1000 : data.payload.exp) < Date.now()
      : null

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <KeySquare className="w-5 h-5 text-mem-orange" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.jwt')}</h3>
      </div>

      <AreaInput value={input} onChange={setInput} rows={4} placeholder="eyJhbGciOiJIUzI1NiIs..." />

      <div className="flex gap-2 flex-wrap">
        <MemphisButton variant="yellow" onClick={run}>
          {t('calcdev.parse')}
        </MemphisButton>
        {data && (
          <CopyButton text={JSON.stringify({ header: data.header, payload: data.payload }, null, 2)} />
        )}
      </div>

      <ErrorLine message={error} />

      {data && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            {iatText && (
              <span className="px-2.5 py-1 rounded-full border-2 border-mem-ink bg-mem-cream">
                {t('calcdev.issuedAt')}: {iatText}
              </span>
            )}
            {expText && (
              <span
                className={`px-2.5 py-1 rounded-full border-2 border-mem-ink ${
                  expired ? 'bg-mem-coral/20' : 'bg-mem-lime/30'
                }`}
              >
                {t('calcdev.expiresAt')}: {expText} ·{' '}
                {expired === null ? '' : expired ? t('calcdev.expired') : t('calcdev.notExpired')}
              </span>
            )}
            {!expText && (
              <span className="px-2.5 py-1 rounded-full border-2 border-mem-ink bg-mem-cream">
                {t('calcdev.noExpiry')}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-mem-ink/70 mb-1">Header</p>
            <AreaInput value={JSON.stringify(data.header, null, 2)} onChange={undefined} rows={4} readOnly />
          </div>
          <div>
            <p className="text-xs font-bold text-mem-ink/70 mb-1">Payload</p>
            <AreaInput value={JSON.stringify(data.payload, null, 2)} onChange={undefined} rows={8} readOnly />
          </div>
          <div>
            <p className="text-xs font-bold text-mem-ink/70 mb-1">Signature</p>
            <AreaInput value={data.signature} onChange={undefined} rows={2} readOnly />
          </div>
        </div>
      )}
    </div>
  )
}
