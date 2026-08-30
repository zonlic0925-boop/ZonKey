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

export async function openOutputFile(outputDir: string | undefined, filename: string): Promise<void> {
  await apiFetch<{ status: string; path: string }>(
    '/api/export/open-file',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, dir: outputDir || null }),
    },
    30000
  )
}

/** 等待所有页面预览图在浏览器中加载完成 */
export async function preloadPdfPageImages(
  pages: Array<{ image_url: string }>
): Promise<void> {
  const urls = (pages || []).map((p) => p.image_url).filter(Boolean)
  if (!urls.length) return
  await Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('页面预览加载失败'))
          img.src = url
        })
    )
  )
}

/** 仅上传并返回页面预览（不触发 OCR） */
export async function uploadPdfPreviewOnly(
  file: File,
  mode: 'drawing' | 'document'
): Promise<any> {
  const previewForm = new FormData()
  previewForm.append('file', file)
  previewForm.append('mode', mode)
  return apiFetch<any>('/api/pdf/upload-preview', { method: 'POST', body: previewForm }, 600000)
}

/** 对已上传 PDF 执行敏感区域识别 */
export async function scanPdfCandidatesById(fileId: string, timeoutMs = 600000): Promise<any> {
  const scanForm = new FormData()
  scanForm.append('file_id', fileId)
  return apiFetch<any>('/api/pdf/scan-candidates', { method: 'POST', body: scanForm }, timeoutMs)
}

/** 两阶段 PDF 上传：先预览、等待全部页面加载、再从第 1 页起识别 */
export async function uploadPdfTwoPhase(
  file: File,
  mode: 'drawing' | 'document',
  onPreview: (preview: any) => void,
  timeoutScanMs = 600000,
  onPagesLoaded?: () => void,
  onScanStart?: () => void
): Promise<any> {
  const preview = await uploadPdfPreviewOnly(file, mode)
  onPreview(preview)

  await preloadPdfPageImages(preview.pages || [])
  onPagesLoaded?.()
  onScanStart?.()

  const scan = await scanPdfCandidatesById(preview.file_id, timeoutScanMs)

  return { ...preview, candidates: scan.candidates, total_hits: scan.total_hits }
}

export async function syncPdfCandidateBoxes(
  fileId: string,
  candidates: Array<{
    id: string
    page_num: number
    bbox: [number, number, number, number]
    is_selected?: boolean
    matched_terms?: string[]
  }>
) {
  if (!fileId) return
  await apiFetch('/api/pdf/update-candidate-boxes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_id: fileId,
      boxes: candidates.map((c) => ({
        id: c.id,
        page_index: c.page_num - 1,
        x: c.bbox[0],
        y: c.bbox[1],
        width: c.bbox[2] - c.bbox[0],
        height: c.bbox[3] - c.bbox[1],
        matched_terms: (c.matched_terms || []).filter(Boolean),
      })),
    }),
  })
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

// ---------------------------------------------------------------------------
// 音视讯中心长任务（视频转换 / 视频转GIF / 语音转写）
// ---------------------------------------------------------------------------

export interface MediaToolCapabilities {
  ffmpeg: boolean
  asr_engine: boolean
  asr_default_model: string
}

export interface MediaJobOutput {
  name: string
  dir: string
}

export interface MediaJobStatus {
  job_id: string
  kind: string
  status: 'running' | 'done' | 'error'
  progress: number
  stage: string
  error: string | null
  outputs: MediaJobOutput[]
  detected_language?: string
  duration?: number
}

export async function getMediaCapabilities(): Promise<MediaToolCapabilities> {
  return apiFetch<MediaToolCapabilities>('/api/media/status', undefined, 10000)
}

export async function startVideoConvert(file: File, target: string): Promise<{ job_id: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('target', target)
  return apiFetch('/api/media/video/convert', { method: 'POST', body: form }, 600000)
}

export async function startVideoGif(
  file: File,
  opts: { startS: number; endS: number; fps: number; width: number; quality: string }
): Promise<{ job_id: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('start_s', String(opts.startS))
  form.append('end_s', String(opts.endS))
  form.append('fps', String(opts.fps))
  form.append('width', String(opts.width))
  form.append('quality', opts.quality)
  return apiFetch('/api/media/video/gif', { method: 'POST', body: form }, 600000)
}

export async function startTranscription(
  file: File,
  language: string,
  modelSize: string
): Promise<{ job_id: string }> {
  const form = new FormData()
  form.append('file', file)
  form.append('language', language)
  form.append('model_size', modelSize)
  return apiFetch('/api/media/transcribe', { method: 'POST', body: form }, 600000)
}

