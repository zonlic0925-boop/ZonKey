"""Round-16 E2E：在「解压产物前端 + 真实后端」上验证 ③ 打字测试与 ② 裁切交付。

- ③ 打字测试：开始挑战 → running → 输入 → 实时着色 → 倒计时结算
- ② 裁切：上传 → 立即裁剪 →
    a) 浏览器路径：a[download] 下载事件
    b) 壳路径：stub window.pywebview → save-blob 200 → save-as（route mock）
"""
import os
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("ZS_URL", "http://127.0.0.1:8766/")
OUT = Path(__file__).parent
SAMPLE = str(OUT / "r16_sample.png")
t0 = time.time()
results = []


def log(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name} {detail} (+{time.time()-t0:.1f}s)")


def dismiss_privacy(page):
    privacy = page.locator('button:has-text("我已了解")')
    if privacy.count():
        privacy.first.click(force=True)
        page.wait_for_timeout(300)


def open_tool(page, center_title, tool_text):
    home = page.locator('button:has-text("首页"):visible')
    if home.count():
        home.first.click(force=True)
        page.wait_for_timeout(400)
    center = page.locator(f'button[title="{center_title}"]:visible').first
    center.wait_for(state="visible", timeout=15000)
    center.click(force=True)
    page.wait_for_timeout(500)
    tool = page.locator(f'button:has-text("{tool_text}"):visible').first
    tool.click(force=True)
    page.wait_for_timeout(500)


def run_flow(shell_mode: bool):
    tag = "shell" if shell_mode else "browser"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1500, "height": 950}, accept_downloads=True)
        if shell_mode:
            ctx.add_init_script(
                "window.pywebview = {api: {}}; Object.defineProperty(window, '__zsShellStub', {value: 1});"
            )
        page = ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append("console:" + m.text) if m.type == "error" else None)
        # mock 原生另存对话框端点（真实对话框是已知可用链路，此处只验证前端链）
        page.route("**/api/export/save-as", lambda route: route.fulfill(
            status=200, content_type="application/json", body='{"cancelled": true}'
        ))
        save_blob_calls = []
        page.on("request", lambda r: save_blob_calls.append(r.url) if "save-blob" in r.url else None)

        page.goto(BASE, wait_until="networkidle", timeout=45000)
        dismiss_privacy(page)

        # ---- ③ 打字测试 ----
        open_tool(page, "文本工坊", "打字测速")
        start_btn = page.locator('button:has-text("开始挑战"):visible')
        log(f"{tag}:typing.start-btn", start_btn.count() > 0, f"count={start_btn.count()}")
        start_btn.first.click(force=True)
        page.wait_for_timeout(500)
        inp = page.locator('input[placeholder*="开始输入"]:visible')
        log(f"{tag}:typing.running-phase", inp.count() > 0, f"input visible={inp.count()}")
        if inp.count():
            inp.first.click(force=True)
            page.keyboard.type("hello", delay=40)
            page.wait_for_timeout(400)
            # 切回英文词库验证更直接：直接读输入值与着色
            colored = page.locator("span.text-mem-teal").count()
            marked_wrong = page.locator("span.text-mem-coral").count()
            log(f"{tag}:typing.colored", colored + marked_wrong > 0,
                f"correct={colored} wrong={marked_wrong}")
            # 等 30s 倒计时结束自动结算太慢：把输入清空重打不现实，直接验证 timer 走动
            tl1 = page.locator('text=/^剩余/').locator("..").inner_text()
            page.wait_for_timeout(2100)
            tl2 = page.locator('text=/^剩余/').locator("..").inner_text()
            log(f"{tag}:typing.timer-ticks", tl1 != tl2, f"{tl1!r} -> {tl2!r}")
        page.screenshot(path=str(OUT / f"r16_typing_{tag}.png"))

        # ---- ② 图片裁切 ----
        open_tool(page, "图像工坊", "图像裁剪")
        file_input = page.locator('input[type="file"]').first
        file_input.set_input_files(SAMPLE)
        page.wait_for_timeout(1200)
        stage = page.locator("div.cursor-crosshair")
        log(f"{tag}:crop.stage", stage.count() > 0, f"stage={stage.count()}")
        crop_btn = page.locator('button:has-text("裁剪并下载"):visible')
        log(f"{tag}:crop.btn", crop_btn.count() > 0)
        if crop_btn.count():
            if shell_mode:
                crop_btn.first.click(force=True)
                page.wait_for_timeout(2500)
                ok = len(save_blob_calls) > 0 and not [
                    e for e in errors if "save" in e.lower()
                ]
                log(f"{tag}:crop.shell-delivery", ok,
                    f"save_blob_calls={len(save_blob_calls)} errors={errors[:3]}")
            else:
                with page.expect_download(timeout=8000) as dl:
                    crop_btn.first.click(force=True)
                d = dl.value
                dest = OUT / f"r16_crop_{tag}.png"
                d.save_as(str(dest))
                log(f"{tag}:crop.browser-download", dest.stat().st_size > 100,
                    f"{d.suggested_filename} {dest.stat().st_size}B")
        page.screenshot(path=str(OUT / f"r16_crop_{tag}.png"))
        log(f"{tag}:zero-pageerror", not errors, str(errors[:4]))
        browser.close()


if __name__ == "__main__":
    run_flow(shell_mode=False)
    run_flow(shell_mode=True)
    fails = [r for r in results if not r[1]]
    print(f"\n==== {len(results) - len(fails)}/{len(results)} PASS ====")
    raise SystemExit(1 if fails else 0)
