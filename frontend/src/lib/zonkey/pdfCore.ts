/**
 * PDF 工坊核心 — 文档结构 / 合并 / 拆分 / 旋转（纯 pdf-lib）。
 * 压缩以 pdf-lib 对象流重写等效实现；转图/增强用 PDF.js + Canvas；
 * 加密/解密用 cryptpdf（AES-256 Rev 5，纯前端 Web Crypto）。
 */
import { PDFDocument, PDFName, StandardFonts, degrees, rgb } from 'pdf-lib';
import { decryptPDF, encryptPDF } from 'cryptpdf';
import {
  canvasToBytes,
  enhanceCanvasPixels,
  loadPdfDocument,
  renderPdfPageToCanvas,
} from './pdfRender';

export const PDF_CORE_LIMITS = Object.freeze({
  maxFiles: 25,
  maxTotalBytes: 150 * 1024 * 1024,
  maxPreviewPages: 200,
});

// ===== AcroForm 展平（页面复制无法安全携带源表单树） =====

function widgetAnnotationKeys(document: PDFDocument): Set<string> {
  const keys = new Set<string>();
  for (const page of document.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;
    for (let index = 0; index < annotations.size(); index++) {
      const reference = annotations.get(index);
      const annotation = document.context.lookup(reference) as { get?: (name: PDFName) => unknown } | undefined;
      if (String(annotation?.get?.(PDFName.of('Subtype'))) === '/Widget') {
        keys.add(String(reference));
      }
    }
  }
  return keys;
}

function removeWidgetAnnotations(document: PDFDocument, knownWidgetKeys: Set<string>): boolean {
  let removed = false;
  for (const page of document.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;
    for (let index = annotations.size() - 1; index >= 0; index--) {
      const annotation = document.context.lookup(annotations.get(index)) as { get?: (name: PDFName) => unknown } | undefined;
      const subtype = annotation?.get?.(PDFName.of('Subtype'));
      const referenceKey = String(annotations.get(index));
      if (annotation && String(subtype) !== '/Widget' && !knownWidgetKeys.has(referenceKey)) continue;
      annotations.remove(index);
      removed = true;
    }
    if (annotations.size() === 0) page.node.delete(PDFName.of('Annots'));
  }
  return removed;
}

export function flattenPdfFormForPageCopy(document: PDFDocument): boolean {
  const form = document.getForm();
  const hasFields = form.getFields().length > 0;
  if (hasFields) {
    form.flatten({ updateFieldAppearances: false });
  }
  return removeWidgetAnnotations(document, widgetAnnotationKeys(document)) || hasFields;
}

// ===== 文件名工具 =====

function pdfBaseName(sourceName: string): string {
  return (
    String(sourceName || 'document.pdf')
      .split(/[\\/]/)
      .pop()!
      .replace(/\.pdf$/i, '')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim() || 'document'
  );
}

export function createPdfSplitFileName(sourceName: string, pageIndex: number): string {
  if (!Number.isInteger(pageIndex) || pageIndex < 1) throw new Error('Invalid PDF page index');
  return `${pdfBaseName(sourceName)}_page_${pageIndex}.pdf`;
}

export function createPdfRotateFileName(sourceName: string, pageIndex?: number): string {
  if (pageIndex !== undefined && (!Number.isInteger(pageIndex) || pageIndex < 1)) throw new Error('Invalid PDF page index');
  return pageIndex === undefined ? `${pdfBaseName(sourceName)}_rotated.pdf` : `${pdfBaseName(sourceName)}_page_${pageIndex}_rotated.pdf`;
}

export function createPdfMergedFileName(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `merged_${stamp}.pdf`;
}

// ===== 断言 =====

export function assertPdfFileCount(files: unknown[], count: number, totalBytes: number): void {
  if (files.length < count) throw new Error(`At least ${count} PDF file(s) are required`);
  if (files.length > PDF_CORE_LIMITS.maxFiles) throw new Error(`Too many PDF files (max ${PDF_CORE_LIMITS.maxFiles})`);
  if (!Number.isSafeInteger(totalBytes) || totalBytes < 0) throw new Error('Invalid PDF file size');
  if (totalBytes > PDF_CORE_LIMITS.maxTotalBytes) {
    throw new Error(`PDF inputs exceed the ${Math.floor(PDF_CORE_LIMITS.maxTotalBytes / 1024 / 1024)}MB limit`);
  }
}

