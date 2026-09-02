import fs from 'fs';
const fCenter = 'C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/pdfcenter/PdfCenter.tsx';
let tc = fs.readFileSync(fCenter, 'utf-8');
tc = tc.replace(" from './PdfEditorView'\n", "");
fs.writeFileSync(fCenter, tc);
