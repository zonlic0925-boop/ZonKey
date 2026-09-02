/**
 * Round-10 回归（2026-09-02 用户实测：PDF 工坊「页面整理」编辑文字白屏卡死
 * + 崩溃后无法重新打开软件）。
 * 修复要点：
 * 1) PdfEditorCanvas onBlur 原读 e.currentTarget.innerText——React 18 批处理
 *    在事件处理器返回后才跑 setElements updater，事件对象已回收(currentTarget=null)
 *    → 渲染器 reducer 阶段 TypeError → 整棵 React 树卸载 = 白屏卡死且无法恢复。
 *    修复：textRefs ref 表安全读取（node 丢失时保留原文，绝不抛异常）。
 * 2) 文字元素 fontSize 原用 imageMetrics.scale（不存在 → NaN）→ 改 scaleY。
 * 3) 全应用无 ErrorBoundary——新增 ZsErrorBoundary（App.tsx 视图层包裹，
 *    resetKey=center:tool，故障圈定单视图 + 重试按钮）。
 * 4) 编辑器拖动元素时未标 data-canvas-gesture——新增 editingElementId 手势标记
 *    （Header 拖拽行手势期转 no-drag，防拖到标题栏被劫持成移窗口）。
 * 5) 壳层「崩溃后打不开」：pywebview WebView2 UDF 默认全局共享 %APPDATA%/pywebview，
 *    残留僵尸 msedgewebview2 持 Singleton Lock → 新实例白屏。修复：
 *    webview.start(storage_path=ZonKey 专属目录) + _cleanup_orphan_webview2()
 *    （只杀父进程已死的孤儿，防误杀其他应用）。
 * 跑法：先起 vite dev(5199)，node temp_ui_test/round10_diag.mjs
 * 全功能冒烟见 round10_pdfcenter_smoke.mjs（72 断言，需后端 8765）。
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
const canvasSrc = readFileSync(join(ROOT, 'frontend/src/components/pdfcenter/PdfEditorCanvas.tsx'), 'utf-8');
ok('onBlur 不再读 e.currentTarget', !/e\.currentTarget\.innerText/.test(canvasSrc));
ok('onBlur 经 textRefs ref 表安全读取', /textRefs\.current\[el\.id\]/.test(canvasSrc));
ok('blur 回写有保底（节点丢失保留原文）', /const text = node \? node\.innerText : el\.text/.test(canvasSrc));
ok('fontSize 不再用不存在的 imageMetrics.scale', !/imageMetrics\.scale\)/.test(canvasSrc));
ok('fontSize 用 scaleY 兜底（scaleY 或 1）', /imageMetrics\.scaleY \|\| 1/.test(canvasSrc));
ok('编辑器拖动时标记 data-canvas-gesture', /setAttribute\('data-canvas-gesture', '1'\)/.test(canvasSrc) && /removeAttribute\('data-canvas-gesture'\)/.test(canvasSrc));

const ebSrc = readFileSync(join(ROOT, 'frontend/src/components/common/ZsErrorBoundary.tsx'), 'utf-8');
ok('ZsErrorBoundary 存在且带重试出口', ebSrc.includes('getDerivedStateFromError') && ebSrc.includes('重试当前页面'));

const appSrc = readFileSync(join(ROOT, 'frontend/src/App.tsx'), 'utf-8');
ok('App 视图层已包 ZsErrorBoundary（resetKey=center:tool）', appSrc.includes('<ZsErrorBoundary resetKey={`${activeCenter}:${activeTool}`}>'));

const desktopSrc = readFileSync(join(ROOT, 'desktop_app.py'), 'utf-8');
ok('WebView2 专属 storage_path（不再全局共享 pywebview UDF）', /webview\.start\(storage_path=storage_path\)/.test(desktopSrc));
ok('孤儿 WebView2 清理函数存在', desktopSrc.includes('def _cleanup_orphan_webview2'));
ok('孤儿清理只杀父进程已死进程（PPID 存活表校验）', desktopSrc.includes('ppid not in alive_set'));
ok('启动路径已接线孤儿清理', desktopSrc.includes('_cleanup_orphan_webview2()'));

// ---------- 1. 运行时探针（编辑文字闭环不再白屏） ----------
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));

await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2500);
try { await page.getByRole('button', { name: /我已了解|知道了|OK|了解/i }).click({ force: true }); } catch {}
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'PDF 工坊' }).first().click({ force: true });
await page.waitForTimeout(800);
await page.locator('button:visible').filter({ hasText: '页面整理' }).first().click({ force: true });
await page.waitForTimeout(600);
await page.setInputFiles('input[type=file][accept*=".pdf"]', join(__dirname, 'multi_page.pdf'));
await page.waitForTimeout(4000);

const imgBox = await page.locator('img[alt="Page Preview"]').boundingBox();
ok('页面整理预览渲染', !!imgBox);
if (imgBox) {
  const toolbar = page.locator('div.shrink-0.flex.items-center.p-2.gap-2.border-b-2');
  await toolbar.locator('button:has(svg.lucide-type):not([title])').click({ force: true });
  await page.waitForTimeout(300);
  await page.mouse.click(imgBox.x + imgBox.width / 2, imgBox.y + imgBox.height / 2);
  await page.waitForTimeout(500);
  const ce = page.locator('[contenteditable="true"]').first();
  ok('文字元素创建', (await ce.count()) > 0);
  if ((await ce.count()) > 0) {
    await ce.dblclick({ force: true });
    await page.keyboard.type('回归测试TEXT-1', { delay: 40 });
    await page.waitForTimeout(400);
    // 原崩溃点：点空白触发 blur
    await page.mouse.click(imgBox.x + 40, imgBox.y + 40);
    await page.waitForTimeout(700);
  }
}
const alive = await page.evaluate(() => document.body.innerHTML.length);
ok('编辑文字 blur 后页面存活（原白屏点）', alive > 500, `body html len=${alive}`);
ok('零 pageerror', pageErrors.length === 0, pageErrors.join(' | '));

await browser.close();
console.log(`TOTAL: ${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'}`);
process.exit(failures === 0 ? 0 : 1);
