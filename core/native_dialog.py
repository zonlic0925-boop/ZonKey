"""原生文件夹 / 另存为对话框（Windows ctypes · macOS tkinter · PyInstaller + pywebview 后台线程）。"""

from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes
from pathlib import Path


def pick_folder(initial_dir: str | None = None) -> str | None:
    if sys.platform == "win32":
        return _pick_folder_win(initial_dir)
    if sys.platform == "darwin":
        return _pick_folder_tk(initial_dir)
    return None


def pick_save_path(
    default_name: str,
    initial_dir: str | None = None,
    filetypes: list[tuple[str, str]] | None = None,
) -> str | None:
    if sys.platform == "win32":
        ext = Path(default_name).suffix.lower()
        if filetypes is None:
            if ext == ".zip":
                filetypes = [("ZIP 压缩包", "*.zip"), ("所有文件", "*.*")]
            elif ext in {".docx", ".doc"}:
                filetypes = [("Word 文档", "*.docx"), ("所有文件", "*.*")]
            elif ext in {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".jpe", ".jfif", ".pjp", ".pjpeg"}:
                filetypes = [("图片", f"*{ext}"), ("所有文件", "*.*")]
            elif ext == ".pdf":
                filetypes = [("PDF 文档", "*.pdf"), ("所有文件", "*.*")]
            else:
                filetypes = [("所有文件", "*.*")]
        return _pick_save_path_win(default_name, initial_dir, filetypes)
    if sys.platform == "darwin":
        return _pick_save_path_tk(default_name, initial_dir, filetypes)
    return None


def _pick_folder_tk(initial_dir: str | None) -> str | None:
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    try:
        root.attributes("-topmost", True)
    except tk.TclError:
        pass
    root.update()
    kwargs: dict = {}
    if initial_dir:
        p = Path(initial_dir)
        if p.is_dir():
            kwargs["initialdir"] = str(p.resolve())
    selected = filedialog.askdirectory(title="选择导出目录", **kwargs)
    root.destroy()
    return selected.strip() if selected else None


def _pick_save_path_tk(
    default_name: str,
    initial_dir: str | None,
    filetypes: list[tuple[str, str]] | None,
) -> str | None:
    import tkinter as tk
    from tkinter import filedialog

    ext = Path(default_name).suffix.lower()
    if filetypes is None:
        if ext == ".zip":
            filetypes = [("ZIP 压缩包", "*.zip"), ("所有文件", "*.*")]
        elif ext in {".docx", ".doc"}:
            filetypes = [("Word 文档", "*.docx"), ("所有文件", "*.*")]
        else:
            filetypes = [("PDF 文档", "*.pdf"), ("所有文件", "*.*")]

    root = tk.Tk()
    root.withdraw()
    try:
        root.attributes("-topmost", True)
    except tk.TclError:
        pass
    root.update()
    kwargs: dict = {
        "title": "导出文件另存为",
        "initialfile": default_name,
        "defaultextension": ext or ".pdf",
        "filetypes": filetypes,
    }
    if initial_dir:
        p = Path(initial_dir)
        if p.is_dir():
            kwargs["initialdir"] = str(p.resolve())
    selected = filedialog.asksaveasfilename(**kwargs)
    root.destroy()
    return selected.strip() if selected else None


def _pick_folder_win(initial_dir: str | None) -> str | None:
    ole32 = ctypes.OleDLL("ole32")
    shell32 = ctypes.WinDLL("shell32")
    user32 = ctypes.WinDLL("user32")
    ole32.CoInitialize(None)
    callback_ref = None
    try:
        initial_path_str: str | None = None
        if initial_dir:
            p = Path(initial_dir)
            if p.is_dir():
                initial_path_str = str(p.resolve())

        BFFM_INITIALIZED = 1
        BFFM_SETSELECTIONW = 0x0400 + 103

        display_name = ctypes.create_unicode_buffer(260)
        bi = _BROWSEINFOW()
        bi.hwndOwner = user32.GetForegroundWindow()
        bi.lpszTitle = "选择导出目录"
        bi.pszDisplayName = ctypes.cast(display_name, wintypes.LPWSTR)
        bi.ulFlags = 0x00000001 | 0x00000040  # BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE

        if initial_path_str:
            def _browse_callback(hwnd, msg, _lp, _data):
                if msg == BFFM_INITIALIZED:
                    user32.SendMessageW(hwnd, BFFM_SETSELECTIONW, 1, initial_path_str)
                return 0

            callback_ref = ctypes.WINFUNCTYPE(
                ctypes.c_int, wintypes.HWND, wintypes.UINT, wintypes.LPARAM, wintypes.LPARAM
            )(_browse_callback)
            bi.lpfn = ctypes.cast(callback_ref, ctypes.c_void_p)

        pidl = shell32.SHBrowseForFolderW(ctypes.byref(bi))
        if not pidl:
            return None

        path_buf = ctypes.create_unicode_buffer(260)
        if not shell32.SHGetPathFromIDListW(pidl, path_buf):
            ole32.CoTaskMemFree(pidl)
            return None
        ole32.CoTaskMemFree(pidl)
        selected = path_buf.value.strip()
        return selected or None
    finally:
        ole32.CoUninitialize()
        callback_ref = None


