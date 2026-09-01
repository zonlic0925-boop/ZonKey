/* 壳内模拟：向 window 注入 pywebview 对象后重载，验证 drag 层与 no-drag 豁免 */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  Object.defineProperty(window, 'pywebview', {
    value: {
      api: {
        minimize: async () => {},
        toggle_maximize: async () => {},
        restore: async () => {},
        is_maximized: async () => false,
        close: async () => {},
      },
    },
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
  const drags = [...document.querySelectorAll('div')].filter((d) => {
    return (d.getAttribute('style') || '').includes('app-region: drag');
  });
  const rects = drags.map((d) => {
    const b = d.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height };
  });
  // Header 内 no-drag 组
  const noDrags = [...document.querySelectorAll('.no-drag')].map((d) => {
    const b = d.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, region: (d.getAttribute('class') || '') };
  });
  const card = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('页面整理'));
  const cb = card?.getBoundingClientRect();
  const pb = document.querySelector('.zs-mobile-scroll-x')?.getBoundingClientRect();
  const overlaps = (a, b) => a && b && !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
  return {
    dragCount: drags.length,
    rects,
    noDragCount: noDrags.length,
    dragOverlapsSubNav: rects.some((d) => overlaps(d, pb)),
    dragOverlapsCard: rects.some((d) => overlaps(d, cb)),
    winCtrlVisible: await_page_visible(),
  };
  function await_page_visible() {
    const el = document.querySelector('.zs-win-ctrl');
    if (!el) return false;
    const b = el.getBoundingClientRect();
    return b.width > 0;
  }
});
console.log(JSON.stringify(r, null, 1));
const ok =
  r.dragCount === 2 &&
  r.rects.every((x) => x.top === 0 && x.bottom <= 80.5) &&
  !r.dragOverlapsSubNav &&
  !r.dragOverlapsCard &&
  r.winCtrlVisible;
console.log(ok ? 'DRAGSTRIP OK (shell-sim)' : 'DRAGSTRIP FAIL');
await browser.close();
process.exit(ok ? 0 : 1);
