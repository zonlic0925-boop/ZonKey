"""诊断：390 视口下手机顶栏是否真实横向溢出 + banner CTA 为何不可见 + 收藏星标行为。"""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5199"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(600)
    # dismiss privacy if present
    pb = page.locator('button:has-text("我已了解"):visible').first
    if pb.count():
        pb.evaluate("(e) => e.dispatchEvent(new MouseEvent('click', {bubbles: true}))")
        page.wait_for_timeout(400)

    # 手机顶栏结构测量
    info = page.evaluate(
        """() => {
        const out = { vw: document.documentElement.clientWidth, rows: [] };
        // 所有 header 直接子行
        const headers = document.querySelectorAll('header, header *');
        const seen = new Set();
        for (const el of headers) {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (style.position === 'fixed' || style.position === 'sticky' || r.width === 0) continue;
          const key = el.tagName + '.' + (el.className || '').toString().slice(0, 80);
          if (seen.has(key)) continue;
          seen.add(key);
          const parent = el.parentElement;
          const pstyle = parent ? getComputedStyle(parent) : null;
          const scrollable = el.scrollWidth > el.clientWidth + 1;
          out.rows.push({
            el: key,
            left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
            scrollW: el.scrollWidth, clientW: el.clientWidth,
            scrollable,
            parentOverflowX: pstyle ? pstyle.overflowX : 'n/a',
            visible: style.display !== 'none' && style.visibility !== 'hidden',
          });
        }
        return out;
      }"""
    )
    print("vw =", info["vw"])
    for row in info["rows"]:
        if row["visible"] and (row["right"] > info["vw"] + 1 or row["scrollable"]):
            print("OVERFLOW?", row)

    # 语言开关按钮位置
    btn = page.locator('button[aria-haspopup="menu"]:visible').first
    print("lang btn count:", page.locator('button[aria-haspopup="menu"]:visible').count())
    b = btn.bounding_box()
    print("lang btn box:", b)

    # banner
    print("banner CTA count:", page.locator('button:has-text("下载桌面版"):visible').count())
    print("banner text:", page.locator('text=这是网页版').count())

    # PPT 中心 → 首页 → 星标
    page.locator('button[title="PPT 工坊"]:visible').first.evaluate(
        "(e) => e.dispatchEvent(new MouseEvent('click', {bubbles: true}))")
    page.wait_for_timeout(700)
    stars = page.locator('button[aria-label="收藏此工具"]:visible')
    print("star count:", stars.count())
    if stars.count():
        stars.first.evaluate("(e) => e.dispatchEvent(new MouseEvent('click', {bubbles: true}))")
        page.wait_for_timeout(500)
        print("aria-pressed after:", page.locator('button[aria-pressed="true"]:visible').count())
        # 主页导航收藏 chip
        print("我的收藏 chip:", page.locator('text=我的收藏').count())
    print("errors:", errs[:5])
    browser.close()