export async function getMediaJob(jobId: string): Promise<MediaJobStatus> {
  return apiFetch<MediaJobStatus>(`/api/media/jobs/${encodeURIComponent(jobId)}`, undefined, 30000)
}

/** 轮询媒体任务直至 done/error；onTick 每次采样回调。 */
export async function pollMediaJob(
  jobId: string,
  onTick?: (status: MediaJobStatus) => void,
  intervalMs = 1000
): Promise<MediaJobStatus> {
  for (;;) {
    const status = await getMediaJob(jobId)
    onTick?.(status)
    if (status.status === 'done' || status.status === 'error') return status
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

// ---------------------------------------------------------------------------
// 文档转换（/api/convert，job 轮询模式）
// ---------------------------------------------------------------------------

export interface ConvertJobOutput {
  name: string
  dir: string
}

export interface ConvertJobStatus {
  job_id: string
  kind: string
  status: 'running' | 'done' | 'error'
  progress: number
  stage: string
  error: string | null
  outputs: ConvertJobOutput[]
  engine?: string
  note?: string
  warnings?: string[]
  page_count?: number
  dpi?: number
  quality?: number
  compression_ratio_pct?: number
  char_count?: number
}

export interface ConvertCapability {
  engines: Record<string, string | null>
  pywin32: boolean
  word_com: boolean
  excel_com: boolean
  rapidocr: boolean
  word_fallback: boolean
}

export async function getConvertCapability(): Promise<ConvertCapability> {
  return apiFetch<ConvertCapability>('/api/convert/capability', undefined, 10000)
}

export type ConvertOp =
  | 'pdf-to-word'
  | 'pdf-to-excel'
  | 'pdf-to-ppt'
  | 'office-to-pdf'
  | 'compress-deep'
  | 'ocr-export'

export interface ConvertOptions {
  dpi?: number
  quality?: number
  imageFormat?: 'png' | 'jpeg'
  ocrOutput?: 'txt' | 'pdf'
}

export async function startConvertJob(op: ConvertOp, file: File, opts: ConvertOptions = {}): Promise<{ job_id: string }> {
  const form = new FormData()
  form.append('file', file)
  if (op === 'pdf-to-ppt') {
    form.append('dpi', String(opts.dpi ?? 150))
    form.append('image_format', opts.imageFormat ?? 'png')
  } else if (op === 'compress-deep') {
    form.append('dpi', String(opts.dpi ?? 144))
    form.append('quality', String(opts.quality ?? 70))
  } else if (op === 'ocr-export') {
    form.append('output', opts.ocrOutput ?? 'txt')
    form.append('dpi', String(opts.dpi ?? 200))
  }
  return apiFetch(`/api/convert/${op}`, { method: 'POST', body: form }, 600000)
}

export async function getConvertJob(jobId: string): Promise<ConvertJobStatus> {
  return apiFetch<ConvertJobStatus>(`/api/convert/jobs/${encodeURIComponent(jobId)}`, undefined, 30000)
}

/** 轮询转换任务直至 done/error；onTick 每次采样回调。 */
export async function pollConvertJob(
  jobId: string,
  onTick?: (status: ConvertJobStatus) => void,
  intervalMs = 1000
): Promise<ConvertJobStatus> {
  for (;;) {
    const status = await getConvertJob(jobId)
    onTick?.(status)
    if (status.status === 'done' || status.status === 'error') return status
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

/** HTML/Markdown → PDF（同步端点）：接受粘贴内容或 .html/.md/.txt 文件。 */
export async function convertHtmlToPdf(
  opts: { content?: string; file?: File | null; title?: string }
): Promise<{ status: string; download_name: string; output_dir: string; engine: string; warnings?: string[] }> {
  const form = new FormData()
  if (opts.file) form.append('file', opts.file)
  if (opts.content) form.append('content', opts.content)
  form.append('title', opts.title || 'Document')
  return apiFetch('/api/convert/html-to-pdf', { method: 'POST', body: form }, 120000)
}

/** PDF 修复（同步端点，pikepdf/qpdf 损坏恢复）。 */
export async function convertRepair(
  file: File
): Promise<{ status: string; download_name: string; output_dir: string; page_count: number; engine: string }> {
  const form = new FormData()
  form.append('file', file)
  return apiFetch('/api/convert/repair', { method: 'POST', body: form }, 300000)
}
