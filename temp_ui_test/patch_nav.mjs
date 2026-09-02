import fs from 'fs';
const f = 'C:/Users/Zonlic/Desktop/ZonKey/frontend/src/components/navigation/SubNavPills.tsx';
let t = fs.readFileSync(f, 'utf-8');
t = t.replace(
  /\{ id: 'pdf-editor', labelKey: 'tools.pdfEditor', availability: 'ready' \},/,
  "{ id: 'pdf-organize', labelKey: 'tools.pdfOrganize', availability: 'ready' },\n        { id: 'pdf-editor', labelKey: 'tools.pdfEditor', availability: 'ready' },"
);
fs.writeFileSync(f, t);
