# -*- coding: utf-8 -*-
"""round-29 手机/浏览器「打开」弹窗内直接预览冒烟：
  A. 离线 PDF→Word：任务弹窗「打开」可见（round-27 曾隐藏=回归点）→ 弹窗内预览出正文
     → 转换完成不再自动落下载（round-29 收口）→ 手动「下载」仍可出 1 个下载
  B. 离线 PDF→Excel：「打开」→ 预览含 sheet 名 Page 1 与表格
  C. 手机 390×844 离线 PDF→Word 全链路 + 零 pageerror
  D. WhatsNew 弹窗升到第 29 轮：首启自动弹 + 条目文案 + 知道了 → seenRound=29
依赖：8765 后端在线（服务 dist_web）；离线组 route abort 全断 /api。
"""
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
FIXTURE = ROOT / 'r29_fixture.pdf'
BASE = 'http://127.0.0.1:8765'
MARKER = 'ZonKey Round 29 Preview'

results = []
def check(name, ok, extra=''):
    results.append((name, ok))
    print(f"{'PASS' if ok else 'FAIL'}  {name}{('  (' + extra + ')') if extra else ''}")

def make_fixture():
    from reportlab.pdfgen import canvas
    c = canvas.Canvas(str(FIXTURE))
    for i in range(2):
        c.setFont('Helvetica-Bold', 22)
        c.drawString(72, 760, MARKER)
        c.setFont('Helvetica', 12)
        for row in range(6):
            c.drawString(72, 720 - row * 22, f'Row {i + 1}-{row + 1}: the quick brown fox jumps over the lazy dog')
        c.showPage()
    c.save()

if not FIXTURE.exists():
    make_fixture()

errors = []

def mk_page(browser, viewport, offline=True):
    ctx = browser.new_context(viewport=viewport, accept_downloads=True)
    p = ctx.new_page()
    p.on('pageerror', lambda e: errors.append('[pageerror] ' + str(e)))
    p.on('console', lambda m: errors.append('[console] ' + m.text) if m.type == 'error' else None)
    p.goto(BASE, wait_until='domcontentloaded')
    p.evaluate("""() => {
        localStorage.setItem('zonkey.privacyNotice.v1', 'ack');
        localStorage.setItem('zonkey.whatsNewSeen.v1', JSON.stringify({ seenRound: 99, lastSeenDay: '2026-09-07' }));
        localStorage.setItem('zonkey-locale', 'zh-CN');
    }""")
    p.reload(wait_until='domcontentloaded')
    p.wait_for_timeout(800)
    if offline:
        p.route('**/api/**', lambda route: route.abort())
    return p, ctx

def goto_tool(p, center, tool):
    p.locator('main').get_by_role('button', name=center, exact=False).first.click()
    p.wait_for_timeout(500)
    p.evaluate("""(tool) => {
        const btn = [...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === tool);
        if (btn) btn.click();
    }""", tool)
    p.wait_for_timeout(700)

def run_convert(p, fixture_name):
    p.locator('main input[type=file]').set_input_files(str(FIXTURE))
    p.wait_for_timeout(300)
    p.evaluate("""() => {
        const btn = [...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === '开始转换');
        if (btn) btn.click();
    }""")
    p.wait_for_timeout(2500)

