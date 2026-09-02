import fs from 'fs';
const text = fs.readFileSync('C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/pdfcenter/PdfCenter.tsx', 'utf-8');
const obj = text.replace(
  /<PdfEditorView \/>/,
  '<PdfEditorView onNotify={notify} />'
);
fs.writeFileSync('C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/pdfcenter/PdfCenter.tsx', obj);
