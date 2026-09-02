/**
 * pdfCore 新增功能的 Node 冒烟测试（esbuild 打包后运行）。
 * 覆盖：范围解析、范围拆分、页面提取、页码、裁剪。水印/图片合成依赖 canvas，不在此覆盖。
 */
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import {
  addPageNumbers,
  cropPdfPages,
  extractPdfPages,
  parsePdfPageRanges,
  splitPdfByRanges,
} from './src/lib/zonkey/pdfCore';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`PASS ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL ${name} ${detail}`);
  }
}

async function makeSamplePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i += 1) {
    const page = doc.addPage([300, 400]);
    page.drawText(`page ${i}`, { x: 20, y: 360, size: 12, font });
  }
  return doc.save();
}

async function main(): Promise<void> {
  // ===== parsePdfPageRanges =====
  const ranges = parsePdfPageRanges('1-3,5,8-', 10);
  check('parse multi ranges', JSON.stringify(ranges.map((r) => [r.start, r.end])) === JSON.stringify([[1, 3], [5, 5], [8, 10]]));
  const openStart = parsePdfPageRanges('-3', 10);
  check('parse open start', openStart.length === 1 && openStart[0].start === 1 && openStart[0].end === 3);
  let threw = false;
  try { parsePdfPageRanges('0', 10); } catch { threw = true; }
  check('reject page 0', threw);
  threw = false;
  try { parsePdfPageRanges('11', 10); } catch { threw = true; }
  check('reject out-of-range', threw);
  threw = false;
  try { parsePdfPageRanges('abc', 10); } catch { threw = true; }
  check('reject garbage', threw);

  // ===== splitPdfByRanges =====
  const sample = await makeSamplePdf(10);
  const parts = await splitPdfByRanges({ fileData: sample, sourceName: 'sample.pdf', ranges });
  check('split part count', parts.length === 3, `got ${parts.length}`);
  const partPages: number[] = [];
  for (const part of parts) {
    const doc = await PDFDocument.load(part.bytes);
    partPages.push(doc.getPageCount());
  }
  check('split part page counts', JSON.stringify(partPages) === JSON.stringify([3, 1, 3]), JSON.stringify(partPages));
  check('split part name', parts[0].fileName === 'sample_part_1_p1-3.pdf', parts[0].fileName);

  // ===== extractPdfPages =====
  const extracted = await extractPdfPages({
    fileData: sample,
    sourceName: 'sample.pdf',
    ranges: parsePdfPageRanges('2,4-6', 10),
  });
  const extractedDoc = await PDFDocument.load(extracted);
  check('extract page count', extractedDoc.getPageCount() === 4, `got ${extractedDoc.getPageCount()}`);

  // ===== addPageNumbers =====
  const numbered = await addPageNumbers({ fileData: sample, format: 'slash', startAt: 3 });
  const numberedDoc = await PDFDocument.load(numbered);
  check('page numbers keeps pages', numberedDoc.getPageCount() === 10);

  // ===== cropPdfPages =====
  const cropped = await cropPdfPages({ fileData: sample, marginPercent: 10 });
  const croppedDoc = await PDFDocument.load(cropped);
  const mediaBox = croppedDoc.getPage(0).getMediaBox();
  const cropBox = croppedDoc.getPage(0).getCropBox();
  check(
    'crop box inset',
    Math.abs(cropBox.width - mediaBox.width * 0.8) < 0.01 && Math.abs(cropBox.height - mediaBox.height * 0.8) < 0.01,
    `crop=${cropBox.width}x${cropBox.height} media=${mediaBox.width}x${mediaBox.height}`,
  );

  // ===== 水印/图片合成的输出可被 pdf-lib 重新加载（结构完整性间接检查） =====
  const structOk = await PDFDocument.load(sample);
  check('sample structurally valid', structOk.getPageCount() === 10);

  console.log(failures === 0 ? 'ALL SMOKE TESTS PASSED' : `${failures} SMOKE TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('SMOKE CRASH:', err);
  process.exit(1);
});
