/** round-24 专项冒烟：图片打码 Pointer Events 框选 E2E + 证件照尺寸预览真实比例。
 *  依赖：8765 后端在线（dist_web 托管）。
 */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8765';
const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('zonkey.privacyNotice.v1', 'ack');
  localStorage.setItem('zonkey.whatsNewSeen.v1', JSON.stringify({ seenRound: 99, lastSeenDay: '2026-09-04' }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);

// ---- A. 图片打码：注入测试图 + Pointer 事件框选 ----
await page.locator('main').getByRole('button', { name: '图像工坊', exact: false }).first().click();
await page.waitForTimeout(400);
await page.locator('button').filter({ hasText: '图片打码' }).first().click();
await page.waitForTimeout(500);

// 合成 400x300 测试图（set_input_files 免对话框）
const pngB64 = await page.evaluate(async () => {
  const c = document.createElement('canvas');
  c.width = 400; c.height = 300;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eeeeee'; ctx.fillRect(0, 0, 400, 300);
  ctx.fillStyle = '#333333'; ctx.fillRect(150, 80, 100, 80);
  return c.toDataURL('image/png').split(',')[1];
});
const buffer = Buffer.from(pngB64, 'base64');
await page.locator('input[type="file"]').first().setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer });

const img = page.locator('main img[draggable="false"]').first();
await img.waitFor({ state: 'visible', timeout: 5000 });
const box = await img.boundingBox();
check('A1 测试图加载', !!box && box.width > 100, `box=${Math.round(box.width)}x${Math.round(box.height)}`);

// 用鼠标在图上拖一个框（Playwright mouse 触发 pointer 事件链）
const scale = box.width / 400;
await page.mouse.move(box.x + 40 * scale, box.y + 40 * scale);
await page.mouse.down();
await page.mouse.move(box.x + 200 * scale, box.y + 180 * scale, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(300);
const regionCount = await page.locator('main').getByText(/已框选|个区域|Regions?/i).count();
check('A2 鼠标 pointer 框选成区', regionCount > 0, `hint count=${regionCount}`);

// 触屏模拟：hasTouch 上下文再用 touch 拖第二个框
const touchPage = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
touchPage.on('pageerror', (e) => errors.push('[touch] ' + e.message));
await touchPage.goto(BASE, { waitUntil: 'domcontentloaded' });
await touchPage.evaluate(() => {
  localStorage.setItem('zonkey.privacyNotice.v1', 'ack');
  localStorage.setItem('zonkey.whatsNewSeen.v1', JSON.stringify({ seenRound: 99, lastSeenDay: '2026-09-04' }));
});
await touchPage.reload({ waitUntil: 'networkidle' });
await touchPage.waitForTimeout(800);
await touchPage.locator('main').getByRole('button', { name: '图像工坊', exact: false }).first().click();
await touchPage.waitForTimeout(400);
await touchPage.locator('button').filter({ hasText: '图片打码' }).first().click();
await touchPage.waitForTimeout(500);
await touchPage.locator('input[type="file"]').first().setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer });
const timg = touchPage.locator('main img[draggable="false"]').first();
await timg.waitFor({ state: 'visible', timeout: 5000 });
await timg.scrollIntoViewIfNeeded();
await touchPage.waitForTimeout(300);
const tbox = await timg.boundingBox();
// 探针：确认 pointer 事件链与坐标
await touchPage.evaluate(() => {
  window.__pev = [];
  for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
    document.addEventListener(type, (e) => {
      window.__pev.push(`${type}:${e.pointerType}@${Math.round(e.clientX)},${Math.round(e.clientY)}`);
    }, true);
  }
});
// 拖拽起点取图片内部（视口可见范围内）30px 处
const dx = tbox.x + 30, dy = tbox.y + 30;
await touchPage.touchscreen.tap(dx, dy); // 先 tap 确认无异常
// pointerdown/move/up via touchscreen drag (touchscreen 只有点击 API，用手动 CDP 拖)
const cdp = await touchPage.context().newCDPSession(touchPage);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: dx, y: dy }] });
for (let i = 1; i <= 5; i++) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: dx + i * 15, y: dy + i * 12 }] });
}
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await touchPage.waitForTimeout(400);
const pev = await touchPage.evaluate(() => window.__pev);
const downOk = pev.some((e) => e.startsWith('pointerdown:touch@'));
const moveOk = pev.some((e) => e.startsWith('pointermove:touch@'));
check('B0 pointer 事件链收到 touch 输入', downOk && moveOk, pev.slice(0, 3).join(' | '));
const tRegion = await touchPage.locator('main').getByText(/已框选|个区域|Regions?/i).count();
check('B1 触屏 touch 框选成区（pointer 事件链）', tRegion > 0, `hint count=${tRegion}`);
check('B2 手机 390px 零 pageerror', errors.length === 0, errors.slice(0, 3).join(' | '));

