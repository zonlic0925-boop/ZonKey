/* 精确找 SubNav 条（App.tsx 里 SubNavPills 外层 div：relative z-30 shrink-0 w-full） */
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
  // SubNavPills 根 div 含 class bg-white border-2 border-mem-ink rounded-xl
  const pillsRoot = document.querySelector('div.bg-white.border-2.border-mem-ink.rounded-xl');
  const pb = pillsRoot?.getBoundingClientRect();
  const drags = [...document.querySelectorAll('div')].filter((d) => (d.getAttribute('style') || '').includes('app-region: drag'));
  const db = drags[0]?.getBoundingClientRect();
  const overlaps = (a, b) => a && b && !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top);
  // 内容区第一张工具卡
  const card = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '页面整理');
  const cb = card?.getBoundingClientRect();
  return {
    subNav: pb ? { top: pb.top, bottom: pb.bottom } : null,
    drag0: db ? { top: db.top, bottom: db.bottom, right: db.right } : null,
    overlapSubNav: overlaps(db, pb),
    overlapCard: overlaps(db, cb),
    cardTop: cb?.top,
  };
});
console.log(JSON.stringify(r, null, 1));
const ok = r.subNav && r.drag0 && !r.overlapSubNav && !r.overlapCard && r.drag0.bottom <= 80.5;
console.log(ok ? 'DRAGSTRIP OK' : 'DRAGSTRIP FAIL');
await browser.close();
process.exit(ok ? 0 : 1);
