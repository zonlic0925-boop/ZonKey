/** round-28 手机网页版三反馈冒烟：
 *  A. 离线（route abort 模拟 Pages）二维码生成 → 黄条 + 浏览器引擎出图 + 弹窗
 *  B. 离线二维码识别 → jsQR 解码真 QR fixture 往返（zonkey-r28-roundtrip-20260907）
 *  C. 离线 PPT 转 PDF / PPT 转长图 → 明确离线引导文案，不再裸 HTTP 405
 *  D. 在线 PPT 转 PDF（PowerPoint COM 真渲染）→ 渲染完成 + 下载按钮（在线路径无回归）
 *  依赖：8765 后端在线（在线组 D）；离线组 A/B/C route abort 全断 /api。
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

// fixture 按需生成（不提交二进制）：python qrcode / python-pptx 均为后端既有依赖
if (!existsSync('qr_r28_fixture.png')) {
  execSync(`python -c "import qrcode; qrcode.make('zonkey-r28-roundtrip-20260907').save(r'qr_r28_fixture.png')"`);
}
if (!existsSync('ppt_r28_fixture.pptx')) {
  execSync(`python -c "from pptx import Presentation; p=Presentation(); p.slides.add_slide(p.slide_layouts[6]); p.slides.add_slide(p.slide_layouts[6]); p.save(r'ppt_r28_fixture.pptx')"`);
}

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

const mkOfflinePage = async (viewport) => {
  const p = await mkPage(viewport);
  await p.route('**/api/**', (route) => route.abort());
  return p;
};

const modalBody = async (page) => {
  const modal = page.locator('[data-testid="task-done-modal"]');
  if (!(await modal.isVisible().catch(() => false))) return { modal, body: '' };
  return { modal, body: await modal.innerText().catch(() => '') };
};

// A: 离线二维码生成（浏览器引擎）
{
  const page = await mkOfflinePage({ width: 1360, height: 900 });
  await gotoCenter(page, '计算开发');
  await clickToolPill(page, '二维码生成');
  const note = await page.locator('main div', { hasText: '后端不在线' }).first().isVisible().catch(() => false);
  check('A1 离线黄条出现（浏览器引擎模式）', note);
  await page.locator('main textarea').first().fill('https://zonkey.pages.dev');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.trim() === '生成');
    if (b) b.click();
  });
  await page.waitForTimeout(5000);
  const { modal, body } = await modalBody(page);
  check('A2 浏览器引擎生成 → 弹窗 qrcode.png', body.includes('qrcode.png'), body.slice(0, 60).replace(/\n/g, '|'));
  const imgVisible = await page.locator('main img[alt="QR"]').first().isVisible().catch(() => false);
  const imgSrc = imgVisible ? await page.locator('main img[alt="QR"]').first().getAttribute('src') : '';
  check('A3 预览图为 blob 出图（引擎真实渲染）', imgVisible && imgSrc.startsWith('blob:'), imgSrc.slice(0, 20));
  check('A4 无 405/error 文案', !JSON.stringify(await page.locator('main').innerText()).includes('405'));
  await page.close();
}

// B: 离线二维码识别（jsQR 往返真解码）
{
  const page = await mkOfflinePage({ width: 1360, height: 900 });
  await gotoCenter(page, '计算开发');
  await clickToolPill(page, '二维码识别');
  const note = await page.locator('main div', { hasText: '后端不在线' }).first().isVisible().catch(() => false);
  check('B1 离线黄条出现', note);
  const png = readFileSync('qr_r28_fixture.png');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: png });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes('开始识别'));
    if (b) b.click();
  });
  await page.waitForTimeout(6000);
  const mainText = await page.locator('main').innerText().catch(() => '');
  check('B2 jsQR 解码出内容（往返命中）', mainText.includes('zonkey-r28-roundtrip-20260907'));
  check('B3 结果行带 QR_CODE 徽标', mainText.includes('QR_CODE'));
  await page.close();
}

// C: 离线 PPT 转 PDF / 转长图 → 明确引导（不再 405）
const offlinePptCheck = async (page, pillLabel, tag) => {
  await gotoCenter(page, 'PPT 工坊');
  await clickToolPill(page, pillLabel);
  const note = await page.locator('main div', { hasText: '渲染引擎需要本机后端' }).first().isVisible().catch(() => false);
  check(`${tag}1 ${pillLabel} 离线提示条出现`, note);
  const dummy = Buffer.from('PK\x03\x04 offline-gate-probe');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'probe.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: dummy });
  await page.waitForTimeout(2500);
  const mainText = await page.locator('main').innerText().catch(() => '');
  check(`${tag}2 选文件后给出引导而非 HTTP 405`, mainText.includes('渲染引擎需要本机后端') && !mainText.includes('405'));
};
{
  const page = await mkOfflinePage({ width: 1360, height: 900 });
  await offlinePptCheck(page, 'PPT 转 PDF', 'C1');
  await page.close();
  const page2 = await mkOfflinePage({ width: 1360, height: 900 });
  await offlinePptCheck(page2, 'PPT 转长图', 'C2');
  await page2.close();
}

// D: 在线 PPT 转 PDF（PowerPoint COM 真渲染，在线路径无回归）
{
  const page = await mkPage({ width: 1360, height: 900 });
  await gotoCenter(page, 'PPT 工坊');
  await clickToolPill(page, 'PPT 转 PDF');
  const pptx = readFileSync('ppt_r28_fixture.pptx');
  await page.locator('input[type=file]').first().setInputFiles({ name: 'sample.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: pptx });
  await page.waitForTimeout(60000); // COM 冷启动慢
  const mainText = await page.locator('main').innerText().catch(() => '');
  check('D1 在线渲染完成提示', mainText.includes('渲染完成') || mainText.includes('PowerPoint') || mainText.includes('LibreOffice'), mainText.slice(0, 120).replace(/\n/g, '|'));
  check('D2 无错误', !mainText.includes('405') && !mainText.includes('失败'));
  await page.close();
}

console.log('\n=== round-28 手机网页版反馈冒烟 ===');
const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('Failed to load resource') && !e.includes('ERR_'));
console.log(realErrors.length ? realErrors.slice(0, 10) : '零 pageerror / console error');
await browser.close();
const failed = results.filter((r) => !r.ok).length;
process.exit(failed || realErrors.length ? 1 : 0);
