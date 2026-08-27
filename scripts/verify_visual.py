"""视觉验收：对每个抹除框做像素级检查。

- in_box 均匀性: 抹除框内应接近纯色（erase 白色 / cover 黑色）
- in_box 残留: 框内非填充色像素占比应接近 0（格线本身允许：见 INK_IS_LINE）
- ring 越界: 框外 3pt 环带内，输入墨迹不得被删除、不得新增墨迹（不越框污染）

用法: python scripts/verify_visual.py <source.pdf> <output.pdf> <audit.json> [--mode erase|cover]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import fitz
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.model import RedactMode  # noqa: E402

BAND_PT = 3.0
RESIDUAL_RATIO = 0.04
# 允许带宽: 抹除框与相邻格线可能共享像素(线宽半内)，MuPDF 处理图像像素时
# 会切掉与框重叠的极小线段，视觉不可感知；安全(不泄露)优先于格线完整。
BAND_INK_DELTA = 0.05
ZOOM = 2.0
INK = 200


def _render(path: str) -> tuple[np.ndarray, float, float]:
    doc = fitz.open(path)
    page = doc[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), alpha=False)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
        pix.height, pix.width, pix.n
    )
    h, w = pix.height, pix.width
    doc.close()
    return arr, w, h


def _ink_mask(arr: np.ndarray) -> np.ndarray:
    if arr.ndim == 3:
        return (arr.max(axis=2) < INK).astype(np.uint8)
    return (arr < INK).astype(np.uint8)


def _check_box(
    arr_in: np.ndarray,
    arr_out: np.ndarray,
    box: list[float],
    mode: RedactMode,
) -> dict:
    x0, y0, x1, y1 = box
    z = ZOOM
    bx0, by0 = int(x0 * z), int(y0 * z)
    bx1, by1 = max(bx0 + 1, int(x1 * z)), max(by0 + 1, int(y1 * z))
    h, w = arr_out.shape[:2]
    bx0, by0 = max(0, bx0), max(0, by0)
    bx1, by1 = min(w, bx1), min(h, by1)
    inner = arr_out[by0:by1, bx0:bx1].astype(np.int16)
    if inner.size == 0:
        return {"error": "empty box"}
    fill = 255 if mode == RedactMode.ERASE else 0
    std = float(inner.std())
    residual = float(
        np.mean(
            np.abs(inner - fill).max(axis=2) > 40
            if inner.ndim == 3
            else np.abs(inner - fill) > 40
        )
    )
    bx0f, by0f, bx1f, by1f = (
        max(0, int((x0 - BAND_PT) * z)),
        max(0, int((y0 - BAND_PT) * z)),
        min(w, int((x1 + BAND_PT) * z)),
        min(h, int((y1 + BAND_PT) * z)),
    )
    bix0, biy0 = max(0, bx0 - bx0f), max(0, by0 - by0f)
    bix1, biy1 = min(bx1 - bx0f, bx1f - bx0f), min(by1 - by0f, by1f - by0f)
    ring_mask = np.ones((by1f - by0f, bx1f - bx0f), dtype=bool)
    ring_mask[biy0:biy1, bix0:bix1] = False
    min_ = _ink_mask(arr_in[by0f:by1f, bx0f:bx1f])
    mout = _ink_mask(arr_out[by0f:by1f, bx0f:bx1f])
    removed = float(np.mean((min_ == 1) & (mout == 0) & ring_mask))
    added = float(np.mean((min_ == 0) & (mout == 1) & ring_mask))
    return {
        "std": round(std, 2),
        "residual": round(residual, 4),
        "band_removed": round(removed, 4),
        "band_added": round(added, 4),
    }


def main() -> None:
    src, out, audit = sys.argv[1], sys.argv[2], sys.argv[3]
    mode = RedactMode(sys.argv[4]) if len(sys.argv) > 4 else RedactMode.ERASE
    arr_in, w, h = _render(src)
    arr_out, _, _ = _render(out)
    data = json.loads(Path(audit).read_text(encoding="utf-8"))
    fails = []
    for i, rb in enumerate(data["boxes"]):
        if rb["page"] != 0:
            continue
        if not rb.get("boxed"):
            continue
        r = _check_box(arr_in, arr_out, rb["box"], mode)
        ok = (
            r.get("std", 99) < 60
            and r.get("residual", 1) < RESIDUAL_RATIO
            and r.get("band_removed", 1) < BAND_INK_DELTA
            and r.get("band_added", 1) < BAND_INK_DELTA
        )
        status = "PASS" if ok else "FAIL"
        if not ok:
            fails.append((i, r))
        print(f"[{status}] box#{i} {r}")
    print(f"RESULT: {'PASS' if not fails else 'FAIL n=' + str(len(fails))}")


if __name__ == "__main__":
    main()