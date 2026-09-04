"""Round-21 批处理二期冒烟（Playwright Python · vite dev 5199）：
① 图像中心：批处理 pill 出现 → 进批处理页 → 选「质量压缩」→ 注入 1 PNG → 开始 → 完成 + 产物 ZIP 行。
② 图像批处理页「格式转换/色彩替换」op 参数区正确渲染。
③ PPT 中心：批处理 pill 出现 → 进批处理页 → server op（PPT 转 PDF）在浏览器模式出门禁且开始禁用。
④ PPT 中心 client op（PPT 瘦身）无门禁、开始可用。
⑤ PDF 工坊批处理回归：入口 + 步骤区渲染（r20 全链路冒烟另行全跑）。
⑥ 手机 390px：图像批处理页无横向溢出 + 零 pageerror（网页端批处理在手机上可操作）。
⑦ 全程零 pageerror。
已知坑：header/卡片按钮用 dispatchEvent('click') 绕 drag 层；可见断言用 :visible；
set_input_files 免对话框注文件；批处理页内操作 pill 与 SubNav 同名 → 选择器收窄 div.max-w-2xl。
"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5199"
ROOT = Path(__file__).parent
F_PNG = str(ROOT / "fixtures" / "img1.png")
F_PPTX = str(ROOT / "fixtures" / "draft.pptx")
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


def open_center(page, center_label):
    # 桌面 header 非激活中心按钮只显图标（title 带中心名），激活后才有文字
    btn = page.locator(f"header button[title='{center_label}']").first
    if not btn.count():
        btn = page.locator(f"button:has-text('{center_label}')").first
    click(btn)
    page.wait_for_timeout(800)


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(800)
    dismiss_privacy(page)
    scope = "div.max-w-2xl"

    # ===== 图像中心批处理 =====
    open_center(page, "图像工坊")
    img_batch_pill = page.locator("button:has-text('批处理'):visible").first
    log("image-batch-pill", img_batch_pill.count() > 0)
    click(img_batch_pill)
    page.wait_for_timeout(600)
    step1 = page.locator(f"{scope} p:has-text('第一步'):visible")
    log("image-batch-open", step1.count() > 0)

    # 选质量压缩 → 注入 PNG → 运行
    compress_pill = page.locator(f"{scope} button:has-text('质量压缩'):visible").first
    log("image-op-compress", compress_pill.count() > 0)
    click(compress_pill)
    page.wait_for_timeout(300)
    quality_btn = page.locator(f"{scope} button:has-text('中等'):visible").first
    log("image-param-quality", quality_btn.count() > 0)

    img_input = page.locator(f'{scope} input[type="file"]').first
    img_input.set_input_files([F_PNG])
    page.wait_for_timeout(400)
    count_label = page.locator(f"{scope} span:has-text('已添加 1 个文件'):visible")
    log("image-file-count", count_label.count() > 0)

    start_btn = page.locator(f"{scope} button:has-text('开始批处理'):visible").first
    log("image-start-enabled", start_btn.count() > 0 and start_btn.is_enabled())
    click(start_btn)
    try:
        page.wait_for_selector(f"{scope} span:has-text('完成'):visible", timeout=60000)
        page.wait_for_function(
            "() => document.body.innerText.includes('批处理完成：1 成功、0 失败')",
            timeout=60000,
        )
        log("image-batch-run-ok", True)
    except Exception as exc:
        log("image-batch-run-ok", False, str(exc)[:120])
    page.wait_for_timeout(500)
    body = page.inner_text("body")
    log("image-zip-row", "1 个产物" in body)

    # 色彩替换参数区
    recolor_pill = page.locator(f"{scope} button:has-text('色彩替换'):visible").first
    click(recolor_pill)
    page.wait_for_timeout(300)
    from_label = page.locator(f"{scope} label:has-text('替换颜色')")
    log("image-op-recolor-params", from_label.count() > 0)

    # ===== PPT 中心批处理 =====
    open_center(page, "PPT 工坊")
    ppt_pill = page.locator("button:has-text('批处理'):visible").first
    log("ppt-batch-pill", ppt_pill.count() > 0)
    click(ppt_pill)
    page.wait_for_timeout(600)
    ppt_home_card = page.locator(f"{scope} button:has-text('PPT 瘦身'):visible").first
    log("ppt-batch-open", ppt_home_card.count() > 0)

    # server op：PPT 转 PDF → 门禁与否取决于后端是否在线（浏览器直连后端时 server op 可用）
    to_pdf_pill = page.locator(f"{scope} button:has-text('PPT 转 PDF'):visible").first
    click(to_pdf_pill)
    page.wait_for_timeout(400)
    gate = page.locator(f"{scope} div:has-text('该操作需要桌面引擎在线'):visible")
    server_note = page.locator(f"{scope} p:has-text('该操作由桌面引擎逐个文件处理'):visible")
    if gate.count() > 0:
        log("ppt-server-op-gate", True, "backend offline -> gate shown")
        start2 = page.locator(f"{scope} button:has-text('开始批处理'):visible").first
        log("ppt-start-disabled-server", start2.count() > 0 and not start2.is_enabled())
    else:
        log("ppt-server-op-gate", server_note.count() > 0, "backend online -> serverNote shown")
        start2 = page.locator(f"{scope} button:has-text('开始批处理'):visible").first
        log("ppt-start-disabled-server", start2.count() > 0 and start2.is_disabled(), "no files yet -> disabled")

    # client op：PPT 瘦身 → 注入 PPTX 跑通（浏览器内 JSZip）
    slim_pill = page.locator(f"{scope} button:has-text('PPT 瘦身'):visible").first
    click(slim_pill)
    page.wait_for_timeout(400)
    gate2 = page.locator(f"{scope} div:has-text('该操作需要桌面引擎在线'):visible")
    log("ppt-client-op-no-gate", gate2.count() == 0)
    pptx_input = page.locator(f'{scope} input[type="file"]').first
    pptx_input.set_input_files([F_PPTX])
    page.wait_for_timeout(400)
    start3 = page.locator(f"{scope} button:has-text('开始批处理'):visible").first
    log("ppt-start-enabled-client", start3.count() > 0 and start3.is_enabled())
    click(start3)
    try:
        page.wait_for_selector(f"{scope} span:has-text('完成'):visible", timeout=60000)
        page.wait_for_function(
            "() => document.body.innerText.includes('批处理完成：1 成功、0 失败')",
            timeout=60000,
        )
        log("ppt-batch-run-ok", True)
    except Exception as exc:
        log("ppt-batch-run-ok", False, str(exc)[:120])
    page.wait_for_timeout(500)
    body_ppt = page.inner_text("body")
    log("ppt-zip-row", "1 个产物" in body_ppt)

    # ===== PDF 工坊批处理回归（入口 + 渲染） =====
    open_center(page, "PDF 工坊")
    pdf_pill = page.locator("button:has-text('批处理'):visible").first
    click(pdf_pill)
    page.wait_for_timeout(600)
    pdf_scope = page.locator(f"{scope} p:has-text('第一步'):visible")
    log("pdf-batch-regression-open", pdf_scope.count() > 0)

    # ===== 手机 390px：图像批处理页无溢出 =====
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
    m_center = mob.locator("button[title='图像工坊'], button[title='Image Studio']").first
    if not m_center.count():
        m_center = mob.locator("button:has-text('图像工坊'), button:has-text('Image Studio')").first
    m_click(m_center)
    mob.wait_for_timeout(700)
    m_pill = mob.locator("button:has-text('批处理'), button:has-text('Batch')").first
    m_click(m_pill)
    mob.wait_for_timeout(600)
    m_visible = mob.locator(f"{scope} p:has-text('第一步'), {scope} p:has-text('Step 1'):visible").first
    log("mobile-image-batch-reachable", m_visible.count() > 0)
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