// ---- C. 证件照尺寸预览真实比例 ----
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.locator('main').getByRole('button', { name: '图像工坊', exact: false }).first().click();
await page.waitForTimeout(400);
await page.locator('button').filter({ hasText: '证件照换底色' }).first().click();
await page.waitForTimeout(500);
// 预览块：跟随选择变化的 mm 比例框
const pv = page.locator('main div[style*="backgroundColor"]').filter({ has: page.locator('div') });
// 直接按结构找：含 "mm @ 300DPI" 文本的容器里的第一个纯色 div
const mmText = page.locator('main').getByText('mm @ 300DPI');
check('C1 尺寸预览存在', await mmText.count() > 0);

const probe = async () => {
  // 预览 div 宽高
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('main div')];
    const label = els.find((e) => e.textContent === '25×35 mm @ 300DPI' || /mm @ 300DPI/.test(e.textContent || '') && e.children.length === 0);
    if (!label) return null;
    // 找同容器中的纯色预览块（有 border-2 且内联宽高样式）
    const container = label.closest('div.flex');
    const box = container ? [...container.querySelectorAll('div')].find((d) => d.style.width && d.style.height && d.style.backgroundColor) : null;
    if (!box) return null;
    const r = box.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
};
await page.locator('select').first().selectOption('one-inch');
await page.waitForTimeout(200);
const one = await probe();
check('C2 一寸预览渲染', !!one && one.w > 20, one ? `${Math.round(one.w)}x${Math.round(one.h)}` : 'null');
const ratioOne = one ? one.w / one.h : 0;
await page.locator('select').first().selectOption('two-inch');
await page.waitForTimeout(200);
const two = await probe();
const ratioTwo = two ? two.w / two.h : 0;
// 真实比例断言：25/35=0.714, 35/49=0.714 —— 宽高比都是 5:7；换到小两寸 33/48=0.6875 才有差异
await page.locator('select').first().selectOption('small-two-inch');
await page.waitForTimeout(200);
const small = await probe();
const ratioSmall = small ? small.w / small.h : 0;
check('C3 比例数值正确', Math.abs(ratioOne - 25 / 35) < 0.02 && Math.abs(ratioSmall - 33 / 48) < 0.02,
  `one=${ratioOne.toFixed(3)} small=${ratioSmall.toFixed(3)}`);
// 大小差异：一寸块应小于二寸块（同比例尺）
await page.locator('select').first().selectOption('two-inch');
await page.waitForTimeout(200);
const twoAgain = await probe();
check('C4 二寸 > 一寸（同比例尺）', !!twoAgain && one && twoAgain.w > one.w && twoAgain.h > one.h,
  twoAgain ? `${Math.round(twoAgain.w)}x${Math.round(twoAgain.h)}` : 'null');

console.log('\n=== 页面错误 ===');
console.log(errors.length ? errors.slice(0, 5) : '零 pageerror');
await browser.close();
const failed = results.filter((r) => !r.ok);
process.exit(failed.length || errors.length ? 1 : 0);
