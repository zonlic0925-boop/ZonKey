import { CandidateBox, PageInfo } from '../types'
import { apiFetch, buildDownloadUrl } from './api'

export interface RedactPreviewResult {
  output_path: string
  output_dir: string
  download_name: string
  redacted_boxes_count: number
  redacted_pages: Array<{
    page_index: number
    width: number
    height: number
    image_url: string
  }>
}

export function mapRedactedPages(raw: RedactPreviewResult['redacted_pages']): PageInfo[] {
  return (raw || []).map((p) => ({
    page_num: p.page_index + 1,
    width: p.width,
    height: p.height,
    image_url: p.image_url,
  }))
}

function buildBoxOverrides(candidates: CandidateBox[], selectedOnly = true) {
  const pool = selectedOnly ? candidates.filter((c) => c.is_selected) : candidates
  return pool.map((c) => ({
    id: c.id,
    page_index: c.page_num - 1,
    x: Number(c.bbox[0].toFixed(2)),
    y: Number(c.bbox[1].toFixed(2)),
    width: Number((c.bbox[2] - c.bbox[0]).toFixed(2)),
    height: Number((c.bbox[3] - c.bbox[1]).toFixed(2)),
    matched_terms: (c.matched_terms || []).filter(Boolean),
  }))
}

export async function requestPdfRedaction(args: {
  fileId: string
  candidates: CandidateBox[]
  outputDir?: string
  exportAsZip?: boolean
  mode?: 'redact' | 'blackout'
  outputFilename?: string
}): Promise<{ result: RedactPreviewResult; downloadUrl: string; pdfDownloadUrl: string; afterPages: PageInfo[] }> {
  const selected = args.candidates.filter((c) => c.is_selected)
  if (!selected.length) {
    throw new Error('NO_SELECTION')
  }

  const result = await apiFetch<RedactPreviewResult>(
    '/api/pdf/execute-redaction',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: args.fileId,
        selected_candidate_ids: selected.map((c) => c.id),
        mode: args.mode ?? 'redact',
        box_overrides: buildBoxOverrides(args.candidates, false),
        output_dir: args.outputDir || undefined,
        export_as_zip: args.exportAsZip,
        output_filename: args.outputFilename,
      }),
    },
    300000
  )

  const pdfName = result.output_path?.split(/[/\\]/).pop() || result.download_name

  return {
    result,
    downloadUrl: buildDownloadUrl(result.output_dir, result.download_name),
    pdfDownloadUrl: buildDownloadUrl(result.output_dir, pdfName),
    afterPages: mapRedactedPages(result.redacted_pages),
  }
}

/** 删除/取消勾选后，若已有脱敏后预览则重新生成，保持左右同步。 */
export async function syncPdfAfterPreview(args: {
  fileId: string
  candidates: CandidateBox[]
  hadAfterPreview: boolean
  outputDir?: string
  exportAsZip?: boolean
}): Promise<{
  afterPages: PageInfo[] | null
  downloadUrl: string | null
  pdfDownloadUrl: string | null
  previewMode: 'before' | 'after'
  result?: RedactPreviewResult
}> {
  if (!args.hadAfterPreview) {
    return { afterPages: null, downloadUrl: null, pdfDownloadUrl: null, previewMode: 'before' }
  }

  const selected = args.candidates.filter((c) => c.is_selected)
  if (!selected.length) {
    return { afterPages: null, downloadUrl: null, pdfDownloadUrl: null, previewMode: 'before' }
  }

  const { result, downloadUrl, pdfDownloadUrl, afterPages } = await requestPdfRedaction({
    fileId: args.fileId,
    candidates: args.candidates,
    outputDir: args.outputDir,
    exportAsZip: args.exportAsZip,
  })

  return {
    afterPages,
    downloadUrl,
    pdfDownloadUrl,
    previewMode: 'after',
    result,
  }
}
