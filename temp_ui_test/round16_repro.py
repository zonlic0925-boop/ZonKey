"""Round-16 复现：① 打字测试无法开始；② 裁切后无法下载。"""
import os
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("ZS_URL", "http://localhost:5199/")
OUT = Path(__file__).parent
t0 = time.time()

def log(*a):
    print(f"[+{time.time()-t0:.1f}s]", *a)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 1500, "height": 950}, accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    console_errors = []
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    page.goto(BASE, wait_until="networkidle", timeout=45000)

    privacy = page.locator('button:has-text("我已了解")')
    if privacy.count():
        privacy.first.click(force=True)
        page.wait_for_timeout(300)

    # ---- 打字测试 ----
    log("== 打字测试 ==")
    center = page.locator('button[title="文本工坊"]:visible').first
    center.wait_for(state="visible", timeout=10000)
    center.click(force=True)
    page.wait_for_timeout(600)
    tool = page.locator('button:has-text("打字测速"):visible').first
    log("打字测速按钮数量:", page.locator('button:has-text("打字测速")').count())
    tool.click(force=True)
    page.wait_for_timeout(500)
    start_btn = page.locator('button:has-text("开始挑战"):visible')
    log("开始挑战按钮:", start_btn.count())
    start_btn.click(force=True)
    page.wait_for_timeout(600)
    # 进入 running 了吗？
    inp = page.locator('input[placeholder*="点击此处开始输入"]')
    log("输入框出现:", inp.count())
    target_chars = page.locator("span.whitespace-pre")
    log("目标字符 span 数:", target_chars.count())
    if inp.count():
        inp.first.click(force=True)
        page.keyboard.type("hello", delay=50)
        page.wait_for_timeout(400)
        colored = page.locator("span.text-mem-teal").count()
        log("已着色正确字符:", colored)
    page.screenshot(path=str(OUT / "r16_typing.png"))

    # ---- 图片裁切 ----
    log("== 图片裁切 ==")
    # 返回首页找图像中心
    center2 = page.locator('button[title="图像中心"]:visible')
    log("图像中心按钮:", center2.count())
    if center2.count():
        center2.first.click(force=True)
        page.wait_for_timeout(600)
    tool2 = page.locator('button:has-text("图片裁切"):visible, button:has-text("裁切"):visible').first
    log("裁切按钮:", page.locator('button:has-text("裁切")').count())
    tool2.click(force=True)
    page.wait_for_timeout(500)
    # 上传样本图
    sample = OUT / "sanity.png"
    log("样本图存在:", sample.exists())
    file_input = page.locator('input[type="file"]').first
    file_input.set_input_files(str(sample))
    page.wait_for_timeout(1200)
    page.screenshot(path=str(OUT / "r16_crop_stage.png"))
    crop_btn = page.locator('button:has-text("立即裁剪"):visible, button:has-text("裁剪"):visible').first
    log("立即裁剪按钮:", crop_btn.count())
    if crop_btn.count():
        with page.expect_download(timeout=8000) as dl_info:
            crop_btn.click(force=True)
        dl = dl_info.value
        dest = OUT / "r16_crop_download.png"
        dl.save_as(str(dest))
        log("下载成功:", dl.suggested_filename, "->", dest.stat().st_size, "bytes")

    log("pageerror:", errors[:5])
    log("console error:", console_errors[:8])
    page.screenshot(path=str(OUT / "r16_final.png"))
    browser.close()
