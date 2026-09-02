"""Round-16 前端回归（对最新 dist_web + 真实后端）：

③ 打字测试 IME 修复——合成 CompositionEvent 走 zh 模式组合路径（此前
   e.target.value='' 在组合中清框掐断 IME，合成键盘事件测不出来）；
② 裁切反馈——壳模式下取消另存后出现「产物保留在 output」提示；
④ 下载提示区——浏览器模式显示、壳模式不显示、CTA 弹窗含 GitHub 主仓库链接；
⑤ 术语——帮助弹窗 GitHub（主仓库）在前、Gitee（国内镜像）在后。
"""
import os
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("ZS_URL", "http://127.0.0.1:8767/")
OUT = Path(__file__).parent
SAMPLE = str(OUT / "r16_sample.png")
t0 = time.time()
results = []


def log(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name} {detail} (+{time.time()-t0:.1f}s)")


COMMIT_ZH = """
([el, text]) => {
  el.focus();
  el.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true, data: ''}));
  // 模拟 IME 组合中途的 input 事件（旧代码在此清框 → 掐断组合）
  el.value = text.slice(0, 2);
  el.dispatchEvent(new InputEvent('input', {bubbles: true, data: text.slice(0, 2)}));
  el.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true, data: text}));
  el.value = '';
  el.dispatchEvent(new InputEvent('input', {bubbles: true, data: ''}));
}
"""


def dismiss_privacy(page):
    privacy = page.locator('button:has-text("我已了解")')
    if privacy.count():
        privacy.first.click(force=True)
        page.wait_for_timeout(300)


def goto_home_tool(page, center_title, tool_text):
    home = page.locator('button:has-text("首页"):visible')
    if home.count():
        home.first.click(force=True)
        page.wait_for_timeout(400)
    page.locator(f'button[title="{center_title}"]:visible').first.click(force=True)
    page.wait_for_timeout(500)
    page.locator(f'button:has-text("{tool_text}"):visible').first.click(force=True)
    page.wait_for_timeout(500)


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ============ 浏览器模式 ============
    ctx = browser.new_context(viewport={"width": 1500, "height": 950}, accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append("console:" + m.text) if m.type == "error" else None)
    page.goto(BASE, wait_until="networkidle", timeout=45000)
    dismiss_privacy(page)

    # ---- ④ 提示区（浏览器模式应显示）----
    cta = page.locator('button:has-text("下载桌面版"):visible').first
    log("web:promo.banner-visible", cta.count() > 0)
    if cta.count():
        cta.click(force=True)
        page.wait_for_timeout(400)
        modal_title = page.locator('text=下载 ZonKey 桌面版')
        log("web:promo.modal-opens", modal_title.count() > 0)
        gh_link = page.locator(f'a[href*="github.com/zonlic0925-boop/ZonKey/releases"]:visible')
        log("web:promo.github-release-link", gh_link.count() > 0)
        main_label = page.locator('text=GitHub Release（主仓库）')
        log("web:promo.main-repo-wording", main_label.count() > 0)
        page.locator('div.memphis-card button.absolute:visible').first.click(force=True)
        page.wait_for_timeout(300)
    else:
        log("web:promo.modal-opens", False, "CTA not found")

    # ---- ⑤ 术语：帮助弹窗 ----
    help_btn = page.locator('button:has-text("帮助"):visible').first
    help_btn.click(force=True)
    page.wait_for_timeout(400)
    modal = page.locator('div.memphis-card:visible')
    body = modal.last.inner_text()
    ok_term = "GitHub（主仓库）" in body and "Gitee（国内镜像）" in body
    gh_pos = body.find("github.com/zonlic0925-boop")
    gitee_pos = body.find("gitee.com/zonlic")
    log("web:term.help-modal-order", ok_term and 0 <= gh_pos < gitee_pos,
        f"github@{gh_pos} gitee@{gitee_pos}")
    # 关帮助弹窗
    close = page.locator('div.memphis-card button.absolute:visible')
    if close.count():
        close.first.click(force=True)
    page.wait_for_timeout(300)


    # ---- ③ 打字测试（zh IME 组合路径）----
    goto_home_tool(page, "文本工坊", "打字测速")
    page.locator('button:has-text("15s"):visible').first.click(force=True)
    page.locator('button:has-text("开始挑战"):visible').first.click(force=True)
    page.wait_for_timeout(500)
    inp = page.locator('input[placeholder*="开始输入"]:visible').first
    log("ime:running", inp.count() > 0)
    if inp.count():
        el = inp.element_handle()
        # 目标前两个字（zh easy 词库首词，如「自然」），从 DOM 读取
        target_spans = page.locator("span.whitespace-pre")
        t1 = target_spans.nth(0).inner_text()
        t2 = target_spans.nth(1).inner_text()
        page.evaluate(COMMIT_ZH, [el, t1 + t2])
        page.wait_for_timeout(500)
        colored = page.locator("span.text-mem-teal").count()
        log("ime:commit-colors-chars", colored >= 2, f"committed='{t1}{t2}' correct_spans={colored}")
        page.screenshot(path=str(OUT / "r16_ime_after.png"))
    ctx.close()

    # ============ 壳模式 ============
    ctx2 = browser.new_context(viewport={"width": 1500, "height": 950}, accept_downloads=True)
    ctx2.add_init_script("window.pywebview = {api: {}};")
    page2 = ctx2.new_page()
    page2.on("pageerror", lambda e: errors.append("shell:" + str(e)))
    page2.route("**/api/export/save-as", lambda route: route.fulfill(
        status=200, content_type="application/json", body='{"cancelled": true}'))
    page2.goto(BASE, wait_until="networkidle", timeout=45000)
    dismiss_privacy(page2)

    # ---- ④ 壳内不显示提示区 ----
    page2.wait_for_timeout(3000)  # 等 useShellMode 异步补判
    log("shell:promo-hidden", page2.locator('button:has-text("下载桌面版"):visible').count() == 0)

    # ---- ② 裁切：取消另存后有反馈 ----
    goto_home_tool(page2, "图像工坊", "图像裁剪")
    page2.locator('input[type="file"]').first.set_input_files(SAMPLE)
    page2.wait_for_timeout(1000)
    page2.locator('button:has-text("裁剪并下载"):visible').first.click(force=True)
    page2.wait_for_timeout(3000)
    notice = page2.locator('text=已取消另存')
    log("shell:crop-cancel-feedback", notice.count() > 0,
        f"notice={notice.count()}")
    page2.screenshot(path=str(OUT / "r16_crop_feedback.png"))

    log("suite:zero-pageerror", not errors, str(errors[:4]))
    browser.close()

fails = [r for r in results if not r[1]]
print(f"\n==== {len(results) - len(fails)}/{len(results)} PASS ====")
raise SystemExit(1 if fails else 0)
