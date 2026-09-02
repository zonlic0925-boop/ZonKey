"""导出 Mac 构建专用压缩包（在 Windows 上运行，拷到 Mac 上执行 ./build_zonkey_mac.sh）。

用法:
  python scripts/export_mac_build_kit.py
  python scripts/export_mac_build_kit.py --include-frontend   # 附带 frontend 源码（不含 node_modules）
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "dist_release"
KIT_NAME = "ZonKey-mac-build-kit"

# 必需：Mac 打包最小文件集
DIRS = [
    "core",
    "rules",
    "dist_web",
    "packaging/macos",
    "scripts",
]

FILES = [
    "desktop_app.py",
    "server_bridge.py",
    "build_zonkey_mac.sh",
    "requirements.txt",
    "packaging/macos/MAC_BUILD_ON_MAC.md",
]

OPTIONAL_FRONTEND_DIRS = ["frontend"]
FRONTEND_IGNORE = shutil.ignore_patterns("node_modules", "dist", ".vite")

README_ROOT = """ZonKey Mac 构建包
==================

请打开 MAC_BUILD_ON_MAC.md 查看完整步骤。

快速开始（Mac 终端）:

  python3.11 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  chmod +x build_zonkey_mac.sh && ./build_zonkey_mac.sh

产物: dist/ZonKey.app 与 dist_release/ZonKey_macOS_*.zip
"""


def _ensure_dist_web() -> None:
    index = ROOT / "dist_web" / "index.html"
    if index.is_file():
        return
    frontend = ROOT / "frontend" / "package.json"
    if not frontend.is_file():
        raise FileNotFoundError(
            "dist_web/index.html 不存在，且找不到 frontend/。请先在本机执行: cd frontend && npm run build"
        )
    print("[*] dist_web 缺失，正在构建前端...")
    subprocess.run(["npm", "run", "build"], cwd=ROOT / "frontend", check=True)
    if not index.is_file():
        raise FileNotFoundError("前端构建完成但仍无 dist_web/index.html")


def _copy_tree(src: Path, dst: Path, ignore=None) -> None:
    if not src.is_dir():
        raise FileNotFoundError(f"缺少目录: {src}")
    shutil.copytree(src, dst, ignore=ignore, dirs_exist_ok=False)


def export_kit(include_frontend: bool = False) -> Path:
    _ensure_dist_web()

    stamp = datetime.now().strftime("%Y%m%d")
    stage = OUT_DIR / f"_mac_kit_stage_{stamp}"
    if stage.exists():
        shutil.rmtree(stage)
    kit_root = stage / KIT_NAME
    kit_root.mkdir(parents=True)

    for rel in DIRS:
        _copy_tree(ROOT / rel, kit_root / rel)

    for rel in FILES:
        src = ROOT / rel
        if not src.is_file():
            raise FileNotFoundError(f"缺少文件: {src}")
        dest = kit_root / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)

    # 根目录双份说明：一份在 packaging 内已有，一份在 kit 根便于第一眼看到
    mac_readme = ROOT / "packaging" / "macos" / "MAC_BUILD_ON_MAC.md"
    shutil.copy2(mac_readme, kit_root / "MAC_BUILD_ON_MAC.md")
    (kit_root / "README_MAC_BUILD.txt").write_text(README_ROOT, encoding="utf-8")

    if include_frontend:
        for rel in OPTIONAL_FRONTEND_DIRS:
            src = ROOT / rel
            if src.is_dir():
                _copy_tree(src, kit_root / rel, ignore=FRONTEND_IGNORE)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    archive_base = OUT_DIR / f"ZonKey_mac_build_kit_{stamp}"
    zip_path = Path(shutil.make_archive(str(archive_base), "zip", root_dir=stage))
    shutil.rmtree(stage)

    size_mb = zip_path.stat().st_size / (1024 * 1024)
    print(f"[OK] Mac 构建包: {zip_path} ({size_mb:.1f} MB)")
    print()
    print("拷到 Mac 后:")
    print(f"  unzip {zip_path.name}")
    print(f"  cd {KIT_NAME}")
    print("  阅读 MAC_BUILD_ON_MAC.md，执行 ./build_zonkey_mac.sh")
    return zip_path


def main() -> int:
    parser = argparse.ArgumentParser(description="导出 Mac 构建专用 ZIP")
    parser.add_argument(
        "--include-frontend",
        action="store_true",
        help="附带 frontend 源码（不含 node_modules），便于在 Mac 上改 UI 后重建",
    )
    args = parser.parse_args()
    try:
        export_kit(include_frontend=args.include_frontend)
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
