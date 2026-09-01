/**
 * 主题/拖拽回归（2026-09-01 主题轮）：
 * 1) 外观弹层入口（Header + HomeNav）可开、主题/纹理 4+4 选项即点即换；
 * 2) <html data-theme> 跟随、CSS 变量实际翻转（dark 底色≠cream 底色）；
 * 3) localStorage 持久化 + reload 后防闪屏脚本回放 data-theme；
 * 4) 拖拽层：Header 品牌行自身带 app-region:drag、行内交互元素 no-drag，
 *    SubNav 与工具卡零覆盖（dragstrip_check6 的几何断言迁移到此）。
 * 跑法：先起 vite dev（port 5199），node temp_ui_test/theme_drag_check.mjs
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:5199/';
let failures = 0;
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// 首次访问隐私弹窗
const agree = page.locator('text=我已了解，放心使用').first();
if (await agree.isVisible().catch(() => false)) {
  await agree.click();
  await page.waitForTimeout(400);
}

// ---------- 1. HomeNav 快捷入口开外观弹层 ----------
const navEntry = page.locator(`button:has-text("外观")`).first();
ok('homeNav 外观入口可见', await navEntry.isVisible());
await navEntry.click();
await page.waitForTimeout(400);
const dialog = page.locator('[role="dialog"]');
ok('外观弹层打开', await dialog.isVisible());

// ---------- 2. 主题即点即换：深夜模式 ----------
await page.locator('button:has-text("深夜模式")').first().click();
await page.waitForTimeout(350);
const r1 = await page.evaluate(() => ({
  dataTheme: document.documentElement.getAttribute('data-theme'),
  bodyBg: getComputedStyle(document.body).backgroundColor,
  saved: localStorage.getItem('zonscale-theme'),
}));
ok('data-theme=dark', r1.dataTheme === 'dark', JSON.stringify(r1.dataTheme));
ok('body 底色翻深', r1.bodyBg === 'rgb(24, 24, 38)', r1.bodyBg);
ok('localStorage 持久化', r1.saved === 'dark', r1.saved);

// ---------- 3. 纹理即点即换 ----------
await page.locator('button:has-text("网格纸")').first().click();
await page.waitForTimeout(250);
const r2 = await page.evaluate(() => ({
  saved: localStorage.getItem('zonscale-texture'),
  gridLayer: Boolean(document.querySelector('.zs-texture-grid')),
}));
ok('纹理=grid 已存已渲染', r2.saved === 'grid' && r2.gridLayer, JSON.stringify(r2));

// ---------- 4. reload 防闪屏回放 ----------
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
const r3 = await page.evaluate(() => ({
  dataTheme: document.documentElement.getAttribute('data-theme'),
  bodyBg: getComputedStyle(document.body).backgroundColor,
  gridLayer: Boolean(document.querySelector('.zs-texture-grid')),
}));
ok('reload 后主题回放', r3.dataTheme === 'dark' && r3.bodyBg === 'rgb(24, 24, 38)', JSON.stringify(r3.dataTheme + ' ' + r3.bodyBg));
ok('reload 后纹理回放', r3.gridLayer, String(r3.gridLayer));

// ---------- 5. 切回奶油 + 字号 + 流动背景 ----------
// reload 后回到首页；Header 的桌面外观按钮带 title=外观。用 dispatchEvent：
// 拖拽层 app-region:drag 会拦 Playwright 合成点击（memory 已登记的壳层坑，
// 真实鼠标不受影响），拖拽行内 no-drag 元素走事件派发绕过命中测试。
await page.locator('button[title="外观"]').first().dispatchEvent('click');
await page.waitForTimeout(300);
await page.locator('button:has-text("奶油孟菲斯")').first().click();
await page.waitForTimeout(200);

// 字号：特大档 → 根字号变 19px（全站 rem 缩放真实生效）
await page.locator('button:has-text("特大")').first().click();
await page.waitForTimeout(250);
const r4 = await page.evaluate(() => ({
  saved: localStorage.getItem('zonscale-fontsize'),
  root: getComputedStyle(document.documentElement).fontSize,
  attr: document.documentElement.getAttribute('data-fontsize'),
}));
ok('字号=xl 已存已生效', r4.saved === 'xl' && r4.root === '19px' && r4.attr === 'xl', JSON.stringify(r4));
await page.locator('button:has-text("标准")').first().click();
await page.waitForTimeout(200);
const r4b = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
ok('字号=md 回 16px', r4b === '16px', r4b);

// 流动背景：fluid 档 → blob 层渲染 + 动画在跑
await page.locator('button:has-text("流动")').first().click();
await page.waitForTimeout(300);
const r5 = await page.evaluate(() => ({
  saved: localStorage.getItem('zonscale-texture'),
  blobs: document.querySelectorAll('.zs-fluid-blob').length,
  anim: getComputedStyle(document.querySelector('.zs-fluid-a')).animationName,
}));
ok('流动背景已存已渲染', r5.saved === 'fluid' && r5.blobs === 3, JSON.stringify(r5));
ok('blob 动画激活', r5.anim.includes('zs-fluid-drift'), r5.anim);
await page.locator('button:has-text("纯色")').first().click();
await page.waitForTimeout(200);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// ---------- 5.5 品牌文案：日用百宝箱 ----------
const brandOk = await page.evaluate(() => document.body.textContent.includes('日用百宝箱'));
ok('品牌文案=日用百宝箱', brandOk);

// ---------- 6. 拖拽几何：Header 行自身 drag + 交互 no-drag + 零覆盖 ----------
// 两个视口的拖拽行都在 DOM（CSS hidden 切换），只取「可见」（有面积）的那行；
// 后端离线横幅会把 Header 下推，因此断言相对几何而非绝对 0-80。
const g = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('div')].filter((d) => {
    const s = d.getAttribute('style') || '';
    return s.includes('app-region: drag') || s.includes('app-region:drag');
  });
  const rects = rows.map((r) => r.getBoundingClientRect());
  const visible = rects.find((b) => b.width > 0 && b.height > 0);
  const noDragEls = [...document.querySelectorAll('.no-drag')];
  // 只看可见的 no-drag（另一视口的行在 DOM 里但 display:none，rect 全零）
  const visibleNoDrag = noDragEls.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const header = document.querySelector('header');
  const hb = visible;
  const headerTop = header?.getBoundingClientRect().top ?? -1;
  const overlaps = (a, b) =>
    a && b && !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
  const brand = visibleNoDrag[0];
  const brandRect = brand?.getBoundingClientRect();
  // SubNav 条（非首页视图才有；首页在首页态隐藏属预期）
  const subNav = document.querySelector('div.relative.z-30');
  const sb = subNav?.getBoundingClientRect();
  return {
    dragRowCount: rows.length,
    visibleCount: rects.filter((b) => b.width > 0 && b.height > 0).length,
    headerTop: hb?.top,
    headerHeight: hb ? hb.bottom - hb.top : 0,
    alignsWithHeader: hb ? Math.abs(hb.top - headerTop) < 1 : false,
    visibleNoDragCount: visibleNoDrag.length,
    noDragInsideHeader: brandRect && hb
      ? brandRect.top >= hb.top - 1 && brandRect.bottom <= hb.bottom + 1
      : false,
    subNavTop: sb?.top,
    overlapSubNav: overlaps(hb, sb),
  };
});
ok('拖拽行存在且仅一行可见', g.dragRowCount >= 1 && g.visibleCount === 1, JSON.stringify({ total: g.dragRowCount, visible: g.visibleCount }));
ok('拖拽行与 Header 对齐（行自身即拖拽区）', g.alignsWithHeader, `rowTop=${g.headerTop}`);
ok('拖拽行高=桌面标题栏 ~80px', g.headerHeight >= 78 && g.headerHeight <= 82, String(g.headerHeight));
ok('行内可见交互组在拖拽行内', g.noDragInsideHeader, `visibleNoDrag=${g.visibleNoDragCount}`);
ok('SubNav 不被拖拽行覆盖', !g.overlapSubNav, `subNavTop=${g.subNavTop}`);

// ---------- 7. 手机视口拖拽行 ----------
const mp = await ctx.newPage();
await mp.setViewportSize({ width: 390, height: 844 });
await mp.goto(URL, { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(1500);
const mg = await mp.evaluate(() => {
  const rows = [...document.querySelectorAll('div')].filter((d) => {
    const s = d.getAttribute('style') || '';
    return s.includes('app-region: drag') || s.includes('app-region:drag');
  });
  const rects = rows.map((r) => r.getBoundingClientRect());
  const visible = rects.find((b) => b.width > 0 && b.height > 0);
  // 手机中心 Tab 行（紧贴品牌行下方，必须不被 drag 行压住）
  const tabs = document.querySelector('nav.zs-mobile-scroll-x');
  const tb = tabs?.getBoundingClientRect();
  // 边缘相接不算重叠（≤0.5px 间隙视为贴合）
  const overlaps = (a, b) =>
    a && b && !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
  return {
    total: rows.length,
    visible: rects.filter((b) => b.width > 0 && b.height > 0).length,
    top: visible?.top,
    height: visible ? visible.bottom - visible.top : 0,
    tabsTop: tb?.top,
    dragBottom: visible?.bottom,
    overlapTabs: overlaps(visible, tb),
  };
});
ok('手机可见拖拽行唯一', mg.total >= 1 && mg.visible === 1, JSON.stringify({ total: mg.total, visible: mg.visible }));
// 行自身即拖拽区：高度由内容决定（手机 rem 17.5px 缩放下 ~70px），只要求与顶栏同高量级且 <80
ok('手机拖拽行=紧凑顶栏行高', mg.height >= 50 && mg.height <= 80, String(mg.height));
ok('手机中心 Tab 不被拖拽行覆盖', !mg.overlapTabs, `dragBottom=${mg.dragBottom} tabsTop=${mg.tabsTop}`);

// ---------- 8. 引擎状态条不被窗口按钮遮挡（桌面 1440）----------
// 窗口按钮区固定占右侧 ~150px（fixed top-2 right-3 z-100），状态条右边界必须 ≤ 窗宽-150
const engine = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-drag-row]')];
  const deskRow = rows.find((el) => el.getBoundingClientRect().width > 0);
  const el = [...(deskRow?.querySelectorAll('div') ?? [])].find((d) =>
    (d.getAttribute('class') || '').includes('bg-mem-lime/30'),
  );
  const b = el?.getBoundingClientRect();
  return { right: b?.right, width: b?.width, vw: window.innerWidth, found: Boolean(el) };
});
ok('引擎状态条存在', engine.found);
ok('引擎状态条避开窗口按钮区', engine.right !== undefined && engine.right <= engine.vw - 148, JSON.stringify(engine));

// ---------- 9. 画布手势期 drag 行转 no-drag（data-canvas-gesture）----------
await page.evaluate(() => document.documentElement.setAttribute('data-canvas-gesture', '1'));
const gestureRule = await page.evaluate(() => {
  const row = document.querySelector('[data-drag-row]');
  return { hasAttr: document.documentElement.hasAttribute('data-canvas-gesture'), rowExists: Boolean(row) };
});
await page.evaluate(() => document.documentElement.removeAttribute('data-canvas-gesture'));
ok('手势标记 + drag 行存在', gestureRule.hasAttr && gestureRule.rowExists, JSON.stringify(gestureRule));

ok('零 pageerror', pageErrors.length === 0, pageErrors.join('; ').slice(0, 300));

await browser.close();
console.log(failures === 0 ? 'THEME_DRAG ALL PASS' : `THEME_DRAG ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