def _pick_save_path_win(
    default_name: str,
    initial_dir: str | None = None,
    filetypes: list[tuple[str, str]] | None = None,
) -> str | None:
    ole32 = ctypes.OleDLL("ole32")
    user32 = ctypes.WinDLL("user32")
    comdlg32 = ctypes.WinDLL("comdlg32")
    # Explorer 风格保存对话框依赖 shell COM：uvicorn 工作线程未初始化 COM 时
    # GetSaveFileNameW 会「静默失败」——不建窗口、不报错、直接返回 NULL
    # （round-16 实测：壳内裁剪/图片工具的另存对话框从未弹出即此根因，
    # output/ 里 save-blob 产物齐全而用户拿不到文件）。与 _pick_folder_win 同口径。
    ole32.CoInitialize(None)
    filter_str = "\0".join(f"{label}\0{pattern}" for label, pattern in filetypes) + "\0\0"
    file_buf = ctypes.create_unicode_buffer(260)
    file_buf.value = default_name

    ofn = _OPENFILENAMEW()
    ofn.lStructSize = ctypes.sizeof(_OPENFILENAMEW)
    ofn.lpstrFilter = filter_str
    # lpstrFile 字段声明为 LPWSTR（c_wchar_p），直接赋 c_wchar_Array_260 会
    # TypeError——即壳内另存对话框「从未弹出」的第一现场（round-16 实测：
    # 端点 500、前端把异常吞成误导性错误文案）。GetSaveFileNameW 会把用户
    # 最终选择的路径写回该缓冲区，cast 后同内存读写均可。
    ofn.lpstrFile = ctypes.cast(file_buf, wintypes.LPWSTR)
    ofn.nMaxFile = 260
    ofn.lpstrTitle = "导出文件另存为"
    ofn.Flags = 0x00000002 | 0x00000800 | 0x00000008 | 0x00080000 | 0x00000004
    # OFN_OVERWRITEPROMPT | OFN_PATHMUSTEXIST | OFN_EXPLORER | OFN_ENABLESIZING | OFN_HIDEREADONLY

    ext = Path(default_name).suffix.lstrip(".") or "pdf"
    ofn.lpstrDefExt = ext

    if initial_dir:
        p = Path(initial_dir)
        if p.is_dir():
            ofn.lpstrInitialDir = str(p.resolve())

    # owner 挂前台主窗口：无 owner 的对话框由后台线程创建，可能不抢前台
    # （被 pywebview 无边框窗口盖住 = 用户视角「点了下载没反应」）
    ofn.hwndOwner = user32.GetForegroundWindow()
    try:
        if not comdlg32.GetSaveFileNameW(ctypes.byref(ofn)):
            return None
        return file_buf.value.strip() or None
    finally:
        ole32.CoUninitialize()


class _BROWSEINFOW(ctypes.Structure):
    _fields_ = [
        ("hwndOwner", wintypes.HWND),
        ("pidlRoot", ctypes.c_void_p),
        ("pszDisplayName", wintypes.LPWSTR),
        ("lpszTitle", wintypes.LPCWSTR),
        ("ulFlags", ctypes.c_uint),
        ("lpfn", ctypes.c_void_p),
        ("lParam", wintypes.LPARAM),
        ("iImage", ctypes.c_int),
    ]


class _OPENFILENAMEW(ctypes.Structure):
    _fields_ = [
        ("lStructSize", wintypes.DWORD),
        ("hwndOwner", wintypes.HWND),
        ("hInstance", wintypes.HINSTANCE),
        ("lpstrFilter", wintypes.LPCWSTR),
        ("lpstrCustomFilter", wintypes.LPWSTR),
        ("nMaxCustFilter", wintypes.DWORD),
        ("nFilterIndex", wintypes.DWORD),
        ("lpstrFile", wintypes.LPWSTR),
        ("nMaxFile", wintypes.DWORD),
        ("lpstrFileTitle", wintypes.LPWSTR),
        ("nMaxFileTitle", wintypes.DWORD),
        ("lpstrInitialDir", wintypes.LPCWSTR),
        ("lpstrTitle", wintypes.LPCWSTR),
        ("Flags", wintypes.DWORD),
        ("nFileOffset", wintypes.WORD),
        ("nFileExtension", wintypes.WORD),
        ("lpstrDefExt", wintypes.LPCWSTR),
        ("lCustData", wintypes.LPARAM),
        ("lpfnHook", wintypes.LPVOID),
        ("lpTemplateName", wintypes.LPCWSTR),
        ("pvReserved", wintypes.LPVOID),
        ("dwReserved", wintypes.DWORD),
        ("FlagsEx", wintypes.DWORD),
    ]
