/* SubNav 实际位置 vs drag 条（80px）——找出 overlap 的真实坐标 */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  Object.defineProperty(window, 'pywebview', {
    value: { api: { minimize: async () => {}, toggle_maximize: async () => {}, restore: async () => {}, is_maximized: async () => false, close: async () => {} } },
    configurable: true,
  });
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const agree = page.locator('text=我已了解，放心使用').first();
if (await agree.isVisible().catch(() => false)) await agree.click();
await page.waitForTimeout(500);
await page.locator('button:has-text("PDF 工坊")').first().click();
await page.waitForTimeout(900);
const r = await page.evaluate(() => {
  const pb = document.querySelector('.zs-mobile-scroll-x')?.getBoundingClientRect();
  const hb = document.querySelector('header')?.getBoundingClientRect();
  return { subNav: pb ? { top: pb.top, bottom: pb.bottom } : null, header: hb ? { top: hb.top, bottom: hb.bottom } : null };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
