import { useState, useEffect, useCallback } from 'react'
import type { ExportSettingsState } from '../components/ExportSettingsPanel'

export type NotifyFn = (msg: string, type?: 'success' | 'error' | 'info') => void

export interface ApiStatus {
  ocr_available: boolean
  ocr_model_status: string
  active_rules_count: number
  pii_active_count?: number
  enterprise_terms_count?: number
  drawing_terms_count?: number
}

async function parseJsonResponse(res: Response) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(
      text.trim().startsWith('<!doctype') || text.trim().startsWith('<!DOCTYPE')
        ? '后端 API 未响应（请确认已运行 启动现代化脱敏工作台.bat）'
        : `服务器返回非 JSON 数据: ${text.slice(0, 120)}`
    )
  }
}

export function useBackendStatus() {
  const [online, setOnline] = useState<boolean | null>(null)
  const [status, setStatus] = useState<ApiStatus | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<ApiStatus>('/api/status', undefined, 8000)
      setOnline(true)
      setStatus(data)
      return data
    } catch {
      setOnline(false)
      setStatus(null)
      return null
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { online, status, refresh }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = 60000
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(path, { ...init, signal: controller.signal })
    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const err = await parseJsonResponse(res)
        detail = (err as { detail?: string }).detail || detail
      } catch {
        /* keep default */
      }
      throw new Error(detail)
    }
    return parseJsonResponse(res) as Promise<T>
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('请求超时 — 服务器可能正在处理 OCR，请稍后重试')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function normalizePiiRules(raw: any[]): any[] {
  return (raw || []).map((rule, idx) => ({
    ...rule,
    id: rule.id || rule.key || `rule_${idx + 1}`,
    key: rule.key || rule.id || `rule_${idx + 1}`,
  }))
}

export function useExportSettings() {
  const [settings, setSettingsState] = useState<ExportSettingsState>({
    outputDir: '',
    exportAsZip: false,
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    apiFetch<{ output_dir: string; export_as_zip: boolean }>('/api/export/settings', undefined, 10000)
      .then((data) => {
        setSettingsState({
          outputDir: data.output_dir || '',
          exportAsZip: !!data.export_as_zip,
        })
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const setSettings = useCallback(async (next: ExportSettingsState) => {
    setSettingsState(next)
    try {
      await apiFetch('/api/export/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          output_dir: next.outputDir,
          export_as_zip: next.exportAsZip,
        }),
      })
    } catch {
      /* local state still updated */
    }
  }, [])

  return { settings, setSettings, loaded }
}

export function buildDownloadUrl(outputDir: string | undefined, downloadName: string) {
  const params = new URLSearchParams()
  if (outputDir) params.set('dir', outputDir)
  const qs = params.toString()
  return `/api/download/${encodeURIComponent(downloadName)}${qs ? `?${qs}` : ''}`
}

export function parseDownloadUrl(url: string | null): { name: string; outputDir?: string } | null {
  if (!url) return null
  try {
    const u = new URL(url, 'http://local')
    const encoded = u.pathname.split('/').pop() || ''
    const name = decodeURIComponent(encoded)
    if (!name) return null
    const outputDir = u.searchParams.get('dir') || undefined
    return { name, outputDir }
  } catch {
    return null
  }
}

export async function pickExportFolder(initialDir?: string): Promise<string | null> {
  const data = await apiFetch<{ cancelled: boolean; path?: string }>(
    '/api/export/pick-folder',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initial_dir: initialDir || null }),
    },
    120000
  )
  if (data.cancelled || !data.path) return null
  return data.path
}

export async function saveOutputFileAs(
  outputDir: string | undefined,
  filename: string
): Promise<{ cancelled: boolean; savedPath?: string }> {
  const data = await apiFetch<{ cancelled: boolean; saved_path?: string }>(
    '/api/export/save-as',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, dir: outputDir || null }),
    },
    120000
  )
  return { cancelled: data.cancelled, savedPath: data.saved_path }
}

/** 两阶段 PDF 上传：先预览、后检测 */
export async function uploadPdfTwoPhase(
  file: File,
  mode: 'drawing' | 'document',
  onPreview: (preview: any) => void,
  timeoutScanMs = 600000
): Promise<any> {
  const previewForm = new FormData()
  previewForm.append('file', file)
  previewForm.append('mode', mode)

  const preview = await apiFetch<any>(
    '/api/pdf/upload-preview',
    { method: 'POST', body: previewForm },
    60000
  )
  onPreview(preview)

  const scanForm = new FormData()
  scanForm.append('file_id', preview.file_id)

  const scan = await apiFetch<any>(
    '/api/pdf/scan-candidates',
    { method: 'POST', body: scanForm },
    timeoutScanMs
  )

  return { ...preview, candidates: scan.candidates, total_hits: scan.total_hits }
}

/** 对已上传 PDF 重新执行敏感区域识别（file_id 仍有效时） */
export async function rescanPdfCandidates(fileId: string, timeoutMs = 600000): Promise<any> {
  const scanForm = new FormData()
  scanForm.append('file_id', fileId)
  return apiFetch<any>(
    '/api/pdf/scan-candidates',
    { method: 'POST', body: scanForm },
    timeoutMs
  )
}

export async function removePdfCandidate(fileId: string, candidateId: string) {
  if (!fileId) return
  if (candidateId.startsWith('manual_')) return
  try {
    await apiFetch('/api/pdf/remove-candidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, candidate_id: candidateId }),
    })
  } catch {
    /* 本地 UI 删除仍生效，执行时靠 selected_candidate_ids 过滤 */
  }
}

/** 扫描完成后合并用户已删除的候选框，避免 OCR 结果覆盖删除操作 */
export function applyRemovedCandidateFilter<T extends { id: string }>(
  items: T[],
  removedIds: Iterable<string>
): T[] {
  const removed = removedIds instanceof Set ? removedIds : new Set(removedIds)
  if (removed.size === 0) return items
  return items.filter((c) => !removed.has(c.id))
}
