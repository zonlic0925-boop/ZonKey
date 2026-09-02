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

# 主题闪屏底色联动：前端 ThemeProvider 把主题镜像到 ui_prefs.json（经
# save_ui_prefs api），create_window 前读它——Python 侧读不到 localStorage，
# 文件是唯一桥。键值与 frontend/src/lib/theme/themeCore.ts THEME_SHELL_BG 同表，
# 两处必须同步改。
THEME_SHELL_BG = {
    "cream": "#FFF9F0",
    "paper": "#FAFAF8",
    "slate": "#E2E8F0",
    "dark": "#181826",
}
DEFAULT_SHELL_BG = THEME_SHELL_BG["cream"]


def _load_shell_bg() -> str:
    """读 ui_prefs.json 的主题底色；文件缺失/损坏/键非法一律回退默认。"""
    try:
        from core.app_paths import get_app_root

        prefs_path = get_app_root() / "ui_prefs.json"
        if not prefs_path.is_file():
            return DEFAULT_SHELL_BG
        import json

        theme = json.loads(prefs_path.read_text(encoding="utf-8")).get("theme")
        return THEME_SHELL_BG.get(theme, DEFAULT_SHELL_BG)
    except Exception:  # noqa: BLE001 — 任何偏好文件异常都不能挡启动
        return DEFAULT_SHELL_BG

if getattr(sys, "frozen", False):
    _ROOT = Path(sys.executable).resolve().parent
else:
    _ROOT = Path(__file__).resolve().parent

if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from core.brand import APP_NAME, APP_TAGLINE, APP_TITLE, WINDOW_TITLE
from core.port_util import free_port


def _log(msg: str) -> None:
    # 窗口化 EXE（console=False）里 sys.stdout 为 None（不是坏了，是没有），
    # 任何 print 都会 TypeError； except 只捕 UnicodeEncodeError 挡不住。
    try:
        print(msg)
    except Exception:  # noqa: BLE001 — 日志失败绝不挡启动
        pass


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


def _cleanup_orphan_webview2() -> None:
    """启动前清理父进程已死的孤儿 msedgewebview2（round-10）。

    前一次宿主崩溃/强杀后，WebView2 子进程可能存活并持有用户数据目录的
    Singleton Lock——新实例开窗即白屏，且表现为「崩溃后无法再打开软件」。
    清理策略：只杀父进程已不存在的孤儿 msedgewebview2（PPID 不在存活进程
    表中），不碰任何有活父进程的 WebView2（其他应用/浏览器的）。非 Windows 无操作。
    """
    if sys.platform != "win32":
        return
    try:
        import subprocess

        ps = (
            "Get-CimInstance Win32_Process -Filter \"Name='msedgewebview2.exe'\" | "
            "Select-Object ProcessId,ParentProcessId | ConvertTo-Csv -NoTypeInformation"
        )
        out = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command", ps],
            text=True,
            errors="ignore",
            timeout=20,
        )
        alive = subprocess.check_output(
            ["powershell", "-NoProfile", "-Command",
             "(Get-CimInstance Win32_Process).ProcessId"],
            text=True,
            errors="ignore",
            timeout=20,
        )
    except Exception:  # noqa: BLE001 — 清理失败绝不能挡启动
        return

    alive_set = set()
    for tok in alive.splitlines():
        tok = tok.strip()
        if tok.isdigit():
            alive_set.add(int(tok))

    orphans = []
    rows = out.splitlines()[1:]  # 跳过 CSV 头
    for row in rows:
        cols = [c.strip().strip('"') for c in row.split(",")]
        if len(cols) < 2 or not cols[0].isdigit() or not cols[1].isdigit():
            continue
        pid, ppid = int(cols[0]), int(cols[1])
        # 当前进程（尚未启动任何 WebView2）不会出现在名单里，防御性排除自身
        if pid == os.getpid() or ppid == os.getpid():
            continue
        if ppid not in alive_set:
            orphans.append(str(pid))

    if orphans:
        _log(f"[*] 清理上次崩溃残留的 WebView2 进程: {', '.join(orphans)}")
        try:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID"] + orphans,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=30,
            )
        except Exception:  # noqa: BLE001
            pass
        time.sleep(0.8)


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

    from core.frameless_window import attach_frameless_behaviour

    # 工坊类工具（PDF/PPT/图像/音视频等）的产物走浏览器下载（blob → 另存为）。
    # pywebview 默认 ALLOW_DOWNLOADS=False 会在 WebView2 里静默取消全部下载，
    # 必须显式放开；放开后 WebView2 弹原生"另存为"对话框，不覆盖原始文件。
    webview.settings['ALLOW_DOWNLOADS'] = True

    # WebView2 用户数据目录（round-10）：pywebview 默认把所有应用共用
    # %APPDATA%/pywebview 作 UDF，宿主崩溃后残留的 msedgewebview2 持有该
    # 目录的 Singleton Lock——新实例撞锁开窗即白屏，且与其他 pywebview
    # 应用互相干扰。改用 ZonScale 专属目录（webview.start 的 storage_path，
    # 注意 settings 表里没有这个键），配合 _cleanup_orphan_webview2 启动清理。
    storage_path = str(
        Path(os.environ.get('APPDATA', str(Path.home()))) / 'ZonScale' / 'webview_data'
    )

    # 无边框窗口：去掉系统标题栏，由前端自绘窗口控制；拖拽/缩放/Snap
    # 由 core/frameless_window.py 的 Win32 钩子补回（仅 Windows）。
    # 窗口/任务栏图标由 PyInstaller 打包时写入 EXE；pywebview 的 create_window 不支持 icon 参数
    #
    # easy_drag 必须关（round-6 拖动劫持真根因）：pywebview 6.x 在
    # frameless+edgechromium 下默认 easy_drag=True，向页面注入 window 级
    # mousedown 拖窗器（webview/js/customize.js），画布上按下拖动任意位置
    # 都被转成 pywebviewMoveWindow 移动窗口——完全绕过 WebView2 的
    # app-region 命中与前端 data-canvas-gesture 手势标记，CSS 层修复三轮
    # 无效即因此。关掉后窗口拖动只剩 Header 品牌行 app-region: drag 一条
    # 正路（WebView2 非客户区支持），与正常软件「只有标题栏能拖」一致。
    window = webview.create_window(
        title,
        URL,
        width=1440,
        height=900,
        min_size=(1024, 720),
        frameless=True,
        easy_drag=False,
        js_api=WindowApi(),
        background_color=_load_shell_bg(),
    )
    attach_frameless_behaviour(window)
    # 注意：storage_path 只能经 webview.start() 传入（settings 表无此键）
    webview.start(storage_path=storage_path)


