/**
 * Round-10 聚焦诊断：blur 后页面是否卡死、按钮是否存在、RAF 是否运行。
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.ZS_URL || 'http://localhost:5199/';
const SAMPLE = process.env.ZS_SAMPLE || path.join(__dirname, 'multi_page.pdf');

const t0 = Date.now();
const log = (...a) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => log('PAGEERROR:', String(e).slice(0, 300)));

// 主线程心跳：evaluate 里挂一个 300ms setTimeout，看多久回来
const heartbeat = async (label) => {
  const start = Date.now();
  try {
    const r = await page.evaluate(() => new Promise((res) => setTimeout(() => res('beat'), 300)));
    log(`${label}: heartbeat ok in ${Date.now() - start}ms (r=${r})`);
    return true;
  } catch (e) {
    log(`${label}: heartbeat FAIL ${Date.now() - start}ms: ${String(e).slice(0, 200)}`);
    return false;
  }
};

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  try { await page.getByRole('button', { name: /我已了解|知道了|OK|了解/i }).click({ force: true }); } catch {}
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'PDF 工坊' }).first().click({ force: true });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '页面整理' }).first().click({ force: true });
  await page.waitForTimeout(800);
  await page.setInputFiles('input[type=file][accept=".pdf"]', SAMPLE);
  await page.waitForTimeout(5000);

  const imgBox = await page.locator('img[alt="Page Preview"]').boundingBox();
  log('preview:', JSON.stringify(imgBox));

  const toolbar = page.locator('div.shrink-0.flex.items-center.p-2.gap-2.border-b-2');
  await toolbar.locator('button:has(svg.lucide-type):not([title])').click({ force: true });
  await page.waitForTimeout(300);
  await page.mouse.click(imgBox.x + imgBox.width / 2, imgBox.y + imgBox.height / 2);
  await page.waitForTimeout(600);
  await heartbeat('after create');

  const ce = page.locator('[contenteditable="true"]').first();
  await ce.dblclick({ force: true });
  await page.waitForTimeout(300);
  await page.keyboard.type('测试TEXT-123', { delay: 40 });
  await page.waitForTimeout(600);
  await heartbeat('after typing');

  // blur：点画布空白
  await page.mouse.click(imgBox.x + 30, imgBox.y + 30);
  await page.waitForTimeout(800);
  await heartbeat('after blur');

  // 诊断 DOM
  const diag = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter((t) => t.length < 30);
    return {
      exportBtn: btns.filter((t) => t.includes('保存并导出')).length,
      bodyChildren: document.body.children.length,
      bodyHtmlLen: document.body.innerHTML.length,
      modalCount: document.querySelectorAll('[class*=backdrop]').length,
      allBtns: btns.slice(-15),
    };
  });
  log('diag:', JSON.stringify(diag, null, 1));

  // 尝试直接 JS 点击导出（绕过 Playwright actionability）
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('保存并导出'));
    if (!btn) return 'NOT FOUND';
    btn.click();
    return 'clicked';
  });
  log('export via JS:', clicked);
  await page.waitForTimeout(2500);
  await heartbeat('after export');

  // 最终快照
  const snap = await page.evaluate(() => ({
    bodyHtmlLen: document.body.innerHTML.length,
    contentEditable: document.querySelectorAll('[contenteditable]').length,
  }));
  log('final snap:', JSON.stringify(snap));
} catch (e) {
  log('SCRIPT ERROR:', String(e).slice(0, 400));
}
await browser.close();
process.exit(0);
