/** round-27 三问题修复冒烟：
 *  A. QR 导航注册：计算开发 → 二维码生成/识别 pill 可进；生成 → 弹窗 qrcode.png（image 产物有「打开」）
 *  B. 弹窗非预览类型：离线模拟 Pages → PDF转Word 前端引擎 → docx 产物弹窗无「打开」按钮（白屏根治）
 *  C. 证件照浏览器引擎：离线 → 黄色提示条出现；keep/replace 两模式均产出 id_photo.png
 *  D. 手机 390px：QR pill 可见可点进视图
 *  依赖：8765 后端在线（在线组 A/D）；离线组 B/C 用 route abort 模拟纯静态 Pages。
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

const gotoCenter = async (page, centerLabel) => {
  const main = page.locator('main');
  await main.getByRole('button', { name: centerLabel, exact: false }).first().click();
  await page.waitForTimeout(500);
};

const clickToolPill = async (page, toolLabel) => {
  await page.evaluate((tool) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === tool);
    if (btn) btn.click();
  }, toolLabel);
  await page.waitForTimeout(700);
};

const modalBody = async (page) => {
  const modal = page.locator('[data-testid="task-done-modal"]');
  if (!(await modal.isVisible().catch(() => false))) return { modal, body: '' };
  return { modal, body: await modal.innerText().catch(() => '') };
};

// A: 在线 QR 生成链路（导航注册 + emit + 弹窗）
{
  const page = await mkPage({ width: 1360, height: 900 });
  await gotoCenter(page, '计算开发');
  const pillVisible = await page.locator('button', { hasText: '二维码生成' }).first().isVisible().catch(() => false);
  check('A1 计算开发中心出现「二维码生成」pill', pillVisible);
  await clickToolPill(page, '二维码生成');
  const genTitle = await page.locator('main h3', { hasText: '二维码生成' }).first().isVisible().catch(() => false);
  check('A2 点入 QR 生成视图（此前无任何入口）', genTitle);
  await page.locator('main textarea').first().fill('https://zonkey.pages.dev');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.trim() === '生成');
    if (b) b.click();
  });
  await page.waitForTimeout(4000);
  const { modal, body } = await modalBody(page);
  check('A3 生成 → 任务弹窗出现', !!body, body.slice(0, 60).replace(/\n/g, '|'));
  check('A4 弹窗产物 qrcode.png + 打开/下载双按钮', body.includes('qrcode.png') && body.includes('打开') && body.includes('下载'));
  await modal.getByText('好的').click().catch(() => {});
  await page.waitForTimeout(300);
  await clickToolPill(page, '二维码识别');
  const readTitle = await page.locator('main h3', { hasText: '二维码识别' }).first().isVisible().catch(() => false);
  check('A5 「二维码识别」pill 可进视图', readTitle);
  await page.close();
}

// 离线环境（模拟 Pages 纯静态）：断掉全部 /api
const mkOfflinePage = async (viewport) => {
  const p = await mkPage(viewport);
  await p.route('**/api/**', (route) => route.abort());
  return p;
};

// B: 离线 PDF转Word 前端引擎 → docx blob → 弹窗无「打开」按钮
{
  const page = await mkOfflinePage({ width: 1360, height: 900 });
  await gotoCenter(page, 'PDF 工坊');
  await clickToolPill(page, 'PDF 转 Word');
  const minPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n192\n%%EOF');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: minPdf });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes('开始转换'));
    if (b) b.click();
  });
  await page.waitForTimeout(9000);
  const { modal, body } = await modalBody(page);
  check('B1 离线 PDF转Word → 弹窗出现（前端引擎兜底）', !!body, body.slice(0, 80).replace(/\n/g, '|'));
  check('B2 产物 .docx', body.includes('.docx'));
  const openBtns = modal.locator('button', { hasText: '打开' });
  check('B3 非预览类型不显示「打开」按钮（白屏根治）', (await openBtns.count()) === 0);
  check('B4 「下载」按钮仍在', body.includes('下载'));
  await page.close();
}

// C: 离线证件照浏览器引擎（keep + replace）
const mkIdPhotoBuf = async (page) => {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 800;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#463c82'; ctx.fillRect(0, 0, 640, 800);
    ctx.fillStyle = '#f2c9a0'; ctx.fillRect(180, 150, 280, 300);
    ctx.fillStyle = '#4b4480'; ctx.fillRect(0, 450, 640, 350);
    return c.toDataURL('image/png');
  });
  return Buffer.from(b64.split(',')[1], 'base64');
};
{
  const page = await mkOfflinePage({ width: 1360, height: 900 });
  await gotoCenter(page, '图像工坊');
  await clickToolPill(page, '证件照换底色');
  const note = await page.locator('main div', { hasText: '后端不在线' }).first().isVisible().catch(() => false);
  check('C1 离线提示条出现（浏览器引擎模式）', note);
  const buf = await mkIdPhotoBuf(page);
  await page.locator('input[type=file]').first().setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: buf });
  await page.waitForTimeout(500);
  // keep 模式
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.includes('仅裁剪')));
    if (sel) { sel.value = 'keep'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes('生成证件照'));
    if (b) b.click();
  });
  await page.waitForTimeout(5000);
  let { modal, body } = await modalBody(page);
  check('C2 keep 模式浏览器引擎 → 弹窗 + idphoto 产物', /idphoto.*\.png|id_photo\.png/.test(body), body.slice(0, 60).replace(/\n/g, '|'));
  check('C2b image 产物保留「打开」按钮', body.includes('打开') && body.includes('下载'));
  await modal.getByText('好的').click().catch(() => {});
  await page.waitForTimeout(300);
  // replace 模式
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.includes('换底色')));
    if (sel) { sel.value = 'replace'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes('生成证件照'));
    if (b) b.click();
  });
  await page.waitForTimeout(8000);
  ({ modal, body } = await modalBody(page));
  check('C3 replace 模式浏览器引擎 → 弹窗出现', /idphoto.*\.png|id_photo\.png/.test(body), body.slice(0, 60).replace(/\n/g, '|'));
  const err = await page.locator('main').innerText().catch(() => '');
  check('C4 replace 无报错（合成纯底样张可识别）', !err.includes('未能识别到前景人像'));
  await page.close();
}

// D: 手机 390px QR 入口
{
  const page = await mkPage({ width: 390, height: 844 });
  await gotoCenter(page, '计算开发');
  const pill = page.locator('button', { hasText: '二维码生成' }).first();
  const visible = await pill.isVisible().catch(() => false);
  if (visible) await pill.click();
  await page.waitForTimeout(700);
  const genTitle = await page.locator('main h3', { hasText: '二维码生成' }).first().isVisible().catch(() => false);
  check('D1 手机 390px QR pill 可见可进', visible && genTitle);
  await page.close();
}

console.log('\n=== round-27 三问题修复冒烟 ===');
const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('Failed to load resource') && !e.includes('ERR_'));
console.log(realErrors.length ? realErrors.slice(0, 10) : '零 pageerror / console error');
await browser.close();
const failed = results.filter((r) => !r.ok).length;
process.exit(failed || realErrors.length ? 1 : 0);
