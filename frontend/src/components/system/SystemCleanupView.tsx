import React, { useState } from 'react'
import { MemphisCard } from '../common/MemphisCard'
import { MemphisButton } from '../common/MemphisButton'
import { Trash2, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react'

export const SystemCleanupView: React.FC = () => {
  const [scanning, setScanning] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [cleanResult, setCleanResult] = useState<any>(null)
  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [status, setStatus] = useState('')

  const handleScan = async () => {
    setScanning(true); setStatus('正在安全扫描系统临时文件...')
    try {
      const res = await fetch('/api/system/cleanup/scan')
      const data = await res.json()
      setScanResult(data)
      setSelectedKeys(data.targets.map((t: any) => t.key))
      setStatus('扫描完成')
    } catch (e: any) { setStatus('扫描失败: ' + e.message) }
    setScanning(false)
  }

  const handleClean = async () => {
    if (selectedKeys.length === 0) return
    setCleaning(true); setStatus('正在清理选定项...')
    try {
      const res = await fetch('/api/system/cleanup/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_keys: selectedKeys })
      })
      const data = await res.json()
      setCleanResult(data)
      const freedMB = (data.total_freed_bytes / (1024 * 1024)).toFixed(2)
      setStatus(`清理完成！释放 ${freedMB} MB 空间`)
      handleScan()
    } catch (e: any) { setStatus('清理失败: ' + e.message) }
    setCleaning(false)
  }

  const toggleKey = (key: string) => {
    setSelectedKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <MemphisButton variant="sky" icon={<RefreshCw className="w-4 h-4" />} onClick={handleScan} disabled={scanning || cleaning}>
          {scanning ? '正在扫描...' : '扫描垃圾文件'}
        </MemphisButton>
        {scanResult && (
          <MemphisButton variant="coral" icon={<Trash2 className="w-4 h-4" />} onClick={handleClean} disabled={cleaning || selectedKeys.length === 0}>
            {cleaning ? '正在清理...' : `清理选定项 (${(scanResult.total_scanned_bytes / (1024 * 1024)).toFixed(2)} MB)`}
          </MemphisButton>
        )}
      </div>

      {scanResult && (
        <MemphisCard className="p-4 space-y-3">
          <div className="flex items-center justify-between border-b-2 border-mem-ink/10 pb-2">
            <span className="font-display font-black text-sm">扫描结果</span>
            <span className="font-mono text-xs font-bold text-mem-coral">
              共计 ${(scanResult.total_scanned_bytes / (1024 * 1024)).toFixed(2)} MB (${scanResult.total_scanned_files} 个文件)
            </span>
          </div>

          <div className="space-y-2">
            {scanResult.targets.map((t: any) => (
              <label key={t.key} className="flex items-center justify-between p-3 border-2 border-mem-ink/20 rounded-xl hover:bg-mem-cream/50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={selectedKeys.includes(t.key)} onChange={() => toggleKey(t.key)} className="w-4 h-4 accent-mem-sky rounded" />
                  <div>
                    <p className="font-display font-bold text-xs text-mem-ink">{t.name}</p>
                    <p className="text-[10px] text-mem-ink/50 font-mono truncate max-w-md">{t.path}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-xs text-mem-ink">{(t.size_bytes / (1024 * 1024)).toFixed(2)} MB</span>
                  <p className="text-[10px] text-mem-ink/50">{t.count} 个文件</p>
                </div>
              </label>
            ))}
          </div>
        </MemphisCard>
      )}

      {status && <p className="text-xs font-bold text-green-700">{status}</p>}
    </div>
  )
}
