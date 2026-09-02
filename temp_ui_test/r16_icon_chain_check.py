"""Round-16 ① 验证链：assets/zonkey.ico → EXE 内嵌 RT_ICON 资源的 alpha 透明度。

判定：每尺寸帧四角 alpha 全 0（真透明）+ 中心 alpha 255（皇冠可见）。
"""
import io
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def _check_ico_blob(tag: str, data: bytes) -> bool:
    """对 ICO 文件字节（目录+帧）做帧级 alpha 断言。"""
    count = struct.unpack_from("<H", data, 4)[0]
    ok_all = True
    for i in range(count):
        entry = data[6 + 16 * i : 6 + 16 * (i + 1)]
        w = entry[0] or 256
        h = entry[1] or 256
        length = struct.unpack_from("<I", entry, 8)[0]
        offset = struct.unpack_from("<I", entry, 12)[0]
        blob = data[offset : offset + length]
        bpp = 0
        if blob[:8] == b"\x89PNG\r\n\x1a\n":
            frame = Image.open(io.BytesIO(blob)).convert("RGBA")
        else:
            bpp = struct.unpack_from("<H", blob, 14)[0]
            width = struct.unpack_from("<i", blob, 4)[0]
            dib_h = struct.unpack_from("<i", blob, 8)[0] // 2
            pitch = ((width * bpp + 31) // 32) * 4
            xor = blob[40 : 40 + pitch * dib_h]
            and_mask = blob[40 + pitch * dib_h :]
            px = bytearray(pitch * dib_h)
            for row in range(dib_h):  # DIB 底向上 → 顶向下
                src = (dib_h - 1 - row) * pitch
                px[row * pitch : (row + 1) * pitch] = xor[src : src + pitch]
            frame = Image.frombytes("RGBA", (width, dib_h), bytes(px), "raw", "BGRA")
            mask_zero = not any(and_mask)
        fw, fh = frame.size
        corners = [frame.getpixel(p)[3] for p in [(0, 0), (fw - 1, 0), (0, fh - 1), (fw - 1, fh - 1)]]
        center = frame.getpixel((fw // 2, fh // 2))[3]
        ok = all(a == 0 for a in corners) and center == 255
        extra = "" if blob[:8] == b"\x89PNG\r\n\x1a\n" else ("" if mask_zero else " AND掩码非全零!")
        print(f"  [{tag}] {fw}x{fh} bpp={bpp} corners_a={corners} center_a={center} {'OK ' if ok else 'BAD'}{extra}")
        if not ok:
            ok_all = False
    return ok_all


def _pe_icon_blobs(exe_path: Path) -> list[tuple[int, bytes]]:
    """PE .rsrc 走查，按 RT_ICON(3) 抽出每帧原始字节（重组为合法 .ico）。"""
    data = exe_path.read_bytes()
    pe_off = struct.unpack_from("<I", data, 0x3C)[0]
    opt_size = struct.unpack_from("<H", data, pe_off + 20)[0]
    sections_off = pe_off + 24 + opt_size
    num_sections = struct.unpack_from("<H", data, pe_off + 6)[0]
    rva_map = {}
    for s in range(num_sections):
        sec = data[sections_off + 40 * s : sections_off + 40 * (s + 1)]
        name = sec[:8].rstrip(b"\0").decode(errors="ignore")
        vsize, va, rawsize, rawptr = struct.unpack_from("<IIII", sec, 8)
        rva_map[va] = (rawptr, min(vsize, rawsize) if rawsize else vsize, name)

    def rva2off(rva: int) -> int:
        for va, (raw, size, _) in sorted(rva_map.items(), reverse=True):
            if va <= rva < va + max(size, 1):
                return raw + (rva - va)
        raise ValueError(f"RVA {rva:#x} 不在任何段内")

    rsrc_va, (rsrc_raw, rsrc_size, _) = next((va, m) for va, m in rva_map.items() if m[2] == ".rsrc")
    rsrc_off = rsrc_raw

    def walk(off: int, level: int, path: tuple[int, ...]) -> list[tuple[tuple[int, ...], int]]:
        chars, ts, ver, named, ided = struct.unpack_from("<IIHHH", data, rsrc_off + off)
        out = []
        for e in range(named + ided):
            name_id, ofs = struct.unpack_from("<II", data, rsrc_off + off + 16 + 8 * e)
            if ofs & 0x80000000:
                out += walk(ofs & 0x7FFFFFFF, level + 1, path + (name_id,))
            else:
                out.append((path + (name_id,), ofs))
        return out

    leaves = walk(0, 0, ())
    blobs = []
    for path, data_entry_off in leaves:
        if path and path[0] != 3:  # RT_ICON
            continue
        lang_off = struct.unpack_from("<I", data, rsrc_off + data_entry_off)[0]
        data_va, size = struct.unpack_from("<II", data, rsrc_off + lang_off)[:2]
        raw = data[rva2off(data_va) : rva2off(data_va) + size]
        blobs.append((path[-1] if len(path) > 1 else 0, raw))

    # 每个 RT_ICON 帧裸 DIB/PNG → 组装成单帧 ICO 以复用检查器
    result = []
    for icon_id, raw in blobs:
        if raw[:8] == b"\x89PNG\r\n\x1a\n":
            frame_blob, w, h = raw, 0, 0
            im = Image.open(io.BytesIO(raw))
            w, h = im.size
        else:
            width = struct.unpack_from("<i", raw, 4)[0]
            dib_h2 = struct.unpack_from("<i", raw, 8)[0]
            w, h = width, dib_h2 // 2
            frame_blob = raw
        ico = struct.pack("<HHH", 0, 1, 1)
        ico += struct.pack("<BBBBHHII", w % 256, h % 256, 0, 0, 1, 32, len(frame_blob), 22)
        ico += frame_blob
        result.append((icon_id, ico))
    return result


if __name__ == "__main__":
    print("== assets/zonkey.ico ==")
    _check_ico_blob("assets", (ROOT / "assets/zonkey.ico").read_bytes())
    print("== dist/ZonKey/ZonKey.exe RT_ICON ==")
    for icon_id, ico in _pe_icon_blobs(ROOT / "dist/ZonKey/ZonKey.exe"):
        _check_ico_blob(f"exe#{icon_id}", ico)
