"""Round-22 What's New 弹窗冒烟（Playwright Python · vite dev 5199）：
① 全新用户（空存储）：首启 → 隐私弹窗 → 确认后「这次更新了什么」接续弹出；内容断言（zh-CN）。
② 确认（知道了）→ zonkey.whatsNewSeen.v1 seenRound=22 → 刷新不再弹。
③ 关闭（X）同样记已读 → 刷新不再弹。
④ 上轮当天已看过（seenRound=21 + lastSeenDay=今天）→ 首启不弹。
⑤ 上轮昨天看过（seenRound=21 + lastSeenDay=昨天）→ 今天首启弹出；确认后升到 22。
⑥ en 语境：内容本地化（标题 / Round 徽标 / 条目）。
⑦ zh-TW 语境：内容本地化。
⑧ 手机 390px：弹窗不超视口 + 零横向溢出；桌面+手机全程零 pageerror。
"""
import time
from datetime import date, timedelta
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5199"
KEY = "zonkey.whatsNewSeen.v1"
LOCALE_KEY = "zonkey-locale"
results = []
t0 = time.time()


def log(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name} {detail} (+{time.time()-t0:.1f}s)")


def click(el):
    el.evaluate("(e) => e.dispatchEvent(new MouseEvent('click', {bubbles: true}))")


def privacy_confirm(page):
    """三语任一隐私确认按钮；无弹窗则跳过"""
    btn = page.locator(
        'button:has-text("我已了解"):visible, button:has-text("我已瞭解"):visible, button:has-text("feel safe"):visible'
    ).first
    if btn.count():
        click(btn)
        page.wait_for_timeout(400)


def shown(page, text, timeout=2500):
    """子串可见性（get_by_text 默认子串匹配）"""
    return page.get_by_text(text).first.is_visible(timeout=timeout)


def run_case(browser, name, fn, viewport=(1440, 900), seed=None, mobile=False):
    """独立 context（localStorage 天然干净）；seed 为每次导航前注入的 JS"""
    ctx = browser.new_context(viewport={"width": viewport[0], "height": viewport[1]})
    if seed:
        ctx.add_init_script(seed)
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
    ok = True
    detail = ""
    try:
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(700)
        fn(page)
        if errs:
            ok = False
            detail = "; ".join(errs[:3])
        log(name, ok, f"errs={len(errs)} {detail}")
    except Exception as e:
        log(name, False, repr(e))
    ctx.close()


def seen_seed(round_no, day):
    return f"localStorage.setItem('{KEY}', JSON.stringify({{seenRound: {round_no}, lastSeenDay: '{day}'}}))"


