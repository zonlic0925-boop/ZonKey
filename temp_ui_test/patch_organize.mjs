import fs from 'fs';
const text = fs.readFileSync('C:/Users/Zonlic/Desktop/ZonScale/frontend/src/components/pdfcenter/PdfOrganizeView.tsx', 'utf-8');
const obj = text.replace(
  /export const PdfEditorView: React\.FC = \(\) => \{/,
  'export const PdfOrganizeView: React.FC = () => {'
);
fs.writeFileSync('C:/Users/Zonlic/Desktop/ZonScale/frontend/src/components/pdfcenter/PdfOrganizeView.tsx', obj);

const text2 = fs.readFileSync('C:/Users/Zonlic/Desktop/ZonScale/frontend/src/components/pdfcenter/PdfCenter.tsx', 'utf-8');
const obj2 = text2.replace(
  /import \{ PdfEditorView \} from '.\/PdfEditorView'/,
  "import { PdfEditorView } from './PdfEditorView'\nimport { PdfOrganizeView } from './PdfOrganizeView'"
).replace(
  /case 'pdf-organize':\n      return <PdfEditorView onNotify=\{notify\} \/>/,
  "case 'pdf-organize':\n      return <PdfOrganizeView />"
);
fs.writeFileSync('C:/Users/Zonlic/Desktop/ZonScale/frontend/src/components/pdfcenter/PdfCenter.tsx', obj2);
