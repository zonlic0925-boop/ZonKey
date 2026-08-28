/**
 * PDF 工坊核心 — 移植自 ToolKnit pdf-document-structure.js /
 * pdf-merge-core.js / pdf-split-core.js / pdf-rotate-core.js（纯 pdf-lib）。
 * 压缩在 ToolKnit 中由 Tauri 后端完成，此处以 pdf-lib 对象流重写等效实现。
 * 加密/解密、转图、扫描增强、页面编辑器需要额外依赖，见阶段 4 第二批。
 */
import { PDFDocument, PDFName, degrees } from 'pdf-lib';

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

// ===== 压缩（pdf-lib 对象流重写；等效 ToolKnit 后端压缩的轻量路径） =====

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
