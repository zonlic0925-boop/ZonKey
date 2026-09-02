import fs from 'fs';
const f = 'C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/pdfcenter/PdfCenter.tsx';
let t = fs.readFileSync(f, 'utf-8');
t = t.replace(
  "import { PdfEditorView }\nimport { PdfFormsView } from './PdfFormsView'\nimport { PdfCertSignView } from './PdfCertSignView' from './PdfEditorView'",
  "import { PdfEditorView } from './PdfEditorView'\nimport { PdfFormsView } from './PdfFormsView'\nimport { PdfCertSignView } from './PdfCertSignView'"
);
fs.writeFileSync(f, t);
