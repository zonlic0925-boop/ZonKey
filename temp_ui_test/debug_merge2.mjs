import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const S = (p) => path.join(__dirname, path.basename(p));
const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickBtn(page, pattern) {
  const btn = page.getByRole('button', { name: pattern }).first();
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click();
  return btn;
}

async function mainBtn(page, pattern) {
  const btn = page.locator('main').getByRole('button', { name: pattern }).first();
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click();
  return btn;
}

async function expectMainDownload(page, pattern, timeout = 60000) {
  const dlPromise = page.waitForEvent('download', { timeout });
  await mainBtn(page, pattern);
  return dlPromise.catch(() => null);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
});
const page = await ctx.newPage();
await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
await waitMs(2500);
const privacy = page.getByRole('button', { name: /我已了解|知道了|确认/ }).first();
if (await privacy.isVisible().catch(() => false)) await privacy.click();

await page.getByRole('button', { name: 'PDF 工坊' }).first().click();
await waitMs(400);

// exact test flow
await clickBtn(page, 'PDF 合并');
await page.locator('main input[type=file]').first().setInputFiles([S('multi_page.pdf'), S('sample_table.pdf')]);
await waitMs(1200);
const dl = await expectMainDownload(page, '合并 PDF', 60000);
console.log('result:', dl ? dl.suggestedFilename() : 'FAIL');
const err = await page.locator('main').getByText(/错误|失败|need/i).first().textContent().catch(() => '');
if (err) console.log('error text:', err);
await browser.close();
