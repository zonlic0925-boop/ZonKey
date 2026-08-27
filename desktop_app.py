"""ZonScale 脱敏工作台 — 桌面入口（Windows / macOS · PyInstaller / 开发模式通用）。"""

from __future__ import annotations

import argparse
import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

PORT = 8765
HOST = "127.0.0.1"
URL = f"http://{HOST}:{PORT}"

if getattr(sys, "frozen", False):
    _ROOT = Path(sys.executable).resolve().parent
else:
    _ROOT = Path(__file__).resolve().parent

if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from core.brand import APP_NAME, APP_TAGLINE, APP_TITLE, WINDOW_TITLE
from core.port_util import free_port


def _log(msg: str) -> None:
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", errors="replace").decode("ascii"))


def _wait_for_server(timeout: float = 30.0) -> bool:
    import urllib.error
    import urllib.request

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(URL, timeout=1.0) as resp:
                if resp.status < 500:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.2)
    return False


def _run_uvicorn(bind_host: str) -> None:
    try:
        import uvicorn
        from server_bridge import app

        # 窗口化 exe 无控制台时 sys.stdout 为 None，uvicorn 默认日志会崩溃
        uvicorn.run(
            app,
            host=bind_host,
            port=PORT,
            log_level="warning",
            log_config=None,
        )
    except Exception:  # noqa: BLE001
        import traceback

        from core.app_paths import get_app_root

        log_path = get_app_root() / "startup_error.log"
        log_path.write_text(traceback.format_exc(), encoding="utf-8")
        raise


def _open_pywebview(title: str) -> None:
    import webview

    webview.create_window(title, URL, width=1440, height=900, min_size=(1024, 720))
    webview.start()


def _open_browser_fallback() -> None:
    time.sleep(1.0)
    if _wait_for_server():
        webbrowser.open(URL)
        _log(f"[OK] 已在浏览器打开: {URL}")
    else:
        _log(f"[!] 服务启动超时，请手动访问: {URL}")


def main() -> None:
    global HOST, URL

    parser = argparse.ArgumentParser(description=APP_TITLE)
    parser.add_argument("--browser", action="store_true", help="使用系统浏览器而非内嵌窗口")
    parser.add_argument("--debug", action="store_true", help="显示 uvicorn 详细日志")
    parser.add_argument(
        "--lan",
        action="store_true",
        help="绑定 0.0.0.0，允许同一 WiFi 下的手机浏览器访问（见控制台局域网地址）",
    )
    args = parser.parse_args()

    from core.app_paths import ensure_runtime_layout, get_dist_web_dir
    from core.network import get_lan_ip, resolve_bind_host

    if args.lan:
        HOST = resolve_bind_host(True)
        URL = f"http://127.0.0.1:{PORT}"
    bind_host = HOST

    ensure_runtime_layout()
    if not get_dist_web_dir().exists():
        _log("[!] dist_web 未找到。请先执行: cd frontend && npm run build")
        if getattr(sys, "frozen", False):
            input("按 Enter 退出...")
        sys.exit(1)

    free_port(PORT, log=_log)

    _log("=" * 60)
    _log(f"[{APP_NAME}] {APP_TAGLINE}")
    _log(f"[*] 本机访问: http://127.0.0.1:{PORT}")
    if args.lan:
        lan_ip = get_lan_ip()
        if lan_ip:
            _log(f"[*] 手机访问: http://{lan_ip}:{PORT}  （需与电脑同一 WiFi）")
        else:
            hint = "ifconfig" if sys.platform == "darwin" else "ipconfig"
            _log(f"[!] 未能检测局域网 IP，请在本机 {hint} 中查看 IPv4 地址")
    else:
        _log(f"[*] 服务地址: {URL}")

    server = threading.Thread(target=_run_uvicorn, args=(bind_host,), daemon=True)
    server.start()

    if not _wait_for_server():
        _log("[!] 本地服务启动失败")
        if getattr(sys, "frozen", False):
            input("按 Enter 退出...")
        sys.exit(1)

    use_browser = args.browser
    if not use_browser:
        try:
            import webview  # noqa: F401

            _log("[*] 正在打开桌面窗口...")
            _open_pywebview(WINDOW_TITLE)
            return
        except ImportError:
            _log("[*] 未安装 pywebview，改用系统浏览器")
            use_browser = True

    if use_browser:
        _open_browser_fallback()
        try:
            server.join()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
