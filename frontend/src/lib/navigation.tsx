import React from 'react';
import {
  ShieldCheck,
  FileStack,
  Presentation,
  Image as ImageIcon,
  Music,
  Type,
  Calculator,
  HardDrive,
} from 'lucide-react';
import type { CenterId, ToolId, ToolAvailability } from '../types';

export type LucideIcon = React.ComponentType<{ className?: string }>;

/** Memphis 强调色（与 tailwind.config.js 的 mem 色板一一对应） */
export type MemphisAccent =
  | 'coral'
  | 'sky'
  | 'pink'
  | 'yellow'
  | 'teal'
  | 'lime'
  | 'lavender'
  | 'orange';

export interface CenterMeta {
  id: CenterId;
  /** i18n key，见 locales 的 centers.* */
  labelKey: string;
  icon: LucideIcon;
  /** 一级导航与二级 pills 的激活态强调色 */
  accent: MemphisAccent;
}

export interface ToolMeta {
  id: ToolId;
  /** i18n key，见 locales 的 tools.* */
  labelKey: string;
  availability: ToolAvailability;
}

/** 8 大中心（顺序即导航顺序） */
export const CENTERS: CenterMeta[] = [
  { id: 'redact', labelKey: 'centers.redact', icon: ShieldCheck, accent: 'coral' },
  { id: 'pdf_center', labelKey: 'centers.pdfCenter', icon: FileStack, accent: 'sky' },
  { id: 'ppt_center', labelKey: 'centers.pptCenter', icon: Presentation, accent: 'orange' },
  { id: 'image_center', labelKey: 'centers.imageCenter', icon: ImageIcon, accent: 'yellow' },
  { id: 'media_center', labelKey: 'centers.mediaCenter', icon: Music, accent: 'teal' },
  { id: 'text_center', labelKey: 'centers.textCenter', icon: Type, accent: 'pink' },
  { id: 'calc_dev', labelKey: 'centers.calcDev', icon: Calculator, accent: 'lavender' },
  { id: 'system_tools', labelKey: 'centers.systemTools', icon: HardDrive, accent: 'lime' },
];

/**
 * 各中心二级子工具注册表。
 * redact 为原生功能（ready）；其余中心按垂直切片逐批把 availability 翻为 ready。
 */