class WindowApi:
    """暴露给前端 window.pywebview.api 的窗口控制（frameless 标题栏按钮）。"""

    def _window(self):
        import webview

        return webview.windows[0] if webview.windows else None

    def minimize(self) -> None:
        win = self._window()
        if win:
            win.minimize()

    def toggle_maximize(self) -> None:
        """按窗口真实状态切换最大化/还原（自给自足，不依赖前端同步状态）。

        前端按「轮询缓存的二态」决定调 toggle_maximize 还是 restore 时，
        缓存滞后会让第一次点击落到错误分支（已最大化却再 maximize，
        观感即"要点两下"）。本方法用 Win32 IsZoomed 读实时状态，
        前端无论传什么参数都得到正确结果。
        """
        win = self._window()
        if not win:
            return
        if self.is_maximized():
            win.restore()
        else:
            win.maximize()

    def is_maximized(self) -> bool:
        """供前端同步最大化状态（窗口事件不透传到 JS，按钮态轮询此接口）。"""
        win = self._window()
        native = getattr(win, "native", None) if win else None
        if native is None:
            return False
        try:
            # WinForms.FormWindowState.Maximized == 2
            return int(native.WindowState) == 2
        except Exception:  # noqa: BLE001
            return False

    def maximize(self) -> None:
        win = self._window()
        if win:
            win.maximize()

    def restore(self) -> None:
        win = self._window()
        if win:
            win.restore()

    def close(self) -> None:
        win = self._window()
        if win:
            win.destroy()

    def save_ui_prefs(self, prefs: dict) -> None:
        """前端 ThemeProvider 镜像主题偏好到文件（下次启动闪屏底色联动）。

        写盘失败静默吞掉：这只影响下次启动闪屏颜色，不值得打断用户。
        """
        try:
            import json

            from core.app_paths import get_app_root

            data = {
                "theme": str(prefs.get("theme", "cream")),
                "texture": str(prefs.get("texture", "fluid")),
                "font_size": str(prefs.get("font_size", "md")),
            }
            (get_app_root() / "ui_prefs.json").write_text(json.dumps(data), encoding="utf-8")
        except Exception:  # noqa: BLE001
            pass


def _open_browser_fallback() -> None:
    time.sleep(1.0)
    if _wait_for_server():
        webbrowser.open(URL)
        _log(f"[OK] 已在浏览器打开: {URL}")
    else:
        _log(f"[!] 服务启动超时，请手动访问: {URL}")


def _die(msg: str) -> None:
    """失败退出：窗口化 EXE 无 stdin，input() 会 RuntimeError；至少留痕。"""
    _log(f"[!] {msg}")
    if getattr(sys, "frozen", False) and sys.stdin is not None:
        try:
            input("按 Enter 退出...")
        except Exception:  # noqa: BLE001
            pass
    sys.exit(1)


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
        _die("dist_web 未找到。请先执行: cd frontend && npm run build")

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
        _die("本地服务启动失败")

    use_browser = args.browser
    if not use_browser:
        try:
            import webview  # noqa: F401
        except ImportError:
            _log("[*] 未安装 pywebview，改用系统浏览器")
            use_browser = True

    if not use_browser:
        # 上次崩溃可能残留孤儿 WebView2（持有 UDF 锁 → 新实例白屏），先清。
        # 必须在 import webview / 建窗前执行。
        _cleanup_orphan_webview2()

        # pywebview 打开失败（WebView2 运行时缺失、GPU 进程崩溃等）时
        # webview.start() 可能直接抛异常——兜底退回浏览器，不让进程白死
        # （用户视角即「双击后窗口一闪而过/永远白屏」）。
        try:
            _log("[*] 正在打开桌面窗口...")
            _open_pywebview(WINDOW_TITLE)
            return
        except Exception:  # noqa: BLE001
            import traceback

            traceback.print_exc()
            _log("[!] 桌面窗口打开失败，改用系统浏览器兜底")

    _open_browser_fallback()
    try:
        server.join()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