// ===== 合并 =====

export interface PdfSourceDocument {
  fileName: string;
  fileData: Uint8Array;
}

export interface PdfMergePageEntry {
  fileIndex: number;
  pageIndex: number;
  rotation?: number;
}

export async function mergePdfPages({ documents, pages }: { documents: PdfSourceDocument[]; pages: PdfMergePageEntry[] }): Promise<Uint8Array> {
  if (!Array.isArray(documents) || !Array.isArray(pages) || pages.length === 0) {
    throw new Error('No PDF pages are available to merge');
  }
  const mergedPdf = await PDFDocument.create();
  const sourceCache = new Map<number, PDFDocument>();

  for (const pageData of pages) {
    const { fileIndex, pageIndex, rotation = 0 } = pageData;
    const documentInfo = documents[fileIndex];
    if (!documentInfo?.fileData?.length) throw new Error(`Missing PDF data for file index ${fileIndex}`);
    if (!Number.isInteger(pageIndex) || pageIndex < 1) throw new Error(`Invalid page index for file index ${fileIndex}`);
    if (!Number.isFinite(rotation) || rotation % 90 !== 0) throw new Error('Invalid page rotation for file index ' + fileIndex);

    let sourcePdf = sourceCache.get(fileIndex);
    if (!sourcePdf) {
      sourcePdf = await PDFDocument.load(documentInfo.fileData.slice());
      flattenPdfFormForPageCopy(sourcePdf);
      sourceCache.set(fileIndex, sourcePdf);
    }
    if (pageIndex > sourcePdf.getPageCount()) throw new Error(`Page ${pageIndex} is outside file index ${fileIndex}`);

    const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageIndex - 1]);
    copiedPage.setRotation(degrees(copiedPage.getRotation().angle + rotation));
    mergedPdf.addPage(copiedPage);
  }

  return mergedPdf.save();
}

/** 顺序合并整份文件（默认全页合并的便捷封装） */
export async function mergePdfFiles(documents: PdfSourceDocument[]): Promise<Uint8Array> {
  assertPdfFileCount(documents, 2, documents.reduce((sum, d) => sum + d.fileData.length, 0));
  const pages: PdfMergePageEntry[] = [];
  const counts = await Promise.all(
    documents.map(async (doc) => (await PDFDocument.load(doc.fileData.slice())).getPageCount()),
  );
  documents.forEach((_, fileIndex) => {
    for (let pageIndex = 1; pageIndex <= counts[fileIndex]; pageIndex += 1) {
      pages.push({ fileIndex, pageIndex });
    }
  });
  return mergePdfPages({ documents, pages });
}

// ===== 拆分 =====

export interface PdfSplitOutput {
  fileIndex: number;
  pageIndex: number;
  fileName: string;
  bytes: Uint8Array;
}

export async function splitPdfPages({
  documents,
  pages,
  onProgress,
}: {
  documents: PdfSourceDocument[];
  pages: PdfMergePageEntry[];
  onProgress?: (info: { completed: number; total: number }) => void;
}): Promise<PdfSplitOutput[]> {
  if (!Array.isArray(documents) || !Array.isArray(pages) || pages.length === 0) {
    throw new Error('No PDF pages are selected for export');
  }
  const sourceCache = new Map<number, PDFDocument>();
  const outputs: PdfSplitOutput[] = [];

  for (let outputIndex = 0; outputIndex < pages.length; outputIndex++) {
    const pageData = pages[outputIndex];
    const { fileIndex, pageIndex } = pageData || {};
    const documentInfo = documents[fileIndex];
    if (!documentInfo?.fileData?.length) throw new Error(`Missing PDF data for file index ${fileIndex}`);
    if (!Number.isInteger(pageIndex) || pageIndex < 1) throw new Error(`Invalid page index for file index ${fileIndex}`);

    let sourcePdf = sourceCache.get(fileIndex);
    if (!sourcePdf) {
      sourcePdf = await PDFDocument.load(documentInfo.fileData.slice());
      flattenPdfFormForPageCopy(sourcePdf);
      sourceCache.set(fileIndex, sourcePdf);
    }
    if (pageIndex > sourcePdf.getPageCount()) throw new Error(`Page ${pageIndex} is outside file index ${fileIndex}`);

    const outputPdf = await PDFDocument.create();
    const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageIndex - 1]);
    outputPdf.addPage(copiedPage);
    const output: PdfSplitOutput = {
      fileIndex,
      pageIndex,
      fileName: createPdfSplitFileName(documentInfo.fileName, pageIndex),
      bytes: await outputPdf.save(),
    };
    outputs.push(output);
    await onProgress?.({ completed: outputIndex + 1, total: pages.length });
  }

  return outputs;
}

