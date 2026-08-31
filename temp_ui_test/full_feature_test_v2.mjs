/**
 * ZonScale 全功能真实用户测试（手机 390×844 / 桌面 1366×900 双模式）
 * MODE=mobile|desktop node full_feature_test.mjs
 * 覆盖：8 中心 76 工具 + 导航 + 隐私弹窗 + 横向溢出检测
 * 产物：shots_full/<mode>/NN_*.png + results_full_<mode>.json
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.env.MODE || 'mobile';
const BASE = 'http://localhost:5173';
const SHOTS = path.join(__dirname, 'shots_full', MODE);
const S = (p) => path.join(__dirname, path.basename(p));
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWPORT = MODE === 'mobile'
  ? { width: 390, height: 844, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
  : { width: 1366, height: 900, isMobile: false, hasTouch: false };

const results = [];
const consoleErrors = [];
let shotIdx = 0;
const waitMs = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  shotIdx += 1;
  const file = path.join(SHOTS, `${String(shotIdx).padStart(2, '0')}_${name}.png`);
  await page.screenshot({ path: file }).catch(() => {});
  return file;
}

async function record(page, center, tool, status, detail, extra = {}) {
  const entry = { center, tool, status, detail, ...extra };
  results.push(entry);
  const tag = `${entry.center}_${entry.tool}`.replace(/[^\w-]/g, '');
  entry.screenshot = await shot(page, tag);
  console.log(`[${entry.status}] ${center} / ${tool}: ${detail}`);
}

async function overflowPx(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** 上传：限定 main 工作区，避免误触页眉/二级导航里的 file input */
async function upload(page, files) {
  const inputs = page.locator('main input[type="file"]');
  const n = await inputs.count();
  if (n === 0) throw new Error('main 工作区无 file input');
  for (let i = 0; i < n; i++) {
    if (await inputs.nth(i).isVisible().catch(() => false)) {
      await inputs.nth(i).setInputFiles(files);
      return;
    }
  }
  await inputs.first().setInputFiles(files);
}

/** 顶部中心 Tab / 二级 SubNav pills（P4 工具首页网格与 SubNav 重名，优先点 SubNav） */
async function clickBtn(page, pattern) {
  const subNav = page.locator('.zs-mobile-scroll-x');
  let btn = subNav.getByRole('button', { name: pattern }).first();
  if (!(await btn.isVisible().catch(() => false))) {
    btn = page.getByRole('button', { name: pattern }).first();
  }
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  await btn.waitFor({ state: 'visible', timeout: 15000 });
  await btn.click();
  await waitMs(500);
  return btn;
}

/** 等导出按钮(渲染完成)出现后点击并接住程序化下载 */
async function clickExportAndWait(page, pattern, timeout = 180000) {
  const btn = page.locator('main').getByRole('button', { name: pattern }).first();
  const ok = await btn.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
  if (!ok) return null;
  const dlPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  await btn.click();
  return dlPromise;
}

/** 新交付 UI：等输出行（文件名 + 保存/下载）出现并点击下载；兼容旧单按钮即时下载 */
async function expectOutputDownload(page, action, pattern, timeout = 60000) {
  const dlPromise = page.waitForEvent('download', { timeout }).catch(() => null);
  if (action) await action();
  let dl = await dlPromise;
  if (dl) return dl;
  // 新 UI：等「转换完成/输出文件」或任何含"保存/下载"的产物行出现
  const outRow = page.locator('main').getByText(/转换完成|已生成|输出文件|_redacted|_compressed|_watermarked|_extracted|_rotated|_edited|_signed|_encrypted|_decrypted|_filled|merged_|pasted_|_ocr\.|_pages\.zip/i).first();
  await outRow.waitFor({ state: 'visible', timeout: timeout }).catch(() => {});
  // 优先点行内「下载」链接/按钮，退而点「保存」
  const dlLink = page.locator('main').locator('a[download]').first();
  if (await dlLink.isVisible().catch(() => false)) {
    const p2 = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
    await dlLink.click();
    return p2;
  }
  const saveBtn = page.locator('main').getByRole('button', { name: /^保存$/ }).first();
  if (await saveBtn.isVisible().catch(() => false)) {
    const p2 = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
    await saveBtn.click();
    return p2;
  }
  return null;
}

/** 主工作区操作按钮 — 排除 SubNav 重名 pill；找不到时返回 null 不抛错 */
async function mainBtn(page, pattern, waitTimeout = 15000) {
  const btn = page.locator('main').getByRole('button', { name: pattern }).first();
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  const ok = await btn.waitFor({ state: 'visible', timeout: waitTimeout }).then(() => true).catch(() => false);
  if (!ok) return null;
  await btn.click();
  return btn;
}

async function expectMainDownload(page, pattern, timeout = 60000) {
  const btn = page.locator('main').getByRole('button', { name: pattern }).first();
  await btn.scrollIntoViewIfNeeded().catch(() => {});
  const ok = await btn.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  if (!ok) return null;
  const dlPromise = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
  await btn.click();
  const dl = await dlPromise;
  if (dl) return dl;
  // 新交付 UI：产物已生成 → 等输出行并点下载/保存
  return expectOutputDownload(page, null, pattern, timeout);
}

/** 转换类 job：main 内点开始，等「下载」按钮 */
async function runConvertJob(page, startPattern, timeout = 120000) {
  await mainBtn(page, startPattern).catch(() => {});
  const dlBtn = page.locator('main').getByRole('button', { name: '下载' }).first();
  const ok = await dlBtn.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  if (ok) {
    const dlPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await dlBtn.click();
    return dlPromise;
  }
  // 新交付 UI：等输出清单里的 a[download]
  const dlLink = page.locator('main').locator('a[download]').first();
  const ok2 = await dlLink.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false);
  if (ok2) {
    const dlPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
    await dlLink.click();
    return dlPromise;
  }
  return null;
}

/** 等待任一产物下载（deliver.ts 走 a[download] blob） */
async function expectDownload(page, action, timeout = 60000) {
  const dlPromise = page.waitForEvent('download', { timeout });
  await action();
  return dlPromise.catch(() => null);
}

async function go(page, center, pillLabel) {
  await page.getByRole('button', { name: center }).first().click();
  await waitMs(400);
  if (pillLabel) {
    const subNav = page.locator('.zs-mobile-scroll-x');
    let pill = subNav.getByRole('button', { name: pillLabel }).first();
    if (!(await pill.isVisible().catch(() => false))) {
      pill = page.getByRole('button', { name: pillLabel }).first();
    }
    await pill.scrollIntoViewIfNeeded().catch(() => {});
    await pill.click({ timeout: 15000 });
    await waitMs(600);
  }
}

