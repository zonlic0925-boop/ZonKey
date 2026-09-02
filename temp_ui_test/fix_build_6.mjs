import fs from 'fs';
let peditor = fs.readFileSync('C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/pdfcenter/PdfEditorView.tsx', 'utf-8');
peditor = peditor.replace(/__IGNORE__/g, 'PdfEditorCanvas');
fs.writeFileSync('C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/pdfcenter/PdfEditorView.tsx', peditor);

const fExport = 'C:/Users/Zonlic/Desktop/ZonKey/frontend/src/lib/hooks/usePdfEditorExport.ts';
let te = fs.readFileSync(fExport, 'utf-8');
te = te.replace(/new Blob\(\[bytes\.buffer as ArrayBuffer\]\)/, "new Blob([new Uint8Array(bytes)] as unknown as BlobPart[])");
fs.writeFileSync(fExport, te);
