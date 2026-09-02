/**
 * 浏览器转换引擎 — 后端离线（公网 Pages / 手机直连）时的纯前端兜底层。
 *
 * 对齐桌面后端 backend_convert_tools 的语义，但运行在浏览器内、文件零上传：
 * - pdf-to-word   ：PDF.js 文本行抽取（字号/粗体/坐标）→ docx 重建（标题分级/段落/分页；表格线性化，如实标注）
 * - pdf-to-excel  ：文本行按 y 聚类 + x 间隙分列 → xlsx（每页一个 sheet；无框线检测，简化口径）
 * - pdf-to-ppt    ：PDF.js 逐页渲染整页贴图 → pptx（视觉版式还原，与后端同思路）
 * - word-to-pdf  ：mammoth(docx→HTML) → foreignObject 栅格化 → pdf-lib 回写
 * - excel-to-pdf ：SheetJS(xlsx→HTML) → foreignObject 栅格化 → pdf-lib 回写
 * - html-to-pdf   ：Markdown/HTML 子集 → 同一栅格化管线
 * - compress-deep ：逐页栅格化 + JPEG 重编码 → pdf-lib 重建（无文本层，与后端同语义）
 * - pdf-repair    ：pdf-lib 容错解析重建（尽力而为，严重损坏仍报错）
 * - ocr-export    ：浏览器端不可行（OCR 模型过大），引导桌面版
 *
 * 许可证：docx MIT / xlsx Apache-2.0 / pptxgenjs MIT / mammoth BSD-2-Clause / pdf-lib MIT —— 零 AGPL。
 * 重量级依赖全部动态 import()（Vite 代码分割），不进主包。
 */
import { canvasToBytes, loadPdfDocument, renderPdfPageToCanvas } from './pdfRender';

export const WEB_SUPPORTED_OPS: ReadonlySet<string> = new Set([
  'pdf-to-word',
  'pdf-to-excel',
  'pdf-to-ppt',
  'word-to-pdf',
  'excel-to-pdf',
  'html-to-pdf',
  'compress-deep',
  'pdf-repair',
]);

export interface WebConvertOptions {
  dpi?: number;
  quality?: number;
  imageFormat?: 'png' | 'jpeg';
  content?: string;
  title?: string;
}

export interface WebConvertResult {
  blob: Blob;
  filename: string;
  engine: string;
}

function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '') || 'document';
}

function extOf(name: string): string {
  const m = /\.([^.]+)$/.exec(name);
  return m ? m[1].toLowerCase() : '';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/* PDF.js 文本行抽取（字号/粗体/坐标，显示空间自上而下）               */
/* ------------------------------------------------------------------ */

interface TextFragment {
  str: string;
  x: number;
  xEnd: number;
  size: number;
  bold: boolean;
}

interface TextLine {
  y: number;
  frags: TextFragment[];
  size: number;
}

function isBoldFont(fontName: string): boolean {
  // 去掉子集前缀（AAAAAB+Arial-BoldMT）后按常见粗体命名判断
  const bare = fontName.replace(/^[A-Z]{6}\+/, '');
  return /bold|black|heavy|semib/i.test(bare);
}

async function extractPageLines(
  pdf: Awaited<ReturnType<typeof loadPdfDocument>>,
  pageIndex: number,
): Promise<TextLine[]> {
  const page = await pdf.getPage(pageIndex);
  const content = await page.getTextContent();
  const groups = new Map<number, { y: number; frags: TextFragment[] }>();
  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const tx = item.transform;
    const size = Math.abs(tx[3]) || Math.abs(tx[0]) || 10;
    const x = tx[4];
    const y = tx[5];
    const tolerance = Math.max(2, size * 0.4);
    let key = y;
    for (const existing of groups.keys()) {
      if (Math.abs(existing - y) <= tolerance) {
        key = existing;
        break;
      }
    }
    const group: { y: number; frags: TextFragment[] } = groups.get(key) ?? { y: key, frags: [] };
    group.frags.push({
      str: item.str,
      x,
      xEnd: x + (item.width || 0),
      size,
      bold: isBoldFont(item.fontName || ''),
    });
    groups.set(key, group);
  }
  const lines: TextLine[] = [];
  for (const group of groups.values()) {
    group.frags.sort((a, b) => a.x - b.x);
    const maxSize = Math.max(...group.frags.map((f) => f.size));
    lines.push({ y: group.y, frags: group.frags, size: maxSize });
  }
  lines.sort((a, b) => b.y - a.y);
  return lines;
}

