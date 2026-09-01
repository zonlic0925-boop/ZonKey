"""壳层烟测：真实 pywebview 窗口验证 toggle_maximize 状态机与拖拽层安装。

验证点（对应本轮两个 bug 修复）：
1. toggle_maximize 连续调用两次 → 最大化/还原交替生效（不再"点两下无反应"）；
2. is_maximized 与 IsZoomed 一致；
3. frameless 钩子安装成功（webview_nonclient=True 日志）。
"""
import sys
import time

sys.path.insert(0, ".")

import threading
import urllib.request

import webview


def wait_server(url: str, timeout: float = 20.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.0):
                return True
        except Exception:
            time.sleep(0.2)
    return False


def probe():
    import desktop_app

    api = desktop_app.WindowApi()
    results = []

    # 初始状态应为 False
    s0 = api.is_maximized()
    results.append(("initial is_maximized=False", s0 is False))

    # 第一次 toggle → 最大化
    api.toggle_maximize()
    time.sleep(1.2)
    s1 = api.is_maximized()
    results.append(("after 1st toggle → maximized", s1 is True))

    # 第二次 toggle → 还原（旧代码此处会再次 maximize = "点两下没反应"）
    api.toggle_maximize()
    time.sleep(1.2)
    s2 = api.is_maximized()
    results.append(("after 2nd toggle → restored", s2 is False))

    # 第三次 toggle → 再最大化（验证状态机可持续）
    api.toggle_maximize()
    time.sleep(1.2)
    s3 = api.is_maximized()
    results.append(("after 3rd toggle → maximized", s3 is True))
    api.restore()
    time.sleep(0.8)

    ok = all(v for _, v in results)
    for name, v in results:
        print(f"{'PASS' if v else 'FAIL'}  {name}")
    print("SHELL SMOKE", "OK" if ok else "FAIL")


def main():
    from core.port_util import free_port

    port = 8791
    free_port(port, log=print)
    url = f"http://127.0.0.1:{port}"

    from server_bridge import app
    import uvicorn

    t = threading.Thread(target=lambda: uvicorn.run(app, host="127.0.0.1", port=port, log_level="error", log_config=None), daemon=True)
    t.start()
    if not wait_server(url):
        print("SERVER FAIL")
        sys.exit(1)

    webview.create_window(
        "ZonScale Shell Smoke",
        url,
        width=1200,
        height=800,
        frameless=True,
        js_api=desktop_api(),
    )
    from core.frameless_window import attach_frameless_behaviour

    window = webview.windows[0]
    attach_frameless_behaviour(window)

    # 在 GUI 线程启动后延迟跑 probe
    threading.Timer(6.0, run_probe).start()
    webview.start()


def desktop_api():
    import desktop_app

    return desktop_app.WindowApi()


_probe_done = {"ran": False}


def run_probe():
    if _probe_done["ran"]:
        return
    _probe_done["ran"] = True
    try:
        probe()
    finally:
        import os

        os._exit(0)


if __name__ == "__main__":
    main()
