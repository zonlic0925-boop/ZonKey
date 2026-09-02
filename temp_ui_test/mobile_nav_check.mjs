/* 手机端导航+收藏 实机检查（390×844）：截图 + 溢出 + 交互链路 */
import { chromium } from 'playwright';
const SHOTS = 'C:/Users/Zonlic/Desktop/ZonKey/temp_ui_test/shots_mnav';
import fs from 'fs';
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0,120)));
await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const agree = page.locator('text=我已了解，放心使用').first();
if (await agree.isVisible().catch(() => false)) await agree.click();
await page.waitForTimeout(600);

const out = [];
// 0) 横向溢出检测
out.push(['hOverflow-home', await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)]);
await page.screenshot({ path: SHOTS + '/01_home.png' });

// 1) 底部导航存在且可见
const bottomNav = page.locator('nav').last();
const navVisible = await bottomNav.isVisible().catch(() => false);
out.push(['bottomNav-visible', navVisible]);
await page.screenshot({ path: SHOTS + '/02_bottomnav.png' });

// 2) 底部导航文本
const navText = await page.evaluate(() => {
  const navs = [...document.querySelectorAll('nav')];
  const last = navs[navs.length - 1];
  return last ? last.innerText.replace(/\n/g, '|') : 'NO NAV';
});
out.push(['bottomNav-text', navText]);

// 3) 点收藏 tab（若存在）
const favTab = page.locator('nav >> text=收藏').last();
if (await favTab.count()) {
  await favTab.click().catch(e => out.push(['fav-click-err', e.message.split('\n')[0]]));
  await page.waitForTimeout(800);
  out.push(['hOverflow-fav', await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)]);
  await page.screenshot({ path: SHOTS + '/03_favorites.png' });
  const favText = await page.evaluate(() => document.body.innerText.slice(0, 400).replace(/\n+/g, '|'));
  out.push(['fav-page-text', favText.slice(0, 200)]);
} else {
  out.push(['fav-tab', 'NOT FOUND']);
}

// 4) 去 PDF 工坊看星标
const pdfBtn = page.locator('button[title*="PDF"]:visible').last();
if (await pdfBtn.count()) {
  await pdfBtn.click();
  await page.waitForTimeout(900);
  const starCount = await page.locator('button:has(svg.lucide-star), [class*="star"]').count();
  out.push(['star-in-pdfhome', starCount]);
  out.push(['hOverflow-pdf', await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)]);
  await page.screenshot({ path: SHOTS + '/04_pdfhome.png' });
}
await browser.close();
console.log(JSON.stringify(out, null, 1));
console.log('PAGE-ERRORS:', errs.slice(0, 3));