// ===== 旋转 =====

export function normalizePdfRotation(rotation: number): number {
  if (!Number.isFinite(rotation) || rotation % 90 !== 0) throw new Error('PDF rotation must be a multiple of 90 degrees');
  return ((rotation % 360) + 360) % 360;
}

export async function rotatePdfPages({
  fileData,
  pages,
  onProgress,
}: {
  fileData: Uint8Array;
  pages: { pageIndex: number; rotation: number }[];
  onProgress?: (info: { completed: number; total: number }) => void;
}): Promise<Uint8Array> {
  if (!Array.isArray(pages) || pages.length === 0) throw new Error('No PDF pages are available to rotate');
  if (!fileData?.length) throw new Error('Invalid PDF file data');

  const sourcePdf = await PDFDocument.load(fileData.slice());
  const sourcePageCount = sourcePdf.getPageCount();
  if (sourcePageCount < 1) throw new Error('PDF has no pages to rotate');

  const normalizedPages = pages.map((entry) => {
    const { pageIndex, rotation = 0 } = entry || {};
    if (!Number.isInteger(pageIndex) || pageIndex < 1 || pageIndex > sourcePageCount) {
      throw new Error(`Page ${pageIndex} is outside the source PDF`);
    }
    return { pageIndex, rotation: normalizePdfRotation(rotation) };
  });

  const updatesWholeDocument =
    normalizedPages.length === sourcePageCount && normalizedPages.every((entry, index) => entry.pageIndex === index + 1);

  if (updatesWholeDocument) {
    for (let index = 0; index < normalizedPages.length; index++) {
      const entry = normalizedPages[index];
      const page = sourcePdf.getPage(index);
      page.setRotation(degrees((page.getRotation().angle + entry.rotation) % 360));
      await onProgress?.({ completed: index + 1, total: normalizedPages.length });
    }
    return sourcePdf.save();
  }

  flattenPdfFormForPageCopy(sourcePdf);
  const outputPdf = await PDFDocument.create();

  for (let outputIndex = 0; outputIndex < normalizedPages.length; outputIndex++) {
    const { pageIndex, rotation } = normalizedPages[outputIndex];
    const [copiedPage] = await outputPdf.copyPages(sourcePdf, [pageIndex - 1]);
    copiedPage.setRotation(degrees((copiedPage.getRotation().angle + rotation) % 360));
    outputPdf.addPage(copiedPage);
    await onProgress?.({ completed: outputIndex + 1, total: normalizedPages.length });
  }

  return outputPdf.save();
}

// ===== 压缩（pdf-lib 对象流重写） =====

export type PdfCompressLevel = 'low' | 'medium' | 'high';

export async function compressPdfFile(fileData: Uint8Array, level: PdfCompressLevel = 'medium'): Promise<Uint8Array> {
  if (!fileData?.length) throw new Error('Invalid PDF file data');
  const document = await PDFDocument.load(fileData.slice(), { updateMetadata: false });
  if (level !== 'low') {
    // medium/high 额外剥离 XMP 元数据流，进一步缩小体积
    try {
      const metadataRef = document.catalog.get(PDFName.of('Metadata'));
      if (metadataRef) document.context.delete(metadataRef as never);
      document.catalog.delete(PDFName.of('Metadata'));
    } catch {
      // 元数据缺失时忽略
    }
  }
  return document.save({ useObjectStreams: true, addDefaultPage: false });
}

// ===== 转图片（PDF.js + Canvas） =====

export type PdfImageFormat = 'png' | 'jpeg';

