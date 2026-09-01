/**
 * Round-6 修复回归（2026-09-01 用户实测 3 问题）：
 * 1) 引擎状态芯片文字被压成竖条：engineLabel span 需有 min-width 底线，
 *    中列收缩时文字仍可读（≥4 字宽）再省略；
 * 2) 拖动劫持根因（pywebview easy_drag）在壳层：desktop_app.py 必须
 *    easy_drag=False（本脚本做静态源断言，运行时行为需壳内实测）；
 * 3) 脱敏 500 防御：server_bridge.py 有 RedactError→400 + engine_error.log
 *    留痕（pytest 侧 tests/test_redact_box_overrides.py 覆盖行为）。
 * 跑法：先起 vite dev（port 5199），node temp_ui_test/round6_diag.mjs
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

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// 首次访问隐私弹窗
const agree = page.locator('text=我已了解，放心使用').first();
if (await agree.isVisible().catch(() => false)) {
  await agree.click();
  await page.waitForTimeout(400);
}

// ---------- 1. 引擎状态芯片最小可读宽度 ----------
const chip = await page.evaluate(() => {
  const span = document.querySelector('[data-drag-row] .min-w-\\[76px\\]');
  if (!span) return { found: false };
  const cs = getComputedStyle(span);
  const rect = span.getBoundingClientRect();
  return {
    found: true,
    minWidth: cs.minWidth,
    width: Math.round(rect.width),
    overflowHidden: cs.overflow === 'hidden',
    nowrap: cs.whiteSpace === 'nowrap',
    textEllipsis: cs.textOverflow === 'ellipsis',
  };
});
ok('引擎文字 span 带 min-w 底线', chip.found && chip.minWidth === '76px', JSON.stringify(chip));
ok('引擎文字溢出策略完整（hidden+nowrap+ellipsis）',
   chip.found && chip.overflowHidden && chip.nowrap && chip.textEllipsis, JSON.stringify(chip));

// ---------- 2. 窄窗压力：芯片仍可读 ----------
await page.setViewportSize({ width: 1024, height: 720 });
await page.waitForTimeout(600);
const chipNarrow = await page.evaluate(() => {
  const span = document.querySelector('[data-drag-row] .min-w-\\[76px\\]');
  if (!span) return { found: false };
  const rect = span.getBoundingClientRect();
  return { found: true, width: Math.round(rect.width), vw: innerWidth };
});
ok('1024px 窄窗引擎文字仍 ≥76px', chipNarrow.found && chipNarrow.width >= 76, JSON.stringify(chipNarrow));

// ---------- 3. 壳层 easy_drag 静态断言（源码级） ----------
const desktopSrc = readFileSync(join(ROOT, 'desktop_app.py'), 'utf-8');
ok('desktop_app.py 显式 easy_drag=False', /easy_drag\s*=\s*False/.test(desktopSrc));

const bridgeSrc = readFileSync(join(ROOT, 'server_bridge.py'), 'utf-8');
ok('server_bridge.py 有 RedactError→400 防御', /except RedactError/.test(bridgeSrc));
ok('server_bridge.py 有 engine_error.log 留痕', /_log_engine_error/.test(bridgeSrc) && /engine_error\.log/.test(bridgeSrc));
ok('server_bridge.py 有输出目录写探针回退', /_zs_write_probe|\.zs_write_probe/.test(bridgeSrc));

const headerSrc = readFileSync(join(ROOT, 'frontend/src/components/Header.tsx'), 'utf-8');
ok('Header 引擎文字带 min-w-[76px]', headerSrc.includes('min-w-[76px]'));

ok('全程零 pageerror', pageErrors.length === 0, pageErrors.join('; '));

console.log(failures === 0 ? 'ROUND6 ALL PASS' : `ROUND6 ${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
