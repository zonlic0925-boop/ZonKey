/** 第三梯队工具箱冒烟：10 个新工具视图渲染零 pageerror + 可交互首屏。
 * 服务器须已在本机 8765 端口起服（dist_web 由 server_bridge 托管）。
 */
import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:8765';

// (进入哪个中心按钮名, 工具按钮名, 主区应包含的正文关键词)
const CHECKS = [
  // 文本工坊 4 个纯前端 + TTS
  ['文本工坊', '文本对比', '原始文本'],
  ['文本工坊', '正则测试', '正则表达式'],
  ['文本工坊', '批量重命名', '重命名'],
  ['文本工坊', '文字转语音', '朗读文本'],
  // 图像工坊 2 个
  ['图像工坊', '图片打码', '拖拽'],
  ['图像工坊', '证件照换底色', '底色'],
  // PDF 工坊 1 个
  ['PDF 工坊', '书签编辑', '选择 PDF'],
  // 计算开发 2 个
  ['计算开发', '单位换算', '长度'],
  ['计算开发', '进制换算', 'BIN'],
  // 系统 1 个
  ['系统硬件', '重复文件查找', '扫描目录'],
];

const results = [];
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push('[console] ' + msg.text());
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
// 预填一次性弹窗记忆（隐私=ack / whatsNew=已看过），绕过首启遮罩（遮罩 z-110 拦截一切点击）
await page.evaluate(() => {
  localStorage.setItem('zonkey.privacyNotice.v1', 'ack');
  localStorage.setItem('zonkey.whatsNewSeen.v1', JSON.stringify({ seenRound: 99, lastSeenDay: '2026-09-04' }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// 每项独立走一遍：首页中心卡 →（该中心落地第一个工具）→ 二级 pills 点目标工具
const pillRow = page.locator('[class*="subnav"], main').first();
for (const [center, tool, keyword] of CHECKS) {
  try {
    await page.locator('main').getByRole('button', { name: center, exact: false }).first().click();
    await page.waitForTimeout(400);
    // 二级 pills 与首页卡同在主区；exact=false 会撞「批处理」等词 → 限定小字号 pill 按钮
    const pill = page.locator('button').filter({ hasText: tool }).first();
    await pill.click();
    await page.waitForTimeout(550);
    const text = await page.locator('main').innerText().catch(() => '');
    const ok = text.includes(keyword) && text.length > 8;
    results.push({ center, tool, render: ok ? 'PASS' : 'FAIL', len: text.length });
    // 回首页：点 header 首页按钮（home 图标）
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
  } catch (e) {
    results.push({ center, tool, render: 'FAIL', err: String(e).slice(0, 120) });
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

console.log('\n=== 工具箱视图冒烟 ===');
for (const r of results) {
  console.log(`${r.render}  ${r.center} / ${r.tool}  (len=${r.len ?? 0}${r.err ? ' err=' + r.err : ''})`);
}
const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('Failed to load resource'));
console.log('\n=== 页面错误 ===');
console.log(realErrors.length ? realErrors.slice(0, 10) : '零 pageerror / console error');

await browser.close();
process.exit(results.some((r) => r.render === 'FAIL') || realErrors.length ? 1 : 0);
