import React, { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../i18n'
import { MemphisButton } from '../common/MemphisButton'
import { downloadBlob } from '../imagecenter/imageKit'
import { ErrorLine, Field, inputClass } from '../calcdev/kit'

export function formatBytes(bytes?: number | null): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

function biosDate(raw?: unknown): string {
  if (typeof raw !== 'string') return '—'
  const m = raw.match(/\/Date\((\d+)\)\//)
  if (m) {
    const d = new Date(Number(m[1]))
    return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10)
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? raw : d.toISOString().slice(0, 10)
}

export const KVTile: React.FC<{ label: string; value: React.ReactNode; wide?: boolean }> = ({ label, value, wide }) => (
  <div className={`p-3 bg-white border-2 border-mem-ink rounded-xl ${wide ? 'col-span-full' : ''}`}>
    <p className="text-xs font-bold text-mem-ink/60">{label}</p>
    <p className="text-sm font-bold font-display text-mem-ink mt-0.5 break-all">{value ?? '—'}</p>
  </div>
)

export const SystemInfoView: React.FC<{ endpoint: string; title: string }> = ({ endpoint, title }) => {
  const { t } = useI18n()
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error(String(response.status))
      setData(await response.json())
    } catch {
      setError(t('systemcenter.fetchFailed'))
    } finally {
      setLoading(false)
    }
  }, [endpoint, t])

  useEffect(() => {
    load()
  }, [load])

  const renderValue = (key: string, value: unknown): React.ReactNode => {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'number' && key.endsWith('_bytes')) return formatBytes(value)
    if (typeof value === 'boolean') return value ? '✓' : '✗'
    return String(value)
  }

  const entries = data ? Object.entries(data).filter(([, value]) => typeof value !== 'object') : []
  const disks = (data?.disks ?? null) as Array<Record<string, unknown>> | null
  const gpus = (data?.gpus ?? null) as Array<Record<string, unknown>> | null
  const adapters = (data?.adapters ?? null) as Array<Record<string, unknown>> | null
  const board = (data?.board ?? null) as Record<string, unknown> | null
  const bios = (data?.bios ?? null) as Record<string, unknown> | null

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-display font-black text-mem-ink">{title}</h3>
        <MemphisButton size="sm" variant="white" onClick={load} disabled={loading}>
          {loading ? '…' : t('systemcenter.refresh')}
        </MemphisButton>
      </div>
      <ErrorLine message={error} />
      {entries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {entries.map(([key, value]) => (
            <KVTile key={key} label={key} value={renderValue(key, value)} />
          ))}
        </div>
      )}

      {board && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <KVTile label={t('systemcenter.boardManufacturer')} value={renderValue('m', board.manufacturer)} />
          <KVTile label={t('systemcenter.boardModel')} value={renderValue('m', board.product)} />
          <KVTile label={t('systemcenter.boardVersion')} value={renderValue('m', board.version)} />
          <KVTile label={t('systemcenter.biosManufacturer')} value={renderValue('m', bios?.manufacturer)} />
          <KVTile label={t('systemcenter.biosVersion')} value={renderValue('m', bios?.version)} />
          <KVTile label={t('systemcenter.biosDate')} value={biosDate(bios?.release_date)} />
        </div>
      )}

      {disks && disks.length > 0 && (
        <div className="space-y-1.5">
          {disks.map((disk, index) => (
            <div key={String(disk.device ?? index)} className="p-3 bg-white border-2 border-mem-ink rounded-xl">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="font-mono">{String(disk.device ?? disk.mountpoint ?? '')}</span>
                <span className="text-mem-ink/60">{String(disk.fstype ?? '')} · {String(disk.percent ?? '—')}%</span>
              </div>
              <div className="mt-1.5 h-2 border-2 border-mem-ink rounded-full overflow-hidden bg-mem-cream">
                <div className="h-full bg-mem-teal" style={{ width: `${Math.min(100, Number(disk.percent ?? 0))}%` }} />
              </div>
              <p className="text-xs text-mem-ink/60 font-mono mt-1">
                {formatBytes(Number(disk.used_bytes))} / {formatBytes(Number(disk.total_bytes))}
              </p>
            </div>
          ))}
        </div>
      )}

      {gpus && gpus.length > 0 && (
        <div className="space-y-1.5">
          {gpus.map((gpu, index) => (
            <div key={index} className="p-3 bg-white border-2 border-mem-ink rounded-xl text-xs">
              <p className="font-bold text-mem-ink">{String(gpu.name ?? '—')}</p>
              <p className="text-xs text-mem-ink/60 font-mono mt-0.5">
                {t('systemcenter.driver')}: {String(gpu.driver_version ?? '—')} · VRAM: {formatBytes(Number(gpu.adapter_ram_bytes))}
              </p>
            </div>
          ))}
        </div>
      )}

      {adapters && adapters.length > 0 && (
        <ul className="space-y-1.5">
          {adapters.map((adapter, index) => (
            <li key={index} className="px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl text-xs flex items-center justify-between gap-2">
              <span className="font-bold truncate">{String(adapter.name ?? '')}</span>
              <span className="font-mono text-mem-ink/60 shrink-0">{String(adapter.ipv4 ?? '—')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface CleanupTier {
  tier: string
  name: string
  bytes: number
  count: number
}

export const CleanupView: React.FC = () => {
  const { t } = useI18n()
  const [scan, setScan] = useState<{ is_admin: boolean; tiers: CleanupTier[] } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmTier, setConfirmTier] = useState<CleanupTier | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const loadScan = useCallback(async () => {
    setError(null)
    try {
      const response = await fetch('/api/system/cleanup/scan')
      if (!response.ok) throw new Error(String(response.status))
      setScan(await response.json())
    } catch {
      setError(t('systemcenter.fetchFailed'))
    }
  }, [t])

  useEffect(() => {
    loadScan()
  }, [loadScan])

  const runCleanup = async (tier: CleanupTier) => {
    setConfirmTier(null)
    setBusy(tier.tier)
    setError(null)
    setResult(null)
    try {
      const response = await fetch('/api/system/cleanup/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tier.tier }),
      })
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json()
      setResult(t('systemcenter.freedReport', { size: formatBytes(data.freed_bytes) }))
      await loadScan()
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.cDriveCleanup')}</h3>
      {scan && !scan.is_admin && (
        <p className="text-xs font-bold border-2 border-mem-orange/60 bg-mem-orange/15 rounded-xl px-3 py-2 text-mem-ink/80">
          {t('systemcenter.notAdmin')}
        </p>
      )}
      <ErrorLine message={error} />
      {!scan && !error && (
        <p className="text-xs font-bold text-mem-ink/60">{t('systemcenter.scanning')}</p>
      )}
      {scan && (
        <div className="space-y-2">
          {scan.tiers.map((tier) => (
            <div key={tier.tier} className="p-3 bg-white border-2 border-mem-ink rounded-xl flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-xs font-bold text-mem-ink">{tier.name}</p>
                <p className="text-xs text-mem-ink/60 font-mono mt-0.5">
                  {formatBytes(tier.bytes)} · {tier.count}
                </p>
              </div>
              <MemphisButton
                size="sm"
                variant={tier.tier === 'high' ? 'coral' : 'white'}
                onClick={() => setConfirmTier(tier)}
                disabled={busy !== null || tier.bytes === 0}
              >
                {busy === tier.tier ? '…' : t('systemcenter.cleanNow')}
              </MemphisButton>
            </div>
          ))}
        </div>
      )}

      {confirmTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-mem-ink/40 p-4" onClick={() => setConfirmTier(null)}>
          <div className="max-w-md w-full bg-white border-[3px] border-mem-ink rounded-2xl shadow-memphis p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-display font-black text-mem-ink">{t('systemcenter.confirmTitle')}</p>
            <p className="text-xs text-mem-ink/70 mt-2 leading-relaxed">
              {t('systemcenter.confirmBody', { name: confirmTier.name, size: formatBytes(confirmTier.bytes) })}
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <MemphisButton size="sm" variant="white" onClick={() => setConfirmTier(null)}>
                {t('systemcenter.cancel')}
              </MemphisButton>
              <MemphisButton size="sm" variant="coral" onClick={() => runCleanup(confirmTier)}>
                {t('systemcenter.confirmClean')}
              </MemphisButton>
            </div>
          </div>
        </div>
      )}
      {result && <p className="text-xs font-bold text-mem-teal">{result}</p>}
    </div>
  )
}

interface LargeFile {
  path: string
  size_bytes: number
}

export const LargeFileView: React.FC = () => {
  const { t } = useI18n()
  const [path, setPath] = useState('')
  const [minMb, setMinMb] = useState(200)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<LargeFile[] | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    setFiles(null)
    try {
      const response = await fetch('/api/system/cleanup/large-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, min_mb: minMb, top_n: 40 }),
      })
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json()
      setFiles(data.files as LargeFile[])
    } catch (err) {
      setError(String((err as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = () => {
    if (!files) return
    const csv = ['path,size_bytes', ...files.map((file) => `"${file.path}",${file.size_bytes}`)].join('\n')
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'large_files.csv')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h3 className="font-display font-black text-mem-ink">{t('tools.largeFileCleanup')}</h3>
      <p className="text-xs text-mem-ink/60 font-medium">{t('systemcenter.largeFileScanOnly')}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <Field label={t('systemcenter.scanPath')} className="md:col-span-2">
          <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="C:\" className={inputClass} />
        </Field>
        <Field label={`${t('systemcenter.minSize')} (MB)`}>
          <input type="number" min={1} value={minMb} onChange={(e) => setMinMb(Number(e.target.value))} className={inputClass} />
        </Field>
      </div>
      <MemphisButton variant="lime" onClick={run} disabled={busy}>
        {busy ? '…' : t('systemcenter.scanNow')}
      </MemphisButton>
      <ErrorLine message={error} />
      {files && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-mem-ink/70">{t('systemcenter.foundFiles', { count: files.length })}</p>
            {files.length > 0 && (
              <MemphisButton size="sm" variant="white" onClick={exportCsv}>CSV</MemphisButton>
            )}
          </div>
          <ul className="max-h-80 overflow-auto space-y-1.5">
            {files.map((file) => (
              <li key={file.path} className="px-3 py-1.5 bg-white border-2 border-mem-ink rounded-xl text-xs">
                <p className="font-mono font-bold truncate">{file.path}</p>
                <p className="text-xs text-mem-ink/60 font-mono">{formatBytes(file.size_bytes)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
