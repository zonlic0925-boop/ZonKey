export type TabType = 'drawing' | 'pdf_doc' | 'word_doc' | 'rules' | 'audit'

export interface RedactionRule {
  name: string
  enabled: boolean
  color: string
  category: 'enterprise' | 'pii' | 'stamp' | 'word'
  keywords?: string[]
  pattern?: string
}

export interface CandidateBox {
  id: string
  page_num: number
  bbox: [number, number, number, number] // [x0, y0, x1, y1] (pt)
  text: string
  rule_name: string
  channel: 'vector' | 'ocr' | 'image' | 'manual'
  is_selected: boolean
  is_manual?: boolean
  confidence?: number
}

export interface PageInfo {
  page_num: number
  width: number
  height: number
  image_url: string
}

export interface DocumentState {
  file_path: string
  file_name: string
  file_type: 'pdf' | 'docx' | 'doc' | 'image'
  file_size: number
  total_pages: number
  current_page: number
  pages: PageInfo[]
  candidates: CandidateBox[]
  history_past: CandidateBox[][]
  history_future: CandidateBox[][]
  stats: {
    total_found: number
    selected_count: number
    channel_counts: Record<string, number>
  }
}

export interface SystemStatus {
  ocr_available: boolean
  ocr_model_status: string
  device: string
  active_rules_count: number
}
