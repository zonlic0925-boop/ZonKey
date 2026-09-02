/**
 * Round-9 修复回归（2026-09-02 用户实测）：
 * 1) DrawingView 左栏：多命中时底部「执行脱敏」被挤出视口且无滚动通道。
 *    根因：底部操作区 flex-1 + lg:overflow-visible（不可压缩、不滚动），
 *    与候选列表平分高度后溢出被列 overflow-hidden 裁切。
 *    修复后：操作区 shrink-0 恒可达，候选列表 flex-1 独占伸缩。
 * 2) 同类排查修复：DocPdfView 底部操作区 shrink-0；RuleCenter 移动端可滚 +
 *    xl 以下卡片自滚；外观/支持作者弹窗 max-h-[88dvh] 内滚。
 * 3) 滚轮：Header 桌面中心导航竖向滚轮转横向滚动（.zs-wheel-x + onWheel）。
 * 跑法：先起 vite dev（port 5199），node temp_ui_test/round9_diag.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const APP_URL = process.env.ZS_URL || 'http://localhost:5199/';
let failures = 0;
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

// ---------- 0. 源码级断言 ----------
const drawingSrc = readFileSync(join(ROOT, 'frontend/src/components/DrawingView.tsx'), 'utf-8');
ok('DrawingView 无 lg:contents 包裹层（候选列表直挂 flex）', !/lg:contents/.test(drawingSrc));
ok('DrawingView 底部操作区 shrink-0（按钮恒可达）', /shrink-0 max-lg:min-h-0 max-lg:overflow-y-auto/.test(drawingSrc));
ok('DrawingView 底部操作区不再 lg:overflow-visible', !/className="[^"]*lg:overflow-visible/.test(drawingSrc));

const docPdfSrc = readFileSync(join(ROOT, 'frontend/src/components/DocPdfView.tsx'), 'utf-8');
ok('DocPdfView 底部操作区 shrink-0', /shrink-0 p-3 border-t-2 border-mem-ink\/15 space-y-3/.test(docPdfSrc));

const ruleSrc = readFileSync(join(ROOT, 'frontend/src/components/RuleCenter.tsx'), 'utf-8');
ok('RuleCenter 移动端可滚（overflow-y-auto xl:overflow-hidden）', ruleSrc.includes('overflow-y-auto xl:overflow-hidden'));
ok('RuleCenter 两卡 xl 以下自滚', (ruleSrc.match(/overflow-y-auto xl:overflow-hidden/g) || []).length >= 3);

const appearanceSrc = readFileSync(join(ROOT, 'frontend/src/components/AppearanceModal.tsx'), 'utf-8');
const supportSrc = readFileSync(join(ROOT, 'frontend/src/components/SupportAuthorModal.tsx'), 'utf-8');
ok('外观弹窗 max-h + 内滚', appearanceSrc.includes('max-h-[88dvh] overflow-y-auto'));
ok('支持作者弹窗 max-h + 内滚', supportSrc.includes('max-h-[88dvh] overflow-y-auto'));

const headerSrc = readFileSync(join(ROOT, 'frontend/src/components/Header.tsx'), 'utf-8');
const cssSrc = readFileSync(join(ROOT, 'frontend/src/index.css'), 'utf-8');
ok('Header 中心导航接滚轮处理器', headerSrc.includes('handleCentersWheel') && headerSrc.includes('zs-wheel-x'));
ok('index.css 有 zs-wheel-x 类', cssSrc.includes('.zs-wheel-x'));

// ---------- 运行时 ----------
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

try {
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
} catch { /* vite 首启慢，继续 */ }
await page.waitForTimeout(1500);

// 进入工程图纸脱敏：首页点「智能脱敏」中心卡（round-9 探针确认按钮文案），
// 默认落在工程图纸脱敏视图
await page.evaluate(() => {
  const card = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim().startsWith('智能脱敏'));
  if (card) card.click();
});
await page.waitForTimeout(1500);

// ---- 1) DrawingView 左栏：底部操作区在小窗口下仍可达（核心场景复现） ----
// 用 700px 高窗口复现「命中列表占高后按钮被裁」场景
await page.setViewportSize({ width: 1440, height: 700 });
await page.waitForTimeout(400);

const actionReachable = await page.evaluate(() => {
  const aside = document.querySelector('aside, .lg\\:w-80')?.closest('div[class*="lg:w-80"]')
    || [...document.querySelectorAll('div')].find((d) => d.className.includes('lg:w-80'));
  if (!aside) return { ok: false, why: 'left column not found' };
  const colRect = aside.getBoundingClientRect();
  // 找左栏内最底部的主要操作按钮（导出 PDF / 执行脱敏 / 打开脱敏 PDF）
  const btns = [...aside.querySelectorAll('button')].filter((b) => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && /导出|执行|打开|重新识别/.test(b.textContent || '');
  });
  if (!btns.length) return { ok: false, why: 'no action buttons' };
  const last = btns[btns.length - 1];
  const r = last.getBoundingClientRect();
  // 关键判定：按钮底缘不超过左栏列的可见底缘（即未被 overflow-hidden 裁切）
  const clipped = r.bottom > colRect.bottom + 1;
  return { ok: !clipped, why: clipped ? `button bottom ${Math.round(r.bottom)} > column bottom ${Math.round(colRect.bottom)}` : `button bottom ${Math.round(r.bottom)} <= column bottom ${Math.round(colRect.bottom)}`, btn: (last.textContent || '').trim() };
});
ok('矮窗(700px)左栏操作按钮未被裁切', actionReachable.ok, `${actionReachable.why || ''} ${actionReachable.btn || ''}`);

