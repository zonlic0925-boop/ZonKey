"""无边框窗口的原生行为补齐（Windows 专属；其他平台空操作）。

pywebview 的 frameless 只做了 FormBorderStyle=None：窗口没了系统标题栏，
但边缘缩放、Aero Snap 贴边、双击标题栏最大化、最大化避开任务栏这些
"真正软件"的原生行为也一并消失。本模块分两层补回：

1. 窗体层（SetWindowLongPtr 子类化）：
   - WS_THICKFRAME/WS_CAPTION/WS_MINIMIZEBOX/WS_MAXIMIZEBOX 样式位
     → 系统级缩放、Snap、窗口动画、DWM 圆角与描边；
   - WM_NCCALCSIZE 返回 0 → 客户区铺满整个窗口（无边框观感）；
   - WM_GETMINMAXINFO → 最大化对齐工作区，不遮任务栏；
   - WM_NCACTIVATE → 消除激活切换时的标题栏重绘闪黑。

2. WebView2 层（IsNonClientRegionSupportEnabled=True，Tauri 2 同款）：
   - 前端 CSS `app-region: drag` 的区域由 WebView2 直接转成 HTCAPTION
     → 拖拽、双击最大化、Aero Snap、Snap 布局悬浮卡全部原生；
   - 窗口四边最外侧由 WebView2 返回缩放命中 → 原生边缘缩放光标与行为。
     WebView2 子窗口会盖住窗体层的鼠标消息，所以命中测试必须走这一层；
     窗体层的 WM_NCHITTEST 仅作为兜底。
"""

from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes

# --- Win32 常量 ---------------------------------------------------------------

GWL_STYLE = -16
GWLP_WNDPROC = -4

WS_THICKFRAME = 0x00040000
WS_CAPTION = 0x00C00000
WS_MINIMIZEBOX = 0x00020000
WS_MAXIMIZEBOX = 0x00010000

WM_NCCALCSIZE = 0x0083
WM_NCHITTEST = 0x0084
WM_NCACTIVATE = 0x0086
WM_GETMINMAXINFO = 0x0024

HTCLIENT = 1
HTCAPTION = 2
HTLEFT = 10
HTRIGHT = 11
HTTOP = 12
HTTOPLEFT = 13
HTTOPRIGHT = 14
HTBOTTOM = 15
HTBOTTOMLEFT = 16
HTBOTTOMRIGHT = 17

MONITOR_DEFAULTTONEAREST = 2


class _MONITORINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("rcMonitor", wintypes.RECT),
        ("rcWork", wintypes.RECT),
        ("dwFlags", wintypes.DWORD),
    ]


user32 = ctypes.WinDLL("user32", use_last_error=True)

if hasattr(user32, "GetWindowLongPtrW"):
    _get_long_ptr = user32.GetWindowLongPtrW
    _set_long_ptr = user32.SetWindowLongPtrW
else:  # 32 位 Python 回退
    _get_long_ptr = user32.GetWindowLongW
    _set_long_ptr = user32.SetWindowLongW

# 64 位下必须显式声明 LONG_PTR 原型，否则 ctypes 默认按 32 位 int
# 传参，窗口过程指针会溢出（OverflowError: int too long to convert）。
_LONG_PTR = ctypes.c_ssize_t
_get_long_ptr.restype = _LONG_PTR
_get_long_ptr.argtypes = [wintypes.HWND, ctypes.c_int]
_set_long_ptr.restype = _LONG_PTR
_set_long_ptr.argtypes = [wintypes.HWND, ctypes.c_int, _LONG_PTR]
user32.CallWindowProcW.restype = _LONG_PTR
user32.CallWindowProcW.argtypes = [_LONG_PTR, wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM]
user32.DefWindowProcW.restype = _LONG_PTR
user32.DefWindowProcW.argtypes = [wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM]
user32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_uint]
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
user32.MonitorFromWindow.argtypes = [wintypes.HWND, ctypes.c_uint]
user32.GetMonitorInfoW.argtypes = [wintypes.HMONITOR, ctypes.POINTER(_MONITORINFO)]
user32.GetMonitorInfoW.restype = wintypes.BOOL
if hasattr(user32, "GetDpiForWindow"):
    user32.GetDpiForWindow.argtypes = [wintypes.HWND]
    user32.GetDpiForWindow.restype = ctypes.c_uint

