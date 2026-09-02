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


# ---------------------------------------------------------------------------
# CCITT G4 扫描图 PDF（工程图纸扫描件语义：整页 1 位传真图 + CCITTFaxDecode）
# ---------------------------------------------------------------------------


def _ccitt_strip_from_g4_tiff(tiff_bytes: bytes) -> tuple[bytes, int, int]:
    """从 PIL 生成的单条带 G4 TIFF 提取 CCITT 原始码流与宽高。"""
    import struct

    bo = ">" if tiff_bytes[:2] == b"MM" else "<"
    ifd_off = struct.unpack(bo + "I", tiff_bytes[4:8])[0]
    (n_tags,) = struct.unpack(bo + "H", tiff_bytes[ifd_off : ifd_off + 2])
    tags: dict[int, tuple[int, int]] = {}
    for i in range(n_tags):
        entry = ifd_off + 2 + 12 * i
        tag, typ, count = struct.unpack(bo + "HHI", tiff_bytes[entry : entry + 8])
        if typ == 3:  # SHORT
            (val,) = struct.unpack(bo + "H", tiff_bytes[entry + 8 : entry + 10])
        elif typ == 4:  # LONG
            (val,) = struct.unpack(bo + "I", tiff_bytes[entry + 8 : entry + 12])
        else:
            continue
        tags[tag] = (count, val)
    # 测试图很小，PIL 必然单条带；多条带说明断言前提失效，直接失败
    assert tags[273][0] == 1 and tags[279][0] == 1, "expected single-strip G4 TIFF"
    offset, length = tags[273][1], tags[279][1]
    return tiff_bytes[offset : offset + length], tags[256][1], tags[257][1]


def make_ccitt_scan_pdf(
    path: str | Path,
    *,
    width: int = 200,
    height: int = 100,
    dark_rect: tuple[float, float, float, float] = (60, 25, 140, 75),
) -> Path:
    """构造整页 CCITTFaxDecode 1 位扫描 PDF：白底 + dark_rect 深色块（敏感内容语义）。

    pikepdf 对 CCITT 图像走 TIFF 包装解码（返回 TiffImageFile）——
    像素化回写路径的专属回归样本，普通 Flate RGB 图触发不了该分支。

    极性陷阱（round-8 教训）：PIL mode "1" 是 0=黑，而 G4 TIFF 按 min-is-white
    （0=白）编码，存盘时位流整体翻转。若按直觉填 PIL 白底(1)+黑块(0)，嵌入 PDF
    （BlackIs1=False，0=黑）后渲染成黑底白块，还会反过来诱导引擎「补偿反转」、
    把真实扫描件整页变黑。这里按「编码后位流 = PDF 约定白底」填 PIL 0 底 + 1 矩形，
    使 PDF 渲染与真实扫描件一致（白底黑块，样本 1=白）。
    """
    import io

    import pikepdf
    from PIL import Image, ImageDraw
    from pikepdf import Name

    buf = io.BytesIO()
    # PIL 0(黑) 经 G4 min-is-white 编码为位 1 → PDF 1=白：背景渲染为白
    img = Image.new("1", (width, height), 0)
    # PIL 1(白) 编码为位 0 → PDF 0=黑：矩形渲染为黑（敏感内容）
    ImageDraw.Draw(img).rectangle(dark_rect, fill=1)
    img.save(buf, format="TIFF", compression="group4")
    strip, cols, rows = _ccitt_strip_from_g4_tiff(buf.getvalue())

    pdf = pikepdf.new()
    pdf.add_blank_page(page_size=(width, height))
    page = pdf.pages[0]
    im = pdf.make_stream(strip)
    im.Type = Name.XObject
    im.Subtype = Name.Image
    im.Width = cols
    im.Height = rows
    im.ColorSpace = Name.DeviceGray
    im.BitsPerComponent = 1
    im.Filter = Name.CCITTFaxDecode
    im.DecodeParms = pikepdf.Dictionary(K=-1, Columns=cols, Rows=rows, BlackIs1=False)
    page.Resources = pikepdf.Dictionary(XObject=pikepdf.Dictionary(Im0=im))
    page.Contents = pdf.make_stream(f"q {width} 0 0 {height} 0 0 cm /Im0 Do Q".encode())
    pdf.save(str(path))
    return Path(path)
