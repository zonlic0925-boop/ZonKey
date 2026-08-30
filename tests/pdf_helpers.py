"""测试用合成 PDF 构造与断言工具（Phase M 去 AGPL）。

以 reportlab（BSD）构造样本、pdfplumber（MIT）/pypdfium2（Apache-2.0）断言，
替代迁移前测试对 fitz 的依赖。

坐标合同：构造参数一律使用「显示空间」——原点左上、y 向下，与
core.model.Box 及迁移前 fitz 的 draw_line/insert_text/insert_image 语义一致；
内部换算为 reportlab 的用户空间（左下原点、y 向上）。
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import Sequence

import numpy as np


def make_pdf(
    path: str | Path,
    *,
    width: float = 400,
    height: float = 400,
    lines: Sequence[tuple[float, float, float, float]] = (),
    texts: Sequence[tuple] = (),
    images: Sequence[tuple] = (),
    form_fields: Sequence[tuple] = (),
    register_cjk: bool = False,
) -> Path:
    """构造单页 PDF。

    lines:  ((x0, y0, x1, y1),)  显示空间线段（格线语义，stroke line）
    texts:  ((x, y_baseline, s[, size[, font]]),)  显示空间基线点文字
    images: ((x0, y0, x1, y1, PIL.Image | np.ndarray),)  显示空间矩形贴图
    form_fields: ((name, x0, y0, x1, y1, value),)  AcroForm 文本控件
    """
    from PIL import Image
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas

    if register_cjk and "MSyh" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("MSyh", r"C:\Windows\Fonts\msyh.ttc", subfontIndex=0))

    c = canvas.Canvas(str(path), pagesize=(width, height))
    for x0, y0, x1, y1 in lines:
        c.line(x0, height - y0, x1, height - y1)
    for item in texts:
        x, y, s = item[0], item[1], item[2]
        size = item[3] if len(item) > 3 else 12
        font = item[4] if len(item) > 4 else "Helvetica"
        c.setFont(font, size)
        c.drawString(x, height - y, s)
    for x0, y0, x1, y1, img in images:
        if not isinstance(img, Image.Image):
            img = Image.fromarray(img)
        c.drawImage(ImageReader(img), x0, height - y1, width=x1 - x0, height=y1 - y0)
    for name, x0, y0, x1, y1, value in form_fields:
        c.acroForm.textfield(
            name=name,
            x=x0,
            y=height - y1,
            width=x1 - x0,
            height=y1 - y0,
            value=value,
            borderWidth=0,
            forceBorder=False,
        )
    c.showPage()
    c.save()
    return Path(path)


def open_view(path: str | Path):
    from core.pdfio import PdfDocView

    return PdfDocView(path)


def page_size(path: str | Path, page: int = 0) -> tuple[float, float]:
    with open_view(path) as view:
        rect = view.page(page).rect
        return rect.width, rect.height


def extract_text(path: str | Path, page: int | None = None) -> str:
    """pdfplumber 全文提取（page=None 时合并全部页）。"""
    import pdfplumber

    with pdfplumber.open(str(path)) as pdf:
        if page is not None:
            return pdf.pages[page].extract_text() or ""
        return "\n".join(p.extract_text() or "" for p in pdf.pages)


def count_vector_lines(path: str | Path, page: int = 0) -> int:
    """stroke 线段计数（格线保留断言用，等价迁移前 get_drawings 的 l 项计数）。"""
    import pdfplumber

    with pdfplumber.open(str(path)) as pdf:
        pg = pdf.pages[page]
        segs = len(pg.lines)
        for cv in pg.curves:
            pts = cv.get("pts") or []
            segs += max(0, len(pts) - 1)
        return segs


def count_widgets(path: str | Path) -> int:
    """AcroForm 控件计数（表单清除断言用）。"""
    import pikepdf

    with pikepdf.open(str(path)) as pdf:
        total = 0
        for page in pdf.pages:
            annots = page.get("/Annots")
            if annots is None:
                continue
            for annot in annots:
                try:
                    if str(annot.get("/Subtype") or "") == "/Widget":
                        total += 1
                except Exception:  # noqa: BLE001
                    continue
        return total


def render_pil(path: str | Path, page: int = 0, scale: float = 1.0):
    """pypdfium2 渲染为 PIL RGB（y 向下像素，与迁移前 fitz get_pixmap 一致）。"""
    import pypdfium2 as pdfium

    doc = pdfium.PdfDocument(str(path))
    try:
        return doc[page].render(scale=scale).to_pil().convert("RGB")
    finally:
        doc.close()


def render_gray(path: str | Path, page: int = 0, scale: float = 1.0) -> np.ndarray:
    from PIL import Image

    pil = render_pil(path, page, scale)
    return np.asarray(pil.convert("L"))


def cell_lines(x0: float, y0: float, x1: float, y1: float):
    """矩形格线四边（显示空间）。"""
    return [
        (x0, y0, x1, y0),
        (x0, y1, x1, y1),
        (x0, y0, x0, y1),
        (x1, y0, x1, y1),
    ]


def shattered_cell_lines(x0: float, y0: float, x1: float, y1: float):
    """每边拆成 2 段短线（共线聚类 + 区间合并验证用）。"""
    xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
    out = []
    for sx0, sx1 in ((x0, xm), (xm, x1)):
        out.append((sx0, y0, sx1, y0))
        out.append((sx0, y1, sx1, y1))
    for sy0, sy1 in ((y0, ym), (ym, y1)):
        out.append((x0, sy0, x0, sy1))
        out.append((x1, sy0, x1, sy1))
    return out
