/**
 * PDF.js 渲染辅助 — 供转图片与扫描增强使用（纯前端，离线）。
 *
 * 用 pdfjs-dist v4 的 legacy 构建：自带 core-js polyfill，兼容微信 X5、
 * 旧 Android WebView 等老内核（v5+/v6+ 主构建要求 Chrome 110/119+，老手机直接报错）。
 */
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

let workerReady = false;

function ensurePdfWorker(): void {
  if (workerReady) return;
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href;
  workerReady = true;
}

/** 老内核上最常见的失败是引擎级 API 缺失，翻译成用户能懂的话 */
function friendlyPdfError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  if (/withResolvers|structuredClone|is not a function|module|import/i.test(raw)) {
    return new Error('当前浏览器内核过旧，无法在网页内渲染 PDF。请更新系统浏览器（Chrome/Safari）后重试，或改用桌面端。');
  }
  return err instanceof Error ? err : new Error(raw);
}

export async function loadPdfDocument(fileData: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  ensurePdfWorker();
  const loadingTask = getDocument({
    data: fileData.slice(),
    password: password || undefined,
    useSystemFonts: true,
  });
  try {
    return await loadingTask.promise;
  } catch (err) {
    throw friendlyPdfError(err);
  }
}

export async function renderPdfPageToCanvas(
  pdfDocument: PDFDocumentProxy,
  pageIndex: number,
  scale: number,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const page = await pdfDocument.getPage(pageIndex);
  const viewport = page.getViewport({ scale });
  const canvas = globalThis.document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  try {
    await page.render({ canvasContext: context, viewport }).promise;
  } catch (err) {
    throw friendlyPdfError(err);
  }
  return { canvas, width: canvas.width, height: canvas.height };
}

export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode canvas'))), mime, quality);
  });
}

export async function canvasToBytes(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Uint8Array> {
  const blob = await canvasToBlob(canvas, mime, quality);
  return new Uint8Array(await blob.arrayBuffer());
}

/** 扫描件增强：对比度 / 灰度 / 二值化 */
export function enhanceCanvasPixels(
  canvas: HTMLCanvasElement,
  mode: 'contrast' | 'grayscale' | 'binarize',
  strength: number,
): void {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const factor = Math.max(0.5, Math.min(2.5, strength));
  const threshold = Math.round(Math.max(64, Math.min(220, 128 + (factor - 1) * 80)));

  for (let index = 0; index < data.length; index += 4) {
    let r = data[index];
    let g = data[index + 1];
    let b = data[index + 2];

    if (mode === 'grayscale' || mode === 'binarize') {
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      r = g = b = gray;
    }

    if (mode === 'contrast') {
      r = clampByte((r - 128) * factor + 128);
      g = clampByte((g - 128) * factor + 128);
      b = clampByte((b - 128) * factor + 128);
    }

    if (mode === 'binarize') {
      const value = r >= threshold ? 255 : 0;
      r = g = b = value;
    }

    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
  }

  context.putImageData(imageData, 0, 0);
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
