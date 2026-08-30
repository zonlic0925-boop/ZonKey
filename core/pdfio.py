"""PDF I/O 适配层（Phase M：PyMuPDF 退出迁移）。

以三个宽松许可库替代 fitz(AGPL) 的读取面：
- 渲染栅格化：pypdfium2（Apache-2.0）
- 文本/矢量/图片坐标抽取：pdfplumber（pdfminer.six，MIT）
- 页面几何/旋转：pypdfium2

坐标合同（全库统一）：对外一律使用 fitz 兼容的「显示页面空间」——
原点左上、y 轴向下、单位 pt、随 /Rotate 旋转（与 PyMuPDF Page.rect /
get_text / get_drawings 语义一致）。pdfplumber 的坐标本就是显示空间
（已实测验证 /Rotate=90 行为），故抽取层无需换算；仅在渲染裁剪与
写入层（pikepdf 用户空间）做显示空间 ↔ 用户空间映射。
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from core.model import Box

logger = logging.getLogger(__name__)


class PdfOpenError(Exception):
    """PDF 无法解析（替换 fitz.open 的异常语义，调用方按需转 FileOpenError）。"""


@dataclass(frozen=True)
class _PageRect:
    """fitz page.rect 的最小替身：width/height（显示空间尺寸）。"""

    width: float
    height: float


@dataclass(frozen=True)
class SpanInfo:
    text: str
    box: Box
    font: str
    size: float


@dataclass(frozen=True)
class ImageInfo:
    box: Box
    pixel_size: tuple[int, int]


def user_to_display(x: float, y: float, w_u: float, h_u: float, rotation: int) -> tuple[float, float]:
    """PDF 用户空间（左下原点、y 向上）→ 显示空间（左上原点、y 向下）。

    rotation 取自页面 /Rotate（0/90/180/270，顺时针显示旋转）。
    """
    rotation %= 360
    if rotation == 90:
        return y, x
    if rotation == 180:
        return w_u - x, y
    if rotation == 270:
        return h_u - y, w_u - x
    return x, h_u - y


def display_to_user(x_v: float, y_v: float, w_u: float, h_u: float, rotation: int) -> tuple[float, float]:
    """显示空间 → 用户空间（user_to_display 的逆映射）。"""
    rotation %= 360
    if rotation == 90:
        return y_v, x_v
    if rotation == 180:
        return w_u - x_v, y_v
    if rotation == 270:
        return w_u - y_v, x_v
    return x_v, h_u - y_v


def display_rect_to_user(rect: Box, w_u: float, h_u: float, rotation: int) -> Box:
    """显示空间矩形 → 用户空间矩形（角点映射后取包围盒，y 向上）。"""
    xs: list[float] = []
    ys: list[float] = []
    for xv, yv in ((rect.x0, rect.y0), (rect.x1, rect.y1)):
        xu, yu = display_to_user(xv, yv, w_u, h_u, rotation)
        xs.append(xu)
        ys.append(yu)
    return Box(min(xs), min(ys), max(xs), max(ys))


class PdfPageView:
    """单页只读视图：文本 span / 图片 / 矢量线段 / 栅格渲染。"""

    def __init__(self, plumber_page: Any, pdfium_page: Any, index: int):
        self.index = index
        self._pp = plumber_page
        self._pdfium_page = pdfium_page
        self.rotation = int(getattr(plumber_page, "rotation", 0) or 0) % 360
        self.rect = _PageRect(float(plumber_page.width), float(plumber_page.height))

    # ---------- 文本 ----------

    def spans(self, *, include_whitespace: bool = False) -> list[SpanInfo]:
        """fitz get_text("dict") span 等价物：连续同字体同字号同行字符聚合。

        行判定：字符 top 接近（相对字号 0.3 容差）；列间大空隙补一个空格
        （与 fitz 行内空白语义一致，保证词表短语可跨空隙命中）。
        """
        out: list[SpanInfo] = []
        cur_text: list[str] = []
        cur_font = ""
        cur_size = 0.0
        cur_top = 0.0
        cur_x0 = cur_y0 = cur_x1 = cur_y1 = 0.0
        last_x1 = 0.0

        def flush() -> None:
            nonlocal cur_text
            text = "".join(cur_text)
            if text.strip():
                out.append(
                    SpanInfo(
                        text=text,
                        box=Box(cur_x0, cur_y0, cur_x1, cur_y1),
                        font=cur_font,
                        size=cur_size,
                    )
                )
            cur_text = []

        for ch in self._pp.chars:
            t = ch.get("text") or ""
            if not t:
                continue
            size = float(ch.get("size") or 0.0)
            font = str(ch.get("fontname") or "")
            top = float(ch.get("top") or 0.0)
            x0 = float(ch.get("x0") or 0.0)
            x1 = float(ch.get("x1") or 0.0)
            bottom = float(ch.get("bottom") or 0.0)
            same_line = (
                cur_text
                and font == cur_font
                and abs(size - cur_size) <= 0.05
                and abs(top - cur_top) <= max(0.3 * max(size, cur_size), 0.5)
            )
            if not same_line:
                flush()
                cur_font, cur_size, cur_top = font, size, top
                cur_x0, cur_y0, cur_x1, cur_y1 = x0, top, x1, bottom
                cur_text = [t]
            else:
                if x0 - last_x1 > 0.25 * max(size, 1.0) and cur_text and not cur_text[-1].isspace() and not t.isspace():
                    cur_text.append(" ")
                cur_text.append(t)
                cur_x0 = min(cur_x0, x0)
                cur_y0 = min(cur_y0, top)
                cur_x1 = max(cur_x1, x1)
                cur_y1 = max(cur_y1, bottom)
            last_x1 = x1
        flush()
        if not include_whitespace:
            out = [s for s in out if s.text.strip()]
        return out

    def page_text(self) -> str:
        try:
            return self._pp.extract_text() or ""
        except Exception as exc:  # noqa: BLE001
            logger.warning("page_text 提取失败（页 %d）: %s", self.index, exc)
            return ""

    def search(self, needle: str, *, ignore_case: bool = True) -> list[Box]:
        """fitz Page.search_for 等价：大小写不敏感、忽略空白差异，返回每处命中的包围盒。

        匹配限制在同一行内（top 容差 = 2×字号），跨行命中拆不出来时不返回
        （doc 管线的 regex 命中兜底会另行展开）。
        """
        needle = (needle or "").strip()
        if not needle:
            return []
        chars = [c for c in self._pp.chars if (c.get("text") or "") and not (c.get("text") or "").isspace()]
        if not chars:
            return []
        hay = "".join((c.get("text") or "") for c in chars)
        if ignore_case:
            hay = hay.lower()
            pat = needle.lower()
        else:
            pat = needle
        pat_compact = "".join(pat.split())
        if not pat_compact:
            return []
        idx_map = [i for i, c in enumerate(hay) if not c.isspace()]
        compact = "".join(hay[i] for i in idx_map)
        results: list[Box] = []
        start = 0
        while True:
            pos = compact.find(pat_compact, start)
            if pos < 0:
                break
            start = pos + 1
            i0 = idx_map[pos]
            i1 = idx_map[pos + len(pat_compact) - 1]
            seg = chars[i0 : i1 + 1]
            tops = [float(c["top"]) for c in seg]
            if max(tops) - min(tops) > 2.0 * max(float(c.get("size") or 0) for c in seg) + 1.0:
                continue  # 跨行命中不聚成一个大框
            x0 = min(float(c["x0"]) for c in seg)
            x1 = max(float(c["x1"]) for c in seg)
            y0 = min(tops)
            y1 = max(float(c["bottom"]) for c in seg)
            results.append(Box(x0, y0, x1, y1))
        return results

    # ---------- 图片 / 矢量 ----------

    def images(self) -> list[ImageInfo]:
        out: list[ImageInfo] = []
        for img in self._pp.images:
            try:
                box = Box(float(img["x0"]), float(img["top"]), float(img["x1"]), float(img["bottom"]))
                src = img.get("srcsize") or (0, 0)
                out.append(ImageInfo(box=box, pixel_size=(int(src[0]), int(src[1]))))
            except Exception as exc:  # noqa: BLE001
                logger.debug("image placement 解析失败: %s", exc)
        return out

    def line_segments(self) -> list[tuple[tuple[float, float], tuple[float, float]]]:
        """轴对齐矢量线段（fitz get_drawings 的 "l" 项等价，含多段路径展开）。

        只取 stroke 线段（pdfminer LTLine/LTCurve 的点列）；"re" 矩形与原实现
        行为一致不参与格线提取。坐标为显示空间。
        """
        segs: list[tuple[tuple[float, float], tuple[float, float]]] = []
        for ln in self._pp.lines:
            segs.append(((float(ln["x0"]), float(ln["top"])), (float(ln["x1"]), float(ln["bottom"]))))
        for cv in self._pp.curves:
            pts = cv.get("pts") or []
            for a, b in zip(pts, pts[1:]):
                segs.append(((float(a[0]), float(a[1])), (float(b[0]), float(b[1]))))
        return segs

    # ---------- 渲染 ----------

    def render(
        self,
        *,
        dpi: float | None = None,
        zoom: float | None = None,
        clip: tuple[float, float, float, float] | None = None,
    ):
        """栅格化页面，返回 PIL RGB 图。

        clip 为显示空间 (x0, y0, x1, y1)。pypdfium2 的 crop 是「四边裁剪量」
        (left, bottom, right, top)，点位输入、内部按 scale 转像素、在旋转之后
        的显示位图上应用；换算：left=x0, bottom=H-y1, right=W-x1, top=y0，
        旋转页同样适用（行为与 fitz get_pixmap(clip=) 一致）。
        """
        scale = zoom if zoom is not None else (dpi or 72.0) / 72.0
        if clip is None:
            bitmap = self._pdfium_page.render(scale=scale)
            return bitmap.to_pil().convert("RGB")
        x0, y0, x1, y1 = clip
        w = self.rect.width
        h = self.rect.height
        cx0 = min(max(x0, 0.0), w)
        cy1 = min(max(h - y1, 0.0), h)
        cx1 = min(max(w - x1, 0.0), w)
        cy0 = min(max(y0, 0.0), h)
        crop = (cx0, cy1, cx1, cy0)
        bitmap = self._pdfium_page.render(scale=scale, crop=crop)
        return bitmap.to_pil().convert("RGB")

    def render_np(
        self,
        *,
        dpi: float | None = None,
        zoom: float | None = None,
        clip: tuple[float, float, float, float] | None = None,
    ) -> np.ndarray:
        return np.asarray(self.render(dpi=dpi, zoom=zoom, clip=clip))


class PdfDocView:
    """整份 PDF 只读视图（pdfplumber + pypdfium2 双柄，随 with 关闭）。"""

    def __init__(self, source: str | Path):
        self.path = Path(source)
        import pdfplumber
        import pypdfium2 as pdfium

        self._pikepdf: Any | None = None
        try:
            self._plumber = pdfplumber.open(str(self.path))
        except Exception as exc:  # noqa: BLE001
            raise PdfOpenError(f"PDF 打开失败: {exc}") from exc
        try:
            self._pdfium = pdfium.PdfDocument(str(self.path))
        except Exception as exc:  # noqa: BLE001
            self._plumber.close()
            raise PdfOpenError(f"PDF 打开失败: {exc}") from exc

    def __enter__(self) -> "PdfDocView":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    def close(self) -> None:
        try:
            self._pdfium.close()
        except Exception:  # noqa: BLE001
            pass
        try:
            self._plumber.close()
        except Exception:  # noqa: BLE001
            pass
        if self._pikepdf is not None:
            try:
                self._pikepdf.close()
            except Exception:  # noqa: BLE001
                pass
            self._pikepdf = None

    @property
    def page_count(self) -> int:
        return len(self._plumber.pages)

    def page(self, index: int) -> PdfPageView:
        if index < 0 or index >= self.page_count:
            raise IndexError(f"页号越界: {index} (共 {self.page_count} 页)")
        return PdfPageView(self._plumber.pages[index], self._pdfium[index], index)

    def widget_texts(self, index: int) -> list[tuple[str, Box]]:
        """AcroForm 控件值文本（显示空间矩形）。

        等价能力说明：PyMuPDF 的 get_text/search_for 会提取控件外观流文本，
        pdfminer 不会；可填写公文（签证表等）的字段值须经由此方法参与
        命中检测，否则脱敏后 field_value 仍可被复制。
        """
        import pikepdf

        if self._pikepdf is None:
            self._pikepdf = pikepdf.open(str(self.path))
        page = self._pikepdf.pages[index]
        out: list[tuple[str, Box]] = []
        mb = page.get("/MediaBox")
        vals = [float(v) for v in (mb if mb is not None else [0, 0, 612, 792])]
        w_u = abs(vals[2] - vals[0]) or 612.0
        h_u = abs(vals[3] - vals[1]) or 792.0
        rot = int(page.get("/Rotate") or 0) % 360
        annots = page.get("/Annots")
        if annots is None:
            return out
        for annot in annots:
            try:
                if str(annot.get("/Subtype") or "") != "/Widget":
                    continue
                rect = annot.get("/Rect")
                if rect is None:
                    continue
                rv = [float(v) for v in rect]
                pts = [
                    user_to_display(min(rv[0], rv[2]), min(rv[1], rv[3]), w_u, h_u, rot),
                    user_to_display(max(rv[0], rv[2]), max(rv[1], rv[3]), w_u, h_u, rot),
                ]
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                value = annot.get("/V")
                if value is None:
                    parent = annot.get("/Parent")
                    value = parent.get("/V") if parent is not None else None
                if value is None or isinstance(value, pikepdf.Dictionary):
                    continue
                text = str(value)
                if text.strip():
                    out.append((text, Box(min(xs), min(ys), max(xs), max(ys))))
            except Exception:  # noqa: BLE001
                continue
        return out


def open_doc(source: str | Path) -> PdfDocView:
    return PdfDocView(source)


def page_count(source: str | Path) -> int:
    with PdfDocView(source) as doc:
        return doc.page_count
