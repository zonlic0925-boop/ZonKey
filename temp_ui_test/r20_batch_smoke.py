"""Round-20 批处理引擎冒烟（Playwright Python · vite dev 5199）：
① PDF 工坊首页出现「批处理」分组与卡片，SubNav 出现批处理 pill。
② 进入批处理页：选「压缩」op → set_input_files 注入 2 个真实 PDF → 开始批处理。
③ 两行状态全「完成」+ 汇总文案 + 「共 2 个产物」ZIP 行出现（纯浏览器本地跑通 pdfCore 链路）。
④ 服务端 op（PDF 转 Word）在浏览器模式正确出「需要桌面引擎在线」门禁且开始按钮禁用。
⑤ en 语言下 tools.pdfBatch 卡片文案 = Batch。
⑥ 零 pageerror。
已知坑：header/卡片按钮用 dispatchEvent('click') 绕 drag 层；可见断言用 :visible；set_input_files 免对话框注 PDF。
"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5199"
ROOT = Path(__file__).parent
F_DOC = str(ROOT / "fixtures" / "document.pdf")
F_MULTI = str(ROOT / "multi_page.pdf")
results = []
t0 = time.time()


def log(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name} {detail} (+{time.time()-t0:.1f}s)")


def click(el):
    el.evaluate("(e) => e.dispatchEvent(new MouseEvent('click', {bubbles: true}))")


def dismiss_privacy(page):
    btn = page.locator('button:has-text("我已了解"):visible, button:has-text("I understand"):visible').first
    if btn.count():
        click(btn)
        page.wait_for_timeout(300)


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    dismiss_privacy(page)

    # ① 进入 PDF 工坊中心（默认落在 pdf-home 首页宫格）
    center_btn = page.locator("header button:has-text('PDF 工坊')").first
    if not center_btn.count():
        center_btn = page.locator("button:has-text('PDF 工坊')").first
    click(center_btn)
    page.wait_for_timeout(800)

    home_batch_group = page.locator("h3:has-text('批处理'):visible")
    log("home-batch-group", home_batch_group.count() > 0)

    subnav_pill = page.locator("button:has-text('批处理'):visible").first
    log("subnav-batch-pill", subnav_pill.count() > 0)

    # ② 点首页「批处理」卡片进入批处理页
    batch_card = page.locator("button:has-text('批处理'):visible").first
    click(batch_card)
    page.wait_for_timeout(600)
    step1 = page.locator("p:has-text('第一步'):visible")
    log("batch-view-open", step1.count() > 0)

    # ③ 选压缩 op → 注入 2 个 PDF → 运行（选择器收窄到批处理页容器，避开 SubNav 同名 pill）
    scope = "div.max-w-2xl"
    compress_pill = page.locator(f"{scope} button:has-text('文字类 PDF 压缩'):visible").first
    click(compress_pill)
    page.wait_for_timeout(300)

    pdf_input = page.locator(f'{scope} input[type="file"][accept=".pdf"]').first
    pdf_input.set_input_files([F_DOC, F_MULTI])
    page.wait_for_timeout(400)
    count_label = page.locator(f"{scope} span:has-text('已添加 2 个文件'):visible")
    log("file-count-2", count_label.count() > 0)

    start_btn = page.locator(f"{scope} button:has-text('开始批处理'):visible").first
    log("start-enabled", start_btn.count() > 0 and start_btn.is_enabled())
    click(start_btn)

    # 等待两行都完成（纯浏览器 pdfCore 链路）
    try:
        page.wait_for_selector("span:has-text('完成')", timeout=60000)
        page.wait_for_function(
            "() => document.body.innerText.includes('批处理完成：2 成功、0 失败')",
            timeout=60000,
        )
        log("batch-run-ok", True)
    except Exception as exc:
        log("batch-run-ok", False, str(exc)[:120])

    page.wait_for_timeout(800)
    body = page.inner_text("body")
    log("zip-row", "共 2 个产物" in body)
    log("summary-2-0", "2 成功、0 失败" in body)
    failed_rows = "失败" in body and "0 失败" not in body
    log("no-failed-rows", not failed_rows)

    # ④ 服务端 op 浏览器门禁：选 PDF 转 Word → offlineNote + 禁用开始
    word_pill = page.locator(f"{scope} button:has-text('PDF 转 Word'):visible").first
    click(word_pill)
    page.wait_for_timeout(400)
    gate = page.locator(f"{scope} div:has-text('该操作需要桌面引擎在线'):visible")
    log("server-op-gate", gate.count() > 0)
    start_btn2 = page.locator(f"{scope} button:has-text('开始批处理'):visible").first
    log("start-disabled-server", start_btn2.count() > 0 and not start_btn2.is_enabled())

    # ⑤ en 语言下批处理标签
    lang_btn = page.locator("button[aria-haspopup='menu']:visible").first
    click(lang_btn)
    page.wait_for_timeout(250)
    en_item = page.locator("div[role='menu'] button:has-text('English'), div[aria-label*='language'] button:has-text('English')").first
    if en_item.count():
        click(en_item)
        page.wait_for_timeout(600)
    en_pill = page.locator("button:has-text('Batch'):visible").first
    log("en-batch-label", en_pill.count() > 0)

    # ⑥ 手机 390px 视口：批处理页无横向溢出（本轮新增页面沿用 round-18 纪律）
    mob = ctx.new_page()
    mob_errs = []
    mob.on("pageerror", lambda e: mob_errs.append(str(e)))
    mob.set_viewport_size({"width": 390, "height": 844})
    mob.goto(BASE, wait_until="networkidle")
    mob.wait_for_timeout(600)
    m_click = lambda el: el.evaluate("(e) => e.dispatchEvent(new MouseEvent('click', {bubbles: true}))")
    mob_btn = mob.locator('button:has-text("我已了解"):visible, button:has-text("I understand"):visible').first
    if mob_btn.count():
        m_click(mob_btn)
        mob.wait_for_timeout(300)
    m_center = mob.locator("button:has-text('PDF 工坊'), button:has-text('PDF Studio')").first
    m_click(m_center)
    mob.wait_for_timeout(700)
    m_card = mob.locator("button:has-text('批处理'), button:has-text('Batch')").first
    m_click(m_card)
    mob.wait_for_timeout(600)
    overflow = mob.evaluate(
        "() => { const de = document.documentElement; return de.scrollWidth - de.clientWidth }"
    )
    log("mobile-390-no-overflow", overflow <= 0, f"overflowPx={overflow}")
    log("mobile-zero-pageerror", len(mob_errs) == 0, str(mob_errs[:2]))
    mob.close()

    log("zero-pageerror", len(errs) == 0, str(errs[:3]))
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n===== {len(results)-len(failed)}/{len(results)} PASS =====")
if failed:
    for f in failed:
        print("FAILED:", f)
    raise SystemExit(1)