export interface PdfImageOutput {
  pageIndex: number;
  fileName: string;
  bytes: Uint8Array;
  mime: string;
}

export async function pdfToImages({
  fileData,
  sourceName,
  format = 'png',
  scale = 2,
  onProgress,
}: {
  fileData: Uint8Array;
  sourceName: string;
  format?: PdfImageFormat;
  scale?: number;
  onProgress?: (info: { completed: number; total: number }) => void;
}): Promise<PdfImageOutput[]> {
  if (!fileData?.length) throw new Error('Invalid PDF file data');
  const document = await loadPdfDocument(fileData);
  const pageCount = document.numPages;
  if (pageCount < 1) throw new Error('PDF has no pages to export');
  if (pageCount > PDF_CORE_LIMITS.maxPreviewPages) {
    throw new Error(`Too many pages (max ${PDF_CORE_LIMITS.maxPreviewPages})`);
  }

  const baseName = pdfBaseName(sourceName);
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const outputs: PdfImageOutput[] = [];

  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
    const { canvas } = await renderPdfPageToCanvas(document, pageIndex, scale);
    const bytes = await canvasToBytes(canvas, mime, format === 'jpeg' ? 0.92 : undefined);
    outputs.push({
      pageIndex,
      fileName: `${baseName}_page_${pageIndex}.${ext}`,
      bytes,
      mime,
    });
    await onProgress?.({ completed: pageIndex, total: pageCount });
  }

  return outputs;
}

// ===== 加密 / 解密（cryptpdf AES-256） =====

export async function encryptPdfFile(fileData: Uint8Array, userPassword: string, ownerPassword?: string): Promise<Uint8Array> {
  if (!fileData?.length) throw new Error('Invalid PDF file data');
  const password = String(userPassword || '').trim();
  if (!password) throw new Error('Password is required');
  return encryptPDF(fileData.slice(), password, ownerPassword?.trim() || password);
}

export async function decryptPdfFile(fileData: Uint8Array, password: string): Promise<Uint8Array> {
  if (!fileData?.length) throw new Error('Invalid PDF file data');
  const value = String(password || '').trim();
  if (!value) throw new Error('Password is required');
  try {
    return await decryptPDF(fileData.slice(), value);
  } catch {
    throw new Error('Incorrect password or unsupported encryption');
  }
}

// ===== 扫描件增强 =====

export type PdfEnhanceMode = 'contrast' | 'grayscale' | 'binarize';

export async function enhancePdfScan({
  fileData,
  mode = 'contrast',
  strength = 1.4,
  scale = 2,
  onProgress,
}: {
  fileData: Uint8Array;
  mode?: PdfEnhanceMode;
  strength?: number;
  scale?: number;
  onProgress?: (info: { completed: number; total: number }) => void;
}): Promise<Uint8Array> {
  if (!fileData?.length) throw new Error('Invalid PDF file data');
  const document = await loadPdfDocument(fileData);
  const pageCount = document.numPages;
  if (pageCount < 1) throw new Error('PDF has no pages to enhance');

  const outputPdf = await PDFDocument.create();

  for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
    const { canvas, width, height } = await renderPdfPageToCanvas(document, pageIndex, scale);
    enhanceCanvasPixels(canvas, mode, strength);
    const jpegBytes = await canvasToBytes(canvas, 'image/jpeg', 0.88);
    const image = await outputPdf.embedJpg(jpegBytes);
    const page = outputPdf.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
    await onProgress?.({ completed: pageIndex, total: pageCount });
  }

  return outputPdf.save({ useObjectStreams: true });
}

// ===== 页面编辑器（重排 / 删除 / 旋转） =====

export interface PdfEditorPageEntry {
  sourcePageIndex: number;
  rotation?: number;
}

