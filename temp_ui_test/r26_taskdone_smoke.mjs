/** round-26 任务弹窗冒烟：taskDone 事件总线 → TaskDoneModal 全链路
 *  A. 证件照 keep 模式生成 → 任务完成弹窗自动出现（产物行 id_photo.png）
 *  B. 弹窗内「打开」按钮存在（浏览器走新标签预览）；关弹窗 → 再任务再弹
 *  C. TTS 合成 → 弹窗（audio 产物）
 *  D. PDF 压缩（纯前端 pdf-lib）→ 弹窗
 *  E. 手机 390px：弹窗完整可见不溢出
 *  F. en locale 弹窗文案（Task completed / Open / Download）
 *  依赖：8765 后端在线（dist_web 托管 + toolbox 端点）。
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = 'http://127.0.0.1:8765';
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
};
const browser = await chromium.launch();
const errors = [];

const mkPage = async (viewport, locale = 'zh-CN') => {
  const p = await browser.newPage({ viewport });
  p.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  p.on('console', (msg) => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.evaluate((loc) => {
    localStorage.setItem('zonkey.privacyNotice.v1', 'ack');
    localStorage.setItem('zonkey.whatsNewSeen.v1', JSON.stringify({ seenRound: 99, lastSeenDay: '2026-09-07' }));
    localStorage.setItem('zonkey-locale', loc);
  }, locale);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  return p;
};

// 跳转指定中心的工具（DOM 直点二级 pill：SubNav 可能滚出视口）
const gotoCenter = async (page, centerLabel, toolLabel) => {
  const main = page.locator('main');
  await main.getByRole('button', { name: centerLabel, exact: false }).first().click();
  await page.waitForTimeout(500);
  await page.evaluate((tool) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === tool);
    if (btn) btn.click();
  }, toolLabel);
  await page.waitForTimeout(700);
};

// 合成纯色证件照底图（紫蓝底 + 肤色块 = keep 模式应原样保留）
const mkIdPhotoBuf = async (page) => {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 800;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#463c82'; ctx.fillRect(0, 0, 640, 800);   // 紫蓝底（四角估色接近衣服）
    ctx.fillStyle = '#f2c9a0'; ctx.fillRect(180, 150, 280, 300); // 肤色「脸」
    ctx.fillStyle = '#4b4480'; ctx.fillRect(0, 450, 640, 350);   // 深紫「衣服」
    return c.toDataURL('image/png');
  });
  return Buffer.from(b64.split(',')[1], 'base64');
};

const setInputFile = async (page, acceptRe, buf, name) => {
  const input = page.locator(`input[type=file]`).first();
  await input.setInputFiles({ name, mimeType: 'image/png', buffer: buf });
};

// A1: 图像工坊 → 证件照（默认 replace）→ 切 keep 模式 → 生成 → 弹窗出现
{
  const page = await mkPage({ width: 1360, height: 900 });
  await gotoCenter(page, '图像工坊', '证件照换底色');
  const buf = await mkIdPhotoBuf(page);
  await setInputFile(page, /image/, buf, 'sample.png');
  await page.waitForTimeout(400);
  // 切到「仅裁剪尺寸（不换底色）」
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.includes('仅裁剪')));
    if (sel) { sel.value = 'keep'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(200);
  await page.locator('main button', { hasText: '生成证件照' }).first().click();
  await page.waitForTimeout(6000);
  const modal = page.locator('[data-testid="task-done-modal"]');
  check('A1 keep模式生成→弹窗出现', await modal.isVisible().catch(() => false));
  if (await modal.isVisible().catch(() => false)) {
    const body = await modal.innerText().catch(() => '');
    check('A2 弹窗含产物 id_photo.png', body.includes('id_photo.png'), body.slice(0, 60).replace(/\n/g, '|'));
    check('A3 弹窗含 打开/下载 按钮', body.includes('打开') && body.includes('下载'));
    // 关闭弹窗
    await modal.getByText('好的').click().catch(async () => { await modal.locator('button[aria-label="关闭"]').click(); });
    await page.waitForTimeout(300);
    check('A4 关闭后弹窗消失', !(await modal.isVisible().catch(() => true)));
    // 再生成一次 → 弹窗再弹（重复触发）
    await page.locator('main button', { hasText: '生成证件照' }).first().click();
    await page.waitForTimeout(6000);
    check('A5 再次任务→再弹', await modal.isVisible().catch(() => false));
  }
  // 手机 390px 弹窗溢出检查：保持弹窗开着
  await page.close();
}

// B: 手机 390px 证件照 keep 生成 → 弹窗完整可见
{
  const page = await mkPage({ width: 390, height: 844 });
  await gotoCenter(page, '图像工坊', '证件照换底色');
  const buf = await mkIdPhotoBuf(page);
  await setInputFile(page, /image/, buf, 'sample.png');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.includes('仅裁剪')));
    if (sel) { sel.value = 'keep'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes('生成证件照'));
    if (b) b.click();
  });
  await page.waitForTimeout(7000);
  const modal = page.locator('[data-testid="task-done-modal"]');
  const visible = await modal.isVisible().catch(() => false);
  if (visible) {
    const box = await modal.boundingBox();
    check('B1 手机 390px 弹窗可见', true);
    check('B2 弹窗在视口内', box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844,
      box ? `x=${Math.round(box.x)} w=${Math.round(box.width)}` : 'no-box');
    const body = await modal.innerText().catch(() => '');
    check('B3 手机弹窗产物名可见', body.includes('id_photo.png'));
  } else {
    check('B1 手机 390px 弹窗可见', false);
  }
  await page.close();
}

// C: TTS → 弹窗（服务端 SAPI 合成）
{
  const page = await mkPage({ width: 1360, height: 900 });
  await gotoCenter(page, '文本工坊', '文字转语音');
  await page.locator('textarea').first().fill('你好，ZonKey');
  await page.waitForTimeout(600); // voices 加载
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes('合成语音'));
    if (b) b.click();
  });
  await page.waitForTimeout(5000);
  const modal = page.locator('[data-testid="task-done-modal"]');
  const visible = await modal.isVisible().catch(() => false);
  const body = visible ? await modal.innerText().catch(() => '') : '';
  check('C1 TTS→弹窗出现', visible);
  check('C2 弹窗含音频产物 tts_*.wav', /tts_\d+\.wav/.test(body), body.slice(0, 80).replace(/\n/g, '|'));
  await page.close();
}

// D: en locale 弹窗文案
{
  const page = await mkPage({ width: 1360, height: 900 }, 'en');
  await gotoCenter(page, 'Image', 'ID Photo');
  const buf = await mkIdPhotoBuf(page);
  await setInputFile(page, /image/, buf, 'sample.png');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.includes('Crop to size')));
    if (sel) { sel.value = 'keep'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes('Generate'));
    if (b) b.click();
  });
  await page.waitForTimeout(7000);
  const modal = page.locator('[data-testid="task-done-modal"]');
  const visible = await modal.isVisible().catch(() => false);
  const body = visible ? await modal.innerText().catch(() => '') : '';
  check('D1 en→弹窗出现', visible);
  check('D2 en 文案 Task completed/Open/Download', body.includes('Task completed') && body.includes('Open') && body.includes('Download'), body.slice(0, 90).replace(/\n/g, '|'));
  await page.close();
}

// E: PDF 压缩（pdfcenter 纯前端）→ 弹窗
{
  const page = await mkPage({ width: 1360, height: 900 });
  await gotoCenter(page, 'PDF 工坊', '文字类 PDF 压缩');
  // 最小合法 PDF（pdf-lib 可解析、可重写压缩）
  const minPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n192\n%%EOF');
  const input = page.locator('input[type=file]').first();
  await input.setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: minPdf });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes('压缩'));
    if (b) b.click();
  });
  await page.waitForTimeout(6000);
  const modal = page.locator('[data-testid="task-done-modal"]');
  const visible = await modal.isVisible().catch(() => false);
  const body = visible ? await modal.innerText().catch(() => '') : '';
  check('E1 PDF压缩→弹窗出现', visible);
  check('E2 产物 _compressed.pdf', visible && body.includes('_compressed.pdf'), body.slice(0, 90).replace(/\n/g, '|'));
  await page.close();
}

console.log('\n=== round-26 任务弹窗冒烟 ===');
const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('Failed to load resource'));
console.log(realErrors.length ? realErrors.slice(0, 10) : '零 pageerror / console error');
await browser.close();
const failed = results.filter((r) => !r.ok).length;
process.exit(failed || realErrors.length ? 1 : 0);
