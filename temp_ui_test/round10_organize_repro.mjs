/**
 * Round-10 复现：PDF 工坊「页面整理」编辑文字白屏卡死。
 * 用户实测路径：上传 PDF → 文字工具 → 画布点击建文字 → 编辑文字 → 改属性 → 导出。
 * 监听 pageerror / console error / 页面存活与响应性。
 * 跑法：先起 vite dev（port 5199），node temp_ui_test/round10_organize_repro.mjs
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
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (e) => { pageErrors.push(String(e).slice(0, 500)); log('PAGEERROR:', String(e).slice(0, 300)); });
page.on('console', (m) => {
  if (m.type() === 'error') { consoleErrors.push(m.text().slice(0, 300)); log('CONSOLE-ERR:', m.text().slice(0, 200)); }
});

const isAlive = async (label) => {
  try {
    const r = await page.evaluate(() => ({ body: !!document.body, ce: document.querySelectorAll('[contenteditable]').length }));
    log(`${label}: alive, body=${r.body}, contentEditable=${r.ce}`);
    return true;
  } catch (e) {
    log(`${label}: EVAL FAIL -> ${String(e).slice(0, 200)}`);
    return false;
  }
};

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  // 隐私弹窗（首访）
  try { await page.getByRole('button', { name: /我已了解|知道了|OK|了解/i }).click({ force: true }); } catch {}
  await page.waitForTimeout(800);

  // 进入 PDF 工坊
  await page.getByRole('button', { name: 'PDF 工坊' }).first().click({ force: true });
  await page.waitForTimeout(1000);
  // 切「页面整理」pill
  await page.getByRole('button', { name: '页面整理' }).first().click({ force: true });
  await page.waitForTimeout(800);

  // 上传样张
  await page.setInputFiles('input[type=file][accept=".pdf"]', SAMPLE);
  await page.waitForTimeout(5000);

  const imgBox = await page.locator('img[alt="Page Preview"]').boundingBox();
  log('preview img box:', JSON.stringify(imgBox));
  if (!imgBox) throw new Error('预览图未出现，页面整理渲染失败');

  // 文字工具按钮（编辑器工具栏行内，避开导航里的文本工坊图标）
  const toolbar = page.locator('div.shrink-0.flex.items-center.p-2.gap-2.border-b-2');
  await toolbar.locator('button:has(svg.lucide-type):not([title])').click({ force: true });
  await page.waitForTimeout(300);

  // 画布中心点击 → 建文字元素
  await page.mouse.click(imgBox.x + imgBox.width / 2, imgBox.y + imgBox.height / 2);
  await page.waitForTimeout(600);
  await isAlive('after create text');

  // 双击文字元素 → contentEditable 获得焦点
  const ce = page.locator('[contenteditable="true"]').first();
  if ((await ce.count()) === 0) throw new Error('文字元素未创建（contentEditable 不存在）');
  await ce.dblclick({ force: true });
  await page.waitForTimeout(300);

  // 键入中英文（模拟用户编辑文字）
  await page.keyboard.type('测试TEXT-123', { delay: 50 });
  await page.waitForTimeout(600);
  await isAlive('after typing');

  // 点击空白处 → blur → setElements 回写
  await page.mouse.click(imgBox.x + 40, imgBox.y + 40);
  await page.waitForTimeout(600);
  await isAlive('after blur');

  // 改颜色（上下文属性面板 color input）
  const colorInput = page.locator('input[type=color]').first();
  if ((await colorInput.count()) > 0) {
    await colorInput.fill('#ff0000').catch((e) => log('color fill err:', String(e).slice(0, 150)));
    await page.waitForTimeout(500);
    await isAlive('after color change');
  }

  // 改字号
  const sizeInput = page.locator('input[type=number]').first();
  if ((await sizeInput.count()) > 0) {
    await sizeInput.fill('36');
    await page.waitForTimeout(500);
    await isAlive('after font-size change');
  }

  // 导出
  await page.getByRole('button', { name: /保存并导出/ }).click({ force: true });
  await page.waitForTimeout(3000);
  await isAlive('after export');

  // 响应性终检（1s 内 evaluate 应返回）
  const responsive = await Promise.race([
    page.evaluate(() => 'responsive-ok').then(() => true),
    new Promise((r) => setTimeout(() => r(false), 1500)),
  ]);
  log('final responsive:', responsive);
} catch (e) {
  log('SCRIPT ERROR:', String(e).slice(0, 400));
}

log('=== pageErrors:', pageErrors.length, JSON.stringify(pageErrors, null, 1));
log('=== consoleErrors:', consoleErrors.length, JSON.stringify(consoleErrors.slice(0, 12), null, 1));
await browser.close();
process.exit(0);
