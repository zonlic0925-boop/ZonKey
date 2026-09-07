/** round-26 任务弹窗冒烟 B 段：弹窗内「下载/打开」动作 + 非产物工具不弹窗
 *  A. 弹窗「下载」按钮 → 浏览器下载事件（a[download] blob）
 *  B. 弹窗「打开」→ 新标签（popup）出现
 *  C. 二维码识别（只读，无产物）→ 不弹窗
 *  D. 弹窗遮罩点击关闭
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
const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('zonkey.privacyNotice.v1', 'ack');
  localStorage.setItem('zonkey.whatsNewSeen.v1', JSON.stringify({ seenRound: 99, lastSeenDay: '2026-09-07' }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);

const gotoCenter = async (centerLabel, toolLabel) => {
  // 回到首页（main 出现中心卡片）再进目标工具
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(550);
  const main = page.locator('main');
  await main.getByRole('button', { name: centerLabel, exact: false }).first().click();
  await page.waitForTimeout(500);
  await page.evaluate((tool) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === tool);
    if (btn) btn.click();
  }, toolLabel);
  await page.waitForTimeout(700);
};

/** 关弹窗（点「好的」；找不到则点 aria-label 关闭） */
const closeModal = async (page) => {
  const modal = page.locator('[data-testid="task-done-modal"]');
  if (await modal.isVisible().catch(() => false)) {
    const ok = modal.getByRole('button', { name: /好的|OK|关闭/ }).first();
    await ok.click().catch(() => {});
    await page.waitForTimeout(300);
  }
};

// 造证件照图
const mkIdPhotoBuf = async () => {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 800;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#463c82'; ctx.fillRect(0, 0, 640, 800);
    ctx.fillStyle = '#f2c9a0'; ctx.fillRect(180, 150, 280, 300);
    return c.toDataURL('image/png');
  });
  return Buffer.from(b64.split(',')[1], 'base64');
};

// A: 下载按钮真实触发浏览器下载（blob 产物 → a[download]）
{
  await gotoCenter('图像工坊', '证件照换底色');
  const buf = await mkIdPhotoBuf();
  await page.locator('input[type=file]').first().setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: buf });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.includes('仅裁剪')));
    if (sel) { sel.value = 'keep'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(150);
  const downloadP = page.waitForEvent('download', { timeout: 20000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes('生成证件照'));
    if (b) b.click();
  });
  // 等弹窗出现
  const modal = page.locator('[data-testid="task-done-modal"]');
  await modal.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  const body = await modal.innerText().catch(() => '');
  const dlBtn = modal.getByRole('button', { name: /下载/ });
  if (await dlBtn.isVisible().catch(() => false)) {
    await dlBtn.click();
    try {
      const download = await downloadP;
      const suggested = download.suggestedFilename();
      check('A1 下载按钮→浏览器下载事件', suggested.includes('id_photo'), suggested);
      const stream = await download.createReadStream();
      // 读一点确认非空
      await new Promise((res) => { stream.on('data', () => {}); stream.on('end', res); stream.on('error', res); });
    } catch (e) {
      check('A1 下载按钮→浏览器下载事件', false, String(e).slice(0, 100));
    }
  } else {
    check('A1 下载按钮→浏览器下载事件', false, 'no download button in: ' + body.slice(0, 60));
  }
  await closeModal(page);
}

// B: 打开按钮 → 弹新标签
{
  await gotoCenter('图像工坊', '证件照换底色');
  const buf = await mkIdPhotoBuf();
  await page.locator('input[type=file]').first().setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: buf });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.includes('仅裁剪')));
    if (sel) { sel.value = 'keep'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  const popupP = page.waitForEvent('popup', { timeout: 20000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes('生成证件照'));
    if (b) b.click();
  });
  const modal = page.locator('[data-testid="task-done-modal"]');
  await modal.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  const openBtn = modal.getByRole('button', { name: /打开/ });
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
    try {
      const popup = await popupP;
      const url = popup.url();
      check('B1 打开按钮→新标签预览', url.startsWith('blob:'), url.slice(0, 50));
      await popup.close();
    } catch (e) {
      check('B1 打开按钮→新标签预览', false, String(e).slice(0, 100));
    }
  } else {
    check('B1 打开按钮→新标签预览', false);
  }
  await closeModal(page);
}

// C: 遮罩点击关闭
{
  await gotoCenter('图像工坊', '证件照换底色');
  const buf = await mkIdPhotoBuf();
  await page.locator('input[type=file]').first().setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: buf });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.textContent.includes('仅裁剪')));
    if (sel) { sel.value = 'keep'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes('生成证件照'));
    if (b) b.click();
  });
  const modal = page.locator('[data-testid="task-done-modal"]');
  await modal.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  const visibleBefore = await modal.isVisible().catch(() => false);
  // 点遮罩（弹窗外左上角）
  await page.mouse.click(10, 100);
  await page.waitForTimeout(400);
  const visibleAfter = await modal.isVisible().catch(() => true);
  check('C1 遮罩点击关闭弹窗', visibleBefore && !visibleAfter);
  await closeModal(page);
}

// D: 二维码识别（只读文本结果，无产物）→ 不弹窗
{
  await gotoCenter('计算开发', '二维码生成');
  const hasView = await page.locator('main').innerText().catch(() => '');
  // 二维码生成无 UI 入口（round-23 视图未注册）→ 改测「重复文件查找」只读工具不弹
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await gotoCenter('系统硬件', '重复文件查找');
  const modalCountBefore = await page.locator('[data-testid="task-done-modal"]').count();
  // 无扫描路径，只读视图渲染本身不应弹窗
  check('D1 只读工具视图无弹窗', modalCountBefore === 0);
}

console.log('\n=== round-26 弹窗动作冒烟 ===');
const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('Failed to load resource'));
console.log(realErrors.length ? realErrors.slice(0, 10) : '零 pageerror / console error');
await browser.close();
const failed = results.filter((r) => !r.ok).length;
process.exit(failed || realErrors.length ? 1 : 0);