with sync_playwright() as p:
    browser = p.chromium.launch()

    # ① 全新首启：隐私 → 更新 顺序 + zh-CN 内容断言
    def case1(page):
        privacy_confirm(page)
        assert shown(page, "这次更新了什么"), "更新弹窗未接续弹出"
        assert shown(page, "本周更新 · 第 22 轮"), "r22 徽标缺失"
        assert shown(page, "新增「这次更新了什么」弹窗：升级后当天第一次打开"), "r22 条目缺失"
        assert shown(page, "批处理引擎二期"), "r21 内容缺失"
        assert shown(page, "知道了"), "确认按钮缺失"
        click(page.locator('button:has-text("知道了"):visible').first)
        page.wait_for_timeout(400)
        val = page.evaluate(f"localStorage.getItem('{KEY}')")
        assert val and '"seenRound":22' in val, f"确认后存储未写 seenRound=22: {val}"
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(600)
        assert not page.get_by_text("这次更新了什么").count(), "刷新后仍弹出"
    run_case(browser, "① 全新首启 隐私→更新顺序 + zh-CN 内容 + 确认落存储 + 刷新不弹", case1)

    # ③ X 关闭也记已读
    def case3(page):
        privacy_confirm(page)
        page.wait_for_timeout(300)
        assert shown(page, "这次更新了什么"), "更新弹窗未出现"
        page.locator("button[aria-label='这次更新了什么']").first.evaluate(
            "(e) => e.dispatchEvent(new MouseEvent('click', {bubbles: true}))"
        )
        page.wait_for_timeout(400)
        val = page.evaluate(f"localStorage.getItem('{KEY}')")
        assert val and '"seenRound":22' in val, f"X 关闭未写已读: {val}"
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(600)
        assert not page.get_by_text("这次更新了什么").count(), "X 后刷新仍弹"
    run_case(browser, "③ X 关闭记已读 + 刷新不弹", case3)

    # ④ 上轮当天已看过 → 不弹
    def case4(page):
        privacy_confirm(page)
        page.wait_for_timeout(300)
        assert not page.get_by_text("这次更新了什么").count(), "当天第二次打开不应弹"
    run_case(browser, "④ 上轮今天已看过（r21/今天）不弹", case4, seed=seen_seed(21, date.today().isoformat()))

    # ⑤ 上轮昨天看过 → 今天首启弹出；确认后升 22
    def case5(page):
        privacy_confirm(page)
        page.wait_for_timeout(300)
        assert shown(page, "这次更新了什么"), "跨天首启应弹出"
        click(page.locator('button:has-text("知道了"):visible').first)
        page.wait_for_timeout(400)
        val = page.evaluate(f"localStorage.getItem('{KEY}')")
        assert '"seenRound":22' in (val or ""), f"确认后未升 22: {val}"
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    run_case(browser, "⑤ 昨天看过今天首启弹出 + 确认升级到 22", case5, seed=seen_seed(21, yesterday))

    # ⑥ en 语境本地化
    def case6(page):
        privacy_confirm(page)
        page.wait_for_timeout(300)
        assert shown(page, "What's New"), "en 标题缺失"
        assert shown(page, "This Week · Round 22"), "en r22 徽标缺失"
        assert shown(page, "Batch engine phase 2"), "en 内容缺失"
        assert shown(page, "Got it"), "en 按钮缺失"
        click(page.locator('button:has-text("Got it"):visible').first)
        page.wait_for_timeout(300)
        val = page.evaluate(f"localStorage.getItem('{KEY}')")
        assert '"seenRound":22' in (val or ""), "en 确认未落存储"
    run_case(browser, "⑥ en 语境本地化内容", case6, seed=f"localStorage.setItem('{LOCALE_KEY}', 'en')")

    # ⑦ zh-TW 语境本地化
    def case7(page):
        privacy_confirm(page)
        page.wait_for_timeout(300)
        assert shown(page, "這次更新了什麼"), "zh-TW 标题缺失"
        assert shown(page, "批次處理引擎二期"), "zh-TW 内容缺失"
        assert shown(page, "知道了"), "zh-TW 按钮缺失"
        click(page.locator('button:has-text("知道了"):visible').first)
        page.wait_for_timeout(300)
        val = page.evaluate(f"localStorage.getItem('{KEY}')")
        assert '"seenRound":22' in (val or ""), "zh-TW 确认未落存储"
    run_case(browser, "⑦ zh-TW 语境本地化内容", case7, seed=f"localStorage.setItem('{LOCALE_KEY}', 'zh-TW')")

    # ⑧ 手机 390px
    def case8(page):
        privacy_confirm(page)
        page.wait_for_timeout(300)
        assert shown(page, "这次更新了什么"), "手机首启未弹出"
        overflow = page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        assert overflow, "390px 视口横向溢出"
        card = page.locator("div[role='dialog']").first
        box = card.bounding_box()
        assert box and box["x"] >= 0 and box["x"] + box["width"] <= 391, f"弹窗超出视口 {box}"
    run_case(browser, "⑧ 手机 390px 弹窗不溢出", case8, viewport=(390, 844))

    browser.close()

fails = [r for r in results if not r[1]]
print(f"\n===== {len(results) - len(fails)}/{len(results)} PASS =====")
if fails:
    print("FAILED:", fails)
    raise SystemExit(1)
