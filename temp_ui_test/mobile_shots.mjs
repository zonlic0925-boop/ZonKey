import { chromium } from 'playwright';
const BASE = process.env.TARGET || 'http://127.0.0.1:8765';
const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await waitMs(1500);
await page.screenshot({ path: 'shots/m2_01_home.png' });
for (const [pill, name] of [['PDF 工坊', 'm2_02_pdf'], ['PPT 工坊', 'm2_03_ppt'], ['规则中心', 'm2_04_rules'], ['审计日志', 'm2_05_audit']]) {
  await page.getByRole('button', { name: pill }).first().click();
  await waitMs(700);
  await page.screenshot({ path: `shots/${name}.png` });
}
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('overflowPx:', overflow);
await browser.close();