export async function rebuildPdfFromPages({
  fileData,
  pages,
  onProgress,
}: {
  fileData: Uint8Array;
  pages: PdfEditorPageEntry[];
  onProgress?: (info: { completed: number; total: number }) => void;
}): Promise<Uint8Array> {
  if (!fileData?.length) throw new Error('Invalid PDF file data');
  if (!Array.isArray(pages) || pages.length === 0) throw new Error('At least one page is required');

  const sourcePdf = await PDFDocument.load(fileData.slice());
  flattenPdfFormForPageCopy(sourcePdf);
  const sourcePageCount = sourcePdf.getPageCount();
  const outputPdf = await PDFDocument.create();

  for (let outputIndex = 0; outputIndex < pages.length; outputIndex += 1) {
    const { sourcePageIndex, rotation = 0 } = pages[outputIndex];
    if (!Number.isInteger(sourcePageIndex) || sourcePageIndex < 1 || sourcePageIndex > sourcePageCount) {
      throw new Error(`Page ${sourcePageIndex} is outside the source PDF`);
    }
    const normalizedRotation = normalizePdfRotation(rotation);
    const [copiedPage] = await outputPdf.copyPages(sourcePdf, [sourcePageIndex - 1]);
    copiedPage.setRotation(degrees((copiedPage.getRotation().angle + normalizedRotation) % 360));
    outputPdf.addPage(copiedPage);
    await onProgress?.({ completed: outputIndex + 1, total: pages.length });
  }

  return outputPdf.save();
}

export function createPdfEnhancedFileName(sourceName: string): string {
  return `${pdfBaseName(sourceName)}_enhanced.pdf`;
}

export function createPdfEditedFileName(sourceName: string): string {
  return `${pdfBaseName(sourceName)}_edited.pdf`;
}

// ===== 水印（canvas 统一渲染 → PNG 盖章：原生支持中日文与图片，无需字体嵌入） =====

export type PdfWatermarkType = 'text' | 'image';

export interface PdfWatermarkParams {
  fileData: Uint8Array;
  type: PdfWatermarkType;
  text?: string;
  imageFile?: File;
  fontSize?: number;
  color?: string;
  imageScalePercent?: number;
  opacity?: number;
  rotation?: number;
  tile?: boolean;
  onProgress?: (info: { completed: number; total: number }) => void;
}

function clampUnit(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** 在离屏 canvas 上渲染带旋转的水印章（文字或图片），返回印章 canvas */
async function buildWatermarkStampCanvas(params: PdfWatermarkParams): Promise<HTMLCanvasElement> {
  const rotationDeg = ((params.rotation ?? 45) % 360 + 360) % 360;
  const rad = (rotationDeg * Math.PI) / 180;
  const canvas = document.createElement('canvas');

  if (params.type === 'text') {
    const text = String(params.text || '').trim();
    if (!text) throw new Error('Watermark text is required');
    const fontSize = Math.round(clampUnit(params.fontSize ?? 48, 8, 200, 48));
    const font = `bold ${fontSize}px sans-serif`;
    const measure = canvas.getContext('2d');
    if (!measure) throw new Error('Canvas is unavailable');
    measure.font = font;
    const pad = Math.ceil(fontSize * 0.4);
    canvas.width = Math.ceil(measure.measureText(text).width) + pad * 2;
    canvas.height = Math.ceil(fontSize * 1.2) + pad * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable');
    ctx.font = font;
    ctx.fillStyle = /^#[0-9a-fA-F]{6}$/.test(params.color || '') ? params.color! : '#808080';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.fillText(text, 0, 0);
    return canvas;
  }

  if (!params.imageFile) throw new Error('Watermark image is required');
  const bitmap = await createImageBitmap(params.imageFile);
  try {
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const boxW = bitmap.width * cos + bitmap.height * sin;
    const boxH = bitmap.width * sin + bitmap.height * cos;
    const shrink = Math.min(1, 2000 / Math.max(boxW, boxH));
    canvas.width = Math.max(1, Math.ceil(boxW * shrink));
    canvas.height = Math.max(1, Math.ceil(boxH * shrink));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.scale(shrink, shrink);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    return canvas;
  } finally {
    bitmap.close();
  }
}

export async function addPdfWatermark(params: PdfWatermarkParams): Promise<Uint8Array> {
  if (!params.fileData?.length) throw new Error('Invalid PDF file data');
  const document = await PDFDocument.load(params.fileData.slice());
  const pages = document.getPages();
  if (pages.length === 0) throw new Error('PDF has no pages to watermark');

  const stampCanvas = await buildWatermarkStampCanvas(params);
  const stampBytes = await canvasToBytes(stampCanvas, 'image/png');
  const stamp = await document.embedPng(stampBytes);
  const opacity = clampUnit(params.opacity ?? 0.3, 0.05, 1, 0.3);

  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    const { width, height } = page.getSize();
    const widthRatio =
      params.type === 'image'
        ? clampUnit(params.imageScalePercent ?? 30, 5, 100, 30) / 100
        : params.tile
          ? 0.34
          : 0.55;
    const drawW = width * widthRatio;
    const drawH = drawW * (stampCanvas.height / stampCanvas.width);

    if (params.tile) {
      const stepX = drawW * 1.6;
      const stepY = drawH * 1.6;
      for (let y = -stepY / 2; y < height; y += stepY) {
        for (let x = -stepX / 2; x < width; x += stepX) {
          page.drawImage(stamp, { x, y, width: drawW, height: drawH, opacity });
        }
      }
    } else {
      page.drawImage(stamp, { x: (width - drawW) / 2, y: (height - drawH) / 2, width: drawW, height: drawH, opacity });
    }
    await params.onProgress?.({ completed: index + 1, total: pages.length });
  }

  return document.save({ useObjectStreams: true });
}

