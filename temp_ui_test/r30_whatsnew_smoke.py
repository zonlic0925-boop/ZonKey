# -*- coding: utf-8 -*-
"""Round-30 What's New 弹窗冒烟（Playwright Python · 静态服务 dist_web 8099）：

口径（2026-09-07 用户反馈重做）：弹窗不再写「打开/直接预览」（首版即有），改为
「自首版发布（v1.0）以来的更新总览」单条目 r30（i1–i4：10 款小工具/批处理/
任务完成弹窗/手机网页版同步），旧轮条目 r26-r29 已从 i18n 删除。

r30 起触发语义调整：取消「同天看过上一轮不再弹」的抑制（会吞同日多轮发布的新
内容），规则改为 seenRound < WHATSNEW_ROUND 一律弹一次。

A. zh-CN 全新：首启隐私 → 更新弹窗接续；标题「更新内容」+ 徽标「自首版发布以来」
   + 4 条清单；仅 1 个 section；旧口径零残留（第 29 轮/直接预览/零上传/本次更新）；
   知道了 → seenRound=30 → 刷新不再弹。
B. seenRound=29 + lastSeenDay=今天（本轮真实场景：今早看过 r29 的用户）：仍弹 r30。
C. seenRound=30 → 不弹。
D. zh-TW 全新：标题「更新內容」+ 徽标「自首版發布以來」+ 条目本地化。
E. en 全新："What's New" + 'Since the first release' + 条目本地化。
F. 手机 390×844 zh-CN：弹窗不超视口、零横向溢出；全程零 pageerror。
"""
import http.server
import os
import socketserver
import subprocess
import threading
import time
from datetime import date

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.normpath(os.path.join(ROOT, '..', 'dist_web'))
PORT = 8099
BASE = f'http://127.0.0.1:{PORT}'
KEY = 'zonkey.whatsNewSeen.v1'

results = []
t0 = time.time()


