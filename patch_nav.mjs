import fs from 'fs';
const navFile = 'C:/Users/Zonlic/Desktop/ZonScale/frontend/src/lib/navigation.tsx';
let navContent = fs.readFileSync(navFile, 'utf-8');
if (!navContent.includes('pdf-forms')) {
    navContent = navContent.replace(
        "{ id: 'pdf-editor', labelKey: 'tools.pdfEditor', availability: 'ready' },",
        "{ id: 'pdf-organize', labelKey: 'tools.pdfOrganize', availability: 'ready' },\n    { id: 'pdf-editor', labelKey: 'tools.pdfEditor', availability: 'ready' },\n    { id: 'pdf-forms', labelKey: 'tools.pdfForms', availability: 'ready' },\n    { id: 'pdf-cert-sign', labelKey: 'tools.pdfCertSign', availability: 'ready' },"
    );
    fs.writeFileSync(navFile, navContent);
}

const langFile = 'C:/Users/Zonlic/Desktop/ZonScale/frontend/src/i18n/locales/zh-CN.ts';
let langContent = fs.readFileSync(langFile, 'utf-8');
if (!langContent.includes('pdfForms:')) {
    langContent = langContent.replace(
        "pdfEditor: 'PDF 编辑器',",
        "pdfEditor: 'PDF 编辑器',\n    pdfForms: 'PDF 表单',\n    pdfCertSign: '证书签名',"
    );
    langContent = langContent.replace(
        "pdfEditor: '在 PDF 页面上添加文本、形状、批注，以及手写签名。',",
        "pdfEditor: '在 PDF 页面上添加文本、形状、批注，以及手写签名。',\n    pdfForms: '填写 PDF 表单数据，或将其拍平保存。',\n    pdfCertSign: '使用 P12 证书对 PDF 进行数字加密签名。',"
    );
    fs.writeFileSync(langFile, langContent);
}