WNDPROC_RET = ctypes.c_ssize_t
_WNDPROC = ctypes.WINFUNCTYPE(WNDPROC_RET, wintypes.HWND, ctypes.c_uint, wintypes.WPARAM, wintypes.LPARAM)

_hooks: dict[int, dict] = {}


class _MINMAXINFO(ctypes.Structure):
    _fields_ = [
        ("ptReserved", wintypes.POINT),
        ("ptMaxSize", wintypes.POINT),
        ("ptMaxPosition", wintypes.POINT),
        ("ptMinTrackSize", wintypes.POINT),
        ("ptMaxTrackSize", wintypes.POINT),
    ]


def _install(hwnd: int) -> None:
    """给指定窗口装上窗体层无边框行为钩子。仅在 Windows 上生效。"""
    if sys.platform != "win32" or hwnd in _hooks:
        return

    # 1) 样式位：ThickFrame 负责缩放/圆角/动画，Caption+Min/MaxBox 负责 Snap 识别
    style = _get_long_ptr(hwnd, GWL_STYLE)
    _set_long_ptr(
        hwnd, GWL_STYLE, style | WS_THICKFRAME | WS_CAPTION | WS_MINIMIZEBOX | WS_MAXIMIZEBOX
    )

    # 2) 子类化窗口过程
    old_proc = _get_long_ptr(hwnd, GWLP_WNDPROC)
    proc = _WNDPROC(_window_proc)
    _set_long_ptr(hwnd, GWLP_WNDPROC, ctypes.cast(proc, ctypes.c_void_p).value)
    _hooks[hwnd] = {"old_proc": old_proc, "proc": proc}

    # 3) 重新计算非客户区，让 WM_NCCALCSIZE 的新语义立即生效
    user32.SetWindowPos(
        hwnd, None, 0, 0, 0, 0,
        0x0001 | 0x0002 | 0x0004 | 0x0020,  # NOSIZE | NOMOVE | NOZORDER | FRAMECHANGED
    )


def _call_old(hwnd: int, msg: int, wp: int, lp: int) -> int:
    return user32.CallWindowProcW(_hooks[hwnd]["old_proc"], hwnd, msg, wp, lp)


def _window_proc(hwnd: int, msg: int, wp: int, lp: int) -> int:
    if msg == WM_NCCALCSIZE and wp:
        # 客户区 = 整个窗口矩形：返回 0 且不动 rgrc
        return 0

    if msg == WM_NCACTIVATE:
        # 默认 DefWindowProc 会重绘标题栏，NCCALCSIZE 已清空非客户区时会闪黑；
        # lParam=-1 禁止重绘（微软文档认可的 frameless 惯用法）
        return user32.DefWindowProcW(hwnd, msg, wp, -1)

    if msg == WM_GETMINMAXINFO:
        # 最大化对齐工作区：不遮任务栏
        mmi = _MINMAXINFO.from_address(lp)
        hwnd_monitor = user32.MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST)
        info = _MONITORINFO()
        info.cbSize = ctypes.sizeof(info)
        if user32.GetMonitorInfoW(hwnd_monitor, ctypes.byref(info)):
            wa, mon = info.rcWork, info.rcMonitor
            mmi.ptMaxPosition.x = wa.left - mon.left
            mmi.ptMaxPosition.y = wa.top - mon.top
            mmi.ptMaxSize.x = wa.right - wa.left
            mmi.ptMaxSize.y = wa.bottom - wa.top
            return 0
        return _call_old(hwnd, msg, wp, lp)

    if msg == WM_NCHITTEST:
        # 兜底：正常情况下命中由 WebView2 非客户区支持处理（子窗口优先），
        # 只有鼠标落在 WebView 未覆盖的客户区时才会走到这里。
        ret = _call_old(hwnd, msg, wp, lp)
        if ret != HTCLIENT:
            return ret
        rect = wintypes.RECT()
        if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            return ret
        x = ctypes.c_short(lp & 0xFFFF).value
        y = ctypes.c_short((lp >> 16) & 0xFFFF).value

        get_dpi = getattr(user32, "GetDpiForWindow", None)
        s = (get_dpi(hwnd) / 96.0) if get_dpi else 1.0
        edge = max(4, round(8 * s))
        corner = max(8, round(16 * s))

        on_left = x - rect.left < edge
        on_right = rect.right - x <= edge
        on_bottom = rect.bottom - y <= edge
        on_top = y - rect.top < edge
        near_l = x - rect.left < corner
        near_r = rect.right - x <= corner
        near_b = rect.bottom - y <= corner

        if on_top and near_l:
            return HTTOPLEFT
        if on_top and near_r:
            return HTTOPRIGHT
        if on_bottom and near_l:
            return HTBOTTOMLEFT
        if on_bottom and near_r:
            return HTBOTTOMRIGHT
        if on_top:
            return HTTOP
        if on_bottom:
            return HTBOTTOM
        if on_left:
            return HTLEFT
        if on_right:
            return HTRIGHT
        return ret

    return _call_old(hwnd, msg, wp, lp)