def log(name, ok, detail=''):
    results.append((name, ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {name} {detail} (+{time.time()-t0:.1f}s)")


def click(el):
    el.evaluate("(e) => e.dispatchEvent(new MouseEvent('click', {bubbles: true}))")


def privacy_confirm(page):
    btn = page.locator(
        'button:has-text("我已了解"):visible, button:has-text("我已瞭解"):visible, button:has-text("feel safe"):visible'
    ).first
    if btn.count():
        click(btn)
        page.wait_for_timeout(400)


def shown(page, text, timeout=2500):
    return page.get_by_text(text).first.is_visible(timeout=timeout)


def run_case(browser, name, fn, viewport=(1440, 900), seed=None):
    ctx = browser.new_context(viewport={'width': viewport[0], 'height': viewport[1]})
    if seed:
        ctx.add_init_script(seed)
    page = ctx.new_page()
    errs = []
    page.on('pageerror', lambda e: errs.append('PAGEERROR: ' + str(e)))
    ok = True
    detail = ''
    try:
        page.goto(BASE, wait_until='networkidle')
        page.wait_for_timeout(700)
        fn(page)
        if errs:
            ok = False
            detail = '; '.join(errs[:3])
    except Exception as e:  # noqa: BLE001
        ok = False
        detail = f'{type(e).__name__}: {e}'
    finally:
        ctx.close()
    log(name, ok, detail)


def main():
    # 静态服务 dist_web
    handler = lambda *a, **kw: http.server.SimpleHTTPRequestHandler(*a, directory=DIST, **kw)
    srv = socketserver.TCPServer(('127.0.0.1', PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    time.sleep(1)

    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        def case_a(page):
            privacy_confirm(page)
            assert shown(page, '更新内容'), '标题未出现'
            assert shown(page, '自首版发布以来'), '徽标未出现'
            assert shown(page, '从首版发布（v1.0）到现在'), 'desc 未出现'
            assert shown(page, '二维码生成/识别、证件照换底色与裁剪'), 'i1 未出现'
            assert shown(page, 'PDF / 图像 / PPT 批处理'), 'i3 未出现'
            assert shown(page, '「任务完成」弹窗'), 'i4 未出现'
            assert shown(page, '手机网页版同步'), 'i2 未出现'
            sections = page.locator('section[aria-label]')
            assert sections.count() == 1, f'section 数={sections.count()}，应为 1（只渲染 r30）'
            dlg = page.locator('[role=dialog]')
            txt = dlg.inner_text()
            for bad in ('第 29 轮', '直接预览', '零上传', '本次更新 · v2.2.0', '本机渲染'):
                assert bad not in txt, f'旧口径残留: {bad}'
            click(page.locator('button:has-text("知道了")').first)
            page.wait_for_timeout(300)
            seen = page.evaluate(f'JSON.parse(localStorage.getItem("{KEY}"))')
            assert seen['seenRound'] == 30, f'seenRound={seen.get("seenRound")}'
            page.reload(wait_until='networkidle')
            page.wait_for_timeout(600)
            assert not page.locator('[role=dialog]').count(), '确认后仍弹出'

        def case_b(page):
            # 本轮真实场景：今早看过 r29 的用户（同天低轮）→ 升 r30 必须再弹一次
            privacy_confirm(page)
            assert shown(page, '自首版发布以来'), '低轮同天用户未看到 r30'
            assert shown(page, '二维码生成/识别、证件照换底色与裁剪'), '条目缺失'

        def case_c(page):
            page.wait_for_timeout(1200)
            assert not page.locator('[role=dialog]').count(), 'seenRound=30 仍弹出'

        def case_d(page):
            privacy_confirm(page)
            assert shown(page, '更新內容'), 'zh-TW 标题未出现'
            assert shown(page, '自首版發布以來'), 'zh-TW 徽标未出现'
            assert shown(page, 'QR Code 產生/辨識'), 'zh-TW 条目未本地化'

        def case_e(page):
            privacy_confirm(page)
            assert shown(page, "What's New"), 'en 标题未出现'
            assert shown(page, 'Since the first release'), 'en 徽标未出现'
            assert shown(page, '10 handy tools added'), 'en 条目未本地化'

        def case_f(page):
            privacy_confirm(page)
            dlg = page.locator('[role=dialog]')
            assert dlg.count(), '手机端弹窗未出现'
            box = dlg.bounding_box()
            assert box['x'] >= 0 and box['x'] + box['width'] <= 391, f'弹窗超视口 {box}'
            scroll = page.evaluate('document.documentElement.scrollWidth')
            assert scroll <= 391, f'横向溢出 scrollWidth={scroll}'

        today = date.today().isoformat()
        seed_today_r29 = (f"localStorage.setItem('{KEY}', JSON.stringify({{seenRound:29,lastSeenDay:'{today}'}}));"
                          "localStorage.setItem('zonkey.privacyNotice.v1','ack');")
        seed_r30 = (f"localStorage.setItem('{KEY}', JSON.stringify({{seenRound:30,lastSeenDay:'{today}'}}));"
                    "localStorage.setItem('zonkey.privacyNotice.v1','ack');")

        run_case(browser, 'A zh-CN 全新首启总览+旧口径零残留+落盘30+刷新不弹', case_a)
        run_case(browser, 'B seenRound=29 且今天看过 → 仍弹 r30', case_b, seed=seed_today_r29)
        run_case(browser, 'C seenRound=30 → 不弹', case_c, seed=seed_r30)
        run_case(browser, 'D zh-TW 本地化', case_d, seed="localStorage.setItem('zonkey-locale','zh-TW');")
        run_case(browser, 'E en 本地化', case_e, seed="localStorage.setItem('zonkey-locale','en');")
        run_case(browser, 'F 手机 390px 弹窗不超视口零溢出', case_f,
                 viewport=(390, 844))
        browser.close()

    srv.shutdown()
    passed = sum(1 for _, ok in results if ok)
    print(f'RESULT {passed}/{len(results)}')
    if passed != len(results):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
