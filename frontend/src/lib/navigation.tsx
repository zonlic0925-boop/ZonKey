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
    { id: 'pdf-editor', labelKey: 'tools.pdfEditor', availability: 'planned' },
    { id: 'pdf-merge', labelKey: 'tools.pdfMerge', availability: 'planned' },
    { id: 'pdf-split', labelKey: 'tools.pdfSplit', availability: 'planned' },
    { id: 'pdf-to-image', labelKey: 'tools.pdfToImage', availability: 'planned' },
    { id: 'pdf-rotate', labelKey: 'tools.pdfRotate', availability: 'planned' },
    { id: 'pdf-encrypt', labelKey: 'tools.pdfEncrypt', availability: 'planned' },
    { id: 'pdf-decrypt', labelKey: 'tools.pdfDecrypt', availability: 'planned' },
    { id: 'pdf-compress', labelKey: 'tools.pdfCompress', availability: 'planned' },
    { id: 'pdf-enhance', labelKey: 'tools.pdfEnhance', availability: 'planned' },
  ],
  ppt_center: [
    { id: 'ppt-to-pdf', labelKey: 'tools.pptToPdf', availability: 'planned' },
    { id: 'ppt-to-image', labelKey: 'tools.pptToImage', availability: 'planned' },
    { id: 'ppt-images', labelKey: 'tools.pptImages', availability: 'planned' },
    { id: 'ppt-text', labelKey: 'tools.pptText', availability: 'planned' },
    { id: 'ppt-compress', labelKey: 'tools.pptCompress', availability: 'planned' },
    { id: 'ppt-outline', labelKey: 'tools.pptOutline', availability: 'planned' },
    { id: 'ppt-draft', labelKey: 'tools.pptDraft', availability: 'planned' },
  ],
  image_center: [
    { id: 'image-crop', labelKey: 'tools.imageCrop', availability: 'planned' },
    { id: 'image-color-replace', labelKey: 'tools.imageColorReplace', availability: 'planned' },
    { id: 'image-convert', labelKey: 'tools.imageConvert', availability: 'planned' },
    { id: 'image-compress', labelKey: 'tools.imageCompress', availability: 'planned' },
    { id: 'image-stitch', labelKey: 'tools.imageStitch', availability: 'planned' },
    { id: 'icon-gen', labelKey: 'tools.iconGen', availability: 'planned' },
    { id: 'color-extractor', labelKey: 'tools.colorExtractor', availability: 'planned' },
    { id: 'color-space-compare', labelKey: 'tools.colorSpaceCompare', availability: 'planned' },
  ],
  media_center: [
    { id: 'bpm-detect', labelKey: 'tools.bpmDetect', availability: 'planned' },
    { id: 'audio-clip', labelKey: 'tools.audioClip', availability: 'planned' },
    { id: 'audio-convert', labelKey: 'tools.audioConvert', availability: 'planned' },
    { id: 'audio-extract', labelKey: 'tools.audioExtract', availability: 'planned' },
    { id: 'video-convert', labelKey: 'tools.videoConvert', availability: 'planned' },
    { id: 'video-frame', labelKey: 'tools.videoFrame', availability: 'planned' },
    { id: 'video-gif', labelKey: 'tools.videoGif', availability: 'planned' },
  ],
  text_center: [
    { id: 'markdown-editor', labelKey: 'tools.markdownEditor', availability: 'planned' },
    { id: 'text-stats', labelKey: 'tools.textStats', availability: 'planned' },
    { id: 'text-format', labelKey: 'tools.textFormat', availability: 'planned' },
    { id: 'transcription', labelKey: 'tools.transcription', availability: 'planned' },
    { id: 'typing-test', labelKey: 'tools.typingTest', availability: 'planned' },
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
    { id: 'hardware-overview', labelKey: 'tools.hardwareOverview', availability: 'planned' },
    { id: 'hardware-cpu-memory', labelKey: 'tools.hardwareCpuMemory', availability: 'planned' },
    { id: 'hardware-gpu-display', labelKey: 'tools.hardwareGpuDisplay', availability: 'planned' },
    { id: 'hardware-mainboard', labelKey: 'tools.hardwareMainboard', availability: 'planned' },
    { id: 'hardware-storage', labelKey: 'tools.hardwareStorage', availability: 'planned' },
    { id: 'hardware-power-sensors', labelKey: 'tools.hardwarePowerSensors', availability: 'planned' },
    { id: 'large-file-cleanup', labelKey: 'tools.largeFileCleanup', availability: 'planned' },
    { id: 'c-drive-cleanup', labelKey: 'tools.cDriveCleanup', availability: 'planned' },
  ],
};

export const getCenterMeta = (id: CenterId): CenterMeta =>
  CENTERS.find((c) => c.id === id) ?? CENTERS[0];

export const isToolReady = (meta: ToolMeta): boolean => meta.availability === 'ready';
