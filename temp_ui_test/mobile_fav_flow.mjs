/* 收藏完整链路：PDF 工坊点星标 → 收藏页出现 → 底部导航联动 */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0,120)));
await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const agree = page.locator('text=我已了解，放心使用').first();
if (await agree.isVisible().catch(() => false)) await agree.click();

// 进 PDF 工坊首页
await page.locator('button[title*="PDF 工坊"]:visible').last().click();
await page.waitForTimeout(900);
// 点第一个工具卡右上角星标
const star = page.locator('button:has(svg.lucide-star)').first();
await star.click({ force: true });
await page.waitForTimeout(500);
// 底部导航进收藏页
await page.locator('nav >> text=收藏').last().click();
await page.waitForTimeout(900);
const favText = await page.evaluate(() => document.body.innerText.slice(0, 600));
const hasFav = favText.includes('PDF 合并') || favText.includes('页面整理') || /我的收藏[\s\S]*?[1-9]/.test(favText);
console.log('FAV-HAS-ITEM:', hasFav);
console.log('FAV-TEXT:', favText.split('\n').slice(0, 14).join(' | '));
await page.screenshot({ path: 'C:/Users/Zonlic/Desktop/ZonScale/temp_ui_test/shots_mnav/05_fav_with_item.png' });
// 点击收藏项应跳到对应工具
const item = page.locator('text=PDF 合并').first();
if (await item.count()) {
  await item.click();
  await page.waitForTimeout(900);
  const t = await page.evaluate(() => document.body.innerText.slice(0, 300));
  console.log('JUMPED-TO-MERGE:', t.includes('PDF 合并') && !t.includes('还没有收藏'));
  await page.screenshot({ path: 'C:/Users/Zonlic/Desktop/ZonScale/temp_ui_test/shots_mnav/06_jump_merge.png' });
}
console.log('PAGE-ERRORS:', errs.slice(0,3));
await browser.close(); process.exit(0);
