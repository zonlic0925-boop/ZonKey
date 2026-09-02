"""Generate ZonKey Windows .ico (multi-resolution), .png and macOS .icns
from the crown brand mark.

品牌语义（2026-09-02 用户拍板）：ZonKey = 皇冠（英皇娱乐式饱满三角冠形 +
lucide chess-king 轮廓语言）+ Key 特色（冠面中央白色钥匙剪影：龙鳞六边形
环柄 + 鳞片状双齿，冠带锁孔点睛）。配色沿用 Memphis 三色渐变
（teal→yellow→coral），与全站 UI 一致。

设计真源是 frontend/public/zonkey-icon.svg（64×64 设计稿，金色渐变皇冠 +
白色钥匙剪影）；本脚本按同一几何绘制栅格版，供 Windows EXE / macOS .app /
PWA 图标使用。两处几何必须同步修改。
"""

from __future__ import annotations

import io
import math
import struct
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "packaging" / "windows" / "assets"
MAC_ASSETS_DIR = ROOT / "packaging" / "macos" / "assets"
OUT_ICO = OUT_DIR / "zonkey.ico"
OUT_PNG = OUT_DIR / "zonkey.png"
ROOT_ASSETS = ROOT / "assets"
WEB_PUBLIC = ROOT / "frontend" / "public"

BG = (255, 249, 240, 255)
STROKE = (26, 26, 46, 255)
GRAD = [(78, 205, 196), (255, 230, 109), (255, 107, 107)]
KEYHOLE = BG  # 钥匙剪影与锁孔填背景色，形成镂空感
ICO_SIZES = [256, 128, 64, 48, 32, 16]

# macOS icns 必须含 16/32/64/128/256/512/1024 全套 PNG 通道，
# 缺任意一个（即 @1x/@2x）会导致 app 图标渲染失败。
ICNS_SIZES = [16, 32, 64, 128, 256, 512, 1024]


