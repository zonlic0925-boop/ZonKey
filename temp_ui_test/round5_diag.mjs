/**
 * round-5 三问题诊断（2026-09-01 实机轮）：
 *  Q2 字体：引擎条/外观面板 font-family 与 @font-face 匹配、文档字体加载状态
 *  Q3 纹理：AppearanceModal → texture class → FluidBackground 接线
 *  Q4 白屏：首启 DOM 挂载时序 + 控制台/网络错误收集（复现静默白屏路径）
 * 跑法：先起 dist_web 静态服务（模拟 EXE 打包形态，非 vite dev），再：
 *   node temp_ui_test/round5_diag.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.ZS_URL || 'http://127.0.0.1:8902/';
let failures = 0;
const ok = (name, cond, detail = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const pageErrors = [];
const consoleErrors = [];
const netFailures = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('requestfailed', (r) => netFailures.push(`${r.url()} :: ${r.failure()?.errorText}`));

// ---- Q4a：首启挂载时序（模拟壳内首启：无 localStorage 偏好） ----
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const boot = await page.evaluate(() => {
  const root = document.getElementById('root');
  const header = document.querySelector('header');
  const blobs = document.querySelectorAll('.zs-fluid-blob').length;
  const rootChildren = root ? root.childElementCount : -1;
  const rootDisplay = root ? getComputedStyle(root).display : 'none';
  return {
    rootChildren,
    rootDisplay,
    headerPresent: Boolean(header),
    blobs,
    text: (document.body.textContent || '').slice(0, 60),
  };
});
ok('Q4 首启 root 已挂载（非白屏）', boot.rootChildren > 0 && boot.headerPresent, JSON.stringify(boot));
ok('Q4 默认流体层渲染', boot.blobs === 3, `blobs=${boot.blobs}`);
ok('Q4 零 pageerror', pageErrors.length === 0, pageErrors.join('; ').slice(0, 300));
ok('Q4 零网络失败', netFailures.length === 0, netFailures.join('; ').slice(0, 400));

// 隐私弹窗（首访必弹）：关掉，避免遮罩干扰后续点击
const agree = page.locator('text=我已了解，放心使用').first();
if (await agree.isVisible().catch(() => false)) {
  await agree.click();
  await page.waitForTimeout(300);
}

// ---- Q2：字体链实测（引擎条 + 外观面板 + 全局） ----
const fonts = await page.evaluate(async () => {
  const dmSans = [...document.fonts].find((f) => f.family.includes('DM Sans'));
  const loadedFaces = [...document.fonts].map((f) => `${f.family} ${f.weight} ${f.status}`);
  return { loadedFaces };
});
ok('Q2 文档字体表非空', fonts.loadedFaces.length > 0, `${fonts.loadedFaces.length} faces`);

// 引擎条（header 内 bg-mem-lime 状态条）
const engine = await page.evaluate(() => {
  const el = [...document.querySelectorAll('[data-drag-row] div')].find((d) =>
    (d.getAttribute('class') || '').includes('bg-mem-lime/30'),
  );
  const cs = el ? getComputedStyle(el) : null;
  return {
    found: Boolean(el),
    font: cs?.fontFamily,
    text: el?.textContent?.trim().slice(0, 40),
  };
});
ok('Q2 引擎条存在', engine.found);
ok('Q2 引擎条 font-family=DM Sans 系', engine.found && engine.font.includes('DM Sans'), engine.font);

// 外观面板 + 纹理预览块
await page.locator('button[title="外观"]:visible').first().dispatchEvent('click');
await page.waitForTimeout(400);
const modal = await page.evaluate(() => {
  const h2 = document.querySelector('[role="dialog"] h2');
  const h2cs = h2 ? getComputedStyle(h2) : null;
  const previews = [...document.querySelectorAll('[role="dialog"] .zs-texture, [role="dialog"] .zs-texture-fluid-preview')];
  const prevStyles = previews.map((el) => {
    const cs = getComputedStyle(el);
    return {
      cls: el.className,
      bgImage: cs.backgroundImage,
      hasImage: cs.backgroundImage !== 'none',
    };
  });
  return {
    title: h2?.textContent?.trim(),
    titleFont: h2cs?.fontFamily,
    previewCount: previews.length,
    prevStyles,
  };
});
ok('Q2 外观面板标题=Audiowide', modal.titleFont && modal.titleFont.includes('Audiowide'), modal.titleFont);
ok('Q3 纹理预览块数量=4（纯色档无纹理类属预期）', modal.previewCount === 4, String(modal.previewCount));
const imagedPreviews = modal.prevStyles.filter((p) => p.hasImage).length;
ok('Q3 纹理预览块 background-image 非 none', imagedPreviews === 4, JSON.stringify(modal.prevStyles.map((p) => p.bgImage.slice(0, 30))));

// 切换纹理并断言实际层
await page.locator('[role="dialog"] button:has-text("网格纸")').first().click();
await page.waitForTimeout(300);
const rGrid = await page.evaluate(() => ({
  saved: localStorage.getItem('zonscale-texture'),
  layer: Boolean(document.querySelector('.zs-texture-grid')),
}));
ok('Q3 切 grid → 层渲染', rGrid.saved === 'grid' && rGrid.layer, JSON.stringify(rGrid));

await page.locator('[role="dialog"] button:has-text("流动")').first().click();
await page.waitForTimeout(300);
const rFluid = await page.evaluate(() => ({
  saved: localStorage.getItem('zonscale-texture'),
  blobs: document.querySelectorAll('.zs-fluid-blob').length,
  anim: (() => {
    const el = document.querySelector('.zs-fluid-a');
    return el ? getComputedStyle(el).animationName : 'none';
  })(),
}));
ok('Q3 切 fluid → blob 渲染+动画', rFluid.saved === 'fluid' && rFluid.blobs === 3 && rFluid.anim.includes('zs-fluid-drift'), JSON.stringify(rFluid));

// 预览块的 class 与 id 映射一致性：4 个纹理档都应有可见纹理样式，纯色档预期 NONE
const previewClassConsistency = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('[role="dialog"] .grid.grid-cols-5 button')];
  return btns.map((b) => {
    const span = b.querySelector('span.block');
    const cs = span ? getComputedStyle(span) : null;
    const hasTextureClass = /zs-texture/.test(span?.className || '');
    return {
      label: b.textContent.trim().slice(0, 10),
      hasTextureClass,
      bg: cs?.backgroundImage === 'none' ? 'NONE' : 'ok',
    };
  });
});
ok(
  'Q3 五档预览块样式映射',
  previewClassConsistency.every((p) => (p.hasTextureClass ? p.bg === 'ok' : p.bg === 'NONE')),
  JSON.stringify(previewClassConsistency),
);

// 关闭弹层
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// ---- Q2b：全局断言 ----
const globalFonts = await page.evaluate(async () => {
  await Promise.race([document.fonts.ready, new Promise((res) => setTimeout(res, 8000))]);
  const pairs = [['DM Sans', '400'], ['Space Grotesk', '700'], ['Audiowide', '400'], ['Caveat', '600']];
  await Promise.all(pairs.map(([f, w]) => document.fonts.load(`${w} 16px "${f}"`).catch(() => {})));
  return pairs.filter(([f, w]) => document.fonts.check(`${w} 16px "${f}"`)).length;
});
ok('Q2 四款品牌字体本地加载成功', globalFonts === 4, `${globalFonts}/4`);

ok('Q4b 全程零 pageerror', pageErrors.length === 0, pageErrors.join('; ').slice(0, 300));

await browser.close();
console.log(failures === 0 ? 'ROUND5 ALL PASS' : `ROUND5 ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
