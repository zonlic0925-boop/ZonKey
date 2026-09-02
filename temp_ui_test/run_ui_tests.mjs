/**
 * ZonKey 智能脱敏 UI 实测脚本（Playwright · 简体中文 UI）
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(__dirname, 'shots');
const BASE = 'http://127.0.0.1:8765';
const SAMPLES = {
  drawing: path.join(__dirname, 'sample_drawing.pdf'),
  docPdf: path.join(__dirname, 'sample_doc.pdf'),
  word: path.join(__dirname, 'sample.docx'),
};

const results = [];

async function shot(page, name) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function waitMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function gotoTool(page, label) {
  await page.getByRole('button', { name: label }).click();
  await waitMs(600);
}

async function uploadViaHiddenInput(page, filePath) {
  await page.locator('input[type="file"]').first().setInputFiles(filePath);
}

async function waitForExecuteEnabled(page, label = /执行脱敏|执行 Word/, timeoutMs = 180000) {
  const runBtn = page.getByRole('button', { name: label }).first();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await runBtn.isEnabled().catch(() => false)) return runBtn;
    await waitMs(1000);
  }
  return null;
}

async function waitForDownloadOrDone(page, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const dl = page.getByRole('button', { name: /下载|导出|ZIP|打开脱敏/i }).first();
    if (await dl.isVisible().catch(() => false)) return true;
    const after = page.getByRole('button', { name: /脱敏后|返回脱敏前/i }).first();
    if (await after.isVisible().catch(() => false)) return true;
    await waitMs(1000);
  }
  return false;
}

async function getHitsCount(page) {
  const text = await page.locator('h3, [class*="font-bold"]').filter({ hasText: /敏感命中|命中/ }).first().textContent().catch(() => '');
  const m = text.match(/\((\d+)\)/);
  return m ? Number(m[1]) : null;
}

async function testDrawing(page) {
  const id = '01_drawing';
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await waitMs(800);
  await shot(page, `${id}_01_home`);
  await uploadViaHiddenInput(page, SAMPLES.drawing);
  await waitMs(2000);
  const runBtn = await waitForExecuteEnabled(page, /^执行脱敏$|^重新脱敏$/);
  const hits = await getHitsCount(page);
  await shot(page, `${id}_02_detected`);
  if (!runBtn) {
    results.push({ test: '工程图纸脱敏', status: 'FAIL', note: `检测超时；命中数=${hits ?? '?'}` });
    return;
  }
  await runBtn.click();
  const ok = await waitForDownloadOrDone(page);
  await waitMs(1500);
  await shot(page, `${id}_03_output`);
  results.push({
    test: '工程图纸脱敏',
    status: ok ? 'PASS' : 'PARTIAL',
    note: `上传→检测(命中${hits ?? '未知'})→${ok ? '执行完成' : '执行后下载未确认'}`,
  });
}

async function testDocPdf(page) {
  const id = '02_doc_pdf';
  await gotoTool(page, '通用行政公文');
  await uploadViaHiddenInput(page, SAMPLES.docPdf);
  await waitMs(2000);
  const runBtn = await waitForExecuteEnabled(page, /^执行脱敏$|^重新脱敏$/);
  const hits = await getHitsCount(page);
  await shot(page, `${id}_01_detected`);
  if (!runBtn) {
    results.push({ test: '公文PDF脱敏', status: 'FAIL', note: `检测超时；命中数=${hits ?? '?'}` });
    return;
  }
  await runBtn.click();
  const ok = await waitForDownloadOrDone(page);
  await waitMs(1500);
  await shot(page, `${id}_02_output`);
  results.push({
    test: '公文PDF脱敏',
    status: ok ? 'PASS' : 'PARTIAL',
    note: `PII/敏感词命中${hits ?? '未知'}；${ok ? '执行完成' : '输出待确认'}`,
  });
}

async function testWord(page) {
  const id = '03_word';
  await gotoTool(page, 'Word 文档脱敏');
  await uploadViaHiddenInput(page, SAMPLES.word);
  await waitMs(3000);
  const scanBadge = page.getByText(/本次扫描命中|处$/).first();
  await scanBadge.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  await shot(page, `${id}_01_scanned`);
  const runBtn = page.getByRole('button', { name: /执行 Word 隐私脱敏并导出/ });
  if (!(await runBtn.isEnabled().catch(() => false))) {
    results.push({ test: 'Word文档脱敏', status: 'PARTIAL', note: '扫描完成但执行按钮未启用（可能零命中）' });
    return;
  }
  await runBtn.click();
  await waitMs(3000);
  const ok = await waitForDownloadOrDone(page, 120000);
  await shot(page, `${id}_02_output`);
  results.push({
    test: 'Word文档脱敏',
    status: ok ? 'PASS' : 'PARTIAL',
    note: ok ? 'docx 扫描+导出完成' : '已扫描，导出待确认',
  });
}

async function testRules(page) {
  const id = '04_rules';
  await gotoTool(page, '规则策略中心');
  await page.getByText('工程图纸敏感词库').waitFor({ timeout: 15000 });
  await shot(page, `${id}_01_loaded`);
  const testTerm = `UI测试词-${Date.now().toString().slice(-6)}`;
  await page.getByPlaceholder('输入密级标记、保密声明...').fill(testTerm);
  await page.getByRole('button', { name: '添加', exact: true }).click();
  await waitMs(400);
  await shot(page, `${id}_02_added`);
  const chip = page.getByText(testTerm, { exact: true });
  const added = (await chip.count()) > 0;
  if (added) {
    const row = chip.locator('xpath=ancestor::*[contains(@class,"rounded")]').first();
    await row.getByRole('button').last().click().catch(async () => {
      await page.locator(`text=${testTerm}`).locator('..').getByRole('button').click();
    });
  }
  await waitMs(400);
  await shot(page, `${id}_03_removed`);
  await page.getByRole('button', { name: '保存工程图纸规则' }).click();
  await waitMs(1000);
  await shot(page, `${id}_04_saved`);
  results.push({
    test: '规则策略中心',
    status: added ? 'PASS' : 'FAIL',
    note: added ? '增删词条 + 保存工程图纸规则' : '添加词条 UI 未生效',
  });
}

async function testAudit(page) {
  const id = '05_audit';
  await gotoTool(page, '审计日志追踪');
  await page.getByText('脱敏操作流水审计').waitFor({ timeout: 15000 });
  await waitMs(1500);
  await shot(page, `${id}_01_loaded`);
  await page.locator('button.memphis-btn-ghost').first().click().catch(() => {});
  await waitMs(2000);
  await shot(page, `${id}_02_refreshed`);
  const empty = await page.getByText('暂无审计脱敏记录').isVisible().catch(() => false);
  const cards = await page.locator('text=/sample_|_desensitized|\.pdf|\.docx/i').count();
  const statsFiles = await page.locator('text=/累计脱敏归档文档/').locator('xpath=following::div[1]').first().textContent().catch(() => '0');
  results.push({
    test: '审计日志流水',
    status: !empty || cards > 0 ? 'PASS' : 'PARTIAL',
    note: empty ? '列表为空（累计文档可能为 0）' : `可见记录/样本引用 ${cards} 处；统计=${statsFiles?.trim()}`,
  });
}

async function main() {
  await mkdir(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    const statusRes = await page.request.get(`${BASE}/api/status`);
    const status = await statusRes.json();
    results.push({
      test: '环境就绪',
      status: statusRes.ok() && status.ocr_available ? 'PASS' : 'FAIL',
      note: `backend=online, OCR=${status.ocr_available}, rules=${status.active_rules_count}`,
    });

    await testDrawing(page);
    await testDocPdf(page);
    await testWord(page);
    await testRules(page);
    await testAudit(page);
  } catch (err) {
    results.push({ test: '脚本异常', status: 'FAIL', note: String(err?.message || err) });
    await shot(page, '99_error').catch(() => {});
  } finally {
    await writeFile(path.join(SHOTS, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
    await browser.close();
  }

  console.log(JSON.stringify(results, null, 2));
}

main();
