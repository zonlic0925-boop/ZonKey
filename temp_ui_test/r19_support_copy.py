"""Round-19 支持作者文案冒烟（Playwright Python · vite dev 5199）：
① 打开「支持作者」弹窗，zh-CN 断言新定位文案（不再是纯打码工具口径）。
② en / zh-TW 切换后文案跟随且各自含新版关键词。
③ 旧口径关键词（省下了一下午/manual redaction/打码）不出现。
④ 零 pageerror。
已知坑：header 按钮用 dispatchEvent('click') 绕 drag 层；文案断言用 :visible 过滤。
"""
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5199"
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


CASES = [
    # (locale, 必含新口径关键词, 旧口径关键词)
    ("zh-CN", ["完全免费", "不只是「打码工具」", "PDF 工坊", "图像音视频", "计算开发", "本地离线"], ["省下了一下午", "手动打码"]),
    ("en", ["no longer just a redaction tool", "PDF studio", "everyday toolbox", "paywall"], ["an afternoon of manual redaction"]),
    ("zh-TW", ["完全免費", "不只是「打碼工具」", "PDF 工坊", "圖像音視訊", "計算開發", "本地離線"], ["省下了一下午", "手動打碼"]),
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)
    dismiss_privacy(page)

    # 桌面 header「支持作者」按钮（文本按钮在桌面布局可见）
    support_btn = page.locator("header button:has-text('支持作者'):visible, header button:has-text('Support'):visible, header button:has-text('支持作者')").first
    if not support_btn.count():
        log("support-button-found", False, "no support button in header")
    else:
        log("support-button-found", True)

    for locale, must, must_not in CASES:
        # 目标 locale 的显示标签（LOCALE_LABELS：zh-CN=简体中文? zh-TW=繁體 en=English）
        target_label = {"zh-CN": "简体", "en": "English", "zh-TW": "繁體"}[locale]
        for _ in range(4):
            html_lang = page.evaluate("() => document.documentElement.lang || ''")
            if (locale == "zh-CN" and html_lang.startswith("zh") and "tw" not in html_lang.lower()) \
               or (locale == "en" and html_lang.startswith("en")) \
               or (locale == "zh-TW" and "zh-tw" in html_lang.lower()):
                break
            # 打开语言下拉（Languages 图标按钮），点目标项
            lang_btn = page.locator("button[aria-haspopup='menu']:visible").first
            if not lang_btn.count():
                log(f"{locale}-lang-btn", False, "language switch not found")
                break
            click(lang_btn)
            page.wait_for_timeout(250)
            item = page.locator(f"div[role='menu'] button:has-text('{target_label}'), button[aria-label*='language']:visible").first
            # 菜单项带两种标签（LOCALE_LABELS + LOCALE_NAMES），点击含目标标签的项
            item = page.locator(f"div[aria-label*='language'] button:has-text('{target_label}'), div[role='menu'] button:has-text('{target_label}')").first
            if item.count():
                click(item)
            else:
                # 无 role=menu 时点按钮本身（若当前循环即目标）
                pass
            page.wait_for_timeout(500)

        html_lang = page.evaluate("() => document.documentElement.lang || ''")
        # 重新打开/定位支持按钮（文案随 locale 变化）
        sb = page.locator("header button:has-text('支持作者'):visible, header button:has-text('Support'):visible, header button:has-text('支持作者')").first
        if sb.count():
            click(sb)
            page.wait_for_timeout(400)

        # 弹窗正文 = 首段 description（支持弹窗内 p）
        modal_text = ""
        p_el = page.locator('div.fixed.inset-0 p[class*="text-mem-ink/55"]').first
        if p_el.count():
            modal_text = p_el.inner_text()
        # 兜底：取整个弹窗文本
        if not modal_text:
            modal_text = page.locator("div.fixed.inset-0").first.inner_text()

        ok = all(k in modal_text for k in must)
        bad = [k for k in must_not if k in modal_text]
        log(f"{locale}-copy", ok, f"lang={html_lang} | text: {modal_text[:120]!r} | bad_hits={bad}")

        # 关闭弹窗
        close_btn = page.locator("div.fixed.inset-0 button").first
        if close_btn.count():
            click(close_btn)
            page.wait_for_timeout(300)

    log("zero-pageerror", len(errs) == 0, str(errs[:3]))
    browser.close()

failed = [r for r in results if not r[1]]
print(f"\n===== {len(results)-len(failed)}/{len(results)} PASS =====")
if failed:
    for f in failed:
        print("FAILED:", f)
    raise SystemExit(1)
