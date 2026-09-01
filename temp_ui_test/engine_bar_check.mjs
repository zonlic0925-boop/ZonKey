import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => {
  Object.defineProperty(window, 'pywebview', { value: { api: {} }, configurable: true });
});
const page = await ctx.newPage();
await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3200);
const agree = page.locator('text=我已了解，放心使用').first();
if (await agree.isVisible().catch(() => false)) { await agree.click(); await page.waitForTimeout(500); }
const r = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-drag-row]')];
  const deskRow = rows.find((el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0);
  if (!deskRow) return { error: 'no visible drag row', count: rows.length };
  const cs = getComputedStyle(deskRow);
  const engine = [...deskRow.querySelectorAll('div')].find((d) => (d.getAttribute('class') || '').includes('bg-mem-lime/30'));
  const eb = engine?.getBoundingClientRect();
  return {
    paddingRight: cs.paddingRight,
    engineRight: eb?.right,
    engineWidth: eb?.width,
    vw: window.innerWidth,
    budget: window.innerWidth - (cs.paddingRight === '150px' ? 150 : 0) - 24,
  };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
