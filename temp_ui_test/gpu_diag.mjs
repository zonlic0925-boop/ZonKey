import { chromium } from 'playwright';
const URL = process.env.ZS_URL || 'http://127.0.0.1:8902/';
// 软件 raster（模拟 GPU 受限/驱动异常的 WebView2 环境下 Chromium 的表现）
const browser = await chromium.launch({ args: ['--disable-gpu', '--use-gl=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
const t0 = Date.now();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
// 轮询等 React 首帧（引擎条出现），最多 20s
let mounted = false;
for (let i = 0; i < 100; i++) {
  if (await page.locator('header').count()) { mounted = true; break; }
  await page.waitForTimeout(200);
}
const dt = Date.now() - t0;
console.log(`${mounted ? 'PASS' : 'FAIL'} 软渲染首帧挂载 — ${dt}ms, pageerrors=${errs.length} ${errs.join('; ').slice(0, 200)}`);
const blobs = await page.evaluate(() => document.querySelectorAll('.zs-fluid-blob').length);
console.log(`${blobs === 3 ? 'PASS' : 'FAIL'} 软渲染流体层渲染 — blobs=${blobs}`);
await browser.close();
process.exit(mounted && blobs === 3 ? 0 : 1);
