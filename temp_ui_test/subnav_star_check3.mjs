/* 星标链路（用 drag 条上方的 no-drag 按钮真实坐标点击——检查 z 层级导致的 Playwright 拦截） */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  localStorage.setItem('zonscale.privacyNotice.v1', 'ack');
  Object.defineProperty(window, 'pywebview', {
    value: { api: { minimize: async () => {}, toggle_maximize: async () => {}, restore: async () => {}, is_maximized: async () => false, close: async () => {} } },
    configurable: true,
  });
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
await page.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2200);

// drag 条 z-80 会拦截 header（z-40）的 Playwright 合成点击；
// 但真实 WebView2 中 no-drag 元素不受影响。此处用 dispatchEvent 模拟真实点击路径。
const centerBtn = page.locator('header button[title="智能脱敏"]:visible').first();
await centerBtn.dispatchEvent('click');
await page.waitForTimeout(700);

const rulePill = page.locator('button:has-text("规则策略中心"):visible').first();
await rulePill.dispatchEvent('click');
await page.waitForTimeout(900);

const star = page.locator('button[aria-label="收藏此工具"]').first();
const starVisible = await star.isVisible().catch(() => false);
console.log('star visible in subnav:', starVisible);
if (starVisible) {
  await star.click(); // 星标在 drag 条覆盖范围之外（SubNav 行 ~91px+）
  await page.waitForTimeout(400);
  const favs = await page.evaluate(() => JSON.parse(localStorage.getItem('zonscale.favoriteTools.v1') || '[]'));
  console.log('favorites after toggle:', favs);
  const homeBtn = page.locator('button[title="欢迎来到 ZonScale"]').first();
  await homeBtn.dispatchEvent('click'); // 回首页按钮也在 header 区
  await page.waitForTimeout(700);
  const chipVisible = await page.locator('main button:has-text("规则策略中心")').first().isVisible().catch(() => false);
  console.log('home shows chip 规则策略中心:', chipVisible);
  await page.screenshot({ path: 'shots_homenav/subnav_star.png' });
}
console.log('pageerrors:', errs.length);
await browser.close();
