import { CandidateBox, PageInfo } from '../types'
import { formatCandidateLabel } from './imageLayout'

export function mapApiPages(pages: any[]): PageInfo[] {
  return (pages || []).map((p: any) => ({
    page_num: p.page_index + 1,
    width: p.width,
    height: p.height,
    image_url: p.image_url,
  }))
}

export function mapApiCandidates(candidates: any[], mode: 'drawing' | 'document'): CandidateBox[] {
  return (candidates || [])
    .filter((c) => {
      if (mode !== 'drawing') return true
      const text = c.text || ''
      return !text.startsWith('[')
    })
    .map((c: any) => ({
      id: c.id,
      page_num: c.page_index + 1,
      bbox: [c.x, c.y, c.x + c.width, c.y + c.height] as [number, number, number, number],
      text: c.text || '敏感项',
      rule_name: formatCandidateLabel(c.matched_terms, c.text, mode === 'document' && c.type === 'pii' ? 'PII' : '敏感项'),
      matched_terms: Array.isArray(c.matched_terms) ? c.matched_terms.filter(Boolean) : [],
      channel: c.manual_required ? 'manual' : c.type === 'pii' ? 'ocr' : 'vector',
      is_selected: c.selected !== false,
      is_manual: false,
      confidence: c.confidence,
    }))
}

export function buildManualBoxes(selected: CandidateBox[]) {
  return selected
    .filter((c) => c.is_manual)
    .map((c) => ({
      id: c.id,
      page_index: c.page_num - 1,
      x: c.bbox[0],
      y: c.bbox[1],
      width: c.bbox[2] - c.bbox[0],
      height: c.bbox[3] - c.bbox[1],
    }))
}

export function downloadUrl(filename: string, outputDir?: string) {
  const q = outputDir ? `?dir=${encodeURIComponent(outputDir)}` : ''
  return `/api/download/${encodeURIComponent(filename)}${q}`
}