export function createPdfWatermarkedFileName(sourceName: string): string {
  return `${pdfBaseName(sourceName)}_watermarked.pdf`;
}

// ===== 图片合成 PDF（canvas 归一化 → embedJpg/embedPng，兼容 EXIF 与 WebP） =====

export const IMAGES_PDF_LIMITS = Object.freeze({
  maxFiles: 100,
  maxTotalBytes: 300 * 1024 * 1024,
});

export type PdfImagesPageSize = 'fit' | 'a4';

export interface PdfImagesToPdfParams {
  files: File[];
  pageSize?: PdfImagesPageSize;
  marginPt?: number;
  onProgress?: (info: { completed: number; total: number }) => void;
}

async function normalizeImageForEmbed(file: File): Promise<{ bytes: Uint8Array; width: number; height: number; isPng: boolean }> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxSide = 4096;
    const shrink = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * shrink));
    const height = Math.max(1, Math.round(bitmap.height * shrink));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const isPng = file.type === 'image/png';
    const bytes = await canvasToBytes(canvas, isPng ? 'image/png' : 'image/jpeg', 0.92);
    return { bytes, width, height, isPng };
  } finally {
    bitmap.close();
  }
}

export async function imagesToPdf({ files, pageSize = 'fit', marginPt = 24, onProgress }: PdfImagesToPdfParams): Promise<Uint8Array> {
  const inputs = Array.isArray(files) ? files.filter(Boolean) : [];
  if (inputs.length === 0) throw new Error('At least one image is required');
  if (inputs.length > IMAGES_PDF_LIMITS.maxFiles) throw new Error(`Too many images (max ${IMAGES_PDF_LIMITS.maxFiles})`);
  const totalBytes = inputs.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > IMAGES_PDF_LIMITS.maxTotalBytes) {
    throw new Error(`Images exceed the ${Math.floor(IMAGES_PDF_LIMITS.maxTotalBytes / 1024 / 1024)}MB limit`);
  }

  const outputPdf = await PDFDocument.create();
  const margin = clampUnit(marginPt, 0, 120, 24);
  const a4Width = 595.28;
  const a4Height = 841.89;

  for (let index = 0; index < inputs.length; index++) {
    const { bytes, width, height, isPng } = await normalizeImageForEmbed(inputs[index]);
    const image = isPng ? await outputPdf.embedPng(bytes) : await outputPdf.embedJpg(bytes);

    if (pageSize === 'fit') {
      const page = outputPdf.addPage([width + margin * 2, height + margin * 2]);
      page.drawImage(image, { x: margin, y: margin, width, height });
    } else {
      const boxW = a4Width - margin * 2;
      const boxH = a4Height - margin * 2;
      const scale = Math.min(boxW / width, boxH / height);
      const drawW = width * scale;
      const drawH = height * scale;
      const page = outputPdf.addPage([a4Width, a4Height]);
      page.drawImage(image, { x: (a4Width - drawW) / 2, y: (a4Height - drawH) / 2, width: drawW, height: drawH });
    }
    await onProgress?.({ completed: index + 1, total: inputs.length });
  }

  return outputPdf.save({ useObjectStreams: true });
}

