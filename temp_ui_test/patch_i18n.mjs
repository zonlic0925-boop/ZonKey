import fs from 'fs';
const f = 'C:/Users/Zonlic/Desktop/ZonKey/frontend/src/i18n/locales/zh-CN.ts';
let t = fs.readFileSync(f, 'utf-8');
t = t.replace(
  /pdfEditor:\s*'页面编辑',/,
  "pdfOrganize: '页面整理',\n    pdfEditor: 'PDF 编辑器',"
).replace(
  /pdfEditor:\s*'调整页面顺序、旋转或删除页面，导出为新 PDF。',/,
  "pdfOrganize: '调整页面顺序、旋转或删除页面，导出为新 PDF。',\n    pdfEditor: '在 PDF 页面上添加文本、形状、批注，以及手写签名。',"
);
if (!t.includes("pdfOrganize: '页面整理'")) {
    console.log("Failed to patch i18n!");
}
fs.writeFileSync(f, t);
