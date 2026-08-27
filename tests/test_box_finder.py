"""框线归位单元测试：网格 snap 归位、断线段合并、无框 FALLBACK。"""

from __future__ import annotations

import fitz
import numpy as np
import pytest

from core.boxing.box_finder import BoxFinder, FALLBACK_PADDING, SNAP_TOL
from core.detector.fusion import MergedHit, fuse_page
from core.model import Box, Channel, SensitiveHit


def _make_page(*, width: float = 400.0, height: float = 400.0) -> tuple[fitz.Document, fitz.Page]:
    doc = fitz.open()
    page = doc.new_page(width=width, height=height)
    return doc, page


def _draw_cell(page: fitz.Page, x0: float, y0: float, x1: float, y1: float) -> None:
    page.draw_line((x0, y0), (x1, y0))
    page.draw_line((x0, y1), (x1, y1))
    page.draw_line((x0, y0), (x0, y1))
    page.draw_line((x1, y0), (x1, y1))


def _draw_cell_shattered(page: fitz.Page, x0: float, y0: float, x1: float, y1: float) -> None:
    """每边拆成 3 段短线，验证共线聚类 + 区间合并。"""
    xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
    segments_h = [(x0, xm), (xm, x1)]
    segments_v = [(y0, ym), (ym, y1)]
    for sx0, sx1 in segments_h:
        page.draw_line((sx0, y0), (sx1, y0))
        page.draw_line((sx0, y1), (sx1, y1))
    for sy0, sy1 in segments_v:
        page.draw_line((x0, sy0), (x0, sy1))
        page.draw_line((x1, sy0), (x1, sy1))


def _hit(x0: float, y0: float, x1: float, y1: float) -> SensitiveHit:
    return SensitiveHit(
        page_index=0,
        channel=Channel.VECTOR_TEXT,
        source_box=Box(x0, y0, x1, y1),
        text="CONFIDENTIAL",
        matched_terms=["CONFIDENTIAL"],
    )


def test_snap_to_enclosed_cell() -> None:
    doc, page = _make_page()
    _draw_cell(page, 100, 100, 200, 150)
    text_box = Box(105, 106, 195, 140)
    merged = fuse_page([_hit(*text_box.as_tuple())])
    results = BoxFinder().assign(page, merged)
    doc.close()
    assert len(results) == 1
    rb = results[0]
    assert rb.boxed is True
    assert rb.manual_required is False
    assert abs(rb.box.x0 - 100) <= SNAP_TOL
    assert abs(rb.box.y0 - 100) <= SNAP_TOL
    assert abs(rb.box.x1 - 200) <= SNAP_TOL
    assert abs(rb.box.y1 - 150) <= SNAP_TOL


def test_snap_with_shattered_lines() -> None:
    doc, page = _make_page()
    _draw_cell_shattered(page, 100, 100, 200, 150)
    text_box = Box(105, 106, 195, 140)
    merged = fuse_page([_hit(*text_box.as_tuple())])
    results = BoxFinder().assign(page, merged)
    doc.close()
    assert len(results) == 1
    assert results[0].boxed is True
    assert results[0].manual_required is False


def test_fallback_when_no_enclosing_cell() -> None:
    doc, page = _make_page()
    text_box = Box(105, 106, 195, 140)
    merged = fuse_page([_hit(*text_box.as_tuple())])
    results = BoxFinder().assign(page, merged)
    doc.close()
    assert len(results) == 1
    rb = results[0]
    assert rb.boxed is False
    assert rb.manual_required is True
    assert rb.box == Box(105 - FALLBACK_PADDING, 106 - FALLBACK_PADDING, 195 + FALLBACK_PADDING, 140 + FALLBACK_PADDING)


def test_no_upward_snap_outside_local_radius() -> None:
    doc, page = _make_page()
    _draw_cell(page, 100, 100, 200, 150)
    # 文字离格线超过 LOCAL_RADIUS(150)，不归位
    text_box = Box(105, 300, 195, 330)
    merged = fuse_page([_hit(*text_box.as_tuple())])
    results = BoxFinder().assign(page, merged)
    doc.close()
    assert results[0].boxed is False
    assert results[0].manual_required is True


