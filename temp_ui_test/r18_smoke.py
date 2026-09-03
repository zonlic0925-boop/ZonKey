"""Round-18 冒烟（Playwright Python · vite dev 5199 + 后端 8765）：
① PPT 首页——切中心落 ppt-home 网格、三组标题（转换/提取与优化/生成）、7 卡、
   组归属、卡跳转、收藏星标、SubNav 分组 pill。
② 语言切换——zh-CN → en → zh-TW，PPT 首页标题、手机顶栏开关（44px + right 对齐不溢出视口）。
③ 下载次数——mock GitHub latest API：资产行「N 次下载」、底部「累计 N 次下载」、
   .sha256/build_kit 过滤；API 失败回退文案 + 双通道入口 + 零 pageerror。
④ 零 pageerror + 零横向溢出（桌面 1440 / 手机 390）。
已知坑：header 区按钮用 dispatchEvent('click') 绕 drag 层；隐藏元素用 :visible；vite 走 localhost。
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
        page.wait_for_timeout(400)


def open_center(page, title):
    page.locator(f'button[title="{title}"]:visible').first.wait_for(timeout=8000)
    click(page.locator(f'button[title="{title}"]:visible').first)
    page.wait_for_timeout(600)


def assert_no_overflow(page, name):
    """主布局容器（header/nav/main）右缘不得超出视口；横向滚动容器允许 scrollW>clientW，
    装饰层（zs-float/zs-fluid-blob 负偏移）与 overflow-hidden 裁剪不视为溢出。"""
    bad = page.evaluate(
        """() => {
        const vw = document.documentElement.clientWidth;
        const bad = [];
        const clipped = (el) => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const s = getComputedStyle(p);
            if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) return true;
          }
          return false;
        };
        for (const sel of ['header', 'nav', 'main', 'footer']) {
          for (const el of document.querySelectorAll(sel)) {
            const r = el.getBoundingClientRect();
            if (r.width === 0) continue;
            if (r.right > vw + 1 || r.left < -1) {
              if (clipped(el) && el.scrollWidth <= el.clientWidth + 1) continue;  // 滚动容器/裁剪内正常
              bad.push(el.tagName + '.' + (el.className || '').toString().slice(0, 50)
                + ` L${Math.round(r.left)} R${Math.round(r.right)}`);
            }
          }
        }
        return bad.slice(0, 5);
      }"""
    )
    log(name, len(bad) == 0, " | ".join(bad))


GH_MOCK = {
    "tag_name": "v1.0.2",
    "assets": [
        {"name": "ZonKey_Setup_x64_20260903.exe", "size": 204_000_000, "download_count": 42,
         "browser_download_url": "https://github.com/zonlic0925-boop/ZonKey/releases/download/v1.0.2/ZonKey_Setup_x64_20260903.exe"},
        {"name": "ZonKey_Windows_x64_20260903.zip", "size": 282_000_000, "download_count": 7,
         "browser_download_url": "https://github.com/zonlic0925-boop/ZonKey/releases/download/v1.0.2/ZonKey_Windows_x64_20260903.zip"},
        {"name": "ZonKey_macOS_arm64_20260903.dmg", "size": 150_000_000, "download_count": 3,
         "browser_download_url": "https://github.com/zonlic0925-boop/ZonKey/releases/download/v1.0.2/ZonKey_macOS_arm64_20260903.dmg"},
        {"name": "ZonKey_Setup_x64_20260903.exe.sha256", "size": 100, "download_count": 1,
         "browser_download_url": "https://example.com/x.sha256"},
        {"name": "ZonKey_mac_build_kit_20260903.zip", "size": 6_000_000, "download_count": 1,
         "browser_download_url": "https://example.com/build_kit.zip"},
    ],
}

GH_PATTERN = "**/api.github.com/repos/zonlic0925-boop/ZonKey/releases/latest"


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        console_errors = []
        page.on("console", lambda m: console_errors.append(m.text[:250]) if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errors.append("PAGEERROR: " + str(e)[:250]))

        page.route(GH_PATTERN, lambda route: route.fulfill(
            status=200, content_type="application/json", body=__import__("json").dumps(GH_MOCK)))

        # ============ ① PPT 首页 ============
        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(600)
        dismiss_privacy(page)
        open_center(page, "PPT 工坊")

        log("PPT 首页标题可见", page.locator('h2:has-text("PPT 工坊")').first.is_visible())
        groups = page.locator("section h3").all_text_contents()
        log("三组标题", all(g in groups for g in ["转换", "提取与优化", "生成"]), "/".join(groups))

        cards = page.locator("section .grid > div.relative")
        log("工具卡 7 张（无 ppt-home 卡）", cards.count() == 7, f"count={cards.count()}")

        convert_section = page.locator("section", has=page.locator('h3:has-text("转换")')).first
        log("PPT 转 PDF 归「转换」组", convert_section.locator('button:has-text("PPT 转 PDF")').count() == 1)

        # 卡跳转 → 工具页 + SubNav 分组 pill
        click(convert_section.locator('button:has-text("PPT 转 PDF")').first)
        page.wait_for_timeout(700)
        upload_ok = page.locator('text=选择或拖入 .ppt/.pptx 文件').first.is_visible()
        fallback_ok = upload_ok or page.locator("input[type=file]").count() > 0
        log("卡片点击跳转 PPT 转 PDF 工具页", fallback_ok)
        # 分组 pill 语义 = 组间分隔条（SubNavPills showDivider），home pill 为「全部工具」
        home_pill = page.locator('button:has-text("全部工具"):visible').count()
        dividers = page.locator(".zs-mobile-scroll-x div.w-0\\.5").count()
        log("SubNav home pill + 组间分隔条（≥2）", home_pill >= 1 and dividers >= 2,
            f"pill={home_pill} dividers={dividers}")

        # 回首页（中心按钮同中心不切换，走「全部工具」pill）→ 收藏星标联动
        click(page.locator('button:has-text("全部工具"):visible').first)
        page.wait_for_timeout(600)
        star = page.locator('button[aria-label="收藏此工具"]:visible, button[aria-label="Add to favorites"]:visible').first
        star.wait_for(timeout=5000)
        click(star)
        page.wait_for_timeout(500)
        pressed = page.locator('button[aria-pressed="true"]:visible').count()
        log("收藏星标可点（aria-pressed 翻转）", pressed >= 1, f"pressed={pressed}")
        click(star)  # 取消收藏，恢复干净
        page.wait_for_timeout(400)

        # ============ ② 语言切换 ============
        lang_btn = page.locator('button[title="语言"]:visible, button[title="Language"]:visible').first
        lang_btn.wait_for(timeout=5000)
        click(lang_btn)
        page.wait_for_timeout(400)
        click(page.locator('[role="menu"] button:has-text("English")').first)
        page.wait_for_timeout(700)
        log("切 en → 标题 PPT Studio", page.locator('h2:has-text("PPT Studio")').first.is_visible())
        en_groups = page.locator("section h3").all_text_contents()
        log("en 分组标题", all(g in en_groups for g in ["Convert", "Extract & Optimize", "Create"]), "/".join(en_groups))

        click(lang_btn)
        page.wait_for_timeout(400)
        click(page.locator('[role="menu"] button:has-text("繁體")').first)
        page.wait_for_timeout(700)
        tw_groups = page.locator("section h3").all_text_contents()
        log("切 zh-TW → 分组标题", all(g in tw_groups for g in ["轉換", "提取與優化", "產生"]), "/".join(tw_groups))

        assert_no_overflow(page, "桌面 1440 零横向溢出")

        # 手机视口：语言开关 44px + 菜单不溢出
        page.set_viewport_size({"width": 390, "height": 844})
        page.wait_for_timeout(800)
        mobile_lang = page.locator('button[aria-haspopup="menu"]:visible').first
        mobile_lang.wait_for(timeout=5000)
        box = mobile_lang.bounding_box()
        log("手机顶栏语言开关 ≥44px 触控", box is not None and box["height"] >= 44,
            f"h={box['height']:.1f}" if box else "no box")
        click(mobile_lang)
        page.wait_for_timeout(400)
        menu = page.locator('[role="menu"]:visible').first
        menu.wait_for(timeout=3000)
        mbox = menu.bounding_box()
        log("手机语言菜单不溢出视口右缘", mbox is not None and mbox["x"] + mbox["width"] <= 391,
            f"right={mbox['x']+mbox['width']:.1f}" if mbox else "menu 不可见")
        click(mobile_lang)
        page.wait_for_timeout(300)
        assert_no_overflow(page, "手机 390 零横向溢出")

        # ============ ③ 下载次数（mock GitHub API） ============
        page.set_viewport_size({"width": 1440, "height": 900})
        page.wait_for_timeout(600)
        # 语言切回 zh-CN（下载次数断言用简体文案；上一步停在 zh-TW）
        lang_btn2 = page.locator('button[title="語言"]:visible, button[title="语言"]:visible, button[title="Language"]:visible').first
        lang_btn2.wait_for(timeout=5000)
        click(lang_btn2)
        page.wait_for_timeout(400)
        click(page.locator('[role="menu"] button:has-text("简体")').first)
        page.wait_for_timeout(700)
        # 防御：清 banner dismiss 状态保证横幅在场
        page.evaluate("localStorage.removeItem('zonkey.desktopPromoDismissed')")
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(800)
        dismiss_privacy(page)
        banner_cta = page.locator('button:has-text("下载桌面版"):visible').first
        banner_cta.wait_for(timeout=8000)
        click(banner_cta)
        page.wait_for_timeout(1500)
        log("资产行下载计数（42 次下载）", page.locator('text=42 次下载').first.is_visible())
        log("底部累计下载（52 = 42+7+3）", page.locator('text=本版本累计 52 次下载').first.is_visible())
        # verifyHint 文案含「.sha256 文件」字样属预期；断言资产行本身被过滤（不含文件名）
        sha_row = page.locator('text=ZonKey_Setup_x64_20260903.exe.sha256').count()
        kit_row = page.locator('text=build_kit').count()
        log(".sha256 / build_kit 资产行被过滤", sha_row == 0 and kit_row == 0,
            f"sha_row={sha_row} kit_row={kit_row}")

        # API 失败回退（拦截 abort 模拟网络受限）。
        # 独立 context：sessionStorage 按 context 共享，若复用 ctx 会读到 page 的
        # mock 成功缓存（v1.0.2），根本不会发请求——缓存命中是正确行为，但测不了失败路径。
        ctx2 = browser.new_context(viewport={"width": 1440, "height": 900})
        page2 = ctx2.new_page()
        errors2 = []
        page2.on("pageerror", lambda e: errors2.append("PAGEERROR: " + str(e)))
        page2.on("console", lambda m: errors2.append(m.text[:200]) if m.type == "error" else None)
        page2.route(GH_PATTERN, lambda route: route.abort())
        page2.goto(BASE, wait_until="domcontentloaded")
        page2.wait_for_timeout(800)
        # 隐私弹窗若在场先关（首访模态可能压住下载弹窗）
        pb2 = page2.locator('button:has-text("我已了解"):visible').first
        try:
            pb2.wait_for(timeout=4000)
            click(pb2)
            page2.wait_for_timeout(400)
        except Exception:
            pass
        page2.locator('button:has-text("下载桌面版"):visible').first.wait_for(timeout=8000)
        click(page2.locator('button:has-text("下载桌面版"):visible').first)
        page2.wait_for_timeout(3000)
        fallback = page2.locator('text=/版本列表(获取|取得).*(失败|失敗)/').first.is_visible()
        channel = page2.locator('text=GitHub').first.is_visible()
        log("API 失败回退文案 + 双通道入口", fallback and channel, f"fallback={fallback} channel={channel}")
        log("失败路径零 pageerror", all("PAGEERROR" not in e for e in errors2), " | ".join(errors2[:2]))
        page2.close()

        # ============ 汇总 ============
        log("全程零 pageerror", len(console_errors) == 0, " | ".join(console_errors[:3]))
        browser.close()

    failed = [r for r in results if not r[1]]
    print(f"\n== r18_smoke: {len(results)-len(failed)}/{len(results)} passed ==")
    for f in failed:
        print(f"FAIL: {f[0]} — {f[2]}")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    run()
