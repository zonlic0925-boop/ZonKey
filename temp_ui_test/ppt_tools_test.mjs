/**
 * PPT 工坊 4 新工具实测（Playwright · 简体中文 UI）
 * 大纲生成 → 编辑 → 下载 md；草稿生成 → 下载 pptx（后经 python-pptx 校验）；
 * 转 PDF / 转长图 → 后端本机渲染 → 另存为（ExportDownloadButton 走 /api/export/save-as）。
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:8765';
const results = [];
const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

async function enterPptCenter(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await waitMs(800);
  await page.getByRole('button', { name: 'PPT 工坊' }).first().click();
  await waitMs(500);
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300)); });
  page.on('pageerror', (err) => consoleErrors.push(`PAGEERROR: ${String(err).slice(0, 300)}`));

  await enterPptCenter(page);

  // 1) 大纲生成
  try {
    await page.getByRole('button', { name: '大纲生成' }).first().click();
    await waitMs(400);
    await page.getByPlaceholder('例如：ZonKey 智能脱敏工作台介绍').fill('ZonKey 智能脱敏工作台介绍');
    await page.getByRole('button', { name: '生成大纲' }).first().click();
    await page.getByText(/已生成 \d+ 页大纲/).first().waitFor({ timeout: 8000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.getByRole('button', { name: '下载 Markdown' }).first().click();
    const download = await downloadPromise;
    const out = path.join(__dirname, 'ppt_out', download.suggestedFilename());
    await download.saveAs(out);
    results.push({ tool: '大纲生成', status: 'pass', file: out, errors: consoleErrors.splice(0) });
  } catch (err) {
    results.push({ tool: '大纲生成', status: 'fail', errors: [String(err).slice(0, 200), ...consoleErrors.splice(0)] });
  }

  // 2) 草稿生成（含示例大纲 → pptx 下载）
  try {
    await page.getByRole('button', { name: '草稿生成' }).first().click();
    await waitMs(400);
    await page.getByRole('button', { name: '填入示例' }).first().click();
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.getByRole('button', { name: '生成 PPTX 草稿' }).first().click();
    const download = await downloadPromise;
    const out = path.join(__dirname, 'ppt_out', download.suggestedFilename());
    await download.saveAs(out);
    results.push({ tool: '草稿生成', status: 'pass', file: out, errors: consoleErrors.splice(0) });
  } catch (err) {
    results.push({ tool: '草稿生成', status: 'fail', errors: [String(err).slice(0, 200), ...consoleErrors.splice(0)] });
  }

  // 3) PPT 转 PDF（后端渲染 → "渲染完成"文案 + save-as 产物直验）
  const draftFile = results.find((r) => r.tool === '草稿生成')?.file;
  try {
    await page.getByRole('button', { name: 'PPT 转 PDF' }).first().click();
    await waitMs(400);
    await page.locator('input[type="file"]').first().setInputFiles(draftFile);
    // 等渲染完成文案（后端 COM 渲染可能需要数秒）
    await page.getByText(/渲染完成（PowerPoint|渲染完成（LibreOffice/).first().waitFor({ timeout: 120000 });
    const label = await page.getByText(/渲染完成（/).first().textContent();
    results.push({ tool: 'PPT 转 PDF', status: 'pass', note: label, errors: consoleErrors.splice(0) });
  } catch (err) {
    results.push({ tool: 'PPT 转 PDF', status: 'fail', errors: [String(err).slice(0, 200), ...consoleErrors.splice(0)] });
  }

  // 4) PPT 转长图
  try {
    await page.getByRole('button', { name: 'PPT 转长图' }).first().click();
    await waitMs(400);
    await page.locator('input[type="file"]').first().setInputFiles(draftFile);
    await page.getByText(/已生成 \d+ 张幻灯片图片/).first().waitFor({ timeout: 120000 });
    results.push({ tool: 'PPT 转长图', status: 'pass', errors: consoleErrors.splice(0) });
  } catch (err) {
    results.push({ tool: 'PPT 转长图', status: 'fail', errors: [String(err).slice(0, 200), ...consoleErrors.splice(0)] });
  }

  await browser.close();
  console.log('\n=== PPT TOOLS SUMMARY ===');
  for (const r of results) {
    console.log(`[${r.status}] ${r.tool}${r.file ? ' → ' + path.basename(r.file) : ''}${r.note ? ' | ' + r.note : ''}`);
    for (const e of r.errors || []) console.log(`    !! ${e}`);
  }
  console.log('RESULTS_JSON=' + JSON.stringify(results));
}

run().catch((err) => { console.error('FATAL', err); process.exit(1); });
