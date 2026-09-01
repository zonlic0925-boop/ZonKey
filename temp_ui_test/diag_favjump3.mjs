import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const agree = page.locator('text=我已了解，放心使用').first();
if (await agree.isVisible().catch(() => false)) await agree.click();
await page.waitForTimeout(500);
await page.locator('button:has-text("PDF 工坊")').first().click();
await page.waitForTimeout(900);
await page.locator('button[aria-label="收藏此工具"]').first().click();
await page.waitForTimeout(300);
await page.locator('button[title="欢迎来到 ZonScale"]').first().click();
await page.waitForTimeout(800);
// 首页上「页面整理」chip 与「页面整理」pill 同名：first() 可能点中隐藏/别的元素
const chips = page.locator('button:has-text("页面整理")');
console.log('match count:', await chips.count());
for (let i = 0; i < await chips.count(); i++) {
  const el = chips.nth(i);
  console.log(i, 'visible=', await el.isVisible(), 'cls=', (await el.getAttribute('class'))?.slice(0, 60));
}
await browser.close();
