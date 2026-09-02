# -*- mode: python ; coding: utf-8 -*-
"""ZonKey 脱敏工作台 — macOS PyInstaller 配置（React + FastAPI + pywebview → .app）。"""

import os
import sys

sys.setrecursionlimit(sys.getrecursionlimit() * 5)

from PyInstaller.utils.hooks import collect_all, collect_dynamic_libs, collect_submodules

current_dir = os.path.dirname(os.path.abspath(SPEC))
macos_dir = os.path.dirname(current_dir)
packaging_dir = os.path.dirname(macos_dir)
project_root = os.path.dirname(packaging_dir)

block_cipher = None

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

core_hiddenimports = collect_submodules("core")
print(f"[INFO] core submodules: {len(core_hiddenimports)}")

app_datas = [
    (os.path.join(project_root, "dist_web"), "dist_web"),
    (os.path.join(project_root, "rules"), "rules"),
]

dist_web_index = os.path.join(project_root, "dist_web", "index.html")
if not os.path.exists(dist_web_index):
    raise SystemExit(
        "[ERROR] dist_web/index.html missing. Run: cd frontend && npm run build"
    )

a = Analysis(
    [os.path.join(project_root, "desktop_app.py")],
    pathex=[project_root],
    binaries=(
        onnx_binaries
        + rapid_binaries
        + extra_onnx_binaries
        + cv2_binaries
        + numpy_binaries
    ),
    datas=app_datas + onnx_datas + rapid_datas + numpy_datas + numpy_compat_datas,
    hiddenimports=[
        "server_bridge",
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
        "webview.platforms.cocoa",
        "tkinter",
        "tkinter.filedialog",
        "_tkinter",
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
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

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

app = BUNDLE(
    coll,
    name="ZonKey.app",
    icon=os.path.join(macos_dir, "assets", "zonkey.icns"),
    bundle_identifier="com.zonlic.zonkey",
    entitlements_file=os.path.join(macos_dir, "config", "entitlements.plist"),
    info_plist={
        "NSHighResolutionCapable": True,
        "CFBundleDisplayName": "ZonKey",
        "CFBundleName": "ZonKey",
        "CFBundleShortVersionString": "2.0.0",
        "CFBundleVersion": "2.0.0",
        "LSMinimumSystemVersion": "11.0",
    },
)
