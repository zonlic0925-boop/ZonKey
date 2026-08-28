/**
 * PPT 工坊核心 — 校验层语义对齐 ToolKnit ppt-image-extract-core.js 等核心；
 * 基于 JSZip 实现：媒体提取、按幻灯片文本提取（a:t 文本流 + 备注）、瘦身重压缩。
 * PPT 转 PDF/长图（渲染引擎）与 AI 大纲/草稿属后续批次。
 */
import JSZip from 'jszip';

export const PPT_CORE_LIMITS = Object.freeze({
  maxInputBytes: 200 * 1024 * 1024,
  maxSlides: 500,
  maxMediaFiles: 2000,
});

export const PPT_IMAGE_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'emf', 'wmf', 'tif', 'tiff',
] as const;

const IMAGE_EXTENSION_SET = new Set<string>(PPT_IMAGE_EXTENSIONS);

export function assertPptxFileName(fileName: string): void {
  if (!/\.pptx$/i.test(String(fileName || ''))) {
    throw new Error('A .pptx file is required');
  }
}

export async function assertPptxFile(file: File): Promise<JSZip> {
  assertPptxFileName(file.name);
  if (file.size > PPT_CORE_LIMITS.maxInputBytes) {
    throw new Error(`PPTX exceeds the ${Math.floor(PPT_CORE_LIMITS.maxInputBytes / 1024 / 1024)}MB limit`);
  }
  return JSZip.loadAsync(await file.arrayBuffer());
}

// ===== 内嵌图片提取 =====

export interface PptMediaItem {
  path: string;
  fileName: string;
  extension: string;
  size: number;
  blob: Blob;
}

export async function extractPptImages(file: File): Promise<PptMediaItem[]> {
  const zip = await assertPptxFile(file);
  const items: PptMediaItem[] = [];
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  for (const entry of entries) {
    const lower = entry.name.toLowerCase();
    if (!lower.startsWith('ppt/media/')) continue;
    const extension = lower.split('.').pop() ?? '';
    if (!IMAGE_EXTENSION_SET.has(extension)) continue;
    if (items.length >= PPT_CORE_LIMITS.maxMediaFiles) break;
    const bytes = await entry.async('uint8array');
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    items.push({
      path: entry.name,
      fileName: entry.name.split('/').pop() ?? entry.name,
      extension,
      size: bytes.byteLength,
      blob: new Blob([buffer]),
    });
  }
  return items;
}

// ===== 文本提取 =====

export interface PptSlideText {
  slideNumber: number;
  title: string;
  lines: string[];
  notes: string[];
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

/** 从幻灯片 XML 中抽取 a:t 文本流；首个独立段落视作标题 */
function extractTextRuns(xml: string): string[] {
  const paragraphs = xml.split(/<a:p[ >]/).slice(1);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const body = paragraph.split('</a:p>')[0];
    const runs = [...body.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((match) => decodeXmlEntities(match[1]).trim()).filter(Boolean);
    if (runs.length) lines.push(runs.join(''));
  }
  return lines;
}

function slideNumberFromName(name: string): number {
  const match = /slide(\d+)\.xml$/i.exec(name);
  return match ? Number(match[1]) : 0;
}

export async function extractPptText(file: File): Promise<PptSlideText[]> {
  const zip = await assertPptxFile(file);
  const slideEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir && /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
    .sort((a, b) => slideNumberFromName(a.name) - slideNumberFromName(b.name));
  if (slideEntries.length > PPT_CORE_LIMITS.maxSlides) slideEntries.length = PPT_CORE_LIMITS.maxSlides;

  const slides: PptSlideText[] = [];
  for (const entry of slideEntries) {
    const xml = await entry.async('string');
    const lines = extractTextRuns(xml);
    const notesPath = entry.name.replace(/^ppt\/slides\/slide/, 'ppt/notesSlides/notesSlide');
    const notesFile = zip.file(notesPath);
    const notes = notesFile ? extractTextRuns(await notesFile.async('string')) : [];
    slides.push({
      slideNumber: slideNumberFromName(entry.name),
      title: lines[0] ?? '',
      lines,
      notes,
    });
  }
  return slides;
}

// ===== PPTX 瘦身（DEFLATE 重压缩） =====

export interface PptCompressResult {
  originalSize: number;
  compressedSize: number;
  fileName: string;
  blob: Blob;
}

export async function compressPptx(file: File): Promise<PptCompressResult> {
  const zip = await assertPptxFile(file);
  const output = new JSZip();
  output.file('[Content_Types].xml', zip.file('[Content_Types].xml')!.async('string'), { compression: 'DEFLATE', compressionOptions: { level: 9 } });
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && entry.name !== '[Content_Types].xml');
  for (const entry of entries) {
    const bytes = await entry.async('uint8array');
    output.file(entry.name, bytes, { compression: 'DEFLATE', compressionOptions: { level: 9 } });
  }
  const blob = await output.generateAsync({ type: 'blob' });
  const baseName = file.name.replace(/\.pptx$/i, '');
  return {
    originalSize: file.size,
    compressedSize: blob.size,
    fileName: `${baseName}_compressed.pptx`,
    blob,
  };
}