def test_assign_keeps_hit_metadata() -> None:
    doc, page = _make_page()
    _draw_cell(page, 100, 100, 200, 150)
    hit = _hit(105, 106, 195, 140)
    merged = fuse_page([hit])
    results = BoxFinder().assign(page, merged)
    doc.close()
    rb = results[0]
    assert rb.hit_ids == [hit.hit_id]
    assert rb.channel_labels == ["vector_text"]
    assert rb.terms == ["CONFIDENTIAL"]


def test_assign_empty_returns_empty() -> None:
    doc, page = _make_page()
    assert BoxFinder().assign(page, []) == []
    doc.close()


def test_manual_merged_hit_roundtrip() -> None:
    doc, page = _make_page()
    _draw_cell(page, 100, 100, 200, 150)
    hit = _hit(105, 106, 195, 140)
    merged = [MergedHit(box=hit.source_box, hits=[hit])]
    results = BoxFinder().assign(page, merged)
    doc.close()
    assert results[0].boxed is True


# ---------- 栅格框线检测（D4：纯栅格扫描图） ----------


def _raster_bw_with_box() -> "np.ndarray":
    """合成二值图：白底反色前景（框线为 255），150dpi 下对应 (100,100)-(300,200)pt 方框。"""
    import numpy as np

    zoom = 150 / 72.0
    bw = np.zeros((500, 800), dtype=np.uint8)
    x0, y0, x1, y1 = (int(v * zoom) for v in (100, 100, 300, 200))
    bw[y0 - 1 : y0 + 2, x0 : x1 + 1] = 255
    bw[y1 - 1 : y1 + 2, x0 : x1 + 1] = 255
    bw[y0 : y1 + 1, x0 - 1 : x0 + 2] = 255
    bw[y0 : y1 + 1, x1 - 1 : x1 + 2] = 255
    return bw


def test_snap_raster_box_encloses_hit() -> None:
    import numpy as np

    bw = _raster_bw_with_box()
    hit = Box(150, 120, 250, 180)
    rbox = BoxFinder()._snap_raster_box(bw, hit, 1200.0)
    assert rbox is not None
    assert abs(rbox.x0 - 100) <= 1.5
    assert abs(rbox.y0 - 100) <= 1.5
    assert abs(rbox.x1 - 300) <= 1.5
    assert abs(rbox.y1 - 200) <= 1.5


def test_snap_raster_box_no_box_returns_none() -> None:
    import numpy as np

    bw = np.zeros((500, 800), dtype=np.uint8)
    hit = Box(150, 120, 250, 180)
    assert BoxFinder()._snap_raster_box(bw, hit, 1200.0) is None


def test_assign_raster_only_page_boxes_to_cell() -> None:
    """页面无任何矢量格线，只有图片内含方框 → 栅格检测归位自动执行。"""
    import cv2

    doc = fitz.open()
    page = doc.new_page(width=600, height=400)
    img = 255 * np.ones((200, 400, 3), dtype=np.uint8)
    cv2.rectangle(img, (60, 50), (340, 150), (0, 0, 0), 1)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    page.insert_image(fitz.Rect(100, 100, 500, 300), stream=buf.tobytes())
    # D4 真实场景：扫描图文字由 OCR 命中，框线是栅格像素
    ocr_hit = SensitiveHit(
        page_index=0,
        channel=Channel.OCR,
        source_box=Box(290, 195, 310, 205),
        text="CONFIDENTIAL",
        matched_terms=["CONFIDENTIAL"],
        confidence=0.95,
    )
    merged = fuse_page([ocr_hit])
    results = BoxFinder().assign(page, merged)
    doc.close()
    assert len(results) == 1
    rb = results[0]
    assert rb.boxed is True
    assert rb.manual_required is False
    assert abs(rb.box.x0 - 160) <= 2
    assert abs(rb.box.y0 - 150) <= 2
    assert abs(rb.box.x1 - 440) <= 2
    assert abs(rb.box.y1 - 250) <= 2