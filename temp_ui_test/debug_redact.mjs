/** 调试：工程图纸脱敏流程（手机视口）—— 步骤截图 + 网络监听 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5173';
const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));
const S = (p) => path.join(__dirname, p);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true, hasTouch: true, acceptDownloads: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
const netlog = [];
page.on('request', (r) => { if (r.url().includes('/api/')) netlog.push(`>> ${r.method()} ${r.url().slice(BASE.length)}`); });
page.on('response', (r) => { if (r.url().includes('/api/')) netlog.push(`<< ${r.status()} ${r.url().slice(BASE.length)}`); });
page.on('download', (d) => netlog.push(`DOWNLOAD: ${d.suggestedFilename()}`));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await waitMs(2000);
const privacy = page.getByRole('button', { name: /我已了解/ });
if (await privacy.isVisible().catch(() => false)) await privacy.click();
await waitMs(500);

await page.locator('input[type="file"]').first().setInputFiles(S('sample_drawing.pdf'));
console.log('uploaded, waiting hits...');
await page.getByText(/敏感命中|未检出工程敏感项/).first().waitFor({ timeout: 90000 });
await waitMs(1000);
await page.screenshot({ path: 'shots_full/debug_redact_1_hits.png' });

// 列出所有含关键词的按钮
const btns = await page.getByRole('button').allTextContents();
console.log('BUTTONS:', JSON.stringify(btns.filter((t) => /执行|脱敏|导出|下载|批量/.test(t))));

// 点击执行按钮
const execBtn = page.getByRole('button', { name: /执行脱敏|一键脱敏|执行已选/ }).first();
console.log('exec visible:', await execBtn.isVisible().catch(() => false), 'enabled:', await execBtn.isEnabled().catch(() => false));
await execBtn.click({ timeout: 5000 }).catch((e) => console.log('CLICK FAILED:', String(e).slice(0, 200)));
await waitMs(6000);
await page.screenshot({ path: 'shots_full/debug_redact_2_after_exec.png' });

// 抓 toast
const toast = await page.locator('.memphis-toast').allTextContents().catch(() => []);
console.log('TOAST:', JSON.stringify(toast));
console.log('URL now:', page.url());
await waitMs(5000);
console.log('URL after 5s:', page.url());
console.log('NETLOG:\n' + netlog.join('\n'));
await page.screenshot({ path: 'shots_full/debug_redact_3_final.png' });
await browser.close();