export function createImagesPdfFileName(sourceCount: number, firstName?: string): string {
  if (sourceCount === 1 && firstName) return `${pdfBaseName(firstName).replace(/\.(png|jpe?g|webp|gif|bmp)$/i, '')}_pdf.pdf`;
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `images_to_pdf_${stamp}.pdf`;
}

// ===== 页码范围解析（拆分 / 提取共用） =====

export interface PdfPageRange {
  start: number;
  end: number;
  label: string;
}

/** 解析 `1-3,5,8-` 形式的页码范围；越界或格式错误抛出 Error */
export function parsePdfPageRanges(input: string, totalPages: number): PdfPageRange[] {
  const tokens = String(input || '').split(/[,，;；\s]+/).filter(Boolean);
  if (tokens.length === 0) throw new Error('Page range is empty');
  const ranges: PdfPageRange[] = [];
  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)?\s*[-–]\s*(\d+)?$/);
    if (rangeMatch) {
      const start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 1;
      const end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : totalPages;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > totalPages || start > end) {
        throw new Error('Invalid page range');
      }
      ranges.push({ start, end, label: `${start}-${end}` });
    } else if (/^\d+$/.test(token)) {
      const page = parseInt(token, 10);
      if (page < 1 || page > totalPages) throw new Error('Invalid page range');
      ranges.push({ start: page, end: page, label: `${page}` });
    } else {
      throw new Error('Invalid page range');
    }
  }
  return ranges;
}

// ===== 范围拆分 / 页面提取 =====

export interface PdfRangePartOutput {
  fileName: string;
  bytes: Uint8Array;
  label: string;
}

export async function splitPdfByRanges({
  fileData,
  sourceName,
  ranges,
  onProgress,
}: {
  fileData: Uint8Array;
  sourceName: string;
  ranges: PdfPageRange[];
  onProgress?: (info: { completed: number; total: number }) => void;
}): Promise<PdfRangePartOutput[]> {
  if (!fileData?.length) throw new Error('Invalid PDF file data');
  if (!Array.isArray(ranges) || ranges.length === 0) throw new Error('Page range is empty');
  const sourcePdf = await PDFDocument.load(fileData.slice());
  flattenPdfFormForPageCopy(sourcePdf);
  const base = pdfBaseName(sourceName);
  const outputs: PdfRangePartOutput[] = [];

  for (let index = 0; index < ranges.length; index++) {
    const { start, end, label } = ranges[index];
    const indices: number[] = [];
    for (let page = start; page <= end; page++) indices.push(page - 1);
    const outputPdf = await PDFDocument.create();
    const copied = await outputPdf.copyPages(sourcePdf, indices);
    copied.forEach((page) => outputPdf.addPage(page));
    outputs.push({
      fileName: `${base}_part_${index + 1}_p${label}.pdf`,
      bytes: await outputPdf.save({ useObjectStreams: true }),
      label,
    });
    await onProgress?.({ completed: index + 1, total: ranges.length });
  }

  return outputs;
}

/** 按页码范围提取页面 → 单个新 PDF（范围去重升序合并） */
export async function extractPdfPages({
  fileData,
  sourceName,
  ranges,
  onProgress,
}: {
  fileData: Uint8Array;
  sourceName: string;
  ranges: PdfPageRange[];
  onProgress?: (info: { completed: number; total: number }) => void;
}): Promise<Uint8Array> {
  if (!fileData?.length) throw new Error('Invalid PDF file data');
  if (!Array.isArray(ranges) || ranges.length === 0) throw new Error('Page range is empty');
  const sourcePdf = await PDFDocument.load(fileData.slice());
  flattenPdfFormForPageCopy(sourcePdf);

  const seen = new Set<number>();
  const indices: number[] = [];
  for (const { start, end } of ranges) {
    for (let page = start; page <= end; page++) {
      if (!seen.has(page)) {
        seen.add(page);
        indices.push(page - 1);
      }
    }
  }
  indices.sort((a, b) => a - b);

  const outputPdf = await PDFDocument.create();
  const copied = await outputPdf.copyPages(sourcePdf, indices);
  copied.forEach((page) => outputPdf.addPage(page));
  await onProgress?.({ completed: indices.length, total: indices.length });
  return outputPdf.save({ useObjectStreams: true });
}

