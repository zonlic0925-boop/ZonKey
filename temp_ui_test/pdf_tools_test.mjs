/**
 * PDF 工坊 9 工具实测（Playwright · 简体中文 UI）
 * 逐工具：切 pill → 上传样张 → 点执行 → 等下载 / 捕获报错
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:8765';
const SAMPLE = path.join(__dirname, 'sample_drawing.pdf');

const results = [];
const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

const TOOLS = [
  { pill: 'PDF 合并', action: '合并 PDF', needTwo: true },
  { pill: 'PDF 拆分', action: '逐页拆分', listDone: /已生成 \d+ 个单页 PDF/, zipBtn: /ZIP \(\d+\)/ },
  { pill: 'PDF 转图片', action: '导出图片', listDone: /已生成 \d+ 张图片/, zipBtn: /ZIP \(\d+\)/ },
  { pill: 'PDF 旋转', action: '旋转 PDF' },
  { pill: 'PDF 加密', action: '加密 PDF', password: 'Test123!' },
  { pill: 'PDF 解密', action: '解密 PDF', password: 'Test123!', preEncrypt: true },
  { pill: 'PDF 压缩', action: '压缩 PDF' },
  { pill: '扫描件增强', action: '增强并下载' },
  { pill: '页面编辑', action: '导出编辑结果' },
];

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 400));
  });
  page.on('pageerror', (err) => consoleErrors.push(`PAGEERROR: ${String(err).slice(0, 400)}`));

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('.backdrop-blur-sm').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  await page.getByRole('button', { name: /我已了解/ }).click({ force: true }).catch(() => {});
  await page.waitForTimeout(500);
  await waitMs(800);

  // 进入 PDF 工坊
  await page.getByRole('button', { name: 'PDF 工坊' }).first().click({ force: true });
  await waitMs(600);

  for (const tool of TOOLS) {
    const entry = { tool: tool.pill, status: 'pass', download: null, errors: [] };
    try {
      // 切到该工具 pill（二级导航）
      await page.getByRole('button', { name: tool.pill }).first().click({ force: true });
      await waitMs(500);

      // 加密-解密链：先在加密工具产出加密文件，解密工具直接上传该产物
      let uploadPath = SAMPLE;
      if (tool.preEncrypt && results.find((r) => r.tool === 'PDF 加密')?.download) {
        uploadPath = results.find((r) => r.tool === 'PDF 加密').download;
      }

      const fileInput = page.locator('input[type="file"]');
      await fileInput.first().setInputFiles(tool.needTwo ? [SAMPLE, SAMPLE] : [uploadPath]);
      await waitMs(700);

      if (tool.password) {
        const pw = page.locator('input[type="password"]').first();
        if (await pw.isVisible().catch(() => false)) await pw.fill(tool.password);
      }

      // 提交下载 Promise 等待，再点执行
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
      await page.getByRole('button', { name: tool.action }).first().click({ force: true });

      let download = null;
      if (tool.listDone) {
        // 列表型工具：先等"已生成"文案，再点 ZIP（多输出）或首个"保存"（单输出）触发下载
        const doneText = await page.getByText(tool.listDone).first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
        if (doneText) {
          const zip = page.getByRole('button', { name: tool.zipBtn }).first();
          if (await zip.isVisible().catch(() => false)) {
            await zip.click();
          } else {
            await page.getByRole('button', { name: '保存' }).first().click({ force: true });
          }
          download = await downloadPromise;
        }
      } else {
        download = await downloadPromise;
      }

      if (download) {
        const out = path.join(__dirname, 'pdf_out', `${tool.pill.replace(/\s/g, '_')}_${download.suggestedFilename()}`);
        await download.saveAs(out);
        entry.download = out;
      } else {
        // 无下载 → 检查错误提示行
        const errLine = await page.locator('text=/密码错误|失败|错误|Error|无效|不支持/i').first().textContent({ timeout: 1500 }).catch(() => null);
        entry.status = 'fail';
        entry.errors.push(errLine ? `UI error line: ${errLine}` : 'no download within 30s');
      }
    } catch (err) {
      entry.status = 'fail';
      entry.errors.push(String(err).slice(0, 300));
    }
    entry.errors.push(...consoleErrors.splice(0));
    if (entry.errors.length && entry.status === 'pass') entry.status = 'pass_with_errors';
    results.push(entry);
    console.log(`[${entry.status}] ${tool.pill}${entry.download ? ' → ' + path.basename(entry.download) : ''}`);
    for (const e of entry.errors) console.log(`    !! ${e}`);
  }

  await browser.close();
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(results, null, 2));
}

run().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
