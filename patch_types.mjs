import fs from 'fs';
const f = 'C:/Users/Zonlic/Desktop/ZonScale/frontend/src/types/index.ts';
let t = fs.readFileSync(f, 'utf-8');
if (!t.includes('pdf-organize')) {
  t = t.replace(
    /export type PdfToolId =\n.*?\| 'pdf-editor'/s, 
    "export type PdfToolId =\n  | 'pdf-organize'\n  | 'pdf-editor'\n  | 'pdf-forms'\n  | 'pdf-cert-sign'"
  );
  fs.writeFileSync(f, t);
}
