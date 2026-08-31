/**
 * 浏览器转换引擎 UI 端到端验证（后端离线场景，dev server 5199）
 * 覆盖：pdf-to-word / pdf-to-excel / compress-deep / pdf-repair(触发引导) / ocr-export(触发桌面版引导)
 * 断言：web 引擎提示出现 + 下载事件 + 产物 magic bytes
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE = path.join(__dirname, 'webconv_sample.pdf');
const results = [];

async function runCase(name, fn) {
  try {
    const r = await fn();
    results.push({ name, ok: true, detail: r });
    console.log('PASS', name, r || '');
  } catch (e) {
    results.push({ name, ok: false, detail: String(e.message).split('\n')[0].slice(0, 160) });
    console.log('FAIL', name, String(e.message).split('\n')[0].slice(0, 160));
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 120)));

await page.goto('http://localhost:5199/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

// 接受隐私弹窗（若出现）
const agree = page.locator('text=我已了解，放心使用').first();
if (await agree.isVisible().catch(() => false)) await agree.click();

async function openConvertTool(title, cardText) {
  await page.locator('button[title="PDF 工坊"]:visible').last().click();
  await page.waitForTimeout(1000);
  const card = page.locator(`text=${cardText}`).first();
  await card.click();
  await page.waitForTimeout(1500);
}

async function convertAndCheckDownload(expectMagic) {
  const dlPromise = page.waitForEvent('download', { timeout: 90000 });
  await page.setInputFiles('input[type="file"]', SAMPLE);
  await page.locator('button:has-text("开始转换")').first().click();
  const dl = await dlPromise;
  const tmp = path.join(__dirname, 'wc_dl_tmp');
  await dl.saveAs(tmp);
  const buf = fs.readFileSync(tmp);
  const magic = buf.subarray(0, 4).toString('latin1');
  if (!magic.startsWith(expectMagic)) throw new Error(`bad magic ${JSON.stringify(magic)} size ${buf.length}`);
  return `${dl.suggestedFilename()} size=${buf.length} magic=${JSON.stringify(magic.slice(0,2))}`;
}

// 1) pdf-to-word
await runCase('pdf-to-word', async () => {
  await openConvertTool('PDF 工坊', 'PDF 转 Word');
  const note = page.locator('text=浏览器本地引擎').first();
  await note.waitFor({ timeout: 10000 });
  return await convertAndCheckDownload('PK');
});

// 2) pdf-to-excel
await runCase('pdf-to-excel', async () => {
  await openConvertTool('PDF 工坊', 'PDF 转 Excel');
  return await convertAndCheckDownload('PK');
});

// 3) compress-deep
await runCase('compress-deep', async () => {
  await openConvertTool('PDF 工坊', '深度压缩');
  return await convertAndCheckDownload('%PD');
});

// 4) pdf-to-ppt (pptxgenjs chunk 动态加载)
await runCase('pdf-to-ppt', async () => {
  await openConvertTool('PDF 工坊', 'PDF 转 PPT');
  return await convertAndCheckDownload('PK');
});

// 5) html-to-pdf：粘贴内容路径（无需文件）
await runCase('html-to-pdf', async () => {
  await openConvertTool('PDF 工坊', 'HTML/MD 转 PDF');
  await page.locator('textarea').first().fill('# 测试\n\n中文**加粗**内容');
  const dlPromise = page.waitForEvent('download', { timeout: 90000 });
  await page.locator('button:has-text("开始转换")').first().click();
  const dl = await dlPromise;
  const tmp = path.join(__dirname, 'wc_dl_tmp2');
  await dl.saveAs(tmp);
  const buf = fs.readFileSync(tmp);
  if (!buf.subarray(0,4).toString('latin1').startsWith('%PD')) throw new Error('bad pdf magic');
  return `size=${buf.length}`;
});

// 6) ocr-export：后端离线且浏览器做不了 → 应显示桌面版引导而非可用的开始按钮
await runCase('ocr-export-desktop-guidance', async () => {
  await openConvertTool('PDF 工坊', 'OCR 导出');
  const guidance = page.locator('text=此工具需要本机引擎').first();
  await guidance.waitFor({ timeout: 8000 });
  return 'desktop guidance shown';
});

await browser.close();

const failed = results.filter(r => !r.ok);
console.log('\n=== SUMMARY ===');
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) console.log('FAILED:', failed.map(f => f.name).join(', '));
if (pageErrors.length) console.log('PAGE ERRORS:', [...new Set(pageErrors)].slice(0, 4));
process.exit(failed.length ? 1 : 0);
