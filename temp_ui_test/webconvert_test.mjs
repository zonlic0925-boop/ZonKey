/**
 * 浏览器转换引擎 UI 实机验证（后端离线场景）
 * 服务 vite preview（仅静态产物、无后端）→ capability 失败 → ConvertView 自动降级 web 引擎
 * 通过真实 UI 文件输入走完整链路，断言下载事件 + 产物 magic bytes。
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SAMPLE = path.join(__dirname, 'webconv_sample.pdf');
const PORT = 4173;

// 起 vite preview（静态服务 dist_web，无后端）
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  cwd: path.join(ROOT, 'frontend'),
  stdio: 'pipe',
  shell: true,
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('preview timeout')), 20000);
  preview.stdout.on('data', (d) => {
    if (String(d).includes(String(PORT))) { clearTimeout(timer); resolve(); }
  });
  preview.on('error', reject);
});

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const results = [];

async function runCase(name, fn) {
  try {
    const r = await fn();
    results.push({ name, ok: true, detail: r });
    console.log('PASS', name, r || '');
  } catch (e) {
    results.push({ name, ok: false, detail: String(e.message).slice(0, 200) });
    console.log('FAIL', name, String(e.message).slice(0, 200));
  }
}

// 从首页导航：智能脱敏 → PDF 工坊 → 转换组 → 指定工具
async function openTool(op) {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  // 处理可能的隐私弹窗
  const notice = page.locator('text=/同意|Agree|知道了|Got it|开始使用|Start/').first();
  if (await notice.isVisible().catch(() => false)) await notice.click();
  // 打开 PDF 工坊
  await page.locator('text=/PDF 工坊|PDF Workshop/i').first().click();
  await page.waitForTimeout(600);
  await page.locator(`text=/转 Word|PDF to Word|转 Excel|PDF to Excel|深度压缩|Deep Compress|HTML/`).first();
  // 直接用 URL hash / 路由（若支持）或点击卡片
  const card = page.locator(`[data-tool="${op}"]`).first();
  if (await card.count()) {
    await card.click();
  } else {
    await page.locator(`text=${op === 'pdf-to-word' ? /转 Word|PDF to Word/ : op === 'pdf-to-excel' ? /转 Excel|PDF to Excel/ : op === 'compress-deep' ? /深度压缩|Deep Compress/ : /HTML/}`).first().click();
  }
  await page.waitForTimeout(800);
}

const downloadBuffers = {};
async function runWithDownload(opLabel, expectMagic) {
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.setInputFiles('input[type="file"]', SAMPLE);
  const startBtn = page.locator('button:has-text("开始转换"), button:has-text("Start")').first();
  await startBtn.click();
  const download = await downloadPromise;
  const filePath = path.join(__dirname, 'webconv_out_' + opLabel.replace(/\W/g, '_'));
  await download.saveAs(filePath);
  const buf = fs.readFileSync(filePath);
  const magic = buf.subarray(0, 4).toString('latin1');
  downloadBuffers[opLabel] = buf.length;
  if (!magic.startsWith(expectMagic)) throw new Error(`bad magic: ${JSON.stringify(magic)} size=${buf.length}`);
  return `size=${buf.length} magic=${JSON.stringify(magic)} fname=${download.suggestedFilename()}`;
}

// 1) 后端离线提示 → 浏览器引擎提示出现
await runCase('web-engine-note-shown', async () => {
  await openTool('pdf-to-word');
  const note = page.locator('text=/浏览器本地引擎|in-browser engine|浏览器引擎/').first();
  await note.waitFor({ timeout: 8000 });
  return 'note visible';
});

// 2) PDF→Word 走通 + docx magic（PK）
await runCase('pdf-to-word-browser', () => runWithDownload('pdf-to-word', 'PK'));

// 3) PDF→Excel 走通 + xlsx magic（PK）
await runCase('pdf-to-excel-browser', async () => {
  await openTool('pdf-to-excel');
  return runWithDownload('pdf-to-excel', 'PK');
});

// 4) compress-deep 走通 + PDF magic（%PDF）
await runCase('compress-deep-browser', async () => {
  await openTool('compress-deep');
  return runWithDownload('compress-deep', '%PDF');
});

await browser.close();
preview.kill();

console.log('\n=== SUMMARY ===');
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
console.log('downloads:', JSON.stringify(downloadBuffers));
if (failed.length) console.log('FAILED:', failed.map((f) => f.name).join(', '));
if (errors.length) console.log('PAGE ERRORS:', errors.slice(0, 3));
process.exit(failed.length ? 1 : 0);