/** 工程/公文脱敏：识别完成后点「执行脱敏」，再点「导出 PDF」（手机端按钮在侧栏底部，需滚动） */
async function waitAndExportRedact(page, timeout = 90000) {
  const main = page.locator('main');
  const exportBtn = main.getByRole('button', { name: /导出 PDF|导出 Word|导出结果|保存并导出|下载|导出/ }).first();
  const execPatterns = [/执行脱敏/, /一键脱敏/, /执行已选/, /执行公文/, /^执行$/, /重新脱敏/, /执行 Word 隐私脱敏/, /Word 隐私脱敏/];
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    await main.evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await waitMs(400);

    // Word 页顶「导出 Word」常先于执行可见 — 有可用执行钮时优先点执行
    let clickedExec = false;
    for (const pat of execPatterns) {
      const execBtn = main.getByRole('button', { name: pat }).first();
      const vis = await execBtn.isVisible().catch(() => false);
      const en = vis && (await execBtn.isEnabled().catch(() => false));
      if (en) {
        await execBtn.scrollIntoViewIfNeeded().catch(() => {});
        await execBtn.click({ timeout: 10000 }).catch(() => {});
        await waitMs(4000);
        clickedExec = true;
        break;
      }
    }
    if (clickedExec) continue;

    if (await exportBtn.isVisible().catch(() => false)) {
      await exportBtn.scrollIntoViewIfNeeded().catch(() => {});
      return exportBtn;
    }

    await waitMs(800);
  }

  await exportBtn.scrollIntoViewIfNeeded().catch(() => {});
  await exportBtn.waitFor({ state: 'visible', timeout: 8000 });
  return exportBtn;
}

/* ============ 各中心流程 ============ */

async function testRedact(page) {
  // 1. 工程图纸脱敏：上传 → 自动识别 → 执行 → 导出 PDF（两步式：执行后出现「导出 PDF」）
  await go(page, '智能脱敏');
  await upload(page, [S('temp_ui_test/sample_drawing.pdf')]);
  await page.getByText(/敏感命中|未检出工程敏感项/).first().waitFor({ timeout: 90000 });
  const hitText = await page.getByText(/敏感命中 \(\d+\)/).first().textContent().catch(() => '未检出');
  const exportBtn = await waitAndExportRedact(page);
  const dl = await expectDownload(page, () => exportBtn.click(), 60000).catch(() => null);
  if (dl) {
    const fname = dl.suggestedFilename();
    await waitMs(1200);
    await record(page, 'redact', 'drawing', fname.includes('.pdf') ? 'pass' : 'fail', `命中:${hitText} 导出:${fname}`, { download: fname });
  } else {
    await record(page, 'redact', 'drawing', 'fail', `命中:${hitText} 执行后无导出下载`);
  }

  // 2. 通用行政公文
  await go(page, '智能脱敏', '通用行政公文');
  await upload(page, [S('temp_ui_test/sample_doc.pdf')]);
  await page.getByText(/命中|识别完成|扫描完成|敏感命中/).first().waitFor({ timeout: 90000 });
  await waitMs(1200);
  let dl2 = null;
  try {
    const exportBtn2 = await waitAndExportRedact(page, 90000);
    dl2 = await expectDownload(page, () => exportBtn2.click(), 60000).catch(() => null);
  } catch { /* 导出按钮未出现 */ }
  const fn2 = dl2?.suggestedFilename() ?? '';
  if (dl2 && /doc|desensitized|redact/i.test(fn2)) {
    await record(page, 'redact', 'pdf_doc', 'pass', `导出:${fn2}`, { download: fn2 });
  } else {
    await record(page, 'redact', 'pdf_doc', 'fail', dl2 ? `错误产物:${fn2}` : '执行后无导出下载');
  }

  // 3. Word 文档脱敏
  await go(page, '智能脱敏', 'Word 文档脱敏');
  await upload(page, [S('temp_ui_test/sample.docx')]);
  await page.getByText(/命中|扫描结果|段落|匹配/).first().waitFor({ timeout: 90000 });
  await waitMs(1200);
  let dl3 = null;
  try {
    const exportBtn3 = await waitAndExportRedact(page, 90000);
    dl3 = await expectDownload(page, () => exportBtn3.click(), 60000).catch(() => null);
  } catch { /* 导出按钮未出现 */ }
  const fn3 = dl3?.suggestedFilename() ?? '';
  if (dl3 && /docx|desensitized|redact/i.test(fn3)) {
    await record(page, 'redact', 'word_doc', 'pass', `导出:${fn3}`, { download: fn3 });
  } else {
    await record(page, 'redact', 'word_doc', 'fail', dl3 ? `错误产物:${fn3}` : '执行后无导出下载');
  }

  // 4. 规则策略中心：增词 → 保存 → 删词 → 保存
  await go(page, '智能脱敏', '规则策略中心');
  await page.getByRole('heading', { name: /工程图纸敏感词库/ }).first().waitFor({ timeout: 30000 });
  const addInput = page.getByPlaceholder(/密级标记|保密声明/).first();
  const testTerm = `ZZTEST${Date.now() % 10000}`;
  await addInput.scrollIntoViewIfNeeded().catch(() => {});
  await addInput.fill(testTerm);
  await page.getByRole('button', { name: '添加', exact: true }).first().click();
  await waitMs(600);
  const added = await page.getByText(testTerm).first().isVisible().catch(() => false);
  await page.getByRole('button', { name: /保存工程图纸规则/ }).first().click();
  await waitMs(800);
  // 删除测试词
  const chip = page.getByText(testTerm).first();
  if (added) {
    const row = chip.locator('xpath=ancestor::*[contains(@class,"border")]').first();
    await row.getByRole('button').last().click().catch(() => {});
    await waitMs(400);
    await page.getByRole('button', { name: /保存工程图纸规则/ }).first().click().catch(() => {});
  }
  await record(page, 'redact', 'rules', added ? 'pass' : 'fail', `加词:${added}`);

  // 5. 审计日志
  await go(page, '智能脱敏', '审计日志追踪');
  await page.getByText(/脱敏操作流水审计|暂无审计/).first().waitFor({ timeout: 15000 });
  const cards = await page.locator('text=/sample_|multi_page|\.pdf|\.docx/i').count();
  await record(page, 'redact', 'audit', cards > 0 ? 'pass' : 'warn', `流水含文件记录:${cards}`);
}

