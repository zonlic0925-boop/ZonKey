/** Round-10 抓完整堆栈：blur TypeError 的触发栈 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.ZS_URL || 'http://localhost:5199/';
const SAMPLE = process.env.ZS_SAMPLE || path.join(__dirname, 'multi_page.pdf');

const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('=== PAGEERROR FULL STACK ===\n', e.stack || String(e)));

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
const toolbar = page.locator('div.shrink-0.flex.items-center.p-2.gap-2.border-b-2');
await toolbar.locator('button:has(svg.lucide-type):not([title])').click({ force: true });
await page.waitForTimeout(300);
await page.mouse.click(imgBox.x + imgBox.width / 2, imgBox.y + imgBox.height / 2);
await page.waitForTimeout(600);

const ce = page.locator('[contenteditable="true"]').first();
await ce.dblclick({ force: true });
await page.waitForTimeout(300);
await page.keyboard.type('测试TEXT-123', { delay: 40 });
await page.waitForTimeout(1500);
console.log('=== typed. body children:', await page.evaluate(() => document.body.children.length));

await page.mouse.click(imgBox.x + 30, imgBox.y + 30);
await page.waitForTimeout(1000);
console.log('=== after click blank. body children:', await page.evaluate(() => document.body.children.length));
await browser.close();
process.exit(0);
