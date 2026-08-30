import fs from 'fs';
const coreF = 'C:/Users/Zonlic/Desktop/ZonScale/frontend/src/lib/toolknit/pdfCore.ts';
let coreCode = fs.readFileSync(coreF, 'utf-8');
coreCode += `
export async function encryptPdfFileAdvanced(
  file: File,
  userPw: string,
  ownerPw: string,
  perms: { print: boolean; copy: boolean; modify: boolean; fill: boolean }
): Promise<Uint8Array> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('user_pw', userPw);
  formData.append('owner_pw', ownerPw);
  formData.append('allow_print', perms.print ? 'true' : 'false');
  formData.append('allow_copy', perms.copy ? 'true' : 'false');
  formData.append('allow_modify', perms.modify ? 'true' : 'false');
  formData.append('allow_fill', perms.fill ? 'true' : 'false');

  const res = await fetch('http://127.0.0.1:8765/api/convert/protect-advanced', {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return new Uint8Array(await res.arrayBuffer());
}
`;
fs.writeFileSync(coreF, coreCode);
