/* 首页导航 + 收藏闭环 + 视图切换 实机验证（桌面 1440×900 与手机 390×844） */
import { chromium } from 'playwright';
import fs from 'fs';
const SHOTS = 'C:/Users/Zonlic/Desktop/ZonScale/temp_ui_test/shots_homenav';
fs.mkdirSync(SHOTS, { recursive: true });
const URL = 'http://127.0.0.1:5199/';
const browser = await chromium.launch();

const results = [];

async function runCase(name, viewport, isMobile) {
  const page = await browser.newPage({ viewport, isMobile, hasTouch: isMobile });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const agree = page.locator('text=我已了解，放心使用').first();
  if (await agree.isVisible().catch(() => false)) await agree.click();
  await page.waitForTimeout(600);

  // 1) 落地页 = 首页导航（欢迎语 + 分类卡）
  const welcomeVisible = await page.locator('text=欢迎来到 ZonScale').first().isVisible().catch(() => false);
  results.push([`${name}:home-landing`, welcomeVisible]);
  await page.screenshot({ path: `${SHOTS}/${name}_01_home.png` });

  // 2) 8 张分类卡
  const cards = await page.locator('button:has-text("项工具")').count();
  results.push([`${name}:category-cards>=8`, cards >= 8]);

  // 3) 点 PDF 工坊卡 → 跳转工具页（SubNav 出现 pdf-home）
  await page.locator('button:has-text("PDF 工坊")').first().click();
  await page.waitForTimeout(900);
  const pdfHomeVisible = await page.locator('text=按类别选择工具').first().isVisible().catch(() => false);
  results.push([`${name}:jump-pdf-center`, pdfHomeVisible]);
  await page.screenshot({ path: `${SHOTS}/${name}_02_pdfhome.png` });

  // 4) PDF 工坊首页星标收藏第一个工具 → 回首页出现收藏区
  const favBtn = page.locator('button[aria-label="收藏此工具"]').first();
  // 记住收藏的是哪个工具（星标在卡片 div 内，取卡片文本第一个工具名）
  const favTargetName = await page
    .locator('button[aria-label="收藏此工具"]')
    .first()
    .evaluate((el) => el.closest('div.relative')?.querySelector('button')?.textContent?.trim() || '');
  if (await favBtn.isVisible().catch(() => false)) await favBtn.click();
  await page.waitForTimeout(400);
  // 底部导航「首页」或 SubNav 回首页按钮
  const homeBtn = page.locator(`button[title="欢迎来到 ZonScale"]`).first();
  if (await homeBtn.isVisible().catch(() => false)) await homeBtn.click();
  else await page.locator('button:has-text("首页")').last().click();
  await page.waitForTimeout(700);
  const favSection = await page.locator('text=我的收藏').first().isVisible().catch(() => false);
  const favChip = favTargetName
    ? await page.locator(`button:has-text("${favTargetName}")`).first().isVisible().catch(() => false)
    : false;
  results.push([`${name}:fav-visible-on-home (${favTargetName})`, favSection && favChip]);
  await page.screenshot({ path: `${SHOTS}/${name}_03_home_with_fav.png` });

  // 5) 收藏 chip 点击直达工具（离开首页、落到该工具视图，不是 pdf-home）
  if (favChip) {
    await page.locator(`button:has-text("${favTargetName}")`).first().click();
    await page.waitForTimeout(900);
    const leftHome = !(await page.locator('text=欢迎来到 ZonScale').first().isVisible().catch(() => false));
    results.push([`${name}:fav-jump`, leftHome]);
    await page.screenshot({ path: `${SHOTS}/${name}_04_after_favjump.png` });
  }

  // 6) 横向溢出
  const hOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  results.push([`${name}:no-h-overflow`, !hOverflow]);
  results.push([`${name}:zero-pageerror`, errs.length === 0]);
  if (errs.length) console.log(`${name} pageerrors:`, errs);
  await page.close();
}

await runCase('desktop', { width: 1440, height: 900 }, false);
await runCase('mobile', { width: 390, height: 844 }, true);

await browser.close();
let pass = 0, fail = 0;
for (const [k, v] of results) {
  console.log(`${v ? 'PASS' : 'FAIL'}  ${k}`);
  v ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
