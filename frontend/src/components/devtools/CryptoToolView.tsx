import React, { useState } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { Shield, Lock, Unlock, Copy, Check } from 'lucide-react'
import {
  calcMd5, calcSha1, calcSha256, calcSha512,
  encryptAesCbc, decryptAesCbc
} from '../../lib/toolknit/cryptoCore'

type Mode = 'hash' | 'aes'

export const CryptoToolView: React.FC = () => {
  const [mode, setMode] = useState<Mode>('hash')
  const [input, setInput] = useState('')
  const [hashType, setHashType] = useState<'md5'|'sha1'|'sha256'|'sha512'>('sha256')
  const [hashResult, setHashResult] = useState('')

  // AES
  const [aesKey, setAesKey] = useState('')
  const [aesIv, setAesIv] = useState('')
  const [aesOutput, setAesOutput] = useState('')
  const [aesErr, setAesErr] = useState('')
  const [copied, setCopied] = useState(false)

  const handleHash = () => {
    if (hashType === 'md5') setHashResult(calcMd5(input))
    else if (hashType === 'sha1') setHashResult(calcSha1(input))
    else if (hashType === 'sha256') setHashResult(calcSha256(input))
    else if (hashType === 'sha512') setHashResult(calcSha512(input))
  }

  const handleAesEncrypt = () => {
    try {
      setAesOutput(encryptAesCbc(input, aesKey, aesIv || undefined))
      setAesErr('')
    } catch (e: any) { setAesErr(e.message) }
  }

  const handleAesDecrypt = () => {
    try {
      setAesOutput(decryptAesCbc(input, aesKey, aesIv || undefined))
      setAesErr('')
    } catch (e: any) { setAesErr(e.message) }
  }

  const handleCopy = (t: string) => {
    navigator.clipboard.writeText(t)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <MemphisButton variant={mode === 'hash' ? 'sky' : 'white'} size="sm" icon={<Shield className="w-4 h-4" />}
          onClick={() => setMode('hash')}>哈希散列计算</MemphisButton>
        <MemphisButton variant={mode === 'aes' ? 'sky' : 'white'} size="sm" icon={<Lock className="w-4 h-4" />}
          onClick={() => setMode('aes')}>AES 加解密</MemphisButton>
      </div>

      <MemphisCard className="p-4 space-y-4">
        {mode === 'hash' && (
          <div className="space-y-3">
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={4} placeholder="输入要计算哈希的明文字符串..."
              className="w-full p-2 border-2 border-mem-ink rounded-xl text-xs font-mono" />
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {(['md5', 'sha1', 'sha256', 'sha512'] as const).map(t => (
                  <label key={t} className="flex items-center gap-1 text-xs font-bold uppercase cursor-pointer">
                    <input type="radio" name="hashType" checked={hashType === t} onChange={() => setHashType(t)} />
                    {t}
                  </label>
                ))}
              </div>
              <MemphisButton variant="teal" size="sm" onClick={handleHash}>计算哈希</MemphisButton>
            </div>
            {hashResult && (
              <div className="relative">
                <input type="text" readOnly value={hashResult} className="w-full p-2 border-2 border-mem-ink rounded-xl text-xs font-mono bg-slate-50 select-all" />
                <button onClick={() => handleCopy(hashResult)} className="absolute top-1.5 right-2 p-1 bg-white border border-mem-ink rounded text-xs">
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
          </div>
        )}

        {mode === 'aes' && (
          <div className="space-y-3">
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={3} placeholder="输入待加解密的文本..."
              className="w-full p-2 border-2 border-mem-ink rounded-xl text-xs font-mono" />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-bold mb-1">Key 密钥 (16/24/32 字节)</label>
                <input type="text" value={aesKey} onChange={e => setAesKey(e.target.value)} className="w-full p-1.5 border-2 border-mem-ink rounded-lg text-xs font-mono" /></div>
              <div><label className="block text-xs font-bold mb-1">IV 向量 (可选 16 字节)</label>
                <input type="text" value={aesIv} onChange={e => setAesIv(e.target.value)} className="w-full p-1.5 border-2 border-mem-ink rounded-lg text-xs font-mono" /></div>
            </div>
            <div className="flex gap-2">
              <MemphisButton variant="sky" size="sm" icon={<Lock className="w-3 h-3" />} onClick={handleAesEncrypt}>加密 (AES-CBC)</MemphisButton>
              <MemphisButton variant="teal" size="sm" icon={<Unlock className="w-3 h-3" />} onClick={handleAesDecrypt}>解密 (AES-CBC)</MemphisButton>
            </div>
            {aesOutput && (
              <div className="relative">
                <textarea readOnly value={aesOutput} rows={3} className="w-full p-2 border-2 border-mem-ink rounded-xl text-xs font-mono bg-slate-50" />
                <button onClick={() => handleCopy(aesOutput)} className="absolute top-2 right-2 p-1 bg-white border border-mem-ink rounded text-xs">
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}
            {aesErr && <p className="text-xs font-bold text-red-600">{aesErr}</p>}
          </div>
        )}
      </MemphisCard>
    </div>
  )
}
