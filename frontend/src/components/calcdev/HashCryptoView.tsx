import React, { useState } from 'react'
import { Lock } from 'lucide-react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import {
  generateRsaKeyPair,
  hashText,
  hmacText,
  HMAC_ALGORITHMS,
  HASH_ALGORITHMS,
  runRsa,
  runSymmetricCipher,
  SYMMETRIC_ALGORITHMS,
  type CipherMode,
  type CipherPadding,
  type KeyFormat,
  type OutputFormat,
} from '../../lib/toolknit/cryptoCore'
import { AreaInput, CopyButton, ErrorLine, Field, TabsRow, inputClass } from './kit'

type Section = 'hash' | 'hmac' | 'cipher' | 'rsa'

const MODES: CipherMode[] = ['CBC', 'ECB', 'CFB', 'OFB', 'CTR']
const PADDINGS: CipherPadding[] = ['pkcs7', 'ansix923', 'iso10126', 'zero', 'nopadding']
const FORMATS: KeyFormat[] = ['text', 'hex', 'base64']
const OUTPUT_FORMATS: OutputFormat[] = ['base64', 'hex', 'text']

export const HashCryptoView: React.FC = () => {
  const { t } = useI18n()
  const [section, setSection] = useState<Section>('hash')

  // 哈希 / HMAC
  const [hashAlgo, setHashAlgo] = useState<string>('sha256')
  const [text, setText] = useState('')
  const [upper, setUpper] = useState(false)
  const [key, setKey] = useState('')
  const [keyFormat, setKeyFormat] = useState<KeyFormat>('text')
  const [digest, setDigest] = useState('')
  const [error, setError] = useState<string | null>(null)

  // 对称
  const [cipherAlgo, setCipherAlgo] = useState<string>('aes')
  const [operation, setOperation] = useState<'encrypt' | 'decrypt'>('encrypt')
  const [cipherInput, setCipherInput] = useState('')
  const [cipherKey, setCipherKey] = useState('')
  const [iv, setIv] = useState('')
  const [mode, setMode] = useState<CipherMode>('CBC')
  const [padding, setPadding] = useState<CipherPadding>('pkcs7')
  const [cipherOutput, setCipherOutput] = useState('')

  // RSA
  const [keySize, setKeySize] = useState(2048)
  const [publicKey, setPublicKey] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [rsaBusy, setRsaBusy] = useState(false)
  const [rsaOutput, setRsaOutput] = useState('')

  const runHash = () => {
    try {
      setDigest(hashText(hashAlgo, text, { upper }))
      setError(null)
    } catch (err) {
      setError(t('calcdev.cryptoError', { code: String((err as Error).message) }))
    }
  }

  const runHmac = () => {
    try {
      setDigest(hmacText(hashAlgo, text, key, keyFormat, upper))
      setError(null)
    } catch (err) {
      setError(t('calcdev.cryptoError', { code: String((err as Error).message) }))
    }
  }

  const runCipher = () => {
    try {
      setCipherOutput(
        runSymmetricCipher(cipherAlgo, {
          operation,
          input: cipherInput,
          key: cipherKey,
          keyFormat,
          iv,
          ivFormat: 'hex',
          mode,
          padding,
          inputFormat: operation === 'encrypt' ? 'text' : 'base64',
          outputFormat: operation === 'encrypt' ? 'base64' : 'text',
          upper,
        }),
      )
      setError(null)
    } catch (err) {
      setError(t('calcdev.cryptoError', { code: String((err as Error).message) }))
      setCipherOutput('')
    }
  }

  const genRsa = async () => {
    setRsaBusy(true)
    try {
      const pair = await generateRsaKeyPair(keySize)
      setPublicKey(pair.publicKey)
      setPrivateKey(pair.privateKey)
      setError(null)
    } catch (err) {
      setError(t('calcdev.cryptoError', { code: String((err as Error).message) }))
    } finally {
      setRsaBusy(false)
    }
  }

  const runRsaOp = async (op: 'encrypt' | 'decrypt') => {
    try {
      const result = await runRsa(op, cipherInput, publicKey, privateKey)
      setRsaOutput(result)
      setError(null)
    } catch (err) {
      setError(t('calcdev.cryptoError', { code: String((err as Error).message) }))
      setRsaOutput('')
    }
  }

  const selectClass = `${inputClass} appearance-none`

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-5 h-5 text-mem-lavender" />
        <h3 className="font-display font-black text-mem-ink">{t('tools.hashCrypto')}</h3>
        <span className="text-[10px] font-bold text-mem-ink/50">{t('calcdev.cryptoCount')}</span>
      </div>

      <TabsRow<Section>
        options={[
          { id: 'hash', label: t('calcdev.sectionHash') },
          { id: 'hmac', label: 'HMAC' },
          { id: 'cipher', label: t('calcdev.sectionCipher') },
          { id: 'rsa', label: 'RSA' },
        ]}
        value={section}
        onChange={setSection}
      />

      {(section === 'hash' || section === 'hmac') && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('calcdev.algorithm')}>
              <select
                value={hashAlgo}
                onChange={(e) => {
                  const algo = e.target.value
                  if (section === 'hash' && !HASH_ALGORITHMS.includes(algo as never)) setHashAlgo('sha256')
                  else if (section === 'hmac' && !HMAC_ALGORITHMS.includes(algo as never)) setHashAlgo('hmac-sha256')
                  else setHashAlgo(algo)
                }}
                className={selectClass}
              >
                {(section === 'hash' ? HASH_ALGORITHMS : HMAC_ALGORITHMS).map((algo) => (
                  <option key={algo} value={algo}>
                    {algo.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('calcdev.upper')}>
              <label className="flex items-center gap-2 p-2.5 border-2 border-mem-ink rounded-xl bg-white text-xs font-bold cursor-pointer">
                <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} className="accent-mem-ink" />
                {t('calcdev.upperDesc')}
              </label>
            </Field>
          </div>

          <Field label={t('calcdev.plaintext')}>
            <AreaInput value={text} onChange={setText} rows={3} />
          </Field>

          {section === 'hmac' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('calcdev.key')}>
                <AreaInput value={key} onChange={setKey} rows={2} />
              </Field>
              <Field label={t('calcdev.keyFormat')}>
                <select value={keyFormat} onChange={(e) => setKeyFormat(e.target.value as KeyFormat)} className={selectClass}>
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <MemphisButton variant="lavender" onClick={section === 'hash' ? runHash : runHmac}>
            {t('calcdev.compute')}
          </MemphisButton>
          <ErrorLine message={error} />
          {digest && (
            <div className="flex items-start justify-between gap-3 p-3 bg-white border-2 border-mem-ink rounded-xl">
              <code className="text-xs font-mono font-bold break-all">{digest}</code>
              <CopyButton text={digest} />
            </div>
          )}
        </div>
      )}

      {section === 'cipher' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label={t('calcdev.algorithm')}>
              <select value={cipherAlgo} onChange={(e) => setCipherAlgo(e.target.value)} className={selectClass}>
                {SYMMETRIC_ALGORITHMS.map((algo) => (
                  <option key={algo} value={algo}>{algo.toUpperCase()}</option>
                ))}
              </select>
            </Field>
            <Field label={t('calcdev.operation')}>
              <TabsRow<'encrypt' | 'decrypt'>
                options={[
                  { id: 'encrypt', label: t('calcdev.encrypt') },
                  { id: 'decrypt', label: t('calcdev.decrypt') },
                ]}
                value={operation}
                onChange={setOperation}
              />
            </Field>
            {cipherAlgo !== 'rc4' && (
              <>
                <Field label={t('calcdev.mode')}>
                  <select value={mode} onChange={(e) => setMode(e.target.value as CipherMode)} className={selectClass}>
                    {MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('calcdev.padding')}>
                  <select value={padding} onChange={(e) => setPadding(e.target.value as CipherPadding)} className={selectClass}>
                    {PADDINGS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label={t('calcdev.keyFormat')}>
              <select value={keyFormat} onChange={(e) => setKeyFormat(e.target.value as KeyFormat)} className={selectClass}>
                {FORMATS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={operation === 'encrypt' ? t('calcdev.plaintext') : t('calcdev.ciphertext')}>
            <AreaInput value={cipherInput} onChange={setCipherInput} rows={3} />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={t('calcdev.key')}>
              <AreaInput value={cipherKey} onChange={setCipherKey} rows={2} />
            </Field>
            {cipherAlgo !== 'rc4' && mode !== 'ECB' && (
              <Field label={`${t('calcdev.iv')} (hex)`}>
                <AreaInput value={iv} onChange={setIv} rows={2} placeholder="000102030405060708090a0b0c0d0e0f" />
              </Field>
            )}
          </div>

          <MemphisButton variant="lavender" onClick={runCipher}>
            {operation === 'encrypt' ? t('calcdev.encrypt') : t('calcdev.decrypt')}
          </MemphisButton>
          <ErrorLine message={error} />
          {cipherOutput && (
            <div className="flex items-start justify-between gap-3 p-3 bg-white border-2 border-mem-ink rounded-xl">
              <code className="text-xs font-mono font-bold break-all">{cipherOutput}</code>
              <CopyButton text={cipherOutput} />
            </div>
          )}
        </div>
      )}

      {section === 'rsa' && (
        <div className="space-y-3">
          <div className="flex items-end gap-3 flex-wrap">
            <Field label={t('calcdev.keySize')} className="w-32">
              <select value={keySize} onChange={(e) => setKeySize(Number(e.target.value))} className={selectClass}>
                {[1024, 2048, 4096].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </Field>
            <MemphisButton variant="lavender" onClick={genRsa} disabled={rsaBusy}>
              {t('calcdev.genKeyPair')}
            </MemphisButton>
            <span className="text-[10px] font-bold text-mem-ink/50 pb-2">{t('calcdev.rsaNote')}</span>
          </div>

          <Field label={t('calcdev.publicKey')}>
            <AreaInput value={publicKey} onChange={setPublicKey} rows={4} />
          </Field>
          <Field label={t('calcdev.privateKey')}>
            <AreaInput value={privateKey} onChange={setPrivateKey} rows={6} />
          </Field>

          <Field label={t('calcdev.plaintext')}>
            <AreaInput value={cipherInput} onChange={setCipherInput} rows={3} />
          </Field>

          <div className="flex gap-2">
            <MemphisButton variant="sky" onClick={() => runRsaOp('encrypt')}>
              {t('calcdev.encrypt')}
            </MemphisButton>
            <MemphisButton variant="teal" onClick={() => runRsaOp('decrypt')}>
              {t('calcdev.decrypt')}
            </MemphisButton>
            {rsaOutput && <CopyButton text={rsaOutput} />}
          </div>
          <ErrorLine message={error} />
          {rsaOutput && (
            <div className="p-3 bg-white border-2 border-mem-ink rounded-xl">
              <code className="text-xs font-mono font-bold break-all">{rsaOutput}</code>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
