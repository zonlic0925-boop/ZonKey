"""将 dist/ZonScale 打包为可分发的 ZIP 归档。"""

from __future__ import annotations

import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "dist" / "ZonScale"
OUT_DIR = ROOT / "dist_release"

LAN_BAT = """@echo off
setlocal
cd /d "%~dp0"

title ZonScale LAN (phone browser)

echo ========================================================
echo   ZonScale EXE - LAN mode
echo   PC:    http://127.0.0.1:8765
echo   Phone: use http://YOUR_PC_IP:8765 on same WiFi
echo ========================================================
echo.

ZonScale.exe --lan --browser
pause
endlocal
"""


def _write_lan_launcher() -> None:
    (SRC / "启动局域网手机访问.bat").write_text(LAN_BAT, encoding="utf-8")


def package(version: str | None = None) -> Path:
    if not (SRC / "ZonScale.exe").is_file():
        raise FileNotFoundError(f"未找到 {SRC / 'ZonScale.exe'}，请先运行 build_zonscale_exe.bat")

    _write_lan_launcher()

    stamp = datetime.now().strftime("%Y%m%d")
    ver = version or stamp
    archive_base = OUT_DIR / f"ZonScale_Windows_x64_{ver}"
    zip_path = shutil.make_archive(str(archive_base), "zip", root_dir=SRC)
    return Path(zip_path)


def main() -> int:
    try:
        zip_path = package(sys.argv[1] if len(sys.argv) > 1 else None)
    except FileNotFoundError as exc:
        print(f"[ERROR] {exc}")
        return 1
    print(f"[OK] 发布包已生成: {zip_path}")
    print(f"     解压后运行: ZonScale.exe")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
