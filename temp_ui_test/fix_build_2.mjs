import fs from 'fs';
const fCenter = 'C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/pdfcenter/PdfCenter.tsx';
let tc = fs.readFileSync(fCenter, 'utf-8');
tc = tc.replace(/import \{ PdfEditorView \} from '.\/PdfEditorView'\nimport \{ PdfOrganizeView \} from '.\/PdfOrganizeView'\n/, "import { PdfEditorView } from './PdfEditorView'\n");
tc = tc.replace(/import \{ PdfOrganizeView \} from '.\/PdfOrganizeView'/g, '');
tc = tc.replace(/import \{ PdfEditorView \}/g, "import { PdfEditorView } from './PdfEditorView'\nimport { PdfOrganizeView } from './PdfOrganizeView'\n");
fs.writeFileSync(fCenter, tc);

const fExport = 'C:/Users/Zonlic/Desktop/ZonKey/frontend/src/lib/hooks/usePdfEditorExport.ts';
let te = fs.readFileSync(fExport, 'utf-8');
te = te.replace(/import \{ PDFDocument, rgb \} from 'pdf-lib'/, "import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'");
te = te.replace(/new Blob\(\[bytes\.buffer\]\)/g, "new Blob([new Uint8Array(bytes)])");
fs.writeFileSync(fExport, te);

const fRender = 'C:/Users/Zonlic/Desktop/ZonKey/frontend/src/lib/hooks/usePdfLocalRender.ts';
let tr = fs.readFileSync(fRender, 'utf-8');
tr = tr.replace(/import pdfjsWorker from 'pdfjs-dist\/build\/pdf\.worker\.mjs\?url';/, "// @ts-ignore\nimport pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';");
fs.writeFileSync(fRender, tr);
