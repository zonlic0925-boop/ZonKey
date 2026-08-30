/** Quick PDF Studio smoke test — merge/split/to-image tabs */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sample = path.join(__dirname, 'sample_drawing.pdf');
const BASE = 'http://127.0.0.1:8765';

async function testTab(page, tabName, action) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'PDF 工坊' }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: tabName }).click();
  await page.waitForTimeout(400);
  const bodyText = await page.locator('main').innerText();
  const empty = bodyText.trim().length < 20;
  let actionResult = 'skipped';
  try {
    actionResult = await action(page);
  } catch (e) {
    actionResult = `FAIL: ${e.message}`;
  }
  return { tab: tabName, empty, actionResult, errors: errors.slice(0, 3) };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  results.push(await testTab(page, 'PDF 合并', async (p) => {
    const input = p.locator('input[type=file]').first();
    if (!(await input.count())) return 'no file input';
    return 'has file input';
  }));

  results.push(await testTab(page, 'PDF 转图片', async (p) => {
    const input = p.locator('input[type=file]').first();
    await input.setInputFiles(sample);
    await p.getByRole('button', { name: /导出图片|Export/ }).click();
    await p.waitForTimeout(8000);
    const err = await p.locator('text=/Error|失败|Invalid|worker/i').first().textContent().catch(() => null);
    const list = await p.locator('ul li').count();
    return err ? `error: ${err}` : `outputs=${list}`;
  }));

  results.push(await testTab(page, 'PDF 加密', async (p) => {
    const input = p.locator('input[type=file]').first();
    await input.setInputFiles(sample);
    await p.locator('input[type=password]').first().fill('test1234');
    await p.getByRole('button', { name: /加密/ }).click();
    await p.waitForTimeout(5000);
    const err = await p.locator('[class*="text-mem-coral"], .text-red').first().textContent().catch(() => null);
    return err || 'clicked ok';
  }));

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}

main();