def _lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def _grad_color(t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    if t <= 0.5:
        return _lerp(GRAD[0], GRAD[1], t / 0.5)
    return _lerp(GRAD[1], GRAD[2], (t - 0.5) / 0.5)


def _fill_vertical_gradient(
    base: Image.Image, mask: Image.Image, top: int, bottom: int, size: int
) -> Image.Image:
    """在 mask 限定区域内铺竖直渐变（teal→yellow→coral），返回合成后的图。"""
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(max(top, 0), min(bottom, size - 1) + 1):
        t = (y - top) / max(bottom - top, 1)
        gd.line([(0, y), (size, y)], fill=_grad_color(t) + (255,), width=1)
    return Image.composite(grad, base, mask)


def _poly_pts(pts: list[tuple[float, float]], s: float) -> list[tuple[float, float]]:
    return [(x * s, y * s) for x, y in pts]


def render_icon(size: int) -> Image.Image:
    """金色渐变皇冠 + 中央白色钥匙剪影（与 zonkey-icon.svg 同几何，64 设计稿缩放）。"""
    img = Image.new("RGBA", (size, size), BG)
    s = size / 64.0
    stroke_w = max(2, round(3 * s))
    thin_w = max(1, round(1.5 * s))
    ball_w = max(1, round(1.8 * s))

    def pt(*xy: float) -> tuple[float, float]:
        return (xy[0] * s, xy[1] * s)

    # ---- 冠面渐变（冠面+冠带同向渐变，仅填皇冠形状内部） ----
    crown_shape = _poly_pts(
        [(6, 43), (6, 16), (18, 21), (32, 8.5), (46, 21), (58, 16), (58, 43)], s
    )
    band_shape = [7 * s, 41.5 * s, 57 * s, 51 * s]
    grad_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(grad_mask).polygon(crown_shape, fill=255)
    ImageDraw.Draw(grad_mask).rectangle(band_shape, fill=255)
    img = _fill_vertical_gradient(img, grad_mask, int(8.5 * s), int(51 * s), size)

    draw = ImageDraw.Draw(img)

    # ---- 冠带（基底饰条，渐变底已铺好，只需描边） ----
    draw.rounded_rectangle(
        [pt(7, 41.5), pt(57, 51)], radius=pt(2, 0)[0], outline=STROKE, width=stroke_w
    )

    # ---- 冠面（三角冠形） ----
    draw.polygon(crown_shape, outline=STROKE, width=stroke_w)

    # ---- 三冠珠 ----
    for cx, cy in [(18, 21), (32, 8.5), (46, 21)]:
        draw.ellipse(
            [pt(cx - 2.6, cy - 2.6), pt(cx + 2.6, cy + 2.6)],
            fill=KEYHOLE,
            outline=STROKE,
            width=ball_w,
        )

    # ---- 钥匙剪影（冠面中央，背景色镂空 + 墨线描边） ----
    # PIL 的 rounded_rectangle 在 ≤32px 时对过窄的齿条带 outline 会抛
    # "x1 must be greater than or equal to x0"（描边收缩后矩形塌陷），
    # 小尺寸只画纯色镂空（白色剪影在渐变底上依然清晰）。
    small = size <= 32
    outline_kw = {} if small else {"outline": STROKE, "width": thin_w}
    draw.rounded_rectangle(
        [pt(25.5, 15.5), pt(30, 35.5)], radius=pt(1.4, 0)[0], fill=KEYHOLE, **outline_kw
    )
    draw.rounded_rectangle(
        [pt(30, 28), pt(37.5, 31.4)], radius=pt(1.2, 0)[0], fill=KEYHOLE, **outline_kw
    )
    draw.rounded_rectangle(
        [pt(30, 32.2), pt(35, 35)], radius=pt(1.2, 0)[0], fill=KEYHOLE, **outline_kw
    )
    hex_pts = [
        pt(27.75 + 3.45 * math.cos(math.radians(60 * i - 90)), 24.6 + 3.45 * math.sin(math.radians(60 * i - 90)))
        for i in range(6)
    ]
    draw.polygon(hex_pts, fill=KEYHOLE, **outline_kw)

    # ---- 冠带锁孔 ----
    draw.ellipse(
        [pt(32 - 2.6, 46.2 - 2.6), pt(32 + 2.6, 46.2 + 2.6)],
        fill=KEYHOLE,
        **outline_kw,
    )

    if size <= 32:
        rgb = Image.new("RGB", (size, size), BG[:3])
        rgb.paste(img, mask=img.split()[3])
        return rgb
    return img


def _to_ico_rgb(img: Image.Image) -> Image.Image:
    """ICO 各尺寸用 RGB，避免 Windows 资源管理器回退到默认图标。"""
    if img.mode == "RGBA":
        base = Image.new("RGB", img.size, BG[:3])
        base.paste(img, mask=img.split()[3])
        return base
    return img.convert("RGB")


def _ico_entry_count(path: Path) -> int:
    from PIL.IcoImagePlugin import IcoFile

    with open(path, "rb") as fp:
        return len(IcoFile(fp).entry)


def _png_bytes(size: int) -> bytes:
    img = render_icon(size)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _write_icns(png_by_size: dict[int, bytes], out: Path) -> None:
    """拼装 macOS .icns（is32/s8mk + il32/l8mk + 全部 icNN PNG 通道）。

    s8mk/l8mk 位掩码必须存在：Finder 与 Dock 用 is32/il32 渲染时会
    同时读对应掩码，缺掩码图标渲染为纯色方块。
    """
    payload = [b"icns", struct.pack(">I", 0)]

    def chunk(tag: bytes, data: bytes) -> None:
        payload.append(tag + struct.pack(">I", len(data) + 8) + data)

    def mask_channel(img: Image.Image, tag: bytes) -> None:
        w = h = img.width
        row_bytes = (w + 31) // 32 * 4
        mask = bytearray(row_bytes * h)
        px = img.load()
        for y in range(h):
            for x in range(w):
                if px[x, y][3] < 128:
                    mask[y * row_bytes + x // 8] |= 0x80 >> (x % 8)
        chunk(tag, bytes(mask))

    for size, tag in [(16, b"is32"), (32, b"il32")]:
        img = Image.open(io.BytesIO(png_by_size[size])).convert("RGBA")
        w = h = img.width
        px = img.load()
        argb = b"".join(bytes((px[x, y][2], px[x, y][1], px[x, y][0], px[x, y][3])) for y in range(h) for x in range(w))
        chunk(tag, argb)
        mask_channel(img, b"s8mk" if size == 16 else b"l8mk")

    for size in [64, 128, 256, 512, 1024]:
        chunk(b"ic%02d" % size, png_by_size[size])

    payload[1] = struct.pack(">I", sum(len(p) for p in payload))
    out.write_bytes(b"".join(payload))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    MAC_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    ROOT_ASSETS.mkdir(parents=True, exist_ok=True)

    images = [_to_ico_rgb(render_icon(s)) for s in ICO_SIZES]
    images[0].save(OUT_ICO, format="ICO", append_images=images[1:])

    master_rgba = render_icon(256)
    if master_rgba.mode != "RGBA":
        master_rgba = master_rgba.convert("RGBA")
    master_rgba.save(OUT_PNG, format="PNG")
    master_rgba.save(ROOT_ASSETS / "zonkey.png", format="PNG")
    images[0].save(ROOT_ASSETS / "zonkey.ico", format="ICO", append_images=images[1:])

    # PWA / iOS 图标：apple-touch 180 + webmanifest 192/512
    for size in [180, 192, 512]:
        (WEB_PUBLIC / f"zonkey-icon-{size}.png").write_bytes(_png_bytes(size))

    # macOS icns（全套 PNG 通道）
    png_by_size = {size: _png_bytes(size) for size in ICNS_SIZES}
    _write_icns(png_by_size, MAC_ASSETS_DIR / "zonkey.icns")

    frame_count = _ico_entry_count(OUT_ICO)
    if frame_count < 2:
        raise SystemExit(f"ICO 仅 {frame_count} 个尺寸，Windows 可能无法显示自定义图标")

    print(f"Wrote {OUT_ICO} ({OUT_ICO.stat().st_size} bytes, {frame_count} sizes)")
    print(f"Wrote {OUT_PNG}")
    print(f"Wrote {MAC_ASSETS_DIR / 'zonkey.icns'}")
    print(f"Copied to {ROOT_ASSETS / 'zonkey.ico'}")
    print("PWA icons: zonkey-icon-180/192/512.png")


if __name__ == "__main__":
    main()