/* ---- PDF 工坊 25 工具 ---- */
async function testPdfCenter(page) {
  await go(page, 'PDF 工坊');

  await clickBtn(page, '页面整理');
  await upload(page, [S('temp_ui_test/multi_page.pdf')]);
  await waitMs(4000);
  const dlOrganize = await expectMainDownload(page, '保存并导出', 60000);
  await record(page, 'pdf', 'organize', dlOrganize ? 'pass' : 'fail',
    dlOrganize ? `导出:${dlOrganize.suggestedFilename()}` : '导出失败', dlOrganize ? { download: dlOrganize.suggestedFilename() } : {});

  await clickBtn(page, 'PDF 编辑器');
  await upload(page, [S('temp_ui_test/multi_page.pdf')]);
  await waitMs(4000);
  const dlEditor = await expectMainDownload(page, /导出编辑结果|保存并导出/, 60000);
  await record(page, 'pdf', 'editor', dlEditor ? 'pass' : 'fail',
    dlEditor ? `导出:${dlEditor.suggestedFilename()}` : '导出失败');

  await clickBtn(page, '在线填表');
  await upload(page, [S('temp_ui_test/sample_form.pdf')]);
  await page.locator('main').getByText(/表单字段|应用修改/).first().waitFor({ timeout: 30000 }).catch(() => {});
  await waitMs(1500);
  const formInput = page.locator('main input[type="text"], main input:not([type])').first();
  const hasForm = await formInput.isVisible().catch(() => false);
  if (hasForm) await formInput.fill('张三');
  const dlForm = await expectMainDownload(page, /应用修改并输出|导出|保存/, 60000);
  await record(page, 'pdf', 'forms', hasForm ? 'pass' : 'fail',
    hasForm ? `表单域可见并填写, 导出:${dlForm ? dlForm.suggestedFilename() : '无下载'}` : '未检测到表单域');

  await clickBtn(page, '证书签名');
  await page.locator('main input[type="file"]').nth(0).setInputFiles(S('temp_ui_test/multi_page.pdf'));
  await waitMs(1000);
  const certInputs = page.locator('main input[type="file"]');
  const cn = await certInputs.count();
  let dlSign = null;
  if (cn >= 3) {
    await certInputs.nth(1).setInputFiles(path.join(__dirname, 'selfsign_demo', 'demo.crt.pem'));
    await certInputs.nth(2).setInputFiles(path.join(__dirname, 'selfsign_demo', 'demo.key.pem'));
    const signBtn = page.locator('main').getByRole('button', { name: /应用证书并签署/ });
    await signBtn.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    for (let i = 0; i < 20 && (await signBtn.isDisabled().catch(() => true)); i++) await waitMs(300);
    if (!(await signBtn.isDisabled().catch(() => true))) {
      const dlP = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
      await signBtn.click();
      dlSign = await dlP;
    }
  } else {
    await record(page, 'pdf', 'cert-sign-setup', 'fail', `证书/私钥上传入口缺失 (file inputs=${cn})`);
  }
  await record(page, 'pdf', 'cert-sign', dlSign ? 'pass' : 'fail', dlSign ? `签名导出:${dlSign.suggestedFilename()}` : '签名未产出');

  await clickBtn(page, 'PDF 合并');
  await upload(page, [S('temp_ui_test/multi_page.pdf'), S('temp_ui_test/sample_table.pdf')]);
  await waitMs(1200);
  const dlMerge = await expectMainDownload(page, '合并 PDF', 60000);
  await record(page, 'pdf', 'merge', dlMerge ? 'pass' : 'fail', dlMerge ? `导出:${dlMerge.suggestedFilename()}` : '合并失败');

  await clickBtn(page, 'PDF 拆分');
  await upload(page, [S('temp_ui_test/multi_page.pdf')]);
  await waitMs(1200);
  const splitBtns = page.locator('main').getByRole('button', { name: /逐页拆分|按范围拆分/ });
  const sbCount = await splitBtns.count();
  if (sbCount > 1) { await splitBtns.nth(sbCount - 1).click().catch(() => {}); }
  const dlSplit = await expectOutputDownload(page, null, /拆分/, 60000);
  await record(page, 'pdf', 'split', dlSplit ? 'pass' : 'fail', dlSplit ? `导出:${dlSplit.suggestedFilename()}` : '拆分失败');

  await clickBtn(page, '提取页面');
  await upload(page, [S('temp_ui_test/multi_page.pdf')]);
  await waitMs(1200);
  const rangeInput = page.locator('main input[placeholder*="1-3"]').first();
  if (await rangeInput.isVisible().catch(() => false)) await rangeInput.fill('1-2');
  const exBtns = page.locator('main').getByRole('button', { name: '提取页面' });
  const exCount = await exBtns.count();
  const target = exCount > 1 ? exBtns.nth(exCount - 1) : exBtns.first();
  const dlLink = page.locator('main').locator('a[download]').first();
  const dlPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  await target.click();
  let dlExtract = await dlPromise;
  if (!dlExtract) {
    // blob 产物行:等「保存」按钮出现再点
    const saveBtn = page.locator('main').getByRole('button', { name: '保存' }).first();
    const ok = await saveBtn.waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
    if (ok) {
      const p2 = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
      await saveBtn.click();
      dlExtract = await p2;
    }
  }
  await record(page, 'pdf', 'extract', dlExtract ? 'pass' : 'fail', dlExtract ? `导出:${dlExtract.suggestedFilename()}` : '提取失败');

  await clickBtn(page, 'PDF 旋转');
  await upload(page, [S('temp_ui_test/multi_page.pdf')]);
  await waitMs(1200);
  const dlRotate = await expectMainDownload(page, '旋转 PDF', 60000);
  await record(page, 'pdf', 'rotate', dlRotate ? 'pass' : 'fail', dlRotate ? `导出:${dlRotate.suggestedFilename()}` : '旋转失败');

  await clickBtn(page, 'PDF 转图片');
  await upload(page, [S('temp_ui_test/multi_page.pdf')]);
  await waitMs(1500);
  let dlToImg = await expectMainDownload(page, '导出图片', 30000);
  if (!dlToImg) {
    const zipBtn = page.locator('main').getByRole('button', { name: /ZIP/ }).first();
    const okZip = await zipBtn.waitFor({ state: 'visible', timeout: 60000 }).then(() => true).catch(() => false);
    if (okZip) {
      const p = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
      await zipBtn.click();
      dlToImg = await p;
    }
  }
  await record(page, 'pdf', 'to-image', dlToImg ? 'pass' : 'fail', dlToImg ? `导出:${dlToImg.suggestedFilename()}` : '转换失败');

  await clickBtn(page, '图片转 PDF');
  await upload(page, [S('temp_ui_test/sample_image.png'), S('temp_ui_test/sample_image2.png')]);
  await waitMs(1200);
  const dlImg2Pdf = await expectMainDownload(page, '合成 PDF', 60000);
  await record(page, 'pdf', 'images-to-pdf', dlImg2Pdf ? 'pass' : 'fail', dlImg2Pdf ? `导出:${dlImg2Pdf.suggestedFilename()}` : '转换失败');

  await clickBtn(page, 'PDF 压缩');
  await upload(page, [S('temp_ui_test/sample_drawing.pdf')]);
  await waitMs(1500);
  const dlCompress = await expectMainDownload(page, '压缩 PDF', 60000);
  await record(page, 'pdf', 'compress', dlCompress ? 'pass' : 'fail', dlCompress ? `导出:${dlCompress.suggestedFilename()}` : '压缩失败');

  await clickBtn(page, '深度压缩');
  await upload(page, [S('temp_ui_test/sample_drawing.pdf')]);
  await waitMs(1500);
  const dlDeep = await runConvertJob(page, /开始转换/, 180000);
  await record(page, 'pdf', 'compress-deep', dlDeep ? 'pass' : 'fail', dlDeep ? `导出:${dlDeep.suggestedFilename()}` : '任务未产出下载按钮');

  await clickBtn(page, '扫描件增强');
  await upload(page, [S('temp_ui_test/sample_drawing.pdf')]);
  await waitMs(1500);
  const dlEnh = await expectMainDownload(page, '增强并下载', 90000);
  await record(page, 'pdf', 'enhance', dlEnh ? 'pass' : 'fail', dlEnh ? `导出:${dlEnh.suggestedFilename()}` : '增强失败');

  await clickBtn(page, 'PDF 水印');
  await upload(page, [S('temp_ui_test/multi_page.pdf')]);
  await waitMs(1200);
  const wmInput = page.locator('main input[placeholder*="水印"], main input[type="text"]').first();
  if (await wmInput.isVisible().catch(() => false)) await wmInput.fill('机密文件');
  const dlWm = await expectMainDownload(page, '添加水印', 60000);
  await record(page, 'pdf', 'watermark', dlWm ? 'pass' : 'fail', dlWm ? `导出:${dlWm.suggestedFilename()}` : '水印失败');

  await clickBtn(page, '添加页码');
  await upload(page, [S('temp_ui_test/multi_page.pdf')]);
  await waitMs(1200);
  const dlPn = await expectMainDownload(page, '添加页码', 60000);
  await record(page, 'pdf', 'page-numbers', dlPn ? 'pass' : 'fail', dlPn ? `导出:${dlPn.suggestedFilename()}` : '页码失败');

  await clickBtn(page, 'PDF 裁剪');
  await upload(page, [S('temp_ui_test/multi_page.pdf')]);
  await waitMs(1200);
  const dlCrop = await expectMainDownload(page, '裁剪 PDF', 60000);
  await record(page, 'pdf', 'crop', dlCrop ? 'pass' : 'fail', dlCrop ? `导出:${dlCrop.suggestedFilename()}` : '裁剪失败');

  await clickBtn(page, 'PDF 加密');
  await upload(page, [S('temp_ui_test/multi_page.pdf')]);
  await waitMs(1200);
  const pwdInputs = page.locator('main input[type="password"]');
  const pn = await pwdInputs.count();
  if (pn >= 1) await pwdInputs.nth(0).fill('Test123!');
  if (pn >= 2) await pwdInputs.nth(1).fill('Test123!');
  const dlEnc = await expectMainDownload(page, '加密 PDF', 60000);
  await record(page, 'pdf', 'encrypt', dlEnc ? 'pass' : 'fail', dlEnc ? `导出:${dlEnc.suggestedFilename()}` : '加密失败');

  await clickBtn(page, 'PDF 解密');
  await upload(page, [S('temp_ui_test/enc_sample.pdf')]);
  await waitMs(1200);
  const dpwd = page.locator('main input[type="password"]').first();
  if (await dpwd.isVisible().catch(() => false)) await dpwd.fill('Test123!');
  const dlDec = await expectMainDownload(page, '解密 PDF', 60000);
  await record(page, 'pdf', 'decrypt', dlDec ? 'pass' : 'fail', dlDec ? `导出:${dlDec.suggestedFilename()}` : '解密失败');

  await clickBtn(page, 'PDF 转 Word');
  await upload(page, [S('temp_ui_test/sample_doc.pdf')]);
  await waitMs(1500);
  const dlW = await runConvertJob(page, /开始转换|转换/, 90000);
  await record(page, 'pdf', 'to-word', dlW ? 'pass' : 'fail', dlW ? `导出:${dlW.suggestedFilename()}` : '任务未产出下载按钮');

  await clickBtn(page, 'PDF 转 Excel');
  await upload(page, [S('temp_ui_test/sample_table.pdf')]);
  await waitMs(1500);
  const dlX = await runConvertJob(page, /开始转换|转换/, 90000);
  await record(page, 'pdf', 'to-excel', dlX ? 'pass' : 'fail', dlX ? `导出:${dlX.suggestedFilename()}` : '任务未产出下载按钮');

  await clickBtn(page, 'PDF 转 PPT');
  await upload(page, [S('temp_ui_test/multi_page.pdf')]);
  await waitMs(1500);
  const dlP = await runConvertJob(page, /开始转换|转换/, 120000);
  await record(page, 'pdf', 'to-ppt', dlP ? 'pass' : 'fail', dlP ? `导出:${dlP.suggestedFilename()}` : '任务未产出下载按钮');

  await clickBtn(page, 'Office 转 PDF');
  await upload(page, [S('temp_ui_test/sample.docx')]);
  await waitMs(1500);
  const dlO = await runConvertJob(page, /开始转换|转换/, 120000);
  await record(page, 'pdf', 'office-to-pdf', dlO ? 'pass' : 'fail', dlO ? `导出:${dlO.suggestedFilename()}` : '任务未产出下载按钮');

  await clickBtn(page, 'HTML/MD 转 PDF');
  await waitMs(800);
  const ta = page.locator('main textarea').first();
  if (await ta.isVisible().catch(() => false)) {
    await ta.fill('# 测试标题\n\n这是 **HTML/MD 转 PDF** 的自动化测试段落。\n\n- 项目一\n- 项目二\n');
  }
  const dlHtml = await expectMainDownload(page, /生成|转换|导出/, 60000);
  await record(page, 'pdf', 'html-to-pdf', dlHtml ? 'pass' : 'fail', dlHtml ? `导出:${dlHtml.suggestedFilename()}` : '生成失败');

  await clickBtn(page, 'OCR 导出');
  await upload(page, [S('temp_ui_test/sample_doc.pdf')]);
  await waitMs(1500);
  const dlOcr = await runConvertJob(page, /开始|导出|执行|转换/, 150000);
  await record(page, 'pdf', 'ocr-export', dlOcr ? 'pass' : 'fail', dlOcr ? `导出:${dlOcr.suggestedFilename()}` : '任务未产出下载按钮(超时150s)');

  await clickBtn(page, 'PDF 修复');
  await upload(page, [S('temp_ui_test/corrupted.pdf')]);
  await waitMs(1200);
  const dlRep = await runConvertJob(page, /开始转换|修复/, 60000);
  await record(page, 'pdf', 'repair', dlRep ? 'pass' : 'fail', dlRep ? `导出:${dlRep.suggestedFilename()}` : '修复失败');
}

