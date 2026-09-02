"""Generate ZonKey Windows .ico (multi-resolution), .png and macOS .icns
from the crown brand mark.

品牌语义（2026-09-02 用户拍板）：ZonKey = 单皇冠（英皇娱乐式饱满三角冠形 +
lucide chess-king 轮廓语言），去掉钥匙剪影。配色沿用 Memphis 三色渐变
（teal→yellow→coral），与全站 UI 一致。渲染增强：冠面带受光/背光双渐变、
顶部釉面高光；三冠珠白色珠心 + 暗色月牙；冠带右侧暗带 + 上微光条 +
拉丝斜纹；中央菱形宝石作 Key 之「眼」。

设计真源是 frontend/public/zonkey-icon.svg（64×64 设计稿）；本脚本按同一
几何绘制栅格版，供 Windows EXE / macOS .app / PWA 图标使用。两处几何必须
同步修改。
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
GRAD_DARK = [(47, 169, 160), (217, 190, 60), (217, 79, 82)]
PEARL = (255, 249, 240, 255)  # 珠心/宝石/高光用背景色，形成镂空感
HALO = (26, 26, 46, 255)  # 透明底（2026-09-02 起）：深色外描边，浅色壁纸/浅色 PWA 背景下保形
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


def _grad_color(stops: list[tuple[int, int, int]], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    if t <= 0.5:
        return _lerp(stops[0], stops[1], t / 0.5)
    return _lerp(stops[1], stops[2], (t - 0.5) / 0.5)


def _fill_vertical_gradient(
    base: Image.Image, mask: Image.Image, top: int, bottom: int, size: int
) -> Image.Image:
    """在 mask 限定区域内铺竖直渐变（teal→yellow→coral），返回合成后的图。"""
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(max(top, 0), min(bottom, size - 1) + 1):
        t = (y - top) / max(bottom - top, 1)
        gd.line([(0, y), (size, y)], fill=_grad_color(GRAD, t) + (255,), width=1)
    return Image.composite(grad, base, mask)


def _overlay_vertical_gradient(
    base: Image.Image,
    mask: Image.Image,
    top: int,
    bottom: int,
    stops: list[tuple[int, int, int]],
    alpha: int,
    size: int,
) -> Image.Image:
    """在 mask 内叠加一层半透明竖直渐变（受光/背光带），不破坏底下的主渐变。"""
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(max(top, 0), min(bottom, size - 1) + 1):
        t = (y - top) / max(bottom - top, 1)
        gd.line([(0, y), (size, y)], fill=_grad_color(stops, t) + (alpha,), width=1)
    return Image.composite(grad, base, mask)


def _poly_pts(pts: list[tuple[float, float]], s: float) -> list[tuple[float, float]]:
    return [(x * s, y * s) for x, y in pts]


def _draw_outer_outline(
    img: Image.Image,
    crown: list[tuple[float, float]],
    band: list[float],
    color: tuple[int, int, int, int],
    width: float,
    s: float,
) -> None:
    """在冠面多边形与冠带圆角矩形外侧画一圈外描边（偏外一半宽度，
    避免吃掉内部细节）。透明底时这是图形与浅色背景之间唯一的边界。"""
    import PIL.ImageDraw as _ID

    w = max(1, round(width * 0.5))
    top, right, bottom, left = (
        min(p[1] for p in crown),
        max(p[0] for p in crown),
        band[3],
        min(p[0] for p in crown),
    )
    half = (top + bottom) / 2.0
    _ID.ImageDraw(img).line(
        [crown[-1], crown[0], crown[1], crown[2]],
        fill=color, width=w, joint="curve",
    )
    _ID.ImageDraw(img).polygon(crown[2:], outline=color, width=w)
    _ID.ImageDraw(img).rounded_rectangle(
        [left, band[1], right, band[3]],
        radius=2 * s + w * 0.5,
        outline=color,
        width=w,
    )
    _ID.ImageDraw(img).line([(left, half), (crown[0][0], crown[0][1])], fill=color, width=w)
    _ID.ImageDraw(img).line([(right, half), (crown[-2][0], crown[-2][1])], fill=color, width=w)


def render_icon(size: int) -> Image.Image:
    """单皇冠（渐变 + 立体渲染），与 zonkey-icon.svg 同几何，64 设计稿缩放。"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))  # 透明底（专业软件风格）
    s = size / 64.0
    stroke_w = max(2, round(3 * s))
    thin_w = max(1, round(1.5 * s))
    ball_w = max(1, round(1.8 * s))

    def pt(*xy: float) -> tuple[float, float]:
        return (xy[0] * s, xy[1] * s)

    def line_seg(p0: tuple[float, float], p1: tuple[float, float]) -> list[tuple[float, float]]:
        n = max(1, int(round(math.hypot(p1[0] - p0[0], p1[1] - p0[1]))))
        return [
            (p0[0] + (p1[0] - p0[0]) * i / n, p0[1] + (p1[1] - p0[1]) * i / n)
            for i in range(n + 1)
        ]

    # ---- 冠面 + 冠带主渐变 ----
    crown_shape = _poly_pts(
        [(6, 43), (6, 16), (18, 21), (32, 8.5), (46, 21), (58, 16), (58, 43)], s
    )
    band_shape = [7 * s, 41.5 * s, 57 * s, 51 * s]
    grad_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(grad_mask).polygon(crown_shape, fill=255)
    ImageDraw.Draw(grad_mask).rectangle(band_shape, fill=255)
    img = _fill_vertical_gradient(img, grad_mask, int(8.5 * s), int(51 * s), size)

    # ---- 冠面暗带（右侧 + 下缘）----
    dark_shape = _poly_pts(
        [(42, 19.2), (56, 14.4), (56, 43), (6, 43), (6, 42), (41.2, 42), (33.8, 33.4), (46, 21)], s
    )
    dark_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(dark_mask).polygon(dark_shape, fill=255)
    img = _overlay_vertical_gradient(img, dark_mask, int(8.5 * s), int(43 * s), GRAD_DARK, 150, size)

    # ---- 冠带暗带（右侧）+ 微光条（顶部）----
    band_dark_shape = _poly_pts([(44, 41.5), (57, 41.5), (57, 46.5), (52.5, 51), (44, 51)], s)
    band_dark_mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(band_dark_mask).polygon(band_dark_shape, fill=255)
    img = _overlay_vertical_gradient(img, band_dark_mask, int(41.5 * s), int(51 * s), GRAD_DARK, 90, size)
    if size >= 48:
        draw = ImageDraw.Draw(img)
        draw.rectangle([pt(8.5, 42.5), pt(55.5, 45)], fill=(255, 255, 255, 90))

    # ---- 冠面顶部釉面高光（右侧小三角透白）----
    if size >= 48:
        hi_shape = _poly_pts(
            [(14.5, 17.5), (19.5, 14.5), (29.5, 7.5), (31.5, 9.2), (24, 14.6), (21, 15.6), (26, 12.4)], s
        )
        hi_mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(hi_mask).polygon(hi_shape, fill=255)
        white_grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        hd = ImageDraw.Draw(white_grad)
        for y in range(int(7.5 * s), int(28 * s)):
            t = (y - 7.5 * s) / (28 * s - 7.5 * s)
            hd.line([(0, y), (size, y)], fill=(255, 255, 255, int(128 * (1 - t))), width=1)
        img = Image.composite(white_grad, img, hi_mask)

    # ---- 外描边（透明底下唯一保形手段，替代原奶油底衬）----
    halo_w = max(2, round(3.6 * s))
    _draw_outer_outline(img, crown_shape, band_shape, STROKE, halo_w, s)

    # ---- 描边：冠带 + 冠面 + 下缘暗线 ----
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(
        [pt(7, 41.5), pt(57, 51)], radius=pt(2, 0)[0], outline=STROKE, width=stroke_w
    )
    draw.polygon(crown_shape, outline=STROKE, width=stroke_w)
    if size >= 48:
        draw.line([pt(6, 43), pt(58, 43)], fill=(26, 26, 46, 60), width=max(1, round(0.7 * s)))

    # ---- 三冠珠：白珠心 + 暗色月牙 ----
    for cx, cy in [(18, 21), (32, 8.5), (46, 21)]:
        draw.ellipse(
            [pt(cx - 2.6, cy - 2.6), pt(cx + 2.6, cy + 2.6)],
            fill=PEARL,
            outline=STROKE,
            width=ball_w,
        )
        if size >= 48:
            draw.pieslice(
                [pt(cx - 2.4, cy - 2.4), pt(cx + 2.4, cy + 2.4)],
                start=210,
                end=330,
                fill=(26, 26, 46, 56),
            )

    # ---- 冠带中央菱形宝石（Key 之「眼」）----
    diamond = [pt(32, 43.2), pt(36, 46.4), pt(32, 49.6), pt(28, 46.4)]
    draw.polygon(diamond, fill=PEARL, outline=STROKE, width=thin_w)
    inner = [pt(33.5, 44.4), pt(35.1, 46.4), pt(33.5, 48.4), pt(31.9, 46.4)]
    for seg in zip(inner, inner[1:] + inner[:1]):
        for i, p in enumerate(line_seg(seg[0], seg[1])):
            t = i / max(len(line_seg(seg[0], seg[1])) - 1, 1)
            draw.ellipse(
                [p[0] - 0.8 * s, p[1] - 0.8 * s, p[0] + 0.8 * s, p[1] + 0.8 * s],
                fill=_grad_color(GRAD, t) + (255,),
            )

    # ---- 冠带高光斜纹（拉丝金）----
    if size >= 32:
        for x0, x1 in [(13, 19.5), (21.5, 28), (38, 44.5), (46.5, 53)]:
            draw.line([pt(x0, 44.6), pt(x1, 44.6)], fill=(255, 249, 240, 140), width=max(1, round(1 * s)))

    if size <= 32:
        rgb = Image.new("RGB", (size, size), (255, 255, 255))  # 小尺寸走纯白衬底（透明背景缩小后轮廓发虚）
        rgb.paste(img, mask=img.split()[3])
        return rgb
    return img


def _to_ico_rgb(img: Image.Image) -> Image.Image:
    """ICO 各尺寸用 RGB，避免 Windows 资源管理器回退到默认图标。"""
    if img.mode == "RGBA":
        base = Image.new("RGB", img.size, (255, 255, 255))  # 透明底在 ICO 用白底合成（Windows 不支持真透明 ICO）
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
