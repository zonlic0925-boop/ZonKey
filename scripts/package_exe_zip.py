"""将 dist/ZonKey 打包为可分发的 7z 归档（LZMA2 最高压缩，省 32% 体积）。
同时生成 SHA256 校验文件，并保留 zip 作为可选格式。
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "dist" / "ZonKey"
OUT_DIR = ROOT / "dist_release"

LAN_BAT = """@echo off
setlocal
cd /d "%~dp0"

title ZonKey LAN (phone browser)

echo ========================================================
echo   ZonKey EXE - LAN mode
echo   PC:    http://127.0.0.1:8765
echo   Phone: use http://YOUR_PC_IP:8765 on same WiFi
echo ========================================================
echo.

ZonKey.exe --lan --browser
pause
endlocal
"""


def _write_lan_launcher() -> None:
    (SRC / "启动局域网手机访问.bat").write_text(LAN_BAT, encoding="utf-8")


def _find_7z() -> str | None:
    """查找系统上的 7z 命令行工具。"""
    candidates = [
        # NanaZip (Windows 11 商店版)
        str(Path.home() / "AppData" / "Local" / "Microsoft" / "WindowsApps" / "7z.exe"),
        # 7-Zip 标准安装路径
        r"C:\Program Files\7-Zip\7z.exe",
        r"C:\Program Files (x86)\7-Zip\7z.exe",
        # PATH 中的 7z
        "7z.exe",
        "7z",
    ]
    for candidate in candidates:
        try:
            result = subprocess.run(
                [candidate, "--help"],
                capture_output=True,
                timeout=5,
                text=True,
            )
            if result.returncode == 0 or "7-Zip" in (result.stdout or ""):
                return candidate
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    return None


def _sha256(path: Path) -> str:
    """计算文件 SHA256。"""
    try:
        result = subprocess.run(
            ["certutil", "-hashfile", str(path), "SHA256"],
            capture_output=True,
            timeout=120,
            text=True,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return ""
    if result.returncode != 0:
        return ""
    lines = (result.stdout or "").strip().splitlines()
    if len(lines) >= 2:
        return lines[1].strip()
    return ""


def package(version: str | None = None) -> dict[str, Path]:
    """打包为 7z + zip（互为备份），并生成 SHA256。

    返回 {"7z": path, "zip": path | None, "sha256": path}。
    """
    if not (SRC / "ZonKey.exe").is_file():
        raise FileNotFoundError(f"未找到 {SRC / 'ZonKey.exe'}，请先运行 build_zonkey_exe.bat")

    _write_lan_launcher()

    stamp = datetime.now().strftime("%Y%m%d")
    ver = version or stamp
    archive_base = OUT_DIR / f"ZonKey_Windows_x64_{ver}"
    result = {}

    # 7z（主分发格式）
    seven_z = _find_7z()
    if seven_z:
        seven_z_path = archive_base.with_suffix(".7z")
        subprocess.run(
            [
                seven_z, "a", "-t7z", "-mx=9", "-m0=LZMA2", "-md=256m",
                "-mfb=273", "-ms=on", str(seven_z_path), str(SRC / "*"),
            ],
            check=True,
            timeout=600,
        )
        result["7z"] = seven_z_path
        print(f"[OK] 7z 发布包: {seven_z_path} ({seven_z_path.stat().st_size} bytes)")

    # zip（兼容格式，保留给不熟悉 7z 的用户）
    try:
        zip_path = shutil.make_archive(str(archive_base), "zip", root_dir=SRC)
        result["zip"] = zip_path
        print(f"[OK] zip 发布包: {zip_path} ({zip_path.stat().st_size} bytes)")
    except Exception as exc:
        print(f"[WARN] zip 打包失败（非致命）: {exc}")

    # SHA256
    primary = result.get("7z") or result.get("zip")
    if primary:
        sha_path = primary.with_suffix(".sha256")
        sha_path.write_text(f"{_sha256(primary)}  {primary.name}\n", encoding="utf-8")
        result["sha256"] = sha_path

    return result


def main() -> int:
    try:
        result = package(sys.argv[1] if len(sys.argv) > 1 else None)
    except FileNotFoundError as exc:
        print(f"[ERROR] {exc}")
        return 1
    if not result:
        print("[ERROR] 未生成任何发布包")
        return 1
    files = ", ".join(str(p.name) for p in result.values())
    print(f"[OK] 发布包已生成: {files}")
    print(f"     解压后运行: ZonKey.exe")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())