def _enable_webview_nonclient(native_form) -> bool:
    """打开 WebView2 的非客户区支持（app-region CSS → 原生拖拽/缩放）。

    所有 CLR 对象访问必须经 BeginInvoke 排到 GUI 线程：从 attach 线程直接
    枚举 Controls / 等待 CoreWebView2 会触发 COM 互操作死锁（GUI STA 线程
    卡住 → 整个窗口挂死，实测复现）。
    CoreWebView2 是异步初始化的，不能轮询（轮询 sleep 会阻塞 GUI 消息泵），
    改订阅 CoreWebView2InitializationCompleted 事件，在回调里一次性设置。
    """
    if sys.platform != "win32":
        return False

    import time

    from System import Action

    result = {"ok": False}

    def _on_gui() -> None:
        try:
            for control in native_form.Controls:
                if "WebView2" not in str(type(control)):
                    continue

                def on_init(sender, args) -> None:
                    try:
                        if args.IsSuccess:
                            sender.CoreWebView2.Settings.IsNonClientRegionSupportEnabled = True
                            result["ok"] = True
                    except Exception:  # noqa: BLE001
                        pass

                control.CoreWebView2InitializationCompleted += on_init
                break
        except Exception:  # noqa: BLE001
            pass

    try:
        native_form.BeginInvoke(Action(_on_gui))
    except Exception:  # noqa: BLE001
        return False

    # CoreWebView2 初始化一般 <2s；给 30s 余量
    deadline = time.time() + 30.0
    while time.time() < deadline and not result["ok"]:
        time.sleep(0.1)
    return result["ok"]


def attach_frameless_behaviour(window) -> None:
    """pywebview 窗口创建完成后调用。等待 native 句柄就绪后安装钩子。

    非 Windows 平台是空操作；安装失败只记录日志，不影响应用运行。
    """
    if sys.platform != "win32":
        return

    import logging
    import threading
    import time

    logger = logging.getLogger("zonscale.frameless")

    def _wait_and_install() -> None:
        deadline = time.time() + 30.0
        while time.time() < deadline:
            try:
                native = window.native
                if native is not None:
                    hwnd = int(native.Handle.ToInt64())
                    _install(hwnd)
                    nc_ok = _enable_webview_nonclient(native)
                    logger.info(
                        "frameless behaviour installed (hwnd=%s, webview_nonclient=%s)",
                        hwnd, nc_ok,
                    )
                    return
            except Exception:  # noqa: BLE001
                pass
            time.sleep(0.2)
        logger.warning("frameless behaviour NOT installed: window handle not ready in 30s")

    threading.Thread(target=_wait_and_install, name="zs-frameless", daemon=True).start()
