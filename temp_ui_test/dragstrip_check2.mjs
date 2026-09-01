/* 检查 -webkit-app-region computed style（Chromium 用 webkit 前缀属性名） */
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
const r = await page.evaluate(() => {
  const drags = [...document.querySelectorAll('div')].filter((d) => {
    const s = getComputedStyle(d);
    return (s.getPropertyValue('-webkit-app-region') || '').trim() === 'drag';
  });
  const rects = drags.map((d) => {
    const b = d.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height, cls: d.className.slice(0, 40) };
  });
  // no-drag 豁免验证：中央导航（nav 元素）
  const nav = document.querySelector('header nav');
  const navRegion = nav ? getComputedStyle(nav).getPropertyValue('-webkit-app-region') : 'n/a';
  const card = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('页面整理'));
  const cb = card?.getBoundingClientRect();
  const pb = document.querySelector('.zs-mobile-scroll-x')?.getBoundingClientRect();
  const overlaps = (a, b) => a && b && !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
  return {
    rects,
    navAppRegion: navRegion,
    dragOverlapsSubNav: rects.some((d) => overlaps(d, pb)),
    dragOverlapsCard: rects.some((d) => overlaps(d, cb)),
  };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