export function createPdfExtractedFileName(sourceName: string): string {
  return `${pdfBaseName(sourceName)}_extracted.pdf`;
}

// ===== 页码 =====

export type PdfPageNumberPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
export type PdfPageNumberFormat = 'plain' | 'slash' | 'page';

export async function addPageNumbers({
  fileData,
  position = 'bottom-center',
  format = 'plain',
  fontSize = 12,
  startAt = 1,
  onProgress,
}: {
  fileData: Uint8Array;
  position?: PdfPageNumberPosition;
  format?: PdfPageNumberFormat;
  fontSize?: number;
  startAt?: number;
  onProgress?: (info: { completed: number; total: number }) => void;
}): Promise<Uint8Array> {
  if (!fileData?.length) throw new Error('Invalid PDF file data');
  const document = await PDFDocument.load(fileData.slice());
  const pages = document.getPages();
  if (pages.length === 0) throw new Error('PDF has no pages');
  const font = await document.embedFont(StandardFonts.Helvetica);
  const size = Math.round(clampUnit(fontSize, 6, 48, 12));
  const fromPage = Math.round(clampUnit(startAt, 1, pages.length, 1));
  const margin = 24;

  for (let index = 0; index < pages.length; index++) {
    if (index + 1 < fromPage) continue;
    const pageNumber = index + 1;
    const label =
      format === 'slash' ? `${pageNumber} / ${pages.length}` : format === 'page' ? `Page ${pageNumber}` : `${pageNumber}`;
    const { width, height } = pages[index].getSize();
    const textWidth = font.widthOfTextAtSize(label, size);
    const alignRight = position.endsWith('right');
    const alignCenter = position.endsWith('center');
    const x = alignRight ? width - margin - textWidth : alignCenter ? (width - textWidth) / 2 : margin;
    const y = position.startsWith('top') ? height - margin - size : margin;
    pages[index].drawText(label, { x, y, size, font, color: rgb(0.25, 0.25, 0.25) });
    await onProgress?.({ completed: index + 1, total: pages.length });
  }

  return document.save({ useObjectStreams: true });
}

export function createPdfNumberedFileName(sourceName: string): string {
  return `${pdfBaseName(sourceName)}_numbered.pdf`;
}

// ===== 裁剪（按四边百分比收缩 CropBox） =====

export async function cropPdfPages({
  fileData,
  marginPercent = 5,
  onProgress,
}: {
  fileData: Uint8Array;
  marginPercent?: number;
  onProgress?: (info: { completed: number; total: number }) => void;
}): Promise<Uint8Array> {
  if (!fileData?.length) throw new Error('Invalid PDF file data');
  const margin = clampUnit(marginPercent, 0, 40, 5) / 100;
  const document = await PDFDocument.load(fileData.slice());
  const pages = document.getPages();
  if (pages.length === 0) throw new Error('PDF has no pages');

  for (let index = 0; index < pages.length; index++) {
    const mediaBox = pages[index].getMediaBox();
    const insetX = mediaBox.width * margin;
    const insetY = mediaBox.height * margin;
    pages[index].setCropBox(mediaBox.x + insetX, mediaBox.y + insetY, mediaBox.width - insetX * 2, mediaBox.height - insetY * 2);
    await onProgress?.({ completed: index + 1, total: pages.length });
  }

  return document.save({ useObjectStreams: true });
}

export function createPdfCroppedFileName(sourceName: string): string {
  return `${pdfBaseName(sourceName)}_cropped.pdf`;
}

export async function encryptPdfFileAdvanced(
  file: File,
  userPw: string,
  ownerPw: string,
  perms: { print: boolean; copy: boolean; modify: boolean; fill: boolean }
): Promise<Uint8Array> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('user_pw', userPw);
  formData.append('owner_pw', ownerPw);
  formData.append('allow_print', perms.print ? 'true' : 'false');
  formData.append('allow_copy', perms.copy ? 'true' : 'false');
  formData.append('allow_modify', perms.modify ? 'true' : 'false');
  formData.append('allow_fill', perms.fill ? 'true' : 'false');

  const res = await fetch('/api/convert/protect-advanced', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return new Uint8Array(await res.arrayBuffer());
}
