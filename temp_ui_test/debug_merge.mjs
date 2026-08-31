import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const S = (p) => path.join(__dirname, path.basename(p));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
});
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('ERR:', m.text()); });
page.on('pageerror', (e) => console.log('PAGEERR:', e.message));

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
const privacy = page.getByRole('button', { name: /我已了解|知道了|确认/ }).first();
if (await privacy.isVisible().catch(() => false)) await privacy.click();
await page.getByRole('button', { name: 'PDF 工坊' }).first().click();
await page.waitForTimeout(500);
await page.locator('.zs-mobile-scroll-x').getByRole('button', { name: 'PDF 合并' }).click();
await page.waitForTimeout(600);
await page.locator('main input[type=file]').first().setInputFiles([S('multi_page.pdf'), S('sample_table.pdf')]);
await page.waitForTimeout(2000);
const mergeBtn = page.locator('main').getByRole('button', { name: '合并 PDF' });
console.log('merge visible:', await mergeBtn.isVisible());
console.log('merge enabled:', await mergeBtn.isEnabled());
const dlPromise = page.waitForEvent('download', { timeout: 45000 });
await mergeBtn.click();
const dl = await dlPromise.catch((e) => { console.log('DL ERR:', e.message); return null; });
console.log('download:', dl ? dl.suggestedFilename() : 'TIMEOUT');
await browser.close();