function median(values: number[]): number {
  if (!values.length) return 10;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function lineText(line: TextLine): string {
  let text = '';
  let prevEnd = -Infinity;
  for (const frag of line.frags) {
    if (text && frag.x - prevEnd > frag.size * 0.18) text += ' ';
    text += frag.str;
    prevEnd = frag.xEnd;
  }
  return text.replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ */
/* PDF → Word（docx 重建）                                            */
/* ------------------------------------------------------------------ */

async function pdfToWord(bytes: Uint8Array, sourceName: string): Promise<WebConvertResult> {
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = docx;
  const pdf = await loadPdfDocument(bytes);
  const pages: TextLine[][] = [];
  const allSizes: number[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const lines = await extractPageLines(pdf, i);
    pages.push(lines);
    for (const line of lines) allSizes.push(line.size);
  }
  const bodySize = median(allSizes) || 10;

  const children: InstanceType<typeof Paragraph>[] = [];
  pages.forEach((lines, pageIndex) => {
    if (pageIndex > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    for (const line of lines) {
      const text = lineText(line);
      if (!text) continue;
      const ratio = line.size / bodySize;
      const heading =
        ratio >= 2.0
          ? HeadingLevel.HEADING_1
          : ratio >= 1.7
            ? HeadingLevel.HEADING_2
            : ratio >= 1.45
              ? HeadingLevel.HEADING_3
              : undefined;
      const runs = line.frags
        .map((frag) => ({ text: frag.str, bold: frag.bold }))
        .filter((run) => run.text.trim().length > 0);
      children.push(
        heading
          ? new Paragraph({ heading, children: [new TextRun({ text, bold: true })] })
          : new Paragraph({ children: runs.map((run) => new TextRun({ text: run.text, bold: run.bold })) }),
      );
    }
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  return {
    blob,
    filename: `${baseName(sourceName)}.docx`,
    engine: 'browser:pdfjs+docx.js',
  };
}

/* ------------------------------------------------------------------ */
/* PDF → Excel（行聚类 + 间隙分列）                                    */
/* ------------------------------------------------------------------ */

function splitCells(line: TextLine): string[] {
  const cells: string[] = [];
  let current = '';
  let prevEnd = -Infinity;
  for (const frag of line.frags) {
    const gap = frag.x - prevEnd;
    if (current && gap > Math.max(8, frag.size * 1.2)) {
      cells.push(current.trim());
      current = frag.str;
    } else if (current && gap > frag.size * 0.18) {
      current += ' ' + frag.str;
    } else {
      current += frag.str;
    }
    prevEnd = frag.xEnd;
  }
  if (current.trim()) cells.push(current.trim());
  return cells;
}

function toCell(value: string): string | number {
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed.replace(/,/g, '')) && trimmed.length < 16) {
    return Number(trimmed.replace(/,/g, ''));
  }
  return value;
}

async function pdfToExcel(bytes: Uint8Array, sourceName: string): Promise<WebConvertResult> {
  const XLSX = await import('xlsx');
  const pdf = await loadPdfDocument(bytes);
  const wb = XLSX.utils.book_new();
  for (let i = 1; i <= pdf.numPages; i++) {
    const lines = await extractPageLines(pdf, i);
    const rows = lines
      .map((line) => splitCells(line).map(toCell))
      .filter((cells) => cells.length > 0);
    const sheet = XLSX.utils.aoa_to_sheet(rows.length ? rows : [['(本页无可提取文本)']]);
    const colWidths: number[] = [];
    for (const row of rows) {
      row.forEach((cell, col) => {
        const length = String(cell ?? '').length + 4;
        colWidths[col] = Math.max(colWidths[col] || 8, Math.min(60, length));
      });
    }
    sheet['!cols'] = colWidths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, sheet, `Page ${i}`);
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  return {
    blob,
    filename: `${baseName(sourceName)}.xlsx`,
    engine: 'browser:pdfjs+sheetjs',
  };
}

/* ------------------------------------------------------------------ */
/* PDF → PPT（整页贴图，与后端同思路）                                  */
/* ------------------------------------------------------------------ */

async function pdfToPpt(
  bytes: Uint8Array,
  sourceName: string,
  dpi: number,
  format: 'png' | 'jpeg',
): Promise<WebConvertResult> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pdf = await loadPdfDocument(bytes);
  const pptx = new PptxGenJS();
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  for (let i = 1; i <= pdf.numPages; i++) {
    const { canvas } = await renderPdfPageToCanvas(pdf, i, dpi / 72);
    const dataUrl = canvas.toDataURL(mime, 0.9);
    const pagePtW = canvas.width / (dpi / 72) / 72;
    const pagePtH = canvas.height / (dpi / 72) / 72;
    if (i === 1) {
      pptx.defineLayout({ name: 'PDFPAGE', width: pagePtW, height: pagePtH });
      pptx.layout = 'PDFPAGE';
    }
    const slide = pptx.addSlide();
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: pagePtW, h: pagePtH });
  }
  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
  return {
    blob,
    filename: `${baseName(sourceName)}.pptx`,
    engine: 'browser:pdfjs+pptxgenjs',
  };
}

