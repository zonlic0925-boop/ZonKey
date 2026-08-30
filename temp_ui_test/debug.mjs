import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto('http://127.0.0.1:8765', { waitUntil: 'networkidle' });
  await page.locator('.backdrop-blur-sm').waitFor({ state: 'detached', timeout: 5000 }).catch(()=>{});
  await page.getByRole('button', { name: /我已了解/ }).click({ force: true }).catch(()=>{});
  await page.getByRole('button', { name: 'PDF 工坊' }).first().click({ force: true });
  await page.waitForTimeout(1000);
  
  await page.screenshot({ path: 'pdf_center.png' });
  await browser.close();
})();
