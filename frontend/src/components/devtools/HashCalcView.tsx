import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { computeHash } from '../../lib/core-crypto/hash'
import { Copy, Check, Hash, FileText, Upload } from 'lucide-react'

export const HashCalcView: React.FC = () => {
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text')
  const [textInput, setTextInput] = useState('ZonScale 100% Offline')
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState('')
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null)

  const [hashes, setHashes] = useState({
    md5: '',
    sha1: '',
    sha256: '',
    sha512: '',
  })
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setFileSize((file.size / 1024).toFixed(1) + ' KB')

    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        setFileBuffer(reader.result)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  useEffect(() => {
    const run = async () => {
      const data = inputMode === 'text' ? textInput : fileBuffer
      if (data === null || data === '') {
        setHashes({ md5: '', sha1: '', sha256: '', sha512: '' })
        return
      }

      const [md5, sha1, sha256, sha512] = await Promise.all([
        computeHash(data, 'MD5'),
        computeHash(data, 'SHA-1'),
        computeHash(data, 'SHA-256'),
        computeHash(data, 'SHA-512'),
      ])

      setHashes({ md5, sha1, sha256, sha512 })
    }
    run()
  }, [textInput, fileBuffer, inputMode])

  return (
    <div className="space-y-6">
      {/* Input Selector */}
      <div className="flex gap-2">
        <MemphisButton
          variant={inputMode === 'text' ? 'yellow' : 'white'}
          onClick={() => setInputMode('text')}
          icon={<FileText className="w-4 h-4" />}
          size="sm"
        >
          文本哈希
        </MemphisButton>
        <MemphisButton
          variant={inputMode === 'file' ? 'yellow' : 'white'}
          onClick={() => setInputMode('file')}
          icon={<Upload className="w-4 h-4" />}
          size="sm"
        >
          本地文件哈希 (0 上传)
        </MemphisButton>
      </div>

      {/* Input Area */}
      <MemphisCard className="p-4 bg-white">
        {inputMode === 'text' ? (
          <div>
            <label className="block text-xs font-display font-bold text-mem-ink/70 mb-1.5 uppercase">
              输入计算文本
            </label>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="输入需要计算摘要的字符串..."
              rows={3}
              className="w-full p-3 font-mono text-sm border-2 border-mem-ink rounded-xl focus:outline-none focus:ring-2 focus:ring-mem-yellow"
            />
          </div>
        ) : (
          <div className="border-2 border-dashed border-mem-ink/40 rounded-xl p-6 text-center hover:border-mem-ink transition-colors relative bg-mem-cream/50">
            <input
              type="file"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <Upload className="w-8 h-8 mx-auto mb-2 text-mem-ink/60" />
            <p className="font-display font-bold text-sm text-mem-ink">
              {fileName ? `${fileName} (${fileSize})` : '点击选择或拖拽本地任意文件'}
            </p>
            <p className="text-xs text-mem-ink/50 mt-1">100% 浏览器/客户端本地计算，文件不出设备</p>
          </div>
        )}
      </MemphisCard>

      {/* Hash Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: 'md5', label: 'MD5 (128-bit)', val: hashes.md5, color: 'bg-mem-coral/10' },
          { key: 'sha1', label: 'SHA-1 (160-bit)', val: hashes.sha1, color: 'bg-mem-yellow/15' },
          { key: 'sha256', label: 'SHA-256 (256-bit)', val: hashes.sha256, color: 'bg-mem-teal/15' },
          { key: 'sha512', label: 'SHA-512 (512-bit)', val: hashes.sha512, color: 'bg-mem-sky/15' },
        ].map((item) => (
          <MemphisCard key={item.key} className={`p-4 ${item.color} relative group`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-display font-black text-xs text-mem-ink flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" />
                {item.label}
              </span>
              <button
                onClick={() => handleCopy(item.val, item.key)}
                className="px-2 py-1 bg-white border border-mem-ink rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-mem-yellow transition-colors shadow-memphis-sm"
              >
                {copiedKey === item.key ? (
                  <>
                    <Check className="w-3 h-3 text-green-600" /> 已复制
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> 复制
                  </>
                )}
              </button>
            </div>
            <p className="font-mono text-xs text-mem-ink break-all select-all bg-white/80 p-2.5 rounded-lg border border-mem-ink/30 min-h-[38px] flex items-center">
              {item.val || '—'}
            </p>
          </MemphisCard>
        ))}
      </div>
    </div>
  )
}