/* ------------------------------------------------------------------ */
/* HTML → PDF 栅格化管线（word/excel-to-pdf 与 html-to-pdf 共用）          */
/* ------------------------------------------------------------------ */

const PAGE_CSS_PX_W = 794; // A4 @96dpi
const PAGE_CSS_PX_H = 1123;

function documentStyle(): string {
  return `<style>
    *{box-sizing:border-box}
    body{margin:0;background:#fff}
    .zs-wrap{width:${PAGE_CSS_PX_W}px;padding:48px 56px;font-family:'Microsoft YaHei','PingFang SC','Hiragino Sans GB',sans-serif;font-size:14px;line-height:1.75;color:#111}
    .zs-wrap h1{font-size:26px;margin:.7em 0 .5em}
    .zs-wrap h2{font-size:21px;margin:.7em 0 .5em}
    .zs-wrap h3{font-size:17px;margin:.6em 0 .4em}
    .zs-wrap h4,.zs-wrap h5,.zs-wrap h6{font-size:15px;margin:.6em 0 .4em}
    .zs-wrap p{margin:.45em 0}
    .zs-wrap pre{background:#f4f4f4;padding:10px 12px;border-radius:6px;font-family:Consolas,Menlo,monospace;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere}
    .zs-wrap code{font-family:Consolas,Menlo,monospace;font-size:12.5px;background:#f4f4f4;padding:1px 4px;border-radius:3px}
    .zs-wrap table{border-collapse:collapse;width:100%;margin:10px 0;font-size:13px}
    .zs-wrap td,.zs-wrap th{border:1px solid #9a9a9a;padding:6px 9px;text-align:left;vertical-align:top}
    .zs-wrap th{background:#f0f0f0;font-weight:700}
    .zs-wrap blockquote{border-left:4px solid #b5b5b5;margin:8px 0;padding:2px 14px;color:#444}
    .zs-wrap ul,.zs-wrap ol{padding-left:26px;margin:.4em 0}
    .zs-wrap hr{border:none;border-top:1px solid #c9c9c9;margin:14px 0}
    .zs-wrap img{max-width:100%}
  </style>`;
}

function wrapHtmlBody(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${documentStyle()}</head>
<body><div class="zs-wrap">${bodyHtml}</div></body></html>`;
}

/** 极简 Markdown 子集 → HTML（标题/列表/引用/代码块/分隔线/表格行/粗斜体内联） */
function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let inCode = false;
  let listMode: 'ul' | 'ol' | null = null;
  const inline = (text: string): string =>
    escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const closeList = () => {
    if (listMode) {
      out.push(`</${listMode}>`);
      listMode = null;
    }
  };
  for (const raw of lines) {
    if (/^```/.test(raw.trim())) {
      closeList();
      out.push(inCode ? '</pre>' : '<pre>');
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(raw));
      continue;
    }
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    if (/^(---+|\*\*\*+|___+)\s*$/.test(line.trim())) {
      closeList();
      out.push('<hr/>');
      continue;
    }
    const ulItem = /^[-*+]\s+(.*)$/.exec(line.trim());
    if (ulItem) {
      if (listMode !== 'ul') {
        closeList();
        out.push('<ul>');
        listMode = 'ul';
      }
      out.push(`<li>${inline(ulItem[1])}</li>`);
      continue;
    }
    const olItem = /^\d+[.)]\s+(.*)$/.exec(line.trim());
    if (olItem) {
      if (listMode !== 'ol') {
        closeList();
        out.push('<ol>');
        listMode = 'ol';
      }
      out.push(`<li>${inline(olItem[1])}</li>`);
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line.trim());
    if (quote) {
      closeList();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }
    closeList();
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (inCode) out.push('</pre>');
  closeList();
  return out.join('\n');
}

/** 粘贴内容路由：以 '<' 开头按 HTML 子集处理（剥离 script/style），否则按 Markdown */
function contentToBodyHtml(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('<')) {
    return trimmed
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');
  }
  return markdownToHtml(content);
}