with sync_playwright() as pw:
    browser = pw.chromium.launch()

    # A. 离线 PDF→Word：打开可见 → 弹窗内预览 → 无自动下载 → 手动下载 1 次
    downloads = []
    p, ctx = mk_page(browser, {'width': 1360, 'height': 900}, offline=True)
    p.on('download', lambda d: downloads.append(d))
    goto_tool(p, 'PDF 工坊', 'PDF 转 Word')
    note = p.locator('main').get_by_text('本地引擎', exact=False).first.is_visible()
    check('A1 离线黄条出现（浏览器引擎模式）', note)
    run_convert(p, 'r29_fixture.pdf')
    modal = p.locator('[data-testid="task-done-modal"]')
    check('A2 任务弹窗自动弹出', modal.is_visible())
    body = modal.inner_text() if modal.is_visible() else ''
    check('A3 产物为 docx', '.docx' in body, body.replace('\n', ' ')[:80])
    open_btn = modal.get_by_role('button', name='打开', exact=True)
    check('A4 「打开」按钮可见（round-29 回归修复点）', open_btn.is_visible())
    check('A5 转换完成零自动下载（收口到弹窗）', len(downloads) == 0, f'downloads={len(downloads)}')
    if open_btn.is_visible():
        open_btn.click()
        preview = p.locator('[data-testid="artifact-preview-modal"]')
        preview.wait_for(state='visible', timeout=15000)
        p.wait_for_timeout(1500)
        content_ok = False
        try:
            content_ok = p.locator('.zs-doc-preview').inner_text(timeout=5000).find(MARKER) >= 0
        except Exception:
            content_ok = False
        check('A6 弹窗内预览渲染出正文（mammoth）', content_ok)
        check('A7 预览零上传提示存在', preview.get_by_text('零上传', exact=False).is_visible())
        preview.get_by_role('button', name='关闭', exact=True).click()
        p.wait_for_timeout(400)
        check('A8 关闭预览回到任务弹窗', modal.is_visible() and not preview.is_visible())
        modal.get_by_role('button', name='下载', exact=True).click()
        p.wait_for_timeout(2500)
        check('A9 手动「下载」产出 1 个下载', len(downloads) == 1, f'downloads={len(downloads)}')
    ctx.close()

    # B. 离线 PDF→Excel：预览含 sheet 名与表格
    p, ctx = mk_page(browser, {'width': 1360, 'height': 900}, offline=True)
    goto_tool(p, 'PDF 工坊', 'PDF 转 Excel')
    run_convert(p, 'r29_fixture.pdf')
    modal = p.locator('[data-testid="task-done-modal"]')
    open_btn = modal.get_by_role('button', name='打开', exact=True)
    ok_open = open_btn.is_visible()
    check('B1 xlsx「打开」按钮可见', ok_open)
    if ok_open:
        open_btn.click()
        preview = p.locator('[data-testid="artifact-preview-modal"]')
        preview.wait_for(state='visible', timeout=15000)
        p.wait_for_timeout(1500)
        has_table = preview.locator('.zs-doc-preview table').count() > 0
        has_sheet = preview.get_by_text('Page 1', exact=True).is_visible()
        check('B2 弹窗内预览渲染表格（SheetJS）', has_table and has_sheet)
    ctx.close()

    # C. 手机 390×844 离线 PDF→Word 全链路
    p, ctx = mk_page(browser, {'width': 390, 'height': 844}, offline=True)
    goto_tool(p, 'PDF 工坊', 'PDF 转 Word')
    run_convert(p, 'r29_fixture.pdf')
    modal = p.locator('[data-testid="task-done-modal"]')
    ok_modal = modal.is_visible()
    check('C1 手机任务弹窗自动弹出', ok_modal)
    if ok_modal:
        open_btn = modal.get_by_role('button', name='打开', exact=True)
        ok_btn = open_btn.is_visible()
        check('C2 手机「打开」按钮可见', ok_btn)
        if ok_btn:
            open_btn.click()
            preview = p.locator('[data-testid="artifact-preview-modal"]')
            preview.wait_for(state='visible', timeout=15000)
            p.wait_for_timeout(1500)
            check('C3 手机弹窗内预览可见', preview.is_visible())
    ctx.close()

    # D. WhatsNew 第 29 轮
    ctx = browser.new_context(viewport={'width': 1360, 'height': 900})
    p = ctx.new_page()
    p.goto(BASE, wait_until='domcontentloaded')
    p.evaluate("() => localStorage.setItem('zonkey.privacyNotice.v1', 'ack')")
    p.reload(wait_until='domcontentloaded')
    p.wait_for_timeout(1200)
    wn = p.locator('[role="dialog"][aria-label="这次更新了什么"]')
    check('D1 WhatsNew 首启自动弹出', wn.is_visible())
    if wn.is_visible():
        body = wn.inner_text()
        check('D2 第 29 轮条目与直接预览文案', ('第 29 轮' in body) and ('直接预览' in body))
        wn.get_by_role('button', name='知道了', exact=True).click()
        p.wait_for_timeout(500)
        seen = p.evaluate("() => JSON.parse(localStorage.getItem('zonkey.whatsNewSeen.v1') || '{}').seenRound")
        check('D3 知道了后 seenRound=29', seen == 29, f'seenRound={seen}')
    ctx.close()
    browser.close()

real_errors = [e for e in errors if 'favicon' not in e.lower() and 'failed to load resource' not in e.lower()]
check('E0 全程零 pageerror（route-abort 网络噪声除外）', not real_errors, '; '.join(real_errors[:3]))

passed = sum(1 for _, ok in results if ok)
print(f'\n==== r29 preview smoke: {passed}/{len(results)} ====')
sys.exit(0 if passed == len(results) else 1)