export const CENTER_TOOLS: Record<CenterId, ToolMeta[]> = {
  redact: [
    { id: 'drawing', labelKey: 'header.navDrawing', availability: 'ready' },
    { id: 'pdf_doc', labelKey: 'header.navPdfDoc', availability: 'ready' },
    { id: 'word_doc', labelKey: 'header.navWordDoc', availability: 'ready' },
    { id: 'rules', labelKey: 'header.navRules', availability: 'ready' },
    { id: 'audit', labelKey: 'header.navAudit', availability: 'ready' },
  ],
  pdf_center: [
    { id: 'pdf-editor', labelKey: 'tools.pdfEditor', availability: 'ready' },
    { id: 'pdf-merge', labelKey: 'tools.pdfMerge', availability: 'ready' },
    { id: 'pdf-split', labelKey: 'tools.pdfSplit', availability: 'ready' },
    { id: 'pdf-extract', labelKey: 'tools.pdfExtract', availability: 'ready' },
    { id: 'pdf-rotate', labelKey: 'tools.pdfRotate', availability: 'ready' },
    { id: 'pdf-to-image', labelKey: 'tools.pdfToImage', availability: 'ready' },
    { id: 'pdf-images-to-pdf', labelKey: 'tools.pdfImagesToPdf', availability: 'ready' },
    { id: 'pdf-compress', labelKey: 'tools.pdfCompress', availability: 'ready' },
    { id: 'compress-deep', labelKey: 'tools.compressDeep', availability: 'ready' },
    { id: 'pdf-enhance', labelKey: 'tools.pdfEnhance', availability: 'ready' },
    { id: 'pdf-watermark', labelKey: 'tools.pdfWatermark', availability: 'ready' },
    { id: 'pdf-page-numbers', labelKey: 'tools.pdfPageNumbers', availability: 'ready' },
    { id: 'pdf-crop', labelKey: 'tools.pdfCrop', availability: 'ready' },
    { id: 'pdf-encrypt', labelKey: 'tools.pdfEncrypt', availability: 'ready' },
    { id: 'pdf-decrypt', labelKey: 'tools.pdfDecrypt', availability: 'ready' },
    { id: 'pdf-to-word', labelKey: 'tools.pdfToWord', availability: 'ready' },
    { id: 'pdf-to-excel', labelKey: 'tools.pdfToExcel', availability: 'ready' },
    { id: 'pdf-to-ppt', labelKey: 'tools.pdfToPpt', availability: 'ready' },
    { id: 'office-to-pdf', labelKey: 'tools.officeToPdf', availability: 'ready' },
    { id: 'html-to-pdf', labelKey: 'tools.htmlToPdf', availability: 'ready' },
    { id: 'ocr-export', labelKey: 'tools.ocrExport', availability: 'ready' },
    { id: 'pdf-repair', labelKey: 'tools.pdfRepair', availability: 'ready' },
  ],
  ppt_center: [
    { id: 'ppt-to-pdf', labelKey: 'tools.pptToPdf', availability: 'ready' },
    { id: 'ppt-to-image', labelKey: 'tools.pptToImage', availability: 'ready' },
    { id: 'ppt-images', labelKey: 'tools.pptImages', availability: 'ready' },
    { id: 'ppt-text', labelKey: 'tools.pptText', availability: 'ready' },
    { id: 'ppt-compress', labelKey: 'tools.pptCompress', availability: 'ready' },
    { id: 'ppt-outline', labelKey: 'tools.pptOutline', availability: 'ready' },
    { id: 'ppt-draft', labelKey: 'tools.pptDraft', availability: 'ready' },
  ],
  image_center: [
    { id: 'image-crop', labelKey: 'tools.imageCrop', availability: 'ready' },
    { id: 'image-color-replace', labelKey: 'tools.imageColorReplace', availability: 'ready' },
    { id: 'image-convert', labelKey: 'tools.imageConvert', availability: 'ready' },
    { id: 'image-compress', labelKey: 'tools.imageCompress', availability: 'ready' },
    { id: 'image-stitch', labelKey: 'tools.imageStitch', availability: 'ready' },
    { id: 'icon-gen', labelKey: 'tools.iconGen', availability: 'ready' },
    { id: 'color-extractor', labelKey: 'tools.colorExtractor', availability: 'ready' },
    { id: 'color-space-compare', labelKey: 'tools.colorSpaceCompare', availability: 'ready' },
  ],
  media_center: [
    { id: 'bpm-detect', labelKey: 'tools.bpmDetect', availability: 'ready' },
    { id: 'audio-clip', labelKey: 'tools.audioClip', availability: 'ready' },
    { id: 'audio-convert', labelKey: 'tools.audioConvert', availability: 'ready' },
    { id: 'audio-extract', labelKey: 'tools.audioExtract', availability: 'ready' },
    { id: 'video-convert', labelKey: 'tools.videoConvert', availability: 'ready' },
    { id: 'video-frame', labelKey: 'tools.videoFrame', availability: 'ready' },
    { id: 'video-gif', labelKey: 'tools.videoGif', availability: 'ready' },
  ],
  text_center: [
    { id: 'markdown-editor', labelKey: 'tools.markdownEditor', availability: 'ready' },
    { id: 'text-stats', labelKey: 'tools.textStats', availability: 'ready' },
    { id: 'text-format', labelKey: 'tools.textFormat', availability: 'ready' },
    { id: 'transcription', labelKey: 'tools.transcription', availability: 'ready' },
    { id: 'typing-test', labelKey: 'tools.typingTest', availability: 'ready' },
  ],
  calc_dev: [
    { id: 'bmi-calc', labelKey: 'tools.bmiCalc', availability: 'ready' },
    { id: 'timestamp-calc', labelKey: 'tools.timestampCalc', availability: 'ready' },
    { id: 'mortgage-calc', labelKey: 'tools.mortgageCalc', availability: 'ready' },
    { id: 'interest-calc', labelKey: 'tools.interestCalc', availability: 'ready' },
    { id: 'password-gen', labelKey: 'tools.passwordGen', availability: 'ready' },
    { id: 'json-tools', labelKey: 'tools.jsonTools', availability: 'ready' },
    { id: 'base64', labelKey: 'tools.base64', availability: 'ready' },
    { id: 'url-codec', labelKey: 'tools.urlCodec', availability: 'ready' },
    { id: 'uuid', labelKey: 'tools.uuid', availability: 'ready' },
    { id: 'jwt', labelKey: 'tools.jwt', availability: 'ready' },
    { id: 'hash-crypto', labelKey: 'tools.hashCrypto', availability: 'ready' },
  ],
  system_tools: [
    { id: 'hardware-overview', labelKey: 'tools.hardwareOverview', availability: 'ready' },
    { id: 'hardware-cpu-memory', labelKey: 'tools.hardwareCpuMemory', availability: 'ready' },
    { id: 'hardware-gpu-display', labelKey: 'tools.hardwareGpuDisplay', availability: 'ready' },
    { id: 'hardware-mainboard', labelKey: 'tools.hardwareMainboard', availability: 'ready' },
    { id: 'hardware-storage', labelKey: 'tools.hardwareStorage', availability: 'ready' },
    { id: 'hardware-power-sensors', labelKey: 'tools.hardwarePowerSensors', availability: 'ready' },
    { id: 'large-file-cleanup', labelKey: 'tools.largeFileCleanup', availability: 'ready' },
    { id: 'c-drive-cleanup', labelKey: 'tools.cDriveCleanup', availability: 'ready' },
  ],
};

export const getCenterMeta = (id: CenterId): CenterMeta =>
  CENTERS.find((c) => c.id === id) ?? CENTERS[0];

export const isToolReady = (meta: ToolMeta): boolean => meta.availability === 'ready';