/** 把包裹好的 HTML 栅格化成画布。
 * 首选 html2canvas（逐节点重绘，Safari/Chrome 对 foreignObject 的 data-URL SVG 支持不稳）；
 * html2canvas 加载失败时回退 foreignObject SVG 方案。 */
async function rasterizeHtmlToCanvas(
  bodyHtml: string,
  onStage?: (stage: string) => void,
): Promise<HTMLCanvasElement> {
  onStage?.('layout');
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.innerHTML = wrapHtmlBody(bodyHtml);
  document.body.appendChild(host);
  const wrap = host.querySelector('.zs-wrap') as HTMLElement;
  const width = PAGE_CSS_PX_W;
  const height = Math.max(PAGE_CSS_PX_H, wrap.scrollHeight);
  try {
    try {
      const html2canvas = (await import('html2canvas')).default;
      onStage?.('render');
      const canvas = await html2canvas(wrap, {
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        backgroundColor: '#ffffff',
        scale: 1,
        logging: false,
        useCORS: true,
      });
      if (canvas.width > 0 && canvas.height > 0) return canvas;
    } catch {
      /* 落到 foreignObject 回退 */
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<foreignObject width="100%" height="100%">${host.innerHTML}</foreignObject></svg>`;
    const image = new Image();
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await image.decode();
    onStage?.('render');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0);
    return canvas;
  } finally {
    host.remove();
  }
}

async function rasterizedCanvasToPdfBytes(
  canvas: HTMLCanvasElement,
  quality: number,
  onStage?: (stage: string) => void,
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const pageCount = Math.max(1, Math.ceil(canvas.height / PAGE_CSS_PX_H));
  for (let index = 0; index < pageCount; index++) {
    const sliceTop = index * PAGE_CSS_PX_H;
    const sliceHeight = Math.min(PAGE_CSS_PX_H, canvas.height - sliceTop);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const sctx = slice.getContext('2d');
    if (!sctx) throw new Error('Canvas 2D context unavailable');
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, slice.width, sliceHeight);
    sctx.drawImage(canvas, 0, sliceTop, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    const jpegBytes = await canvasToBytes(slice, 'image/jpeg', quality);
    const embedded = await pdfDoc.embedJpg(jpegBytes);
    const page = pdfDoc.addPage([595.28, 841.89]);
    page.drawImage(embedded, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  onStage?.('write');
  return pdfDoc.save();
}

/* ------------------------------------------------------------------ */
/* Office → PDF（mammoth / SheetJS → HTML → 栅格化）                   */
/* ------------------------------------------------------------------ */

async function docxToBodyHtml(bytes: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.convertToHtml({ arrayBuffer: bytes });
  return result.value || '<p>(空文档)</p>';
}

async function xlsxToBodyHtml(bytes: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(bytes, { type: 'array' });
  const sections: string[] = [];
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const table = XLSX.utils.sheet_to_html(sheet, { editable: false });
    const inner = /<body[^>]*>([\s\S]*)<\/body>/i.exec(table);
    sections.push(`<h3>${escapeHtml(name)}</h3>${inner ? inner[1] : table}`);
  }
  return sections.join('<hr/>') || '<p>(空工作簿)</p>';
}

async function officeToPdf(
  file: File,
  _opts: WebConvertOptions,
  onStage?: (stage: string) => void,
  kind: 'word' | 'excel' = 'word',
): Promise<WebConvertResult> {
  const ext = extOf(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const wordOk = ext === 'docx' || ext === 'doc';
  const excelOk = ext === 'xlsx' || ext === 'xls';
  if (kind === 'word' && !wordOk) throw new Error('word-to-pdf:unsupported-input');
  if (kind === 'excel' && !excelOk) throw new Error('excel-to-pdf:unsupported-input');
  if (kind === 'word' && wordOk) {
    onStage?.('parse-docx');
    const body = await docxToBodyHtml(bytes.buffer as ArrayBuffer);
    onStage?.('layout');
    const canvas = await rasterizeHtmlToCanvas(body, onStage);
    const pdfBytes = await rasterizedCanvasToPdfBytes(canvas, 0.92, onStage);
    return {
      blob: new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }),
      filename: `${baseName(file.name)}.pdf`,
      engine: 'browser:mammoth+rasterize',
    };
  }
  if (kind === 'excel' && (ext === 'xlsx' || ext === 'xls')) {
    onStage?.('parse-xlsx');
    const body = await xlsxToBodyHtml(bytes.buffer as ArrayBuffer);
    const canvas = await rasterizeHtmlToCanvas(body, onStage);
    const pdfBytes = await rasterizedCanvasToPdfBytes(canvas, 0.92, onStage);
    return {
      blob: new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }),
      filename: `${baseName(file.name)}.pdf`,
      engine: 'browser:sheetjs+rasterize',
    };
  }
  throw new Error('browser-unsupported-legacy-office');
}

/* ------------------------------------------------------------------ */
/* 深度压缩（逐页栅格化 + JPEG 重编码 + pdf-lib 回写）                  */
/* ------------------------------------------------------------------ */

async function compressDeep(
  bytes: Uint8Array,
  sourceName: string,
  dpi: number,
  quality: number,
): Promise<WebConvertResult> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await loadPdfDocument(bytes);
  const out = await PDFDocument.create();
  for (let i = 1; i <= pdf.numPages; i++) {
    const { canvas } = await renderPdfPageToCanvas(pdf, i, dpi / 72);
    const jpegBytes = await canvasToBytes(canvas, 'image/jpeg', Math.max(0.2, Math.min(0.95, quality / 100)));
    const embedded = await out.embedJpg(jpegBytes);
    const scale = dpi / 72;
    const page = out.addPage([canvas.width / scale, canvas.height / scale]);
    page.drawImage(embedded, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }
  const saved = await out.save();
  return {
    blob: new Blob([saved as BlobPart], { type: 'application/pdf' }),
    filename: `${baseName(sourceName)}_compressed.pdf`,
    engine: 'browser:pdfjs+pdf-lib',
  };
}

/* ------------------------------------------------------------------ */
/* PDF 修复（pdf-lib 容错解析重建，尽力而为）                           */
/* ------------------------------------------------------------------ */

async function repairPdf(bytes: Uint8Array, sourceName: string): Promise<WebConvertResult> {
  const { PDFDocument } = await import('pdf-lib');
  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdfDoc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    });
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? `浏览器引擎无法修复该文件：${err.message}`
        : '浏览器引擎无法修复该文件',
    );
  }
  const saved = await pdfDoc.save();
  return {
    blob: new Blob([saved as BlobPart], { type: 'application/pdf' }),
    filename: `${baseName(sourceName)}_repaired.pdf`,
    engine: 'browser:pdf-lib',
  };
}

/* ------------------------------------------------------------------ */
/* HTML/MD → PDF                                                       */
/* ------------------------------------------------------------------ */

async function htmlToPdf(
  content: string,
  file: File | null,
  title: string,
  onStage?: (stage: string) => void,
): Promise<WebConvertResult> {
  const body = contentToBodyHtml(content);
  const canvas = await rasterizeHtmlToCanvas(body, onStage);
  const pdfBytes = await rasterizedCanvasToPdfBytes(canvas, 0.92, onStage);
  const name = title || (file ? baseName(file.name) : 'document');
  return {
    blob: new Blob([pdfBytes as BlobPart], { type: 'application/pdf' }),
    filename: `${name}.pdf`,
    engine: 'browser:rasterize',
  };
}

/* ------------------------------------------------------------------ */
/* 统一入口                                                            */
/* ------------------------------------------------------------------ */

export async function runWebConversion(
  op: string,
  file: File | null,
  opts: WebConvertOptions = {},
  onStage?: (stage: string) => void,
): Promise<WebConvertResult> {
  if (op === 'html-to-pdf') {
    const content = (opts.content || '').trim() || (file ? await file.text() : '');
    if (!content) throw new Error('empty-input');
    return htmlToPdf(content, file, (opts.title || '').trim(), onStage);
  }
  if (!file) throw new Error('no-file');
  const bytes = new Uint8Array(await file.arrayBuffer());
  switch (op) {
    case 'pdf-to-word':
      return pdfToWord(bytes, file.name);
    case 'pdf-to-excel':
      return pdfToExcel(bytes, file.name);
    case 'pdf-to-ppt':
      return pdfToPpt(bytes, file.name, opts.dpi ?? 144, opts.imageFormat ?? 'png');
    case 'word-to-pdf':
      return officeToPdf(file, opts, onStage, 'word');
    case 'excel-to-pdf':
      return officeToPdf(file, opts, onStage, 'excel');
    case 'compress-deep':
      return compressDeep(bytes, file.name, opts.dpi ?? 144, opts.quality ?? 70);
    case 'pdf-repair':
      return repairPdf(bytes, file.name);
    default:
      throw new Error(`browser-unsupported-op:${op}`);
  }
}
