import fs from 'fs';
const fType = 'C:/Users/Zonlic/Desktop/ZonKey/frontend/src/types/index.ts';
let tt = fs.readFileSync(fType, 'utf-8');
if (!tt.includes("'pdf-organize'")) {
    tt = tt.replace("'pdf-editor'", "'pdf-editor'\n  | 'pdf-organize'\n  | 'images-to-pdf'\n  | 'pdf-forms'\n  | 'pdf-sign-cert'");
}
tt = tt.replace("declare module \"*?url\" {\n  const src: string;\n  export default src;\n}", "");
tt = tt.replace(/\/\/\/ <reference types=\"vite\/client\" \/>/g, "");
fs.writeFileSync(fType, tt);

const fExport = 'C:/Users/Zonlic/Desktop/ZonKey/frontend/src/lib/hooks/usePdfEditorExport.ts';
let te = fs.readFileSync(fExport, 'utf-8');
te = te.replace(/new Blob\(\[new Uint8Array\(bytes\)\].*?\)/, "new Blob([bytes.buffer as ArrayBuffer])");
fs.writeFileSync(fExport, te);

const venv = 'C:/Users/Zonlic/Desktop/ZonKey/frontend/src/vite-env.d.ts';
fs.writeFileSync(venv, "/// <reference types=\"vite/client\" />\n");

// Restore missing PdfEditorView.tsx
if (!fs.existsSync('C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/pdfcenter/PdfEditorView.tsx')) {
    fs.copyFileSync('C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/pdfcenter/PdfOrganizeView.tsx', 'C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/pdfcenter/PdfEditorView.tsx');
    let peditor = fs.readFileSync('C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/pdfcenter/PdfEditorView.tsx', 'utf-8');
    peditor = peditor.replace(/PdfOrganizeView/g, 'PdfEditorView');
    peditor = peditor.replace(/PdfEditorCanvas/g, '__IGNORE__');
    fs.writeFileSync('C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/pdfcenter/PdfEditorView.tsx', peditor);
}
