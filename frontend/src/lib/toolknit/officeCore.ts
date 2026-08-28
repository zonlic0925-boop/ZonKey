import { PDFDocument, degrees } from 'pdf-lib';
import JSZip from 'jszip';

export async function mergePdfFiles(files: File[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach(page => mergedPdf.addPage(page));
  }
  return mergedPdf.save();
}

export async function splitPdfFile(file: File, pageRanges: string): Promise<{ name: string; bytes: Uint8Array }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const totalPages = pdf.getPageCount();

  const ranges = pageRanges.split(',').map(r => r.trim()).filter(Boolean);
  const results: { name: string; bytes: Uint8Array }[] = [];

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    const newPdf = await PDFDocument.create();
    let indices: number[] = [];

    if (range.includes('-')) {
      const [startStr, endStr] = range.split('-');
      const start = Math.max(1, parseInt(startStr, 10));
      const end = Math.min(totalPages, parseInt(endStr, 10));
      for (let p = start; p <= end; p++) indices.push(p - 1);
    } else {
      const p = parseInt(range, 10);
      if (p >= 1 && p <= totalPages) indices.push(p - 1);
    }

    if (indices.length > 0) {
      const copied = await newPdf.copyPages(pdf, indices);
      copied.forEach(page => newPdf.addPage(page));
      const bytes = await newPdf.save();
      results.push({
        name: `part_${i + 1}_pages_${range}.pdf`,
        bytes
      });
    }
  }

  return results;
}

export async function rotatePdfPages(file: File, rotationDeg: 90 | 180 | 270): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  for (const page of pages) {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + rotationDeg) % 360));
  }
  return pdf.save();
}

export async function extractPptImages(file: File): Promise<{ name: string; blob: Blob; size: number }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const images: { name: string; blob: Blob; size: number }[] = [];

  const mediaFolder = zip.folder('ppt/media');
  if (mediaFolder) {
    const promises: Promise<void>[] = [];
    mediaFolder.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && /\.(png|jpe?g|gif|webp|bmp|emf|wmf)$/i.test(zipEntry.name)) {
        promises.push(
          zipEntry.async('blob').then(blob => {
            images.push({
              name: relativePath.split('/').pop() || zipEntry.name,
              blob,
              size: blob.size
            });
          })
        );
      }
    });
    await Promise.all(promises);
  }

  return images;
}

export async function extractPptText(file: File): Promise<{ slideIndex: number; text: string }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slides: { slideIndex: number; text: string }[] = [];

  const slideFiles = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name));
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)![0], 10);
    const numB = parseInt(b.match(/\d+/)![0], 10);
    return numA - numB;
  });

  for (let i = 0; i < slideFiles.length; i++) {
    const content = await zip.files[slideFiles[i]].async('text');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'application/xml');
    const textNodes = xmlDoc.getElementsByTagName('a:t');
    const texts: string[] = [];
    for (let j = 0; j < textNodes.length; j++) {
      if (textNodes[j].textContent) {
        texts.push(textNodes[j].textContent!);
      }
    }
    slides.push({
      slideIndex: i + 1,
      text: texts.join(' ')
    });
  }

  return slides;
}

export async function addPdfWatermark(file: File, watermarkText: string): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const pages = pdf.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(watermarkText, {
      x: width / 4,
      y: height / 2,
      size: 36,
      opacity: 0.3,
      rotate: degrees(45)
    });
  }
  return pdf.save();
}

export const mergePdfDocuments = mergePdfFiles;
export const splitPdfDocument = splitPdfFile;

export async function splitPdfDocumentToZip(file: File): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const totalPages = pdf.getPageCount();
  const zip = new JSZip();

  for (let i = 0; i < totalPages; i++) {
    const newPdf = await PDFDocument.create();
    const copied = await newPdf.copyPages(pdf, [i]);
    copied.forEach(page => newPdf.addPage(page));
    const bytes = await newPdf.save();
    zip.file("page_" + (i + 1) + ".pdf", bytes);
  }

  return zip.generateAsync({ type: 'blob' });
}
