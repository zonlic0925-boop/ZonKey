"""Generate ZonKey Windows .ico (multi-resolution) from the dragon-scale key brand mark.

品牌语义（2026-09-02 用户拍板）：Zon=龙鳞（Zon）+ Key=钥匙 —— 钥匙柄为
渐变龙鳞六边形环，柄心为内六边形钥孔，钥匙杆 + 鳞片状双齿。配色沿用
Memphis 三色渐变（teal→yellow→coral），与全站 UI 一致。
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "packaging" / "windows" / "assets"
OUT_ICO = OUT_DIR / "zonkey.ico"
OUT_PNG = OUT_DIR / "zonkey.png"
ROOT_ASSETS = ROOT / "assets"

BG = (255, 249, 240, 255)
STROKE = (26, 26, 46, 255)
GRAD = [(78, 205, 196), (255, 230, 109), (255, 107, 107)]
KEYHOLE = (255, 249, 240, 255)  # 柄心钥孔填背景色
ICO_SIZES = [256, 128, 64, 48, 32, 16]


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


def _hex_points(cx: float, cy: float, r: float) -> list[tuple[float, float]]:
    return [
        (
            cx + r * math.cos(math.radians(60 * i - 90)),
            cy + r * math.sin(math.radians(60 * i - 90)),
        )
        for i in range(6)
    ]


def render_icon(size: int) -> Image.Image:
    """龙鳞钥匙：柄(六边形环渐变+钥孔) 在左上，杆垂直下延，双齿向右。"""
    img = Image.new("RGBA", (size, size), BG)
    s = size / 64.0  # 以 64×64 设计稿为基准缩放
    stroke_w = max(2, round(size / 18))
    thin_w = max(1, round(size / 28))

    def pt(x: float, y: float) -> tuple[float, float]:
        return (x * s, y * s)

    # ---- 钥匙杆（含柄部正下方的杆段，避免柄与齿之间断裂） ----
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle(
        [pt(17.5, 8.6), pt(26.5, 53)], radius=pt(2, 0)[0], fill=STROKE
    )

    # ---- 钥匙齿（鳞片状双齿） ----
    draw.rounded_rectangle([pt(26.5, 40), pt(37.5, 46)], radius=pt(1.5, 0)[0], fill=STROKE)
    draw.rounded_rectangle([pt(26.5, 48), pt(33.5, 52.5)], radius=pt(1.5, 0)[0], fill=STROKE)

    # ---- 钥匙柄：龙鳞六边形环（渐变） ----
    cx, cy, r = pt(22, 21.8)[0], pt(22, 21.8)[1], 13.2 * s
    outer = _hex_points(cx, cy, r)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).polygon(outer, fill=255)
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad_draw = ImageDraw.Draw(grad)
    min_y = int(min(p[1] for p in outer))
    max_y = int(max(p[1] for p in outer))
    for y in range(max(min_y, 0), min(max_y, size - 1) + 1):
        t = (y - min_y) / max(max_y - min_y, 1)
        grad_draw.line([(0, y), (size, y)], fill=_grad_color(t) + (255,), width=1)
    img = Image.composite(grad, img, mask)
    draw = ImageDraw.Draw(img)
    draw.polygon(outer, outline=STROKE, width=stroke_w)

    # ---- 柄心钥孔（内六边形，填背景色形成镂空感） ----
    inner = _hex_points(cx, cy, r * 0.58)
    draw.polygon(inner, fill=KEYHOLE, outline=STROKE, width=thin_w)

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


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ROOT_ASSETS.mkdir(parents=True, exist_ok=True)

    images = [_to_ico_rgb(render_icon(s)) for s in ICO_SIZES]
    images[0].save(OUT_ICO, format="ICO", append_images=images[1:])

    master_rgba = render_icon(256)
    if master_rgba.mode != "RGBA":
        master_rgba = master_rgba.convert("RGBA")
    master_rgba.save(OUT_PNG, format="PNG")
    master_rgba.save(ROOT_ASSETS / "zonkey.png", format="PNG")
    images[0].save(ROOT_ASSETS / "zonkey.ico", format="ICO", append_images=images[1:])

    frame_count = _ico_entry_count(OUT_ICO)
    if frame_count < 2:
        raise SystemExit(f"ICO 仅 {frame_count} 个尺寸，Windows 可能无法显示自定义图标")

    print(f"Wrote {OUT_ICO} ({OUT_ICO.stat().st_size} bytes, {frame_count} sizes)")
    print(f"Wrote {OUT_PNG}")
    print(f"Copied to {ROOT_ASSETS / 'zonkey.ico'}")


if __name__ == "__main__":
    main()
