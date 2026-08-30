/** Convert 工坊冒烟：8 个新转换工具视图渲染 + html-to-pdf 端到端（粘贴内容 → 产物清单） */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8765';
const TABS = [
  'PDF 转 Word',
  'PDF 转 Excel',
  'PDF 转 PPT',
  'Office 转 PDF',
  '深度压缩',
  'HTML/MD 转 PDF',
  'OCR 导出',
  'PDF 修复',
];

const results = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'PDF 工坊' }).first().click();
await page.waitForTimeout(600);

for (const tab of TABS) {
  await page.getByRole('button', { name: tab, exact: true }).first().click();
  await page.waitForTimeout(400);
  const text = await page.locator('main').innerText();
  const ok = text.includes(tab) && text.length > 40;
  results.push({ tab, render: ok ? 'PASS' : 'FAIL' });
}

// 端到端：HTML/MD 转 PDF（粘贴内容 → 转换 → 产物清单出现文件名）
await page.getByRole('button', { name: 'HTML/MD 转 PDF', exact: true }).first().click();
await page.waitForTimeout(400);
await page
  .locator('textarea')
  .fill('# 冒烟测试\n\n这是**转换冒烟**段落。\n\n- 甲\n- 乙');
await page.getByRole('button', { name: '开始转换' }).first().click();
await page.waitForTimeout(2500);
const afterText = await page.locator('main').innerText();
const e2eOk = afterText.includes('pasted_pdf.pdf') || /_pdf\.pdf/.test(afterText) || afterText.includes('转换完成');
results.push({ tab: 'E2E html-to-pdf', render: e2eOk ? 'PASS' : 'FAIL' });
if (!e2eOk) results.push({ tab: 'E2E debug', render: afterText.slice(0, 300) });

results.push({ tab: 'consoleErrors', render: errors.length === 0 ? 'PASS' : errors.join(' | ').slice(0, 200) });
console.log(JSON.stringify(results, null, 1));
await browser.close();
process.exit(results.every((r) => r.render === 'PASS') ? 0 : 1);
