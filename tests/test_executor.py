"""抹除执行单元测试：命名规则、真删除抹除、模式切换、页号校验。"""

from __future__ import annotations

import numpy as np
import pytest

from core.errors import RedactError
from core.model import Box, RedactBox, RedactMode
from core.redact.executor import output_path_for, redact_pdf
from pdf_helpers import (
    cell_lines,
    count_vector_lines,
    extract_text,
    make_ccitt_scan_pdf,
    make_pdf,
    render_pil,
)


@pytest.fixture
def synthetic_pdf(tmp_path) -> str:
    """一页合成图纸：格线单元格 + 敏感文字 + 单元格内图片。"""
    path = tmp_path / "synthetic.pdf"
    img = np.full((20, 40, 3), 200, dtype=np.uint8)
    img[:5, :, :] = 0
    make_pdf(
        path,
        width=400,
        height=400,
        lines=cell_lines(100, 100, 300, 200),
        texts=[(110, 140, "CONFIDENTIAL CORP", 12)],
        images=[(120, 155, 160, 175, img)],
    )
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
    text = extract_text(out)
    assert "CONFIDENTIAL" not in text
    assert "CORP" not in text
    # 格线保留
    assert count_vector_lines(out) >= 4


def test_cover_mode_paints_black(synthetic_pdf: str, tmp_path) -> None:
    out = str(tmp_path / "out_cover.pdf")
    redact_pdf(synthetic_pdf, [_cell_box()], RedactMode.COVER, out)
    pil = render_pil(out, scale=1.0)
    # 单元格中心应渲染为黑色（COVER 填充）
    r, g, b = pil.getpixel((200, 150))
    assert (r, g, b) == (0, 0, 0)


def test_image_pixelated_after_erase(synthetic_pdf: str, tmp_path) -> None:
    out = str(tmp_path / "out_img.pdf")
    redact_pdf(synthetic_pdf, [_cell_box()], RedactMode.ERASE, out)
    pil = render_pil(out, scale=1.0)
    # 原图片区域 (120,155)-(160,175)：删除后应近乎纯白（像素化抹除）
    samples = [pil.getpixel((x, y)) for x in range(120, 160, 2) for y in range(155, 175, 2)]
    assert samples
    assert all(c == (255, 255, 255) for c in samples)


def test_ccitt_scan_pixelated_after_erase(tmp_path) -> None:
    """CCITT G4 整页扫描图脱敏（回归：TiffImageFile.fromarray 曾使像素化必败）。

    pikepdf 对 CCITTFaxDecode 图像经 TIFF 包装解码，返回 TiffImageFile；
    修复前 _write_image_stream 反转极性时调 pil.__class__.fromarray →
    AttributeError → 「图像像素化失败（拒绝静默保留敏感图像内容）」，
    系统识别与手动框选全部无法执行。"""
    dark = (60, 25, 140, 75)
    src = str(make_ccitt_scan_pdf(tmp_path / "ccitt_scan.pdf", dark_rect=dark))
    out = str(tmp_path / "ccitt_out.pdf")
    box = RedactBox(
        page_index=0,
        box=Box(dark[0] + 2, dark[1] + 2, dark[2] - 2, dark[3] - 2),
        boxed=True,
        manual_required=False,
        terms=["MANUAL"],
        channel_labels=["manual"],
    )
    redact_pdf(src, [box], RedactMode.ERASE, out)
    pil = render_pil(out, scale=1.0)
    # 深色矩形内部应被像素化填充为背景白，不再保留敏感内容
    samples = [pil.getpixel((x, y)) for x in range(66, 134, 4) for y in range(31, 69, 4)]
    assert samples
    assert all(c >= (240, 240, 240) for c in samples)


def test_write_image_stream_accepts_tiff_image_file() -> None:
    """单测：CCITT 源极性反转必须用模块级 Image.fromarray（TiffImageFile 无此方法）。"""
    import io

    from PIL import Image

    from core.redact.pikepdf_engine import _write_image_stream

    buf = io.BytesIO()
    Image.new("1", (32, 16), 1).save(buf, format="TIFF", compression="group4")
    buf.seek(0)
    pil = Image.open(buf)
    assert pil.__class__.__name__ == "TiffImageFile", "前提：G4 TIFF 解出 TiffImageFile"

    class _StreamStub:
        def __init__(self) -> None:
            object.__setattr__(self, "data", b"")
            object.__setattr__(self, "kv", {})

        def write(self, chunk: bytes) -> None:
            object.__setattr__(self, "data", chunk)

        def __setattr__(self, key: str, value) -> None:
            self.kv[key] = value

        def __contains__(self, key: str) -> bool:
            return key in self.kv

        def __delattr__(self, key: str) -> None:
            self.kv.pop(key, None)

        def __delitem__(self, key: str) -> None:
            self.kv.pop(key, None)

    stub = _StreamStub()
    _write_image_stream(stub, pil, is_mask=False, source_filter="CCITTFaxDecode")
    assert stub.data, "应回写出 Flate 1bpp 样本"


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
    assert "CONFIDENTIAL CORP" in extract_text(out)
