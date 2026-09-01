/* 拖拽层几何检查：drag 区只覆盖 Header 品牌行，不覆盖 SubNav/内容区 */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const agree = page.locator('text=我已了解，放心使用').first();
if (await agree.isVisible().catch(() => false)) await agree.click();
await page.waitForTimeout(500);
// 进入 PDF 工坊让 SubNav 与内容区出现
await page.locator('button:has-text("PDF 工坊")').first().click();
await page.waitForTimeout(900);

const r = await page.evaluate(() => {
  // 找出带 app-region: drag 的固定层
  const drags = [...document.querySelectorAll('div')].filter((d) => {
    const s = getComputedStyle(d);
    return (s.appRegion || '') === 'drag';
  });
  const rects = drags.map((d) => {
    const b = d.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, hidden: b.width === 0 };
  });
  // 内容区第一工具卡位置
  const card = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('页面整理'));
  const cb = card?.getBoundingClientRect();
  // SubNav 位置
  const pills = document.querySelector('.zs-mobile-scroll-x');
  const pb = pills?.getBoundingClientRect();
  const overlaps = (a, b) => a && b && !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
  return {
    dragRects: rects,
    dragOverlapsSubNav: rects.some((d) => !d.hidden && overlaps(d, pb)),
    dragOverlapsCard: rects.some((d) => !d.hidden && overlaps(d, cb)),
    subNavTop: pb?.top,
    cardTop: cb?.top,
  };
});
console.log(JSON.stringify(r, null, 1));
const ok =
  r.dragRects.length === 2 &&
  r.dragRects.every((x) => !x.hidden && x.top === 0 && x.bottom <= 80.5) &&
  !r.dragOverlapsSubNav &&
  !r.dragOverlapsCard;
console.log(ok ? 'DRAGSTRIP OK' : 'DRAGSTRIP FAIL');
await browser.close();
process.exit(ok ? 0 : 1);
