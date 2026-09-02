"""将 dist/ZonKey 打包为 Inno Setup 安装包（setup.exe）+ 7z/zip 归档。

前置条件：Inno Setup 6 已安装，iscc.exe 在 PATH 或 C:\Program Files (x86)\Inno Setup 6。
"""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "dist" / "ZonKey"
OUT_DIR = ROOT / "dist_release"
ISS = ROOT / "packaging" / "windows" / "setup" / "ZonKey_setup.iss"

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


def _find_iscc() -> str | None:
    """查找 Inno Setup 编译器路径。"""
    candidates = [
        r"C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        r"C:\Program Files\Inno Setup 6\ISCC.exe",
        "iscc",
        "ISCC.exe",
    ]
    for candidate in candidates:
        try:
            result = subprocess.run(
                [candidate, "/?"],
                capture_output=True,
                timeout=5,
                text=True,
            )
            if result.returncode == 0 or "Inno Setup" in (result.stdout or ""):
                return candidate
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    return None


def _write_lan_launcher() -> None:
    (SRC / "启动局域网手机访问.bat").write_text(LAN_BAT, encoding="utf-8")


def _find_7z() -> str | None:
    candidates = [
        str(Path.home() / "AppData" / "Local" / "Microsoft" / "WindowsApps" / "7z.exe"),
        r"C:\Program Files\7-Zip\7z.exe",
        r"C:\Program Files (x86)\7-Zip\7z.exe",
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
    # certutil 输出格式: "SHA256 的 path 哈希:\nhash\nCertUtil: ..."
    for line in lines:
        line = line.strip()
        if len(line) == 64 and all(c in "0123456789abcdefABCDEF" for c in line):
            return line.lower()
    return ""


def package(version: str | None = None) -> dict[str, Path]:
    """打包为 Inno Setup 安装包（主分发）+ 7z + zip。

    返回 {"setup": path, "7z": path | None, "zip": path | None, "sha256": path}。
    """
    if not (SRC / "ZonKey.exe").is_file():
        raise FileNotFoundError(f"未找到 {SRC / 'ZonKey.exe'}，请先运行 build_zonkey_exe.bat")

    _write_lan_launcher()

    stamp = datetime.now().strftime("%Y%m%d")
    ver = version or stamp
    result = {}

    # ---------- Inno Setup 安装包（主分发格式）----------
    iscc = _find_iscc()
    if not iscc:
        print("[WARN] 未找到 Inno Setup（iscc.exe），跳过安装包生成。")
        print("[INFO] 安装方法：winget install JRSoftware.InnoSetup")
    else:
        print(f"[INFO] 使用 Inno Setup: {iscc}")
        subprocess.run(
            [iscc, f"/DMyAppVersion={ver}", str(ISS)],
            check=True,
            timeout=600,
            text=False,  # ISCC 输出含二进制数据，不能用 text=True
        )
        setup_path = OUT_DIR / f"ZonKey_Setup_x64_{ver}.exe"
        if setup_path.is_file():
            result["setup"] = setup_path
            print(f"[OK] 安装包: {setup_path} ({setup_path.stat().st_size} bytes)")
        else:
            print("[WARN] 安装包未生成，检查 Inno Setup 编译日志。")

    # ---------- 7z（便携版备选）----------
    seven_z = _find_7z()
    archive_base = OUT_DIR / f"ZonKey_Windows_x64_{ver}"
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
        print(f"[OK] 7z 便携包: {seven_z_path} ({seven_z_path.stat().st_size} bytes)")

    # ---------- zip（兼容格式）----------
    import shutil
    try:
        zip_path = Path(shutil.make_archive(str(archive_base), "zip", root_dir=SRC))
        result["zip"] = zip_path
        print(f"[OK] zip 便携包: {zip_path} ({zip_path.stat().st_size} bytes)")
    except Exception as exc:
        print(f"[WARN] zip 打包失败（非致命）: {exc}")

    # ---------- SHA256 ----------
    primary = result.get("setup") or result.get("7z") or result.get("zip")
    if primary:
        sha_path = primary.with_suffix(primary.suffix + ".sha256")
        sha_path.write_text(f"{_sha256(primary)}  {primary.name}\n", encoding="utf-8")
        result["sha256"] = sha_path
        print(f"[OK] SHA256: {sha_path}")

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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())