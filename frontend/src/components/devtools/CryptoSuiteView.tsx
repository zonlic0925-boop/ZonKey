import React, { useState } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import {
  encodeBase64,
  decodeBase64,
  encodeHex,
  decodeHex,
  parseJwt,
  encryptAesGcm,
  decryptAesGcm,
} from '../../lib/core-crypto/cipher'
import { Key, Lock, Unlock, ShieldAlert, Code2, ArrowRightLeft } from 'lucide-react'

export const CryptoSuiteView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'aes' | 'base64' | 'jwt'>('aes')

  // AES State
  const [aesInput, setAesInput] = useState('Secret Project Blueprint 2026')
  const [aesKey, setAesKey] = useState('zonscale-secret-key-32bytes-pass')
  const [aesOutput, setAesOutput] = useState('')
  const [aesError, setAesError] = useState('')

  // Base64 State
  const [b64Input, setB64Input] = useState('Hello ZonScale 🚀')
  const [b64Output, setB64Output] = useState('')

  // JWT State
  const [jwtInput, setJwtInput] = useState(
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlpvblNjYWxlIFVzZXIiLCJpYXQiOjE1MTYyMzkwMjJ9.4z9sK_zonscale_demo_sign'
  )
  const [jwtParsed, setJwtParsed] = useState<any>(null)
  const [jwtError, setJwtError] = useState('')

  const handleAesEncrypt = async () => {
    try {
      setAesError('')
      const result = await encryptAesGcm(aesInput, aesKey)
      setAesOutput(result)
    } catch (e: any) {
      setAesError(e.message)
    }
  }

  const handleAesDecrypt = async () => {
    try {
      setAesError('')
      const result = await decryptAesGcm(aesInput, aesKey)
      setAesOutput(result)
    } catch (e: any) {
      setAesError('解密失败：请检查密钥是否正确或密文是否完整')
    }
  }

  const handleB64Encode = () => {
    try {
      setB64Output(encodeBase64(b64Input))
    } catch (e: any) {
      setB64Output('编码出错: ' + e.message)
    }
  }

  const handleB64Decode = () => {
    try {
      setB64Output(decodeBase64(b64Input))
    } catch (e: any) {
      setB64Output('解码出错: 非有效 Base64 字符串')
    }
  }

  const handleParseJwt = () => {
    try {
      setJwtError('')
      const parsed = parseJwt(jwtInput)
      setJwtParsed(parsed)
    } catch (e: any) {
      setJwtError(e.message)
      setJwtParsed(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex gap-2">
        <MemphisButton
          variant={activeTab === 'aes' ? 'teal' : 'white'}
          onClick={() => setActiveTab('aes')}
          icon={<Lock className="w-4 h-4" />}
          size="sm"
        >
          AES-256-GCM 本地加密
        </MemphisButton>
        <MemphisButton
          variant={activeTab === 'base64' ? 'teal' : 'white'}
          onClick={() => setActiveTab('base64')}
          icon={<Code2 className="w-4 h-4" />}
          size="sm"
        >
          Base64 / Hex 编码
        </MemphisButton>
        <MemphisButton
          variant={activeTab === 'jwt' ? 'teal' : 'white'}
          onClick={() => setActiveTab('jwt')}
          icon={<Key className="w-4 h-4" />}
          size="sm"
        >
          JWT 结构解析
        </MemphisButton>
      </div>

      {activeTab === 'aes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MemphisCard className="p-4 bg-white space-y-4">
            <div>
              <label className="block text-xs font-display font-bold text-mem-ink/70 mb-1 uppercase">
                密钥 (Secret Key)
              </label>
              <input
                type="text"
                value={aesKey}
                onChange={(e) => setAesKey(e.target.value)}
                className="w-full p-2.5 font-mono text-xs border-2 border-mem-ink rounded-lg focus:ring-2 focus:ring-mem-teal"
              />
            </div>
            <div>
              <label className="block text-xs font-display font-bold text-mem-ink/70 mb-1 uppercase">
                输入文本 / 密文
              </label>
              <textarea
                value={aesInput}
                onChange={(e) => setAesInput(e.target.value)}
                rows={5}
                className="w-full p-2.5 font-mono text-xs border-2 border-mem-ink rounded-lg focus:ring-2 focus:ring-mem-teal"
              />
            </div>
            <div className="flex gap-3">
              <MemphisButton variant="teal" onClick={handleAesEncrypt} icon={<Lock className="w-4 h-4" />}>
                AES 加密
              </MemphisButton>
              <MemphisButton variant="yellow" onClick={handleAesDecrypt} icon={<Unlock className="w-4 h-4" />}>
                AES 解密
              </MemphisButton>
            </div>
            {aesError && (
              <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                <ShieldAlert className="w-4 h-4" /> {aesError}
              </p>
            )}
          </MemphisCard>

          <MemphisCard className="p-4 bg-mem-teal/10 space-y-2">
            <label className="block text-xs font-display font-bold text-mem-ink/70 uppercase">
              加密 / 解密结果
            </label>
            <textarea
              readOnly
              value={aesOutput}
              placeholder="结果将输出至此处..."
              rows={10}
              className="w-full p-3 font-mono text-xs border-2 border-mem-ink rounded-lg bg-white select-all"
            />
          </MemphisCard>
        </div>
      )}

      {activeTab === 'base64' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MemphisCard className="p-4 bg-white space-y-4">
            <label className="block text-xs font-display font-bold text-mem-ink/70 uppercase">
              待处理内容
            </label>
            <textarea
              value={b64Input}
              onChange={(e) => setB64Input(e.target.value)}
              rows={7}
              className="w-full p-2.5 font-mono text-xs border-2 border-mem-ink rounded-lg focus:ring-2 focus:ring-mem-teal"
            />
            <div className="flex gap-3">
              <MemphisButton variant="teal" onClick={handleB64Encode}>
                Base64 编码
              </MemphisButton>
              <MemphisButton variant="yellow" onClick={handleB64Decode}>
                Base64 解码
              </MemphisButton>
            </div>
          </MemphisCard>

          <MemphisCard className="p-4 bg-mem-yellow/15 space-y-2">
            <label className="block text-xs font-display font-bold text-mem-ink/70 uppercase">
              转换输出
            </label>
            <textarea
              readOnly
              value={b64Output}
              rows={10}
              className="w-full p-3 font-mono text-xs border-2 border-mem-ink rounded-lg bg-white select-all"
            />
          </MemphisCard>
        </div>
      )}

      {activeTab === 'jwt' && (
        <div className="space-y-4">
          <MemphisCard className="p-4 bg-white space-y-3">
            <label className="block text-xs font-display font-bold text-mem-ink/70 uppercase">
              粘贴 JWT 字符串
            </label>
            <textarea
              value={jwtInput}
              onChange={(e) => setJwtInput(e.target.value)}
              rows={3}
              className="w-full p-2.5 font-mono text-xs border-2 border-mem-ink rounded-lg focus:ring-2 focus:ring-mem-teal"
            />
            <MemphisButton variant="teal" onClick={handleParseJwt} size="sm">
              纯本地解析 Payload (无联网)
            </MemphisButton>
            {jwtError && <p className="text-xs text-red-600 font-bold">{jwtError}</p>}
          </MemphisCard>

          {jwtParsed && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MemphisCard className="p-4 bg-mem-coral/10">
                <span className="font-display font-black text-xs text-mem-coral mb-2 block">
                  HEADER (Algorithm & Type)
                </span>
                <pre className="font-mono text-xs bg-white p-3 border border-mem-ink/30 rounded-lg overflow-x-auto">
                  {JSON.stringify(jwtParsed.header, null, 2)}
                </pre>
              </MemphisCard>
              <MemphisCard className="p-4 bg-mem-teal/10">
                <span className="font-display font-black text-xs text-mem-teal mb-2 block">
                  PAYLOAD (Claims & Data)
                </span>
                <pre className="font-mono text-xs bg-white p-3 border border-mem-ink/30 rounded-lg overflow-x-auto">
                  {JSON.stringify(jwtParsed.payload, null, 2)}
                </pre>
              </MemphisCard>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
