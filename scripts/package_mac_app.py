"""将 dist/ZonScale.app 打包为可分发的 ZIP 归档。"""

from __future__ import annotations

import platform
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "dist" / "ZonScale.app"
OUT_DIR = ROOT / "dist_release"

README = """ZonScale macOS 版 — 使用说明
================================

1. 解压后将 ZonScale.app 拖入「应用程序」文件夹（或任意位置）。
2. 首次打开：若提示「无法验证开发者」：
   - 在 ZonScale.app 上 **右键 → 打开 → 打开**；或
   - 系统设置 → 隐私与安全性 → 仍要打开。
3. 双击 ZonScale.app 启动脱敏工作台（内嵌窗口，本地离线）。
4. 若窗口未弹出，可在终端运行：
     open dist/ZonScale.app
   或浏览器访问 http://127.0.0.1:8765

导出目录、规则与输出文件保存在：
  ~/Library/Application Support/ZonScale/
（规则、output、临时文件；首次启动会从应用内复制默认词表）

by zonlic · ZonScale
"""


def _arch_tag() -> str:
    machine = platform.machine().lower()
    if machine in {"arm64", "aarch64"}:
        return "arm64"
    if machine in {"x86_64", "amd64"}:
        return "x64"
    return machine or "unknown"


def package(version: str | None = None) -> Path:
    mac_bin = APP / "Contents" / "MacOS" / "ZonScale"
    if not APP.is_dir() or not mac_bin.is_file():
        raise FileNotFoundError(
            f"未找到 {APP}，请先在 Mac 上运行 ./build_zonscale_mac.sh"
        )

    stamp = datetime.now().strftime("%Y%m%d")
    ver = version or stamp
    stage = OUT_DIR / f"_mac_stage_{ver}"
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    shutil.copytree(APP, stage / "ZonScale.app")
    (stage / "README_macOS.txt").write_text(README, encoding="utf-8")

    archive_base = OUT_DIR / f"ZonScale_macOS_{_arch_tag()}_{ver}"
    zip_path = shutil.make_archive(str(archive_base), "zip", root_dir=stage)
    shutil.rmtree(stage)
    return Path(zip_path)


def main() -> int:
    try:
        zip_path = package(sys.argv[1] if len(sys.argv) > 1 else None)
    except FileNotFoundError as exc:
        print(f"[ERROR] {exc}")
        return 1
    print(f"[OK] 发布包已生成: {zip_path}")
    print("     解压后运行: ZonScale.app")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
