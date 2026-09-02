/* 用 title 属性精确定位中心按钮 */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  localStorage.setItem('zonkey.privacyNotice.v1', 'ack');
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

// Header 中心按钮带 title=中心名
const redactBtn = page.locator('header button[title="智能脱敏"]:visible').first();
await redactBtn.click();
await page.waitForTimeout(700);
// 进入后 SubNav 有 5 个工具 pill（工程图纸脱敏/通用行政公文/Word 文档脱敏/规则策略中心/审计日志追踪）
const rulePill = page.locator('button:has-text("规则策略中心")').first();
await rulePill.click();
await page.waitForTimeout(900);

const star = page.locator('button[aria-label="收藏此工具"]').first();
const starVisible = await star.isVisible().catch(() => false);
console.log('star visible in subnav:', starVisible);
if (starVisible) {
  await star.click();
  await page.waitForTimeout(400);
  const favs = await page.evaluate(() => JSON.parse(localStorage.getItem('zonkey.favoriteTools.v1') || '[]'));
  console.log('favorites after toggle:', favs);
  await page.locator('button[title="欢迎来到 ZonKey"]').first().click();
  await page.waitForTimeout(700);
  const chipVisible = await page.locator('main button:has-text("规则策略中心")').first().isVisible().catch(() => false);
  console.log('home shows chip 规则策略中心:', chipVisible);
  await page.screenshot({ path: 'shots_homenav/subnav_star.png' });
}
console.log('pageerrors:', errs.length);
await browser.close();
