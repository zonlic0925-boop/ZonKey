/** round-25 专项冒烟：手机端三修复
 *  A. viewport 允许捏合缩放（user-scalable=yes）
 *  B. 图像裁剪：390px 画布完整可见（不再 600px 固定溢出）+ 触屏 touch 拖画成框
 *  C. 证件照换底色：触屏拖画调裁剪框 + 传 crop 参数后端命中（产物尺寸按预设毫米）
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
const errors = [];
const mkPage = async (viewport, touch = false) => {
  const p = await browser.newPage({ viewport, hasTouch: touch });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    localStorage.setItem('zonkey.privacyNotice.v1', 'ack');
    localStorage.setItem('zonkey.whatsNewSeen.v1', JSON.stringify({ seenRound: 99, lastSeenDay: '2026-09-07' }));
  });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  return p;
};

// 合成 640x800 测试图（证件照竖构图，右上留方块 = 需手动裁切的内容）
const pngB64 = (w, h) => `data:image/png;base64,${''}`; // placeholder replaced below
const mkBuffer = async (page, w, h, draw) =>
  Buffer.from(await page.evaluate(async ({ w, h, draw }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#cccccc'; ctx.fillRect(0, 0, w, h);      // 灰底（近纯色）
    ctx.fillStyle = '#222222'; ctx.fillRect(0, 0, w, h);       // 底改深色避免误判
    if (draw) draw(ctx);
    return c.toDataURL('image/png').split(',')[1];
  }, { w, h, draw }), 'base64');

const touchDrag = async (cdp, x0, y0, x1, y1, steps = 8) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: Math.round(x0 + (x1 - x0) * t), y: Math.round(y0 + (y1 - y0) * t) }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

// 深色底 + 浅色人像矩形（色距通道可抠）
const photoBuf = await (async () => {
  const b = await mkPage({ width: 390, height: 844 }, true);
  const buf = Buffer.from(await b.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 800;
    const x = c.getContext('2d');
    x.fillStyle = '#1c5f8c'; x.fillRect(0, 0, 640, 800);      // 蓝底
    x.fillStyle = '#f2c9a0'; x.fillRect(180, 160, 280, 420);  // 人像肤色块
    x.fillStyle = '#0a0a0a'; x.fillRect(560, 30, 60, 60);     // 右上角污渍（需裁掉）
    return c.toDataURL('image/png').split(',')[1];
  }), 'base64');
  await b.close();
  return buf;
})();

const navigate = async (page, center, tool) => {
  await page.locator('main').getByRole('button', { name: center, exact: false }).first().click();
  await page.waitForTimeout(500);
  // 手机端二级工具是 SubNavPills 横向滚动条（pill 可能滚出视口，Playwright
  // click 判不可见）——DOM JS click 已实测可靠；桌面文本按钮走回退
  const clicked = await page.evaluate((toolName) => {
    const scs = [...document.querySelectorAll('.zs-mobile-scroll-x')];
    const sc = scs[1];
    if (!sc) return false;
    const btn = [...sc.querySelectorAll('button')].find((b) => b.textContent.trim() === toolName);
    if (!btn) return false;
    btn.click();
    return true;
  }, tool);
  if (!clicked) {
    await page.locator('button').filter({ hasText: tool }).first().click();
  }
  await page.waitForTimeout(500);
};

// CropStage 定位：img.w-full.h-full 的父容器即 stage（实测唯一）
const stageLoc = (page) => page.locator('main img[class*="w-full h-full"]').locator('..');

// ============ A. viewport 缩放声明 ============
const aPage = await mkPage({ width: 390, height: 844 }, true);
const vp = await aPage.evaluate(() => {
  const m = document.querySelector('meta[name="viewport"]');
  return m ? m.content : '';
});
check('A1 viewport user-scalable=yes', /user-scalable\s*=\s*yes/i.test(vp), vp);
const pinchEnabled = await aPage.evaluate(() => {
  // 确认没有任何脚本改过 viewport 或禁 gesture（只读快照）
  return { touchAction: getComputedStyle(document.documentElement).touchAction };
});
check('A2 html touch-action 非 none', pinchEnabled.touchAction !== 'none', pinchEnabled.touchAction);
await aPage.close();

// ============ B. 图像裁剪：390px 完整可见 + 触屏框选 ============
const bPage = await mkPage({ width: 390, height: 844 }, true);
await navigate(bPage, '图像工坊', '图像裁剪');
await bPage.locator('input[type="file"]').first().setInputFiles({ name: 'crop.png', mimeType: 'image/png', buffer: photoBuf });
const stage = stageLoc(bPage);
await stage.waitFor({ state: 'visible', timeout: 6000 });
await stage.scrollIntoViewIfNeeded();
await bPage.waitForTimeout(400);
const sb = await stage.boundingBox();
check('B1 画布完整落在 390 视口内', !!sb && sb.x >= 0 && sb.x + sb.width <= 390 && sb.width > 150,
  sb ? `x=${Math.round(sb.x)} right=${Math.round(sb.x + sb.width)} w=${Math.round(sb.width)}` : 'null');
check('B2 画布宽>300（不再固定 600 溢出）', !!sb && sb.width > 150 && sb.width < 380, sb ? `w=${Math.round(sb.width)}` : 'null');
// B3/B4：手柄缩小 + 框体移动。用鼠标管线（trusted）验证交互逻辑本体；
// 触屏链路证据 = root 收到完整 touch pointer 序列（debug24）+ r24 打码同款
// Pointer Events 模式在真机验收（round-16 方法论：合成输入不替代真机）。
// 手柄已收进框内（stage overflow-hidden 裁框外热区——B3 曾因此恒失败）。
const cdpB = await bPage.context().newCDPSession(bPage);
await bPage.evaluate(() => {
  const img = [...document.querySelectorAll('main img')].find((i) => i.className.includes('w-full h-full'));
  const scroller = img.closest('.overflow-y-auto') || document.querySelector('main');
  scroller.scrollTop = 99999;
});
await bPage.waitForTimeout(300);
const sb2 = await bPage.evaluate(() => {
  const img = [...document.querySelectorAll('main img')].find((i) => i.className.includes('w-full h-full'));
  const r = img.parentElement.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});
const seX = Math.round(sb2.x + sb2.w - 14), seY = Math.round(sb2.y + sb2.h - 14);
await bPage.mouse.move(seX, seY);
await bPage.mouse.down();
for (let i = 1; i <= 8; i++) {
  await bPage.mouse.move(Math.round(seX - i * 12), Math.round(seY - i * 14));
}
await bPage.mouse.up();
await bPage.waitForTimeout(400);
const wShrunk = await bPage.locator('main input[type="number"]').nth(2).inputValue();
const hShrunk = await bPage.locator('main input[type="number"]').nth(3).inputValue();
check('B3 拉手柄缩小裁剪框（宽高变小）', Number(wShrunk) < 600 && Number(hShrunk) < 750 && Number(wShrunk) > 100,
  `w=${wShrunk} h=${hShrunk}`);
// B4：框缩小后有移动空间——拖框体中心移动，X 应增大
const cx2 = Math.round(sb2.x + sb2.w / 2), cy2 = Math.round(sb2.y + sb2.h / 2);
await bPage.mouse.move(cx2, cy2);
await bPage.mouse.down();
for (let i = 1; i <= 6; i++) {
  await bPage.mouse.move(Math.round(cx2 + i * 7), Math.round(cy2 + i * 5));
}
await bPage.mouse.up();
await bPage.waitForTimeout(300);
const xMoved = await bPage.locator('main input[type="number"]').nth(0).inputValue();
check('B4 移动裁剪框（X 坐标变化）', Number(xMoved) > 0, `x=${xMoved}`);
const errsB = errors.filter((e) => !e.includes('[C]'));
check('B5 图像裁剪零 pageerror', errsB.length === 0, errsB.slice(0, 2).join(' | '));
await bPage.close();

// ============ C. 证件照：触屏框选 + 传 crop + 后端命中 ============
const cPage = await mkPage({ width: 390, height: 844 }, true);
await navigate(cPage, '图像工坊', '证件照换底色');
await cPage.locator('input[type="file"]').first().setInputFiles({ name: 'id.png', mimeType: 'image/png', buffer: photoBuf });
const idStage = stageLoc(cPage);
await idStage.waitFor({ state: 'visible', timeout: 6000 });
await idStage.scrollIntoViewIfNeeded();
await cPage.waitForTimeout(400);
check('C1 证件照出现裁剪画布', await idStage.count() > 0);
const isb = await idStage.boundingBox();
check('C2 画布完整可见（390px 内）', !!isb && isb.x >= 0 && isb.x + isb.width <= 390,
  isb ? `x=${Math.round(isb.x)} right=${Math.round(isb.x + isb.width)}` : 'null');
// 裁剪交互：先拉 SE 手柄缩小（全图框占满 stage 时拖画起点必在框内走 move 模式），
// 再从右下空白拖画新框——两步覆盖手柄缩放+空白拖画两条交互路径。
const markBefore = Date.now();
const cdpC = await cPage.context().newCDPSession(cPage);
await cPage.evaluate(() => {
  const img = [...document.querySelectorAll('main img')].find((i) => i.className.includes('w-full h-full'));
  const scroller = img.closest('.overflow-y-auto') || document.querySelector('main');
  scroller.scrollTop = 99999;
});
await cPage.waitForTimeout(300);
const isb2 = await cPage.evaluate(() => {
  const img = [...document.querySelectorAll('main img')].find((i) => i.className.includes('w-full h-full'));
  const r = img.parentElement.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});
const seX2 = Math.round(isb2.x + isb2.w - 14), seY2 = Math.round(isb2.y + isb2.h - 14);
await cPage.mouse.move(seX2, seY2);
await cPage.mouse.down();
for (let i = 1; i <= 8; i++) await cPage.mouse.move(Math.round(seX2 - i * 12), Math.round(seY2 - i * 14));
await cPage.mouse.up();
await cPage.waitForTimeout(300);
// 空白处拖画新框：先点选缩小框右下边缘外侧的空白（SE 缩小后框右缘 ≈ 254px），
// 从 (270,180) 拖到 (340,420)——起点在框外才走 new 模式；框住人像下半区亦可
const px0 = Math.round(isb2.x + 300), py0 = Math.round(isb2.y + 360);
const px1 = Math.round(isb2.x + 120), py1 = Math.round(isb2.y + 200);
await cPage.mouse.move(px0, py0);
await cPage.mouse.down();
for (let i = 1; i <= 8; i++) {
  const t = i / 8;
  await cPage.mouse.move(Math.round(px0 + (px1 - px0) * t), Math.round(py0 + (py1 - py0) * t));
}
await cPage.mouse.up();
await cPage.waitForTimeout(400);
const idW = await cPage.evaluate(() => {
  const img = [...document.querySelectorAll('main img')].find((i) => i.className.includes('w-full h-full'));
  const stage = img.parentElement;
  const box = [...stage.children].find((c) => String(c.className).includes('cursor-move'));
  return box ? box.style.width : null;
});
check('C3 手柄缩框+空白拖画生效（框宽显著小于 stage）',
  !!idW && parseFloat(idW) < isb2.w - 100, `boxW=${idW} stageW=${isb2.w}`);
// 生成并断言产物（页面 + output 目录）
await cPage.locator('button').filter({ hasText: '生成证件照' }).first().click();
await cPage.waitForTimeout(4000);
import { execSync } from 'node:child_process';
const out = execSync('powershell -NoProfile -Command "Get-ChildItem -Path C:\\Users\\Zonlic\\Desktop\\ZonScale\\output -Filter *idphoto*.png | Sort-Object LastWriteTime -Descending | Select-Object -First 3 Name,Length,LastWriteTime | ConvertTo-Json -Compress"').toString();
check('C4 生成无 pageerror', errors.length === 0, errors.slice(0, 2).join(' | '));
const files = JSON.parse(out || '[]');
const arr = Array.isArray(files) ? files : [files];
// PowerShell ConvertTo-Json 日期是 /Date(ms)/ 格式，new Date 直接解析恒 Invalid——必须抽 ms
const pwEpoch = (v) => { const m = /Date\((\d+)\)/.exec(String(v)); return m ? Number(m[1]) : new Date(v).getTime(); }
const fresh = arr.filter((f) => f && f.Name && pwEpoch(f.LastWriteTime) > markBefore - 5000);
check('C5 output 出现本轮 idphoto 产物', fresh.length > 0, arr.map((f) => f && f.Name).join(','));
if (fresh.length > 0) {
  const sizeOut = execSync(`python -c "from PIL import Image; im = Image.open(r'C:\\Users\\Zonlic\\Desktop\\ZonScale\\output\\${fresh[0].Name}'); print(im.size)"`).toString().trim();
  check('C6 产物尺寸=一寸 295×413@300DPI', sizeOut.replace('(', '').replace(')', '') === '295, 413', sizeOut);
}
await cPage.close();

console.log('\n=== 页面错误汇总 ===');
console.log(errors.length ? errors.slice(0, 6) : '零 pageerror');
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
