/* 逐属性排查 app-region 落地情况 */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5199/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const r = await page.evaluate(() => {
  // WindowDragStrip 是否存在于 DOM（shellMode=false 时不渲染——浏览器里就是没有！）
  const all = [...document.querySelectorAll('div[aria-hidden="true"]')];
  return {
    ariaHiddenDivs: all.length,
    inlineStyles: all.slice(0, 5).map((d) => d.getAttribute('style')),
  };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
