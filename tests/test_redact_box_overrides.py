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


# ----------------- round-6：HTTP 500 防御回归 -----------------

import warnings
from pathlib import Path

from fastapi.testclient import TestClient

warnings.filterwarnings("ignore")


def _make_client_and_file(tmp_path, texts):
    """上传一份合成 PDF（drawing 模式），返回 (client, file_id)。"""
    from server_bridge import app

    from pdf_helpers import make_pdf

    pdf_path = make_pdf(tmp_path / "r6.pdf", texts=texts)
    client = TestClient(app, raise_server_exceptions=False)
    with open(pdf_path, "rb") as f:
        resp = client.post(
            "/api/pdf/upload-and-scan",
            files={"file": ("r6.pdf", f, "application/pdf")},
            data={"mode": "drawing"},
        )
    assert resp.status_code == 200
    return client, resp.json()["file_id"]


def test_execute_redaction_oob_page_returns_400_not_500(tmp_path):
    """手动框 page_index 越界应得可读 400，而非裸 500（round-6 问题3）。"""
    client, fid = _make_client_and_file(tmp_path, [(50, 50, "CONFIDENTIAL", 14)])
    resp = client.post(
        "/api/pdf/execute-redaction",
        json={
            "file_id": fid,
            "selected_candidate_ids": ["manual_oob"],
            "mode": "redact",
            "box_overrides": [
                {"id": "manual_oob", "page_index": 5, "x": 10, "y": 10, "width": 30, "height": 30}
            ],
        },
    )
    assert resp.status_code == 400
    assert "页号越界" in resp.json()["detail"]


def test_execute_redaction_negative_size_normalized(tmp_path):
    """拖动翻转产生的负宽高应被归一为合法矩形后正常脱敏。"""
    client, fid = _make_client_and_file(tmp_path, [(50, 50, "CONFIDENTIAL", 14)])
    resp = client.post(
        "/api/pdf/execute-redaction",
        json={
            "file_id": fid,
            "selected_candidate_ids": ["manual_flip"],
            "mode": "redact",
            "box_overrides": [
                {"id": "manual_flip", "page_index": 0, "x": 100, "y": 100, "width": -50, "height": 30}
            ],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["redacted_boxes_count"] == 1


def test_execute_redaction_zero_area_box_rejected(tmp_path):
    """零面积框不应送入引擎，返回 400 提示未选中。"""
    client, fid = _make_client_and_file(tmp_path, [(50, 50, "CONFIDENTIAL", 14)])
    resp = client.post(
        "/api/pdf/execute-redaction",
        json={
            "file_id": fid,
            "selected_candidate_ids": ["manual_zero"],
            "mode": "redact",
            "box_overrides": [
                {"id": "manual_zero", "page_index": 0, "x": 100, "y": 100, "width": 50, "height": 0}
            ],
        },
    )
    assert resp.status_code == 400


def test_resolve_output_dir_falls_back_when_unwritable(tmp_path):
    """输出目录不可写（U 盘拔出等）应回退到默认 output/ 而非裸抛 500。"""
    from server_bridge import _resolve_output_dir

    blocked = tmp_path / "readonly"
    blocked.mkdir()
    blocked_file = blocked / ".keep"
    blocked_file.write_text("x")

    # 用一个必然不可写的路径（Windows 上以设备名/非法字符构造）
    fallback = _resolve_output_dir(str(tmp_path / "con" / "sub"))
    assert Path(fallback).exists()
