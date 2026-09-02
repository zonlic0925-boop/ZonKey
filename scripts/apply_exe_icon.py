"""Post-build: copy ZonKey icon sidecars for pywebview / shortcuts.

IMPORTANT: Do NOT use rcedit or other PE resource editors on PyInstaller EXEs —
they strip the appended PKG overlay and break startup with:
  "Could not load PyInstaller's embedded PKG archive"
Explorer/taskbar icons must come from PyInstaller `icon=` in ZonKey.spec.
"""

from __future__ import annotations

import shutil
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXE = ROOT / "dist" / "ZonKey" / "ZonKey.exe"
ICO = ROOT / "packaging" / "windows" / "assets" / "zonkey.ico"


def _pe_has_icon_resource(exe_path: Path) -> bool:
    """Return True if the PE file has an RT_GROUP_ICON (14) resource directory."""
    try:
        data = exe_path.read_bytes()
    except OSError:
        return False
    if len(data) < 0x40 or data[:2] != b"MZ":
        return False
    pe_offset = struct.unpack_from("<I", data, 0x3C)[0]
    if pe_offset + 24 > len(data) or data[pe_offset : pe_offset + 4] != b"PE\x00\x00":
        return False
    num_sections = struct.unpack_from("<H", data, pe_offset + 6)[0]
    opt_header_size = struct.unpack_from("<H", data, pe_offset + 20)[0]
    section_table = pe_offset + 24 + opt_header_size
    rva_to_offset: dict[int, int] = {}
    for i in range(num_sections):
        off = section_table + i * 40
        if off + 40 > len(data):
            break
        virtual_addr, raw_ptr = struct.unpack_from("<II", data, off + 12)
        rva_to_offset[virtual_addr] = raw_ptr

    def rva_to_file_offset(rva: int) -> int | None:
        for va, raw in sorted(rva_to_offset.items()):
            size = next(
                (
                    struct.unpack_from("<I", data, section_table + j * 40 + 16)[0]
                    for j in range(num_sections)
                    if struct.unpack_from("<I", data, section_table + j * 40 + 12)[0] == va
                ),
                0,
            )
            if va <= rva < va + max(size, 1):
                return raw + (rva - va)
        return None

    magic = struct.unpack_from("<H", data, pe_offset + 24)[0]
    data_dir_off = pe_offset + 24 + (112 if magic == 0x20B else 96)
    resource_rva = struct.unpack_from("<I", data, data_dir_off + 2 * 8)[0]
    if not resource_rva:
        return False
    res_off = rva_to_file_offset(resource_rva)
    if res_off is None:
        return False

    num_named, num_id = struct.unpack_from("<II", data, res_off + 12)
    total = num_named + num_id
    entry_off = res_off + 16
    for _ in range(total):
        if entry_off + 8 > len(data):
            break
        name_id = struct.unpack_from("<I", data, entry_off)[0]
        entry_off += 8
        if name_id == 14:  # RT_GROUP_ICON
            return True
    return False


def _copy_sidecars() -> None:
    if not ICO.exists() or not EXE.parent.exists():
        return
    dest = EXE.parent / "zonkey.ico"
    shutil.copy2(ICO, dest)
    print(f"[OK] Copied icon sidecar: {dest}")

    assets_dir = EXE.parent / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)
    assets_dest = assets_dir / "zonkey.ico"
    shutil.copy2(ICO, assets_dest)
    print(f"[OK] Copied icon sidecar: {assets_dest}")


def main() -> int:
    if sys.platform != "win32":
        print("[SKIP] apply_exe_icon is Windows-only")
        return 0
    if not EXE.exists():
        print(f"[ERROR] EXE not found: {EXE}")
        return 1
    if not ICO.exists():
        print(f"[ERROR] ICO not found: {ICO} — run scripts/generate_zonkey_icon.py")
        return 1

    _copy_sidecars()
    if _pe_has_icon_resource(EXE):
        print(f"[OK] PyInstaller embedded icon verified in {EXE.name}")
    else:
        print(
            "[WARN] EXE has no embedded icon resource — regenerate icon and rebuild with ZonKey.spec icon="
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
