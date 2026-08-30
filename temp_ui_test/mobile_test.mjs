import { chromium } from 'playwright';
const BASE = process.env.TARGET || 'http://127.0.0.1:8765';
const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },          // iPhone 14 尺寸
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  isMobile: true, hasTouch: true, deviceScaleFactor: 3,
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await waitMs(1500);
await page.screenshot({ path: 'shots/mobile_01_home.png' });
// 智能脱敏（原生）入口可见性
const navLabels = ['智能脱敏', 'PDF 工坊', 'PPT 工坊', '图像工坊', '计算开发', '系统硬件'];
const visible = {};
for (const label of navLabels) {
  visible[label] = await page.getByRole('button', { name: label }).first().isVisible().catch(() => false);
}
// 横向溢出检测（手机端最常见的布局问题）
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
// PDF 工坊手机视图
await page.getByRole('button', { name: 'PDF 工坊' }).first().click();
await waitMs(600);
await page.screenshot({ path: 'shots/mobile_02_pdf.png' });
// 后端状态（公网隧道时验证 API 连通）
const status = await page.evaluate(async () => {
  try { const r = await fetch('/api/status'); return (await r.json()).backend; } catch { return 'unreachable'; }
});
console.log(JSON.stringify({ title: await page.title(), navVisible: visible, horizontalOverflowPx: overflow, backend: status }));
await browser.close();
