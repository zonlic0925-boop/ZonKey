/** round-26 服务端产物弹窗验证：Word→PDF 转换 job 完成 → TaskDoneModal 弹窗
 *  产物来自 output/（服务端文件），弹窗按钮 = 另存为（壳）/ 下载流（浏览器）
 *  浏览器模式下载 = /api/download 流 → 触发浏览器下载事件
 */
import { chromium } from 'playwright';
const BASE = 'http://127.0.0.1:8765';
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
};
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('zonkey.privacyNotice.v1', 'ack');
  localStorage.setItem('zonkey.whatsNewSeen.v1', JSON.stringify({ seenRound: 99, lastSeenDay: '2026-09-07' }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);

// 进 PDF 工坊 → Word 转 PDF（服务端 job）
const main = page.locator('main');
await main.getByRole('button', { name: 'PDF 工坊', exact: false }).first().click();
await page.waitForTimeout(500);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Word 转 PDF');
  if (btn) btn.click();
});
await page.waitForTimeout(700);

// 最小 docx（含文本）
const docxBuf = Buffer.from(await page.evaluate(() => {
  // 浏览器端构造最小 docx：zip 结构太繁 → 用后端 openpyxl/python-docx 不支持浏览器
  return '';
}));
// 直接用 fetch 从本机构造? 简单方案:后端转换需要真实 docx —— 用 Playwright 前先由 Node 合成
// Node 侧没有 docx 库 → 让后端 /api/toolbox 相关生成? 更直接:python 已装 python-docx,
// 但冒烟要从浏览器发。构造:用已知 base64 最小 docx (python-docx 生成的空白文档)
// 用一个预生成的最小 docx（从 tests fixtures 借）
const fs = await import('fs');
let docxPath = 'temp_ui_test/sample.docx';
if (!fs.existsSync(docxPath)) {
  check('S0 找到 docx 样本', false);
} else {
  check('S0 找到 docx 样本', true, docxPath);
  const buf = fs.readFileSync(docxPath);
  const input = page.locator('input[type=file]').first();
  await input.setInputFiles({ name: 'sample.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: buf });
  await page.waitForTimeout(400);
  const downloadP = page.waitForEvent('download', { timeout: 60000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes('开始转换'));
    if (b) b.click();
  });
  // job 完成 → 弹窗（等待最长 60s）
  const modal = page.locator('[data-testid="task-done-modal"]');
  await modal.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  const visible = await modal.isVisible().catch(() => false);
  const body = visible ? await modal.innerText().catch(() => '') : '';
  check('S1 服务端 job 完成→弹窗', visible, body ? body.slice(0, 80).replace(/\n/g, '|') : 'no modal');
  if (visible) {
    check('S2 产物 .pdf 行存在', body.includes('.pdf'));
    // 点下载（浏览器 = /api/download 流）
    const dlBtn = modal.getByRole('button', { name: /下载/ }).first();
    if (await dlBtn.isVisible().catch(() => false)) {
      await dlBtn.click();
      try {
        const download = await downloadP;
        check('S3 服务端产物下载流', download.suggestedFilename().endsWith('.pdf'), download.suggestedFilename());
      } catch (e) {
        check('S3 服务端产物下载流', false, String(e).slice(0, 80));
      }
    } else {
      check('S3 服务端产物下载流', false);
    }
  }
}
console.log('\n=== round-26 服务端产物弹窗 ===');
const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('Failed to load resource'));
console.log(realErrors.length ? realErrors.slice(0, 10) : '零 pageerror / console error');
await browser.close();
const failed = results.filter((r) => !r.ok).length;
process.exit(failed || realErrors.length ? 1 : 0);
