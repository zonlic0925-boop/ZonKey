"""脱敏执行应使用前端传入的 box_overrides 坐标，而非仅依赖扫描缓存。"""

from __future__ import annotations

from server_bridge import (
    ManualBoxInput,
    SCAN_CANDIDATES_CACHE,
    _build_redact_boxes_from_selection,
)


def test_build_redact_boxes_prefers_overrides():
    file_id = "test-file-001"
    cid = f"{file_id}_0_0"
    SCAN_CANDIDATES_CACHE[file_id] = [
        {
            "id": cid,
            "page_index": 0,
            "x": 10.0,
            "y": 20.0,
            "width": 100.0,
            "height": 50.0,
            "text": "CONFIDENTIAL",
        }
    ]
    overrides = [
        ManualBoxInput(id=cid, page_index=0, x=30.0, y=40.0, width=80.0, height=60.0),
    ]

    boxes = _build_redact_boxes_from_selection(file_id, {cid}, overrides)
    assert len(boxes) == 1
    rb = boxes[0]
    assert rb.page_index == 0
    assert rb.box.x0 == 30.0
    assert rb.box.y0 == 40.0
    assert rb.box.x1 == 110.0
    assert rb.box.y1 == 100.0

    cached = SCAN_CANDIDATES_CACHE[file_id][0]
    assert cached["x"] == 30.0
    assert cached["y"] == 40.0
    assert cached["width"] == 80.0
    assert cached["height"] == 60.0

    SCAN_CANDIDATES_CACHE.pop(file_id, None)


def test_apply_overrides_adds_manual_box():
    file_id = "test-file-manual"
    SCAN_CANDIDATES_CACHE[file_id] = []
    manual_id = "manual_123"
    overrides = [
        ManualBoxInput(id=manual_id, page_index=1, x=5.0, y=6.0, width=40.0, height=20.0),
    ]
    _build_redact_boxes_from_selection(file_id, {manual_id}, overrides)
    boxes = _build_redact_boxes_from_selection(file_id, {manual_id}, overrides)
    assert len(boxes) == 1
    assert boxes[0].box.x0 == 5.0
    assert boxes[0].page_index == 1
    SCAN_CANDIDATES_CACHE.pop(file_id, None)


def test_build_redact_boxes_uses_override_matched_terms_when_cache_empty():
    """后端重启后扫描缓存丢失：前端须随 box_overrides 带上 matched_terms。"""
    file_id = "test-file-terms-only"
    SCAN_CANDIDATES_CACHE[file_id] = []
    cid = f"{file_id}_0_0"
    overrides = [
        ManualBoxInput(
            id=cid,
            page_index=0,
            x=10.0,
            y=10.0,
            width=50.0,
            height=20.0,
            matched_terms=["F764486(4)"],
        ),
    ]
    boxes = _build_redact_boxes_from_selection(file_id, {cid}, overrides)
    assert len(boxes) == 1
    assert boxes[0].terms == ["F764486(4)"]
    SCAN_CANDIDATES_CACHE.pop(file_id, None)
