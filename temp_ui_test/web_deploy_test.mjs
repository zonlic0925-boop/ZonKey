import { chromium } from 'playwright';
const BASE = 'https://zonscale.pages.dev';
const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await waitMs(1500);
const title = await page.title();
// 打开 PDF 工坊 → 合并（纯前端，公网应可用）
await page.getByRole('button', { name: 'PDF 工坊' }).first().click();
await waitMs(500);
await page.getByRole('button', { name: 'PDF 合并' }).first().click();
await waitMs(500);
const addBtn = await page.getByRole('button', { name: /添加 PDF|选择 PDF/ }).first().isVisible().catch(() => false);
// PPT 工坊 → 大纲生成（纯前端）
await page.getByRole('button', { name: 'PPT 工坊' }).first().click();
await waitMs(500);
await page.getByRole('button', { name: '大纲生成' }).first().click();
await waitMs(400);
await page.getByPlaceholder('例如：ZonScale 智能脱敏工作台介绍').fill('公网部署验证');
await page.getByRole('button', { name: '生成大纲' }).first().click();
await page.getByText(/已生成 \d+ 页大纲/).first().waitFor({ timeout: 10000 });
console.log(JSON.stringify({ title, pdfMergeViewOk: addBtn, pptOutlineOk: true, pageErrors: errors }));
await browser.close();
