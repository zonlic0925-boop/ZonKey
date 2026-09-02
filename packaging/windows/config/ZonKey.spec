# -*- mode: python ; coding: utf-8 -*-
"""ZonKey 脱敏工作台 — Windows PyInstaller 配置（React + FastAPI + pywebview）。"""

import glob
import os
import site
import sys

sys.setrecursionlimit(sys.getrecursionlimit() * 5)

from PyInstaller.utils.hooks import collect_all, collect_dynamic_libs, collect_submodules

current_dir = os.path.dirname(os.path.abspath(SPEC))
windows_dir = os.path.dirname(current_dir)
packaging_dir = os.path.dirname(windows_dir)
project_root = os.path.dirname(packaging_dir)
icon_path = os.path.join(windows_dir, "assets", "zonkey.ico")
icon_png_path = os.path.join(windows_dir, "assets", "zonkey.png")
resolved_icon = icon_path if os.path.exists(icon_path) else (icon_png_path if os.path.exists(icon_png_path) else None)
if resolved_icon:
    print(f"[INFO] Application icon: {resolved_icon}")
else:
    print("[WARN] zonkey.ico / zonkey.png not found — run scripts/generate_zonkey_icon.py")

block_cipher = None

# --- 重型依赖：OCR / 图像 ---
onnx_datas, onnx_binaries, onnx_hiddenimports = collect_all("onnxruntime")
rapid_datas, rapid_binaries, rapid_hiddenimports = collect_all("rapidocr_onnxruntime")
numpy_datas, numpy_binaries, numpy_hiddenimports = collect_all("numpy")
cv2_binaries = collect_dynamic_libs("cv2")

extra_onnx_binaries = collect_dynamic_libs("onnxruntime")

numpy_compat_datas = []
try:
    import numpy as _numpy

    numpy_path = os.path.dirname(_numpy.__file__)
    for rel_name in ("core", "_core"):
        compat_path = os.path.join(numpy_path, rel_name)
        if os.path.exists(compat_path):
            numpy_compat_datas.append((compat_path, f"numpy/{rel_name}"))
except Exception as exc:
    print(f"[WARN] numpy compat dirs: {exc}")

# --- VC++ 运行时（onnxruntime 1.28+ 需要 vcruntime140_1.dll）---
vcrt_binaries = []
vc_dlls = [
    "vcruntime140.dll",
    "vcruntime140_1.dll",
    "msvcp140.dll",
    "msvcp140_1.dll",
    "msvcp140_2.dll",
]
system32_path = os.path.join(os.environ.get("SYSTEMROOT", "C:\\Windows"), "System32")
for dll_name in vc_dlls:
    dll_path = os.path.join(system32_path, dll_name)
    if os.path.exists(dll_path):
        vcrt_binaries.append((dll_path, "."))

python_base = os.path.dirname(sys.executable)
for dll_name in vc_dlls:
    for sub in ("DLLs", os.path.join("Library", "bin")):
        dll_path = os.path.join(python_base, sub, dll_name)
        if os.path.exists(dll_path):
            vcrt_binaries.append((dll_path, "."))

# --- 项目 core 包 ---
core_hiddenimports = collect_submodules("core")
print(f"[INFO] core submodules: {len(core_hiddenimports)}")

# --- 前端静态资源 & 默认词表 ---
app_datas = [
    (os.path.join(project_root, "dist_web"), "dist_web"),
    (os.path.join(project_root, "rules"), "rules"),
]
if resolved_icon and os.path.exists(resolved_icon):
    app_datas.append((resolved_icon, "assets"))

dist_web_index = os.path.join(project_root, "dist_web", "index.html")
if not os.path.exists(dist_web_index):
    raise SystemExit(
        "[ERROR] dist_web/index.html 不存在。请先执行: cd frontend && npm run build"
    )

a = Analysis(
    [os.path.join(project_root, "desktop_app.py")],
    pathex=[project_root],
    binaries=(
        onnx_binaries
        + rapid_binaries
        + extra_onnx_binaries
        + vcrt_binaries
        + cv2_binaries
        + numpy_binaries
    ),
    datas=app_datas + onnx_datas + rapid_datas + numpy_datas + numpy_compat_datas,
    hiddenimports=[
        "server_bridge",
        "backend_system_tools",
        "uvicorn",
        "uvicorn.logging",
        "uvicorn.loops",
        "uvicorn.loops.auto",
        "uvicorn.protocols",
        "uvicorn.protocols.http",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.lifespan",
        "uvicorn.lifespan.on",
        "fastapi",
        "starlette",
        "starlette.routing",
        "pydantic",
        "multipart",
        "cv2",
        "fitz",
        "numpy",
        "numpy._core._multiarray_umath",
        "PIL",
        "PIL._imaging",
        "docx",
        "rapidocr_onnxruntime",
        "onnxruntime",
        "onnxruntime.capi",
        "onnxruntime.capi.onnxruntime_pybind11_state",
        "webview",
        "clr_loader",
    ]
    + onnx_hiddenimports
    + rapid_hiddenimports
    + numpy_hiddenimports
    + core_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "matplotlib",
        "pandas",
        "scipy",
        "IPython",
        "jupyter",
        "notebook",
        "tkinter",
        "PyQt5",
        "PyQt6",
        "PySide2",
        "PySide6",
        "torch",
        "torchvision",
        "torchaudio",
        "ultralytics",
        "transformers",
        "sklearn",
        "tensorflow",
        "keras",
        "boto3",
        "botocore",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# 强制刷新 EXE 图标（避免 PyInstaller 缓存旧的无图标 bootloader 产物）
_exe_build = os.path.join(project_root, "build", "ZonKey", "ZonKey.exe")
if os.path.exists(_exe_build):
    try:
        os.remove(_exe_build)
    except OSError:
        pass

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="ZonKey",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=resolved_icon,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="ZonKey",
)
