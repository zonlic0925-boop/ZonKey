import fs from 'fs';

// 4. Vite global types
let fEnv = 'C:/Users/Zonlic/Desktop/ZonScale/frontend/src/types/index.ts';
let tEnv = fs.readFileSync(fEnv, 'utf-8');
if (!tEnv.includes('?url')) {
    tEnv += '\n/// <reference types="vite/client" />\ndeclare module "*?url" {\n  const src: string;\n  export default src;\n}\n';
    fs.writeFileSync(fEnv, tEnv);
}

// 5. t(string) to t(any) in a few files.
const tsFiles = [
    'C:/Users/Zonlic/Desktop/ZonScale/frontend/src/components/pdfcenter/PdfEditorCanvas.tsx',
    'C:/Users/Zonlic/Desktop/ZonScale/frontend/src/components/pdfcenter/PdfOrganizeView.tsx',
    'C:/Users/Zonlic/Desktop/ZonScale/frontend/src/components/pdfcenter/SignaturePad.tsx'
];
for (const f of tsFiles) {
    if(!fs.existsSync(f)) continue;
    let t = fs.readFileSync(f, 'utf-8');
    t = t.replace(/t\('(.*?)'\)/g, "t('$1' as any)");
    fs.writeFileSync(f, t);
}
