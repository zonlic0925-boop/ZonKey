"""应用路径解析：开发模式 vs PyInstaller 冻结模式。"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

_APP_SUPPORT_NAME = "ZonScale"


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def get_bundle_root() -> Path:
    """只读资源根目录（源码树或 _MEIPASS）。"""
    if is_frozen():
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parent.parent


def _macos_writable_root() -> Path:
    """macOS .app 安装到「应用程序」后包内 MacOS 目录不可写，数据放到 Application Support。"""
    root = Path.home() / "Library" / "Application Support" / _APP_SUPPORT_NAME
    root.mkdir(parents=True, exist_ok=True)
    return root


def get_app_root() -> Path:
    """可读写工作目录（源码树、exe 同级，或 macOS Application Support）。"""
    if is_frozen():
        if sys.platform == "darwin":
            return _macos_writable_root()
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


def get_dist_web_dir() -> Path:
    bundled = get_bundle_root() / "dist_web"
    if bundled.is_dir():
        return bundled
    return get_app_root() / "dist_web"


def ensure_runtime_layout() -> Path:
    """创建运行时目录，并在首次启动时从包内复制默认 rules。"""
    app_root = get_app_root()
    for rel in ("temp_bridge_files", "output", "rules", "rules/logos"):
        (app_root / rel).mkdir(parents=True, exist_ok=True)

    bundle_rules = get_bundle_root() / "rules"
    app_rules = app_root / "rules"
    if bundle_rules.is_dir():
        for src in bundle_rules.rglob("*"):
            if not src.is_file():
                continue
            dest = app_rules / src.relative_to(bundle_rules)
            if not dest.exists():
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dest)

    return app_root
