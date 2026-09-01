/* SubNav 行内星标：当前工具 toggle 收藏 → 首页收藏区同步 */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  localStorage.setItem('zonscale.privacyNotice.ack.v1', '1');
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

// 进入智能脱敏 → 规则策略中心（redact 原生工具）
await page.locator('button:has-text("规则策略中心"), button[title="规则策略中心"]').first().click().catch(async () => {
  await page.locator('header button:has-text("规则")').first().click();
});
await page.waitForTimeout(900);

// SubNav 行内星标（aria-label=收藏此工具）
const star = page.locator('button[aria-label="收藏此工具"]').first();
const starVisible = await star.isVisible().catch(() => false);
console.log('star visible in subnav:', starVisible);
if (starVisible) {
  await star.click();
  await page.waitForTimeout(400);
  // localStorage 已写入
  const favs = await page.evaluate(() => JSON.parse(localStorage.getItem('zonscale.favoriteTools.v1') || '[]'));
  console.log('favorites after toggle:', favs);
  // 回首页看 chip
  await page.locator('button[title="欢迎来到 ZonScale"]').first().click();
  await page.waitForTimeout(700);
  const chipVisible = await page.locator('button:has-text("规则策略中心")').first().isVisible().catch(() => false);
  console.log('home shows chip 规则策略中心:', chipVisible);
}
console.log('pageerrors:', errs.length);
await page.screenshot({ path: 'shots_homenav/subnav_star.png' });
await browser.close();
