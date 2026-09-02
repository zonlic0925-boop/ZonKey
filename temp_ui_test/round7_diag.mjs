/**
 * Round-7 修复回归（2026-09-01 用户实测 2 问题）：
 * 1) CCITT 扫描图脱敏必败：pikepdf 对 CCITTFaxDecode 图像经 TIFF 包装解码
 *    返回 TiffImageFile，旧代码 pil.__class__.fromarray 直接 AttributeError
 *    →「图像像素化失败（拒绝静默保留敏感图像内容）」。行为回归在 pytest：
 *    tests/test_executor.py::test_ccitt_scan_pixelated_after_erase /
 *    test_write_image_stream_accepts_tiff_image_file。此处做源码断言兜底。
 * 2) 外观弹窗纹理标签渲染成墨块：预览 span 复用了全页 overlay 定位类
 *    .zs-texture（position:absolute; inset:0），预览块铺满按钮垫到文字底下，
 *    文字压 background-image 渲染时 WebView2/Chromium 走劣化光栅路径。
 *    修复后预览块只挂图案类（文档流内 32px 色块），不再与标签重叠。
 * 跑法：先起 vite dev（port 5199），node temp_ui_test/round7_diag.mjs
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
const engineSrc = readFileSync(join(ROOT, 'core/redact/pikepdf_engine.py'), 'utf-8');
// round-8 订正：极性反转本身是错的（round-7 夹具极性反了诱导出的补偿修复），
// 已整体移除；fromarray 断言改为「无任何反转残留」。
ok('引擎无极性反转（round-8 移除，直接回写保真）', !/255\s*-\s*np\.asarray\(pil/.test(engineSrc) && !/__class__\.fromarray/.test(engineSrc));
ok('引擎 _write_flate zlib 压缩回写（round-8）', engineSrc.includes('def _write_flate') && engineSrc.includes('zlib.compress'));

const modalSrc = readFileSync(join(ROOT, 'frontend/src/components/AppearanceModal.tsx'), 'utf-8');
ok('外观预览块不再复用 .zs-texture 定位类', !/zs-texture\s+zs-texture-(grid|dots|paper|fluid-preview)/.test(modalSrc));

// ---------- 运行时：外观弹窗纹理标签 ----------
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const agree = page.locator('text=我已了解，放心使用').first();
if (await agree.isVisible().catch(() => false)) {
  await agree.click();
  await page.waitForTimeout(400);
}

await page.click('button:has-text(\'外观\') >> visible=true');
await page.waitForTimeout(600);

const tex = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('[role=dialog] .grid-cols-5 span.mt-1')];
  return labels.map((label) => {
    const btn = label.closest('button');
    const preview = btn?.querySelector('span.block');
    const pcs = preview ? getComputedStyle(preview) : null;
    const pr = preview?.getBoundingClientRect();
    const lr = label.getBoundingClientRect();
    return {
      text: label.textContent.trim(),
      previewPosition: pcs?.position,
      overlap: pr && lr ? lr.top < pr.bottom - 0.5 : null,
    };
  });
});
for (const t of tex) {
  ok(`「${t.text}」预览块为文档流定位`, t.previewPosition === 'static', JSON.stringify(t));
  ok(`「${t.text}」标签不与预览块重叠`, t.overlap === false, JSON.stringify(t));
}
ok('纹理行共 5 个标签', tex.length === 5, `n=${tex.length}`);

ok('全程零 pageerror', pageErrors.length === 0, pageErrors.join('; '));

console.log(failures === 0 ? 'ROUND7 ALL PASS' : `ROUND7 ${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