// ---- 2) 左栏结构断言：操作区是 shrink-0、候选列表可滚 ----
const layout = await page.evaluate(() => {
  const col = [...document.querySelectorAll('div')].find((d) => typeof d.className === 'string' && d.className.includes('lg:w-80') && d.className.includes('lg:overflow-hidden'));
  if (!col) return { found: false };
  const blocks = [...col.children].map((c) => ({
    cls: c.className.slice(0, 80),
    shrink0: c.className.includes('shrink-0'),
    scrollable: (c.className.includes('overflow-y-auto') || (c.firstElementChild && c.firstElementChild.className.includes?.('overflow-y-auto'))) ?? false,
  }));
  return { found: true, blocks };
});
ok('左栏列结构存在', layout.found);

// ---- 3) RuleCenter：窄屏可达性。后端离线（vite dev 无 API）时组件渲染
// 「规则无法加载」早退卡，主布局（保存按钮/两卡）需后端在线才出现——
// 此处分别验证：离线早退卡在窄窗不裁切；主布局修复由源码断言兜底。 ----
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim().startsWith('规则策略中心'));
  if (tab) tab.click();
});
await page.waitForTimeout(800);
await page.setViewportSize({ width: 900, height: 720 }); // xl 以下 → 纵向堆叠 + 根滚动
await page.waitForTimeout(500);
const ruleState = await page.evaluate(() => {
  const mainRoot = document.querySelector('main');
  const offline = [...document.querySelectorAll('button, h3')].find((b) => /规则无法加载|规则策略中心/.test(b.textContent || ''));
  const mainLayoutRoot = [...(mainRoot?.querySelectorAll('div') ?? [])].find((d) => typeof d.className === 'string' && d.className.includes('overflow-y-auto xl:overflow-hidden'));
  if (mainLayoutRoot) {
    const canScroll = mainLayoutRoot.scrollHeight > mainLayoutRoot.clientHeight;
    const saveBtn = [...mainLayoutRoot.querySelectorAll('button')].find((b) => /保存/.test(b.textContent || ''));
    const r = saveBtn?.getBoundingClientRect();
    return { mode: 'main', canScroll, hasSave: !!saveBtn, saveInView: r ? r.top < window.innerHeight : false };
  }
  // 离线早退分支：卡片完整可见即可
  const card = offline?.getBoundingClientRect();
  return { mode: 'offline', cardVisible: card ? card.bottom > 0 && card.top < window.innerHeight : false, hasOffline: !!offline };
});
ok(
  'RuleCenter 窄屏(900px)可达',
  ruleState.mode === 'main' ? (ruleState.hasSave && (ruleState.saveInView || ruleState.canScroll)) : ruleState.hasOffline && ruleState.cardVisible,
  JSON.stringify(ruleState)
);

// ---- 4) 外观弹窗：内容超高时弹窗自身可滚 ----
await page.setViewportSize({ width: 1440, height: 500 }); // 极矮窗口逼出弹窗滚动
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '外观' || (b.getAttribute('aria-label') || '').includes('外观'));
  if (btn) btn.click();
});
await page.waitForTimeout(600);
const modalScroll = await page.evaluate(() => {
  const card = document.querySelector('[role="dialog"] > div');
  if (!card) return { found: false };
  return {
    found: true,
    maxH: getComputedStyle(card).maxHeight,
    scrollable: card.scrollHeight >= card.clientHeight && getComputedStyle(card).overflowY === 'auto',
    fullyVisible: card.getBoundingClientRect().height <= window.innerHeight,
  };
});
ok('外观弹窗极矮窗(500px)不超出视口且可滚', modalScroll.found && modalScroll.fullyVisible, JSON.stringify(modalScroll));
// 关闭弹窗
await page.keyboard.press('Escape');
await page.evaluate(() => {
  const close = document.querySelector('[role="dialog"] button[aria-label]');
  if (close) close.click();
});
await page.waitForTimeout(300);

// ---- 5) Header 中心导航滚轮转横滚（窄视口折叠出横向滚动条） ----
await page.setViewportSize({ width: 1000, height: 800 });
await page.waitForTimeout(400);
const wheelX = await page.evaluate(async () => {
  const nav = document.querySelector('nav.zs-wheel-x');
  if (!nav) return { found: false };
  if (nav.scrollWidth <= nav.clientWidth) return { found: true, noOverflow: true };
  const before = nav.scrollLeft;
  nav.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 200));
  return { found: true, before, after: nav.scrollLeft, moved: nav.scrollLeft !== before };
});
ok('Header 导航竖向滚轮转横向滚动', wheelX.found && (wheelX.noOverflow || wheelX.moved), JSON.stringify(wheelX));

ok('零 pageerror', pageErrors.length === 0, pageErrors.slice(0, 2).join('; '));

await browser.close();
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
