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

export async function requestPdfRedaction(args: {
  fileId: string
  candidates: CandidateBox[]
  outputDir?: string
  exportAsZip?: boolean
  mode?: 'redact' | 'blackout'
}): Promise<{ result: RedactPreviewResult; downloadUrl: string; afterPages: PageInfo[] }> {
  const selected = args.candidates.filter((c) => c.is_selected)
  if (!selected.length) {
    throw new Error('NO_SELECTION')
  }

  const manualBoxes = selected
    .filter((c) => c.is_manual || c.id.startsWith('manual_'))
    .map((c) => ({
      id: c.id,
      page_index: c.page_num - 1,
      x: c.bbox[0],
      y: c.bbox[1],
      width: c.bbox[2] - c.bbox[0],
      height: c.bbox[3] - c.bbox[1],
    }))

  const result = await apiFetch<RedactPreviewResult>(
    '/api/pdf/execute-redaction',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: args.fileId,
        selected_candidate_ids: selected.map((c) => c.id),
        mode: args.mode ?? 'redact',
        manual_boxes: manualBoxes.length > 0 ? manualBoxes : undefined,
        output_dir: args.outputDir || undefined,
        export_as_zip: args.exportAsZip,
      }),
    },
    300000
  )

  return {
    result,
    downloadUrl: buildDownloadUrl(result.output_dir, result.download_name),
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
  previewMode: 'before' | 'after'
  result?: RedactPreviewResult
}> {
  if (!args.hadAfterPreview) {
    return { afterPages: null, downloadUrl: null, previewMode: 'before' }
  }

  const selected = args.candidates.filter((c) => c.is_selected)
  if (!selected.length) {
    return { afterPages: null, downloadUrl: null, previewMode: 'before' }
  }

  const { result, downloadUrl, afterPages } = await requestPdfRedaction({
    fileId: args.fileId,
    candidates: args.candidates,
    outputDir: args.outputDir,
    exportAsZip: args.exportAsZip,
  })

  return {
    afterPages,
    downloadUrl,
    previewMode: 'after',
    result,
  }
}
