import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PdfElement } from '../../types';

export const exportEditedPdf = async (
  originalFile: File,
  elements: PdfElement[]
): Promise<Blob> => {
  const buffer = await originalFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(buffer);
  
  // Keep track of embedded fonts and images to reuse them
  const fontCache: Record<string, any> = {};
  const imageCache: Record<string, any> = {};
  
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const el of elements) {
    // pdf-lib's getPage is 0-indexed, whereas our frontend's page_num is 1-indexed
    const pageObj = pdfDoc.getPage(el.page - 1);
    const { width, height } = pageObj.getSize();

    // pdf-lib coordinates are bottom-left based. Our frontend coordinates
    // (from overlayPointerToPdf) are top-left based (usually). Wait, 
    // pdfBoxToOverlayPixels in imageLayout.ts expects [x, y, w, h] from top-left.
    // If the elements store top-left coordinates:
    const pdfY = height - el.y - el.height;

    if (el.type === 'rect') {
      pageObj.drawRectangle({
        x: el.x,
        y: pdfY,
        width: el.width,
        height: el.height,
        borderColor: el.color ? hexToPdfRgb(el.color) : rgb(0,0,0),
        borderWidth: el.strokeWidth || 2,
        // Optional fill logic could be added here
      });
    } else if (el.type === 'ellipse') {
      // PDF-lib drawEllipse uses center coordinates
      pageObj.drawEllipse({
        x: el.x + el.width / 2,
        y: pdfY + el.height / 2,
        xScale: el.width / 2,
        yScale: el.height / 2,
        borderColor: el.color ? hexToPdfRgb(el.color) : rgb(0,0,0),
        borderWidth: el.strokeWidth || 2,
      });
    } else if (el.type === 'text' && el.text) {
      // Need a proper font for unicode, but fallback to helvetica for MVP
      pageObj.drawText(el.text, {
        x: el.x,
        y: pdfY + el.height - (el.fontSize || 12), // Text is drawn from baseline
        size: el.fontSize || 12,
        font: helveticaFont,
        color: el.color ? hexToPdfRgb(el.color) : rgb(0,0,0),
      });
    } else if (el.type === 'image' && el.imageUrl) {
      // E.g., signature PNG
      let pdfImage = imageCache[el.imageUrl];
      if (!pdfImage) {
        // Assume png for signatures
        const imgBytes = await fetch(el.imageUrl).then(res => res.arrayBuffer());
        if (el.imageUrl.includes('image/png')) {
          pdfImage = await pdfDoc.embedPng(imgBytes);
        } else {
          pdfImage = await pdfDoc.embedJpg(imgBytes);
        }
        imageCache[el.imageUrl] = pdfImage;
      }
      
      pageObj.drawImage(pdfImage, {
        x: el.x,
        y: pdfY,
        width: el.width,
        height: el.height,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes] as any, { type: 'application/pdf' });
};

// Helper: '#FF0000' -> pdf-lib rgb
function hexToPdfRgb(hex: string) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}