/* ---- PPT 工坊 7 工具 ---- */
async function testPptCenter(page) {
  await go(page, 'PPT 工坊');

  await clickBtn(page, 'PPT 转 PDF');
  await upload(page, [S('temp_ui_test/sample.pptx')]);
  await waitMs(1500);
  const dl1 = await clickExportAndWait(page, /导出 PDF/);
  await record(page, 'ppt', 'to-pdf', dl1 ? 'pass' : 'fail', dl1 ? `导出:${dl1.suggestedFilename()}` : '无下载按钮');

  await clickBtn(page, 'PPT 转长图');
  await upload(page, [S('temp_ui_test/sample.pptx')]);
  await waitMs(1500);
  const dl2 = await clickExportAndWait(page, /导出 ZIP|导出长图|导出图片/);
  await record(page, 'ppt', 'to-image', dl2 ? 'pass' : 'fail', dl2 ? `导出:${dl2.suggestedFilename()}` : '无下载按钮');

  await clickBtn(page, '图片提取');
  await upload(page, [S('temp_ui_test/sample.pptx')]);
  await waitMs(1500);
  const dl3 = await clickExportAndWait(page, /导出|下载/);
  await record(page, 'ppt', 'images', dl3 ? 'pass' : 'warn', dl3 ? `导出:${dl3.suggestedFilename()}` : '样本无内嵌图片或无下载按钮(诚实边界)');

  await clickBtn(page, '文本提取');
  await upload(page, [S('temp_ui_test/sample.pptx')]);
  await waitMs(1500);
  const dl4 = await clickExportAndWait(page, /导出 \.txt/);
  await record(page, 'ppt', 'text', dl4 ? 'pass' : 'fail', dl4 ? `导出:${dl4.suggestedFilename()}` : '无下载按钮');

    await clickBtn(page, 'PPT 瘦身');
  {
    const p = page.waitForEvent('download', { timeout: 120000 }).catch(() => null);
    await upload(page, [S('temp_ui_test/sample.pptx')]);
    const dl5 = await p;
    await record(page, 'ppt', 'compress', dl5 ? 'pass' : 'fail', dl5 ? `导出:${dl5.suggestedFilename()}` : '无下载');
  }

await clickBtn(page, '大纲生成');
  await waitMs(800);
  const outlineInput = page.locator('main input:not([type])').first();
  const outlineReady = await outlineInput.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
  if (outlineReady) {
    await outlineInput.fill('季度产品发布计划');
    await mainBtn(page, /生成大纲/).catch(() => {});
    await waitMs(2000);
    const out = await page.getByText(/#|章节|大纲|Slide|页/).first().isVisible().catch(() => false);
    await record(page, 'ppt', 'outline', out ? 'pass' : 'fail', out ? '大纲文本已生成' : '未见大纲输出');
  } else await record(page, 'ppt', 'outline', 'fail', '无输入框');

  await clickBtn(page, '草稿生成');
  await waitMs(800);
  const draftInput = page.locator('main textarea, main input[type="text"]').first();
  if (await draftInput.isVisible().catch(() => false)) {
    await draftInput.fill('# 年度工作总结\n\n## 第一季度\n- 完成A项目\n\n## 第二季度\n- 完成B项目\n');
    const dl7 = await expectMainDownload(page, /生成 PPTX 草稿|生成/, 60000);
    await record(page, 'ppt', 'draft', dl7 ? 'pass' : 'fail', dl7 ? `导出:${dl7.suggestedFilename()}` : '生成失败');
  } else await record(page, 'ppt', 'draft', 'fail', '无输入框');
}

/* ---- 图像工坊 8 工具 ---- */
async function testImageCenter(page) {
  await go(page, '图像工坊');

  await clickBtn(page, '格式转换');
  await upload(page, [S('temp_ui_test/sample_image.png')]);
  await waitMs(1500);
  const dl1 = await expectMainDownload(page, /开始转换|转换|导出|下载/, 60000);
  await record(page, 'image', 'convert', dl1 ? 'pass' : 'fail', dl1 ? `导出:${dl1.suggestedFilename()}` : '转换失败');

  await clickBtn(page, '质量压缩');
  await upload(page, [S('temp_ui_test/sample_image.jpg')]);
  await waitMs(1500);
  const dl2 = await expectMainDownload(page, '开始压缩', 60000);
  await record(page, 'image', 'compress', dl2 ? 'pass' : 'fail', dl2 ? `导出:${dl2.suggestedFilename()}` : '压缩失败');

  await clickBtn(page, '图像裁剪');
  await upload(page, [S('temp_ui_test/sample_image.png')]);
  await waitMs(2000);
  const dl3 = await expectMainDownload(page, /裁剪并下载|裁剪|导出|下载/, 60000);
  await record(page, 'image', 'crop', dl3 ? 'pass' : 'fail', dl3 ? `导出:${dl3.suggestedFilename()}` : '裁剪失败');

  await clickBtn(page, '色彩替换');
  await upload(page, [S('temp_ui_test/sample_image.png')]);
  await waitMs(2000);
  const dl4 = await expectMainDownload(page, '替换颜色', 60000);
  await record(page, 'image', 'color-replace', dl4 ? 'pass' : 'fail', dl4 ? `导出:${dl4.suggestedFilename()}` : '无导出');

  await clickBtn(page, '多图拼接');
  await upload(page, [S('temp_ui_test/sample_image.png'), S('temp_ui_test/sample_image2.png')]);
  await waitMs(2000);
  const dl5 = await expectMainDownload(page, '拼接图片', 60000);
  await record(page, 'image', 'stitch', dl5 ? 'pass' : 'fail', dl5 ? `导出:${dl5.suggestedFilename()}` : '拼接失败');

  await clickBtn(page, '图标生成');
  await upload(page, [S('temp_ui_test/sample_icon.png')]);
  await waitMs(2000);
  const dl6 = await expectMainDownload(page, /生成图标集|生成|导出|下载/, 60000);
  await record(page, 'image', 'icon-gen', dl6 ? 'pass' : 'fail', dl6 ? `导出:${dl6.suggestedFilename()}` : '生成失败');

  // 取色板
  await clickBtn(page, '取色板');
  await upload(page, [S('temp_ui_test/sample_image.png')]);
  await waitMs(2000);
  const swatches = await page.locator('[class*="cursor-pointer"], button[title*="#"], [data-color]').count();
  const hasColor = (await page.getByText(/#[0-9A-Fa-f]{6}/).first().isVisible().catch(() => false)) || swatches > 0;
  await record(page, 'image', 'color-extractor', hasColor ? 'pass' : 'fail', hasColor ? `取色结果可见 (${swatches})` : '未提取到色板');

  // 色域对比（无上传）
  await clickBtn(page, '色域对比');
  await waitMs(1500);
  const canvasCount = await page.locator('canvas').count();
  await record(page, 'image', 'color-space-compare', canvasCount > 0 ? 'pass' : 'warn', `canvas 渲染:${canvasCount}`);
}

/* ---- 音视频中心 7 工具 ---- */
async function testMediaCenter(page) {
  await go(page, '音视频中心');

  // BPM 检测
  await clickBtn(page, 'BPM 检测');
  await upload(page, [S('temp_ui_test/sample_audio.wav')]);
  await waitMs(1500);
  await mainBtn(page, /检测|分析|开始/).catch(() => {});
  const bpmText = page.getByText(/\d{2,3}\s*BPM|BPM/i).first();
  const bpmOk = await bpmText.waitFor({ state: 'visible', timeout: 60000 }).then(() => true).catch(() => false);
  await record(page, 'media', 'bpm-detect', bpmOk ? 'pass' : 'fail', bpmOk ? `结果:${await bpmText.textContent()}` : '未出 BPM 结果');

  // 音频裁剪（blob 直下：点按钮即下载）
  await clickBtn(page, '音频裁剪');
  await upload(page, [S('temp_ui_test/sample_audio.wav')]);
  await waitMs(2000);
  const dlc = await clickExportAndWait(page, /裁剪并导出 WAV/, 60000);
  await record(page, 'media', 'audio-clip', dlc ? 'pass' : 'fail', dlc ? `导出:${dlc.suggestedFilename()}` : '无下载');

  // 音频转换（blob 直下）
  await clickBtn(page, '音频转换');
  await upload(page, [S('temp_ui_test/sample_audio.wav')]);
  await waitMs(1500);
  const dlc2 = await clickExportAndWait(page, /转换为 WAV/, 90000);
  await record(page, 'media', 'audio-convert', dlc2 ? 'pass' : 'fail', dlc2 ? `导出:${dlc2.suggestedFilename()}` : '无下载');

  // 音轨提取（blob 直下）
  await clickBtn(page, '音轨提取');
  await upload(page, [S('temp_ui_test/sample_video.mp4')]);
  await waitMs(1500);
  const dlc3 = await clickExportAndWait(page, /提取音轨/, 90000);
  await record(page, 'media', 'audio-extract', dlc3 ? 'pass' : 'fail', dlc3 ? `导出:${dlc3.suggestedFilename()}` : '无下载');

  // 视频转换（后端 job → MediaOutputList a[download]）
  await clickBtn(page, '视频转换');
  await upload(page, [S('temp_ui_test/sample_video.mp4')]);
  await waitMs(1500);
  let dlc4 = await clickExportAndWait(page, /开始转换/, 30000);
  if (!dlc4) dlc4 = await runConvertJob(page, /下载|导出/, 180000);
  await record(page, 'media', 'video-convert', dlc4 ? 'pass' : 'fail', dlc4 ? `导出:${dlc4.suggestedFilename()}` : '无下载');

  // 视频抽帧
  await clickBtn(page, '视频抽帧');
  await upload(page, [S('temp_ui_test/sample_video.mp4')]);
  await waitMs(1500);
  let dlc5 = await clickExportAndWait(page, /抽帧|抓取|开始/, 30000);
  if (!dlc5) dlc5 = await runConvertJob(page, /下载|导出/, 180000);
  await record(page, 'media', 'video-frame', dlc5 ? 'pass' : 'fail', dlc5 ? `导出:${dlc5.suggestedFilename()}` : '无下载');

  // 视频转 GIF
  await clickBtn(page, '视频转 GIF');
  await upload(page, [S('temp_ui_test/sample_video.mp4')]);
  await waitMs(1500);
  const dlc6 = await runConvertJob(page, /转换|生成|开始/, 180000);
  await record(page, 'media', 'video-gif', dlc6 ? 'pass' : 'fail', dlc6 ? `导出:${dlc6.suggestedFilename()}` : '无下载');
}

/* ---- 文本工坊 5 工具 ---- */
async function testTextCenter(page) {
  await go(page, '文本工坊');

  await clickBtn(page, 'Markdown');
  await waitMs(800);
  const mdTa = page.locator('textarea').first();
  if (await mdTa.isVisible().catch(() => false)) {
    await mdTa.fill('# 标题\n\n**加粗** 与 `代码`\n\n- 列表项\n');
    await waitMs(1000);
    const preview = await page.locator('h1').first().isVisible().catch(() => false);
    await record(page, 'text', 'markdown-editor', preview ? 'pass' : 'fail', preview ? '预览 h1 渲染' : '无预览渲染');
  } else await record(page, 'text', 'markdown-editor', 'fail', '无输入区');

  await clickBtn(page, '文本统计');
  await waitMs(800);
  const ta2 = page.locator('textarea').first();
  if (await ta2.isVisible().catch(() => false)) {
    await ta2.fill('Hello world 你好世界。这是统计测试文本 12345。');
    await waitMs(1000);
    const stats = await page.getByText(/字|词|字符|段/).first().isVisible().catch(() => false);
    await record(page, 'text', 'text-stats', stats ? 'pass' : 'fail', stats ? '统计结果可见' : '无统计输出');
  } else await record(page, 'text', 'text-stats', 'fail', '无输入区');

  await clickBtn(page, '排版格式化');
  await waitMs(800);
  const ta3 = page.locator('textarea').first();
  if (await ta3.isVisible().catch(() => false)) {
    await ta3.fill('这是一段  混乱  排版的文本，需要格式化。');
    await mainBtn(page, /格式化|整理|应用/).catch(() => {});
    await waitMs(1200);
    const dl = await page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
    const out = dl || (await page.locator('textarea').nth(1).isVisible().catch(() => false));
    await record(page, 'text', 'text-format', out ? 'pass' : 'warn', out ? (dl ? `导出:${dl.suggestedFilename()}` : '输出区可见') : '未见输出');
  } else await record(page, 'text', 'text-format', 'fail', '无输入区');

  // 语音转写（whisper 能力探测）
  await clickBtn(page, '语音转写');
  await waitMs(1200);
  const gate = await page.getByText(/不可用|离线|未安装|不支持/).first().isVisible().catch(() => false);
  const ta4 = page.locator('input[type="file"]');
  const hasUpload = await ta4.count();
  await record(page, 'text', 'transcription', 'warn', `能力探测: 不可用提示=${gate}, 有上传入口=${hasUpload > 0}`);

  // 打字测速
  await clickBtn(page, '打字测速');
  await waitMs(800);
  const startBtn = page.locator('main').getByRole('button', { name: /开始挑战|开始/ }).first();
  const hasStart = await startBtn.isVisible().catch(() => false);
  if (hasStart) {
    await startBtn.click();
    await waitMs(600);
    const typingArea = page.locator('main textarea, main input[type="text"]').first();
    if (await typingArea.isVisible().catch(() => false)) {
      await typingArea.click();
      await typingArea.type('the quick brown fox', { delay: 30 });
      await waitMs(800);
    }
    const speed = await page.getByText(/WPM|字\/分|速度|KPM|正确率/i).first().isVisible().catch(() => false);
    await record(page, 'text', 'typing-test', speed ? 'pass' : 'warn', speed ? '速度统计可见' : '挑战已开始,统计未显示');
  } else await record(page, 'text', 'typing-test', 'fail', '无开始挑战入口');
}

/* ---- 计算开发 11 工具 ---- */
async function testCalcDev(page) {
  await go(page, '计算开发');

  // 健康计算
  await clickBtn(page, '健康计算');
  await waitMs(600);
  const numInputs = page.locator('input[type="number"]');
  const n1 = await numInputs.count();
  if (n1 >= 2) {
    await numInputs.nth(0).fill('170');
    await numInputs.nth(1).fill('65');
    await mainBtn(page, /计算|开始/).catch(() => {});
    await waitMs(800);
    const bmi = await page.getByText(/BMI|体重|正常|偏瘦|过重/).first().isVisible().catch(() => false);
    await record(page, 'calc', 'bmi-calc', bmi ? 'pass' : 'fail', bmi ? 'BMI 结果可见' : '无结果');
  } else await record(page, 'calc', 'bmi-calc', 'fail', `数字输入框仅 ${n1} 个`);

  // 时间戳
  await clickBtn(page, '时间戳');
  await waitMs(1000);
  const tsInput = page.locator('main input[type="text"], main input:not([type])').first();
  const tsReady = await tsInput.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
  if (tsReady) {
    await tsInput.fill('1700000000');
    await waitMs(600);
    await mainBtn(page, /转换|换算/).catch(() => {});
    await waitMs(600);
    const conv = await page.getByText(/2023|202\d/).first().isVisible().catch(() => false);
    await record(page, 'calc', 'timestamp-calc', conv ? 'pass' : 'fail', conv ? '时间戳转换可见' : '无转换结果');
  } else await record(page, 'calc', 'timestamp-calc', 'fail', '无输入框');

  // 房贷计算
  await clickBtn(page, '房贷计算');
  await waitMs(600);
  const mInputs = page.locator('input[type="number"]');
  const nm = await mInputs.count();
  if (nm >= 2) {
    await mInputs.nth(0).fill('1000000');
    if (nm >= 3) { await mInputs.nth(1).fill('30'); await mInputs.nth(2).fill('4.2'); }
    await mainBtn(page, /计算/).catch(() => {});
    await waitMs(800);
    const mortgage = await page.getByText(/月供|还款|利息/).first().isVisible().catch(() => false);
    await record(page, 'calc', 'mortgage-calc', mortgage ? 'pass' : 'fail', mortgage ? '月供结果可见' : '无结果');
  } else await record(page, 'calc', 'mortgage-calc', 'fail', `输入框仅 ${nm} 个`);

  // 复利计算
  await clickBtn(page, '复利计算');
  await waitMs(600);
  const cInputs = page.locator('input[type="number"]');
  const nc = await cInputs.count();
  if (nc >= 2) {
    await cInputs.nth(0).fill('10000');
    if (nc >= 3) { await cInputs.nth(1).fill('10'); await cInputs.nth(2).fill('5'); }
    await mainBtn(page, /计算/).catch(() => {});
    await waitMs(800);
    const interest = await page.getByText(/终值|收益|本息|复利/).first().isVisible().catch(() => false);
    await record(page, 'calc', 'interest-calc', interest ? 'pass' : 'fail', interest ? '复利结果可见' : '无结果');
  } else await record(page, 'calc', 'interest-calc', 'fail', `输入框仅 ${nc} 个`);

  // 密码生成
  await clickBtn(page, '密码生成');
  await waitMs(600);
  await mainBtn(page, /生成/).catch(() => {});
  await waitMs(600);
  const pwdOut = await page.locator('input[readonly], code, .font-mono').first().textContent().catch(() => '');
  const pwdOk = pwdOut && pwdOut.length >= 8 && /[A-Za-z0-9]/.test(pwdOut);
  await record(page, 'calc', 'password-gen', pwdOk ? 'pass' : 'fail', `输出:${String(pwdOut).slice(0, 6)}***`);

  // JSON 工具
  await clickBtn(page, 'JSON 工具');
  await waitMs(600);
  const jsonTa = page.locator('textarea').first();
  if (await jsonTa.isVisible().catch(() => false)) {
    await jsonTa.fill('{"name":"test","items":[1,2,3]}');
    await mainBtn(page, /格式化|美化|校验/).catch(() => {});
    await waitMs(800);
    const ok = await page.getByText(/"name"|name/).first().isVisible().catch(() => false);
    await record(page, 'calc', 'json-tools', ok ? 'pass' : 'fail', ok ? 'JSON 格式化成功' : '无输出');
  } else await record(page, 'calc', 'json-tools', 'fail', '无输入区');

  // Base64
  await clickBtn(page, 'Base64');
  await waitMs(600);
  const b64Inputs = page.locator('textarea');
  if (await b64Inputs.first().isVisible().catch(() => false)) {
    await b64Inputs.first().fill('ZonScale 测试');
    await mainBtn(page, /编码/).catch(() => {});
    await waitMs(1000);
    const anyOut = await b64Inputs.nth(1).inputValue().catch(() => '') || await b64Inputs.nth(1).textContent().catch(() => '');
    const finalOk = String(anyOut).trim().length >= 8;
    await record(page, 'calc', 'base64', finalOk ? 'pass' : 'fail', finalOk ? `输出:${String(anyOut).slice(0, 20)}` : '无编码输出');
  } else await record(page, 'calc', 'base64', 'fail', '无输入区');

  // URL 编解码
  await clickBtn(page, 'URL 编解码');
  await waitMs(600);
  const urlTa = page.locator('textarea').first();
  if (await urlTa.isVisible().catch(() => false)) {
    await urlTa.fill('https://zonscale.com/测试?_q=空 格');
    await mainBtn(page, /编码/).catch(() => {});
    await waitMs(800);
    const enc = await page.getByText(/%E6%|%/).first().isVisible().catch(() => false);
    await record(page, 'calc', 'url-codec', enc ? 'pass' : 'fail', enc ? 'URL 编码输出可见' : '无输出');
  } else await record(page, 'calc', 'url-codec', 'fail', '无输入区');

  // UUID
  await clickBtn(page, 'UUID');
  await waitMs(600);
  await mainBtn(page, /生成/).catch(() => {});
  await waitMs(600);
  const uuidText = await page.getByText(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i).first().textContent().catch(() => '');
  await record(page, 'calc', 'uuid', uuidText ? 'pass' : 'fail', `输出:${String(uuidText).slice(0, 18)}...`);

  // JWT 解析
  await clickBtn(page, 'JWT 解析');
  await waitMs(600);
  const jwtTa = page.locator('textarea, input[type="text"]').first();
  if (await jwtTa.isVisible().catch(() => false)) {
    await jwtTa.fill('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6InRlc3QifQ.sig');
    await mainBtn(page, /解析/).catch(() => {});
    await waitMs(1000);
    const parsed = await page.getByText(/sub|HS256|header|Header|载荷|payload/i).first().isVisible().catch(() => false);
    await record(page, 'calc', 'jwt', parsed ? 'pass' : 'fail', parsed ? 'JWT 解析可见' : '无解析输出');
  } else await record(page, 'calc', 'jwt', 'fail', '无输入区');

  // 哈希加密
  await clickBtn(page, '哈希加密');
  await waitMs(600);
  const hashTa = page.locator('textarea, input[type="text"]').first();
  if (await hashTa.isVisible().catch(() => false)) {
    await hashTa.fill('zonscale');
    await mainBtn(page, /计算/).catch(() => {});
    await waitMs(1200);
    const hash = await page.getByText(/[0-9a-f]{32,64}/i).first().isVisible().catch(() => false);
    await record(page, 'calc', 'hash-crypto', hash ? 'pass' : 'fail', hash ? '哈希值可见' : '无哈希输出');
  } else await record(page, 'calc', 'hash-crypto', 'fail', '无输入区');
}

/* ---- 系统硬件 8 工具 ---- */
async function testSystemCenter(page) {
  await go(page, '系统硬件');

  const sysTools = ['系统概览', 'CPU / 内存', '显卡 / 显示', '主板 / BIOS', '磁盘存储', '网络 / 外设'];
  for (const t of sysTools) {
    await clickBtn(page, t);
    await waitMs(2000);
    const content = await page.locator('main').innerText().catch(() => '');
    const hasData = /CPU|内存|GB|GHz|型号|Windows|磁盘|适配|核心/i.test(content) && content.length > 100;
    await record(page, 'system', t, hasData ? 'pass' : 'fail', hasData ? '硬件数据已加载' : '内容不足');
  }

  // 大文件清理（扫描需时间，验证进入扫描态）
  await clickBtn(page, '大文件清理');
  await waitMs(1500);
  const scanBtn = page.getByRole('button', { name: /扫描|开始|查找/ }).first();
  const hasScan = await scanBtn.isVisible().catch(() => false);
  await record(page, 'system', 'large-file-cleanup', hasScan ? 'pass' : 'warn', hasScan ? '扫描入口可见(不实际全盘扫描)' : '入口未找到');

  // 系统盘清理
  await clickBtn(page, '系统盘清理');
  // 后端全盘扫描约需 10-20s,等待任一清理档位按钮出现
  const cBtn = page.locator('main').getByRole('button', { name: /清理/ }).first();
  const hasC = await cBtn.waitFor({ state: 'visible', timeout: 45000 }).then(() => true).catch(() => false);
  await record(page, 'system', 'c-drive-cleanup', hasC ? 'pass' : 'warn', hasC ? '清理档位已加载(不实际清理)' : '45s 内未加载出清理档位');
}

/* ============ 主流程 ============ */
async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: VIEWPORT.width, height: VIEWPORT.height }, ...VIEWPORT, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[${new Date().toISOString()}] ${msg.text().slice(0, 300)}`); });
  page.on('pageerror', (err) => consoleErrors.push(`PAGEERROR: ${String(err).slice(0, 300)}`));

  console.log(`=== ${MODE} 全功能测试开始 (${VIEWPORT.width}×${VIEWPORT.height}) ===`);
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitMs(2500);

  // 隐私声明弹窗（真实用户点确认）
  const privacy = page.getByRole('button', { name: /我已了解|知道了|确认/ }).first();
  if (await privacy.isVisible().catch(() => false)) {
    await privacy.click();
    await record(page, 'global', 'privacy-notice', 'pass', '首访弹窗已确认');
  } else {
    await record(page, 'global', 'privacy-notice', 'warn', '弹窗未出现(可能已有 localStorage)');
  }

  // 全中心导航 + 横向溢出
  const centers = ['智能脱敏', 'PDF 工坊', 'PPT 工坊', '图像工坊', '音视频中心', '文本工坊', '计算开发', '系统硬件'];
  for (const c of centers) {
    await page.getByRole('button', { name: c }).first().click();
    await waitMs(600);
    const ov = await overflowPx(page);
    if (ov > 2) await record(page, 'nav', c, 'fail', `横向溢出 ${ov}px`);
  }
  await go(page, '智能脱敏');
  console.log('导航与溢出检查完成');

  await testRedact(page);
  await testPdfCenter(page);
  await testPptCenter(page);
  await testImageCenter(page);
  await testMediaCenter(page);
  await testTextCenter(page);
  await testCalcDev(page);
  await testSystemCenter(page);

  // 汇总
  const pass = results.filter((r) => r.status === 'pass').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  const warn = results.filter((r) => r.status === 'warn').length;
  const summary = { mode: MODE, viewport: `${VIEWPORT.width}x${VIEWPORT.height}`, total: results.length, pass, fail, warn, results, consoleErrors };
  fs.writeFileSync(path.join(__dirname, `results_full_${MODE}.json`), JSON.stringify(summary, null, 2));
  console.log(`\n=== ${MODE} 汇总: ${pass} pass / ${fail} fail / ${warn} warn (共 ${results.length}) ===`);
  console.log(`截图目录: ${SHOTS}`);
  if (consoleErrors.length) console.log(`控制台错误 ${consoleErrors.length} 条(详见 JSON)`);
  await browser.close();
}

main().catch(async (e) => {
  console.error('FATAL', e);
  try {
    const pass = results.filter((r) => r.status === 'pass').length;
    const fail = results.filter((r) => r.status === 'fail').length;
    const warn = results.filter((r) => r.status === 'warn').length;
    fs.writeFileSync(path.join(__dirname, `results_full_${MODE}.json`), JSON.stringify({
      mode: MODE, fatal: String(e), total: results.length, pass, fail, warn, results, consoleErrors,
    }, null, 2));
  } catch { /* ignore */ }
  process.exit(1);
});
