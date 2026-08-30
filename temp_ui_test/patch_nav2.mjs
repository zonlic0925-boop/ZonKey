import fs from 'fs';
const f1 = 'C:/Users/Zonlic/Desktop/ZonScale/frontend/src/components/navigation/SubNavPills.tsx';
let t1 = fs.readFileSync(f1, 'utf-8');
if (!t1.includes('pdf-forms')) {
    t1 = t1.replace( // insert after protect-pdf
        /\{ id: 'pdf-protect', labelKey: 'tools.pdfEncrypt', availability: 'ready' \},/,
        "{ id: 'pdf-protect', labelKey: 'tools.pdfEncrypt', availability: 'ready' },\n        { id: 'pdf-forms', labelKey: 'tools.pdfForms', availability: 'ready' },\n        { id: 'pdf-cert-sign', labelKey: 'tools.pdfCertSign', availability: 'ready' },"
    );
    fs.writeFileSync(f1, t1);
}

const f2 = 'C:/Users/Zonlic/Desktop/ZonScale/frontend/src/components/pdfcenter/PdfCenter.tsx';
let t2 = fs.readFileSync(f2, 'utf-8');
if (!t2.includes('PdfFormsView')) {
    t2 = t2.replace(
        "import { PdfEditorView }",
        "import { PdfEditorView }\nimport { PdfFormsView } from './PdfFormsView'\nimport { PdfCertSignView } from './PdfCertSignView'"
    );
    t2 = t2.replace(
        "case 'pdf-organize':",
        "case 'pdf-forms': return <PdfFormsView />\n    case 'pdf-cert-sign': return <PdfCertSignView />\n    case 'pdf-organize':"
    );
    fs.writeFileSync(f2, t2);
}

const f3 = 'C:/Users/Zonlic/Desktop/ZonScale/frontend/src/i18n/locales/zh-CN.ts';
let t3 = fs.readFileSync(f3, 'utf-8');
if (!t3.includes('pdfForms')) {
    t3 = t3.replace(
        /pdfEncrypt: 'PDF 加密',/,
        "pdfEncrypt: 'PDF 加密',\n    pdfForms: '在线填表',\n    pdfCertSign: '证书签名',"
    );
    fs.writeFileSync(f3, t3);
}
