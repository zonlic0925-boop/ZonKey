"""Round-15 专项回归（Python Playwright · 简体中文 UI）。
覆盖：① 打字测速全流程（设置→开始→打字→结算）；
② 图片裁切拖拽交互（手柄缩放 + 框体移动 + 裁剪执行）；
③ 壳层心跳 __zsHeartbeat 推进。
跑法：先起 vite dev(5199) + 后端(8765)，python temp_ui_test/round15_fixes.py
"""
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get("ZS_URL", "http://localhost:5199/")
SAMPLE_IMG = str(Path(__file__).parent / "sanity.png")

t0 = time.time()
failures = 0


def log(*a):
    print(f"[+{time.time() - t0:.1f}s]", *a)


def ok(name, cond, detail=""):
    global failures
    print(f"  {'PASS' if cond else 'FAIL'} {name}{' — ' + detail if detail else ''}")
    if not cond:
        failures += 1


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1500, "height": 950}, accept_downloads=True)
    page = ctx.new_page()
    page_errors = []
    page.on("pageerror", lambda e: page_errors.append(str(e)))

    page.goto(BASE, wait_until="networkidle", timeout=45000)

    # 关闭隐私弹窗（如出现）
    privacy_btn = page.locator('button:has-text("我已了解")')
    if privacy_btn.count():
        privacy_btn.first.click(force=True)
        page.wait_for_timeout(400)

    # ---- 心跳 ----
    hb1 = page.evaluate("() => window.__zsHeartbeat || 0")
    page.wait_for_timeout(2300)
    hb2 = page.evaluate("() => window.__zsHeartbeat || 0")
    ok("heartbeat 推进", hb2 > hb1, f"hb: {hb1} -> {hb2}")

    # ---- 文本工坊 → 打字测速 ----
    center = page.locator('button[title="文本工坊"]:visible').first
    center.wait_for(state="visible", timeout=10000)
    center.click(force=True)
    page.wait_for_timeout(600)

    tool = page.locator('button:has-text("打字测速"):visible').first
    tool.wait_for(state="visible", timeout=10000)
    tool.click(force=True)
    page.wait_for_timeout(900)

    start_btn = page.locator('button:has-text("开始")').first
    start_btn.wait_for(state="visible", timeout=8000)
    ok("打字测速设置页可见", True)

    en_opt = page.locator('button:has-text("英文"):visible').first
    if en_opt.count():
        en_opt.click(force=True)
        page.wait_for_timeout(300)
    d15 = page.locator('button:has-text("15s")').first
    if d15.count():
        d15.click(force=True)
        page.wait_for_timeout(300)

    start_btn.click(force=True)
    page.wait_for_timeout(700)

    target_box = page.locator("div.border-2.border-mem-ink.rounded-2xl").first
    target_box.wait_for(state="visible", timeout=8000)
    target_text = (target_box.inner_text() or "").strip()
    ok("运行页目标文本渲染", len(target_text) > 5, f"len={len(target_text)}")

    typing_input = page.locator('input[type="text"]').first
    typing_input.wait_for(state="visible", timeout=8000)
    typing_input.click()

    letters = "".join(c for c in target_text if c.isascii() and c.isalpha())
    ok("英文模式目标文本", len(letters) > 20, f"letters={len(letters)}")

    first = letters[:18]
    page.keyboard.type(first, delay=55)
    page.wait_for_timeout(400)

    wpm_tile = page.locator('p:has-text("WPM")').first
    ok("WPM 磁贴存在", wpm_tile.count() > 0)

    # 打完剩余目标 → 长度达标立即结算
    rest = letters[18:]
    if rest:
        typing_input.click(force=True)
        page.keyboard.type(rest, delay=5)
    page.wait_for_timeout(1200)

    again_btn = page.locator('button:has-text("再来一局")').first
    ok("打字测速可结算到结果页（打完目标）", again_btn.count() > 0, "结果页已出现" if again_btn.count() else "无结果页")
    if not again_btn.count():
        page.wait_for_timeout(16000)
        ok("倒计时后结算", page.locator('button:has-text("再来一局")').first.count() > 0)

    # ---- 图像工坊 → 图片裁剪 ----
    page.goto(BASE, wait_until="networkidle", timeout=45000)
    privacy_btn = page.locator('button:has-text("我已了解")')
    if privacy_btn.count():
        privacy_btn.first.click(force=True)
        page.wait_for_timeout(400)
    img_center = page.locator('button[title="图像工坊"]:visible').first
    img_center.wait_for(state="visible", timeout=10000)
    img_center.click(force=True)
    page.wait_for_timeout(600)
    crop_tool = page.locator('button:has-text("图像裁剪"):visible').first
    crop_tool.wait_for(state="visible", timeout=10000)
    crop_tool.click(force=True)
    page.wait_for_timeout(700)

    file_input = page.locator('input[type="file"]').first
    file_input.set_input_files(SAMPLE_IMG)
    page.wait_for_timeout(1200)

    stage = page.locator('div.relative.overflow-hidden[style*="width"]').first
    stage.wait_for(state="visible", timeout=8000)
    ok("裁切画布出现", True)

    crop_box = page.locator("div.border-2.border-mem-pink").first
    crop_box.wait_for(state="visible", timeout=8000)
    box0 = crop_box.bounding_box()
    ok("裁剪框初始渲染", bool(box0) and box0["width"] > 10 and box0["height"] > 10, str(box0))

    if box0:
        # 手柄只取 stage 内的（页面另有同 class 元素，nth 会错位）；se=第 7 个
        stage_handles = stage.locator("div.w-3.h-3")
        se_handle = stage_handles.nth(6)
        hb0 = se_handle.bounding_box()
        if hb0:
            page.mouse.move(hb0["x"] + hb0["width"] / 2, hb0["y"] + hb0["height"] / 2)
            page.mouse.down()
            page.mouse.move(hb0["x"] - 60, hb0["y"] - 60, steps=12)
            page.mouse.up()
            page.wait_for_timeout(300)
            box1 = crop_box.bounding_box()
            ok("se 手柄拖拽改变尺寸", bool(box1) and box1["width"] < box0["width"] - 20,
               f"w: {box0['width']} -> {box1['width'] if box1 else 'N/A'}")
            if box1:
                # 框缩小后内部拖动：向右下移动（向左上会被原点 clamp）
                page.mouse.move(box1["x"] + box1["width"] / 2, box1["y"] + box1["height"] / 2)
                page.mouse.down()
                page.mouse.move(box1["x"] + box1["width"] / 2 + 40, box1["y"] + box1["height"] / 2 + 30, steps=10)
                page.mouse.up()
                page.wait_for_timeout(300)
                box2 = crop_box.bounding_box()
                ok("框体拖拽移动", bool(box2) and abs((box2["x"] - box1["x"]) - 40) < 15,
                   f"dx: {box1['x']} -> {box2['x'] if box2 else 'N/A'}")

    crop_btn = page.locator('button:has-text("裁剪并下载")').first
    crop_btn.wait_for(state="visible", timeout=8000)
    try:
        with page.expect_download(timeout=15000) as dl_info:
            crop_btn.click(force=True)
        page.wait_for_timeout(800)
        ok("裁剪产物下载", True, dl_info.value.suggested_filename)
    except Exception:
        ok("裁剪产物下载", False, "无下载事件")
    err_line = page.locator("text=裁剪区域").count()
    ok("裁剪执行无错误", err_line == 0)

    ok("全程零 pageerror", len(page_errors) == 0, " | ".join(page_errors[:3]))

    browser.close()

print(f"\n==== round15: {'ALL PASS' if failures == 0 else f'{failures} FAILURES'} ====")
sys.exit(0 if failures == 0 else 1)
