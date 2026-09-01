"""壳层烟测 v2：结果落盘（GUI 事件循环吞 stdout），GUI 线程内跑状态机探针。"""
import sys
import time

sys.path.insert(0, ".")

OUT = "temp_ui_test/shell_smoke_result.txt"


def wait_server(url: str, timeout: float = 20.0) -> bool:
    import urllib.request

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.0):
                return True
        except Exception:
            time.sleep(0.2)
    return False


def probe(api):
    import webview

    results = []
    win = webview.windows[0]

    s0 = api.is_maximized()
    results.append(("initial is_maximized=False", s0 is False))

    api.toggle_maximize()
    time.sleep(1.5)
    s1 = api.is_maximized()
    results.append(("after 1st toggle -> maximized", s1 is True))

    api.toggle_maximize()
    time.sleep(1.5)
    s2 = api.is_maximized()
    results.append(("after 2nd toggle -> restored", s2 is False))

    api.toggle_maximize()
    time.sleep(1.5)
    s3 = api.is_maximized()
    results.append(("after 3rd toggle -> maximized", s3 is True))
    api.restore()

    # 拖拽层检查：前端 WindowDragStrip 只覆盖 Header 行（evaluate_js 需要页面加载好）
    time.sleep(2.0)
    try:
        drag_info = win.evaluate_js(
            "(() => {"
            "const drags=[...document.querySelectorAll('div')].filter(d=>(d.getAttribute('style')||'').includes('app-region: drag'));"
            "const b=drags.map(d=>{const r=d.getBoundingClientRect();return [r.top,r.bottom,r.width];});"
            "const ctrl=document.querySelector('.zs-win-ctrl');"
            "const cb=ctrl?ctrl.getBoundingClientRect():null;"
            "return JSON.stringify({dragCount:drags.length,rects:b,ctrlVisible:cb?cb.width>0:false});"
            "})()"
        )
        results.append(("frontend drag strips + window ctrl", drag_info is not None and "dragCount" in str(drag_info)))
    except Exception as e:  # noqa: BLE001
        results.append((f"frontend drag strips (err {e})", False))

    ok = all(v for _, v in results)
    with open(OUT, "w", encoding="utf-8") as f:
        for name, v in results:
            f.write(f"{'PASS' if v else 'FAIL'}  {name}\n")
        f.write(f"drag_detail={drag_info}\n")
        f.write(f"SHELL SMOKE {'OK' if ok else 'FAIL'}\n")


def main():
    from core.port_util import free_port

    port = 8792
    free_port(port, log=lambda m: None)
    url = f"http://127.0.0.1:{port}"

    from server_bridge import app
    import uvicorn
    import webview

    import threading

    t = threading.Thread(target=lambda: uvicorn.run(app, host="127.0.0.1", port=port, log_level="error", log_config=None), daemon=True)
    t.start()
    if not wait_server(url):
        with open(OUT, "w", encoding="utf-8") as f:
            f.write("SERVER FAIL\n")
        sys.exit(1)

    import desktop_app

    api = desktop_app.WindowApi()

    webview.create_window("ZonScale Shell Smoke", url, width=1200, height=800, frameless=True)
    from core.frameless_window import attach_frameless_behaviour

    attach_frameless_behaviour(webview.windows[0])

    def late():
        time.sleep(8.0)
        try:
            probe(api)
        except Exception as e:  # noqa: BLE001
            with open(OUT, "w", encoding="utf-8") as f:
                f.write(f"PROBE ERR {e}\n")
        import os

        os._exit(0)

    threading.Thread(target=late, daemon=True).start()
    webview.start()


if __name__ == "__main__":
    main()
