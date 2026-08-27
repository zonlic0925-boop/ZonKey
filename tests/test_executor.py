"""抹除执行单元测试：命名规则、两阶段抹除、模式切换、页号校验。"""

from __future__ import annotations

import cv2
import fitz
import numpy as np
import pytest

from core.errors import RedactError
from core.model import Box, RedactBox, RedactMode
from core.redact.executor import output_path_for, redact_pdf


@pytest.fixture
def synthetic_pdf(tmp_path) -> str:
    """一页合成图纸：格线单元格 + 敏感文字 + 单元格内图片。"""
    path = tmp_path / "synthetic.pdf"
    doc = fitz.open()
    page = doc.new_page(width=400, height=400)
    # 格线（矢量线画，应被保留）
    page.draw_line((100, 100), (300, 100))
    page.draw_line((100, 200), (300, 200))
    page.draw_line((100, 100), (100, 200))
    page.draw_line((300, 100), (300, 200))
    # 单元格内敏感文字
    page.insert_text((110, 140), "CONFIDENTIAL CORP", fontname="helv", fontsize=12)
    # 单元格内图片（40x20 灰块）
    arr = np.full((20, 40, 3), 200, dtype=np.uint8)
    arr[:5, :, :] = 0
    ok, buf = cv2.imencode(".png", arr)
    assert ok
    page.insert_image(fitz.Rect(120, 155, 160, 175), stream=buf.tobytes())
    doc.save(str(path), garbage=3, deflate=True)
    doc.close()
    return str(path)


def _cell_box() -> RedactBox:
    return RedactBox(
        page_index=0,
        box=Box(100, 100, 300, 200),
        boxed=True,
        manual_required=False,
        terms=["CONFIDENTIAL CORP"],
        channel_labels=["vector_text"],
    )


def test_output_path_for_suffix() -> None:
    assert output_path_for("AA01_1K4168_A.pdf") == "AA01_1K4168_A_desensitized.pdf"
    assert (
        output_path_for("D:\\drawings\\AA01_1K4168_A.pdf")
        == "D:\\drawings\\AA01_1K4168_A_desensitized.pdf"
    )
    assert (
        output_path_for("Testing Drawings\\GK11040_B.pdf")
        == "Testing Drawings\\GK11040_B_desensitized.pdf"
    )


def test_erase_mode_removes_text_keeps_line_art(synthetic_pdf: str, tmp_path) -> None:
    out = str(tmp_path / "out.pdf")
    redact_pdf(synthetic_pdf, [_cell_box()], RedactMode.ERASE, out)
    doc = fitz.open(out)
    text = "".join(p.get_text() for p in doc)
    assert "CONFIDENTIAL" not in text
    assert "CORP" not in text
    # 格线保留
    drawings = doc[0].get_drawings()
    assert len(drawings) >= 4
    doc.close()


def test_cover_mode_paints_black(synthetic_pdf: str, tmp_path) -> None:
    out = str(tmp_path / "out_cover.pdf")
    redact_pdf(synthetic_pdf, [_cell_box()], RedactMode.COVER, out)
    doc = fitz.open(out)
    pix = doc[0].get_pixmap(dpi=72)
    # 单元格中心应渲染为黑色（COVER 填充）
    x = int((200 / 400) * pix.width)
    y = int((150 / 400) * pix.height)
    r, g, b = pix.pixel(x, y)[:3]
    assert (r, g, b) == (0, 0, 0)
    doc.close()


def test_image_pixelated_after_erase(synthetic_pdf: str, tmp_path) -> None:
    out = str(tmp_path / "out_img.pdf")
    redact_pdf(synthetic_pdf, [_cell_box()], RedactMode.ERASE, out)
    doc = fitz.open(out)
    pix = doc[0].get_pixmap(dpi=72)
    # 原图片区域 (120,155)-(160,175)：删除后应近乎纯白（像素化抹除）
    x0 = int((120 / 400) * pix.width)
    y0 = int((155 / 400) * pix.height)
    x1 = int((160 / 400) * pix.width)
    y1 = int((175 / 400) * pix.height)
    samples = [pix.pixel(x, y)[:3] for x in range(x0, x1, 2) for y in range(y0, y1, 2)]
    assert samples
    assert all(c == (255, 255, 255) for c in samples)
    doc.close()


def test_page_index_out_of_range_raises(synthetic_pdf: str, tmp_path) -> None:
    out = str(tmp_path / "out_bad.pdf")
    bad = RedactBox(page_index=99, box=Box(0, 0, 10, 10), boxed=True, manual_required=False)
    with pytest.raises(RedactError):
        redact_pdf(synthetic_pdf, [bad], RedactMode.ERASE, out)


def test_source_file_missing_raises(tmp_path) -> None:
    with pytest.raises(RedactError):
        redact_pdf(str(tmp_path / "missing.pdf"), [_cell_box()], RedactMode.ERASE)


def test_empty_box_list_returns_output(synthetic_pdf: str, tmp_path) -> None:
    out = str(tmp_path / "out_empty.pdf")
    redact_pdf(synthetic_pdf, [], RedactMode.ERASE, out)
    doc = fitz.open(out)
    assert "CONFIDENTIAL CORP" in doc[0].get_text()
    doc.close()