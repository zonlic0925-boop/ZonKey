// ===== 导航结构：8 大中心 + 二级子工具（ToolKnit 合并架构） =====

/** 一级：功能中心 */
export type CenterId =
  | 'redact'
  | 'pdf_center'
  | 'ppt_center'
  | 'image_center'
  | 'media_center'
  | 'text_center'
  | 'calc_dev'
  | 'system_tools';

/** 智能脱敏中心（ZonScale 原生功能） */
export type RedactToolId = 'drawing' | 'pdf_doc' | 'word_doc' | 'rules' | 'audit' | 'favorites-view' | 'home-nav';

/** PDF 工坊 */
export type PdfToolId =
  | 'pdf-home'
  | 'pdf-editor'
  | 'pdf-organize'
  | 'images-to-pdf'
  | 'pdf-forms'
  | 'pdf-cert-sign'
  | 'pdf-merge'
  | 'pdf-split'
  | 'pdf-extract'
  | 'pdf-to-image'
  | 'pdf-images-to-pdf'
  | 'pdf-rotate'
  | 'pdf-compress'
  | 'pdf-enhance'
  | 'pdf-watermark'
  | 'pdf-page-numbers'
  | 'pdf-crop'
  | 'pdf-encrypt'
  | 'pdf-decrypt'
  | 'pdf-to-word'
  | 'pdf-to-excel'
  | 'pdf-to-ppt'
  | 'office-to-pdf'
  | 'compress-deep'
  | 'html-to-pdf'
  | 'ocr-export'
  | 'pdf-repair';

/** PPT 工坊 */
export type PptToolId =
  | 'ppt-to-pdf'
  | 'ppt-to-image'
  | 'ppt-images'
  | 'ppt-text'
  | 'ppt-compress'
  | 'ppt-outline'
  | 'ppt-draft';

/** 图像工坊 */
export type ImageToolId =
  | 'image-crop'
  | 'image-color-replace'
  | 'image-convert'
  | 'image-compress'
  | 'image-stitch'
  | 'icon-gen'
  | 'color-extractor'
  | 'color-space-compare';

/** 音视频中心 */
export type MediaToolId =
  | 'bpm-detect'
  | 'audio-clip'
  | 'audio-convert'
  | 'audio-extract'
  | 'video-convert'
  | 'video-frame'
  | 'video-gif';

/** 文本工坊 */
export type TextToolId =
  | 'markdown-editor'
  | 'text-stats'
  | 'text-format'
  | 'transcription'
  | 'typing-test';

/** 计算开发中心 */
export type CalcToolId =
  | 'bmi-calc'
  | 'timestamp-calc'
  | 'mortgage-calc'
  | 'interest-calc'
  | 'password-gen'
  | 'json-tools'
  | 'base64'
  | 'url-codec'
  | 'uuid'
  | 'jwt'
  | 'hash-crypto';

/** 系统硬件中心 */
export type SystemToolId =
  | 'hardware-overview'
  | 'hardware-cpu-memory'
  | 'hardware-gpu-display'
  | 'hardware-mainboard'
  | 'hardware-storage'
  | 'hardware-power-sensors'
  | 'large-file-cleanup'
  | 'c-drive-cleanup';

export type ToolId =
  | RedactToolId
  | PdfToolId
  | PptToolId
  | ImageToolId
  | MediaToolId
  | TextToolId
  | CalcToolId
  | SystemToolId;

/** 工具接入状态：ready=已接入可用；planned=已注册、待垂直切片接入 */
export type ToolAvailability = 'ready' | 'planned';

export interface RedactionRule {
  name: string;
  enabled: boolean;
  color: string;
  category: 'enterprise' | 'pii' | 'stamp' | 'word';
  keywords?: string[];
  pattern?: string;
}

export interface CandidateBox {
  id: string;
  page_num: number;
  bbox: [number, number, number, number];
  text: string;
  rule_name: string;
  matched_terms?: string[];
  channel: 'vector' | 'ocr' | 'image' | 'manual';
  is_selected: boolean;
  is_manual?: boolean;
  confidence?: number;
}

export interface PageInfo {
  page_num: number;
  width: number;
  height: number;
  image_url: string;
}

export interface DocumentState {
  file_path: string;
  file_name: string;
  file_type: 'pdf' | 'docx' | 'doc' | 'image';
  file_size: number;
  total_pages: number;
  current_page: number;
  pages: PageInfo[];
  candidates: CandidateBox[];
  history_past: CandidateBox[][];
  history_future: CandidateBox[][];
  stats: {
    total_found: number;
    selected_count: number;
    channel_counts: Record<string, number>;
  };
}

export type PdfElementType = 'text' | 'image' | 'rect' | 'ellipse';

export interface PdfElement {
  id: string;
  page: number;
  type: PdfElementType;
  x: number;
  y: number; // PDF coordinates (top-left based for our frontend canvas, converted on export)
  width: number;
  height: number;
  // Type specific properties
  text?: string;
  color?: string; // hex color
  fontSize?: number;
  imageUrl?: string; // base64 data uri for images/signatures
  strokeWidth?: number;
}

export interface SystemStatus {
  ocr_available: boolean;
  ocr_model_status: string;
  device: string;
  active_rules_count: number;
  service?: string;
  version?: string;
  online?: boolean;
  model_ready?: boolean;
}



