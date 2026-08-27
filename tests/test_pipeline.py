"""管线级测试：FALLBACK（无框归位）命中不得自动执行（宪法硬规则锚定）。"""

from __future__ import annotations

import json
from pathlib import Path

import fitz
import pytest

from core.boxing.box_finder import BoxFinder
from core.detector.fusion import fuse_page
from core.model import Box, Channel, RedactMode, SensitiveHit
from core.pipeline import Pipeline, PipelineConfig


@pytest.fixture
def mixed_pdf(tmp_path) -> str:
    """一页：一个封闭格内敏感文字（应自动抹）+ 一个无框敏感文字（应保留）。"""
    path = tmp_path / "mixed.pdf"
    doc = fitz.open()
    page = doc.new_page(width=400, height=400)
    page.draw_line((100, 100), (300, 100))
    page.draw_line((100, 200), (300, 200))
    page.draw_line((100, 100), (100, 200))
    page.draw_line((300, 100), (300, 200))
    page.insert_text((110, 140), "CONFIDENTIAL", fontname="helv", fontsize=12)
    page.insert_text((110, 300), "PROPRIETARY", fontname="helv", fontsize=12)
    doc.save(str(path), garbage=3, deflate=True)
    doc.close()
    return str(path)


def _pipeline() -> Pipeline:
    return Pipeline(PipelineConfig(use_ocr=False))


def _ocr_hit(box: Box, text: str) -> SensitiveHit:
    return SensitiveHit(
        page_index=0,
        channel=Channel.OCR,
        source_box=box,
        text=text,
        matched_terms=[text],
        confidence=0.95,
    )


def test_boxed_executed_fallback_kept(mixed_pdf: str, tmp_path) -> None:
    out = str(tmp_path / "mixed_desensitized.pdf")
    audit = str(tmp_path / "audit.json")
    result = _pipeline().process_and_redact(mixed_pdf, RedactMode.ERASE, out, audit)
    assert result.output_path is not None
    doc = fitz.open(out)
    text = doc[0].get_text()
    doc.close()
    assert "CONFIDENTIAL" not in text
    assert "PROPRIETARY" in text  # FALLBACK 未执行，原文保留


def test_audit_marks_fallback_manual(mixed_pdf: str, tmp_path) -> None:
    out = str(tmp_path / "mixed_desensitized.pdf")
    audit = str(tmp_path / "audit.json")
    _pipeline().process_and_redact(mixed_pdf, RedactMode.ERASE, out, audit)
    data = json.loads(Path(audit).read_text(encoding="utf-8"))
    rows = data["boxes"]
    assert any(r["boxed"] for r in rows)
    assert any(not r["boxed"] and r["manual_required"] for r in rows)


def test_all_fallback_no_output_file(tmp_path) -> None:
    path = tmp_path / "all_manual.pdf"
    doc = fitz.open()
    page = doc.new_page(width=400, height=400)
    page.insert_text((110, 300), "PROPRIETARY", fontname="helv", fontsize=12)
    doc.save(str(path), garbage=3, deflate=True)
    doc.close()
    out = str(tmp_path / "all_manual_desensitized.pdf")
    audit = str(tmp_path / "audit2.json")
    result = _pipeline().process_and_redact(str(path), RedactMode.ERASE, out, audit)
    assert result.output_path is None
    assert not Path(out).exists()


# ---------- D3/R1：图片内容验证集成 ----------


def _page_with_image(tmp_path, *, with_grid: bool) -> str:
    """一页插图（40x40pt），可选画封闭格线（格内含图，box_finder 可归位）。"""
    import cv2
    import numpy as np

    path = tmp_path / "img_page.pdf"
    doc = fitz.open()
    page = doc.new_page(width=400, height=400)
    if with_grid:
        _draw_box_lines(page, 90, 90, 310, 210)
    img = 255 * np.ones((40, 40, 3), dtype=np.uint8)
    cv2.rectangle(img, (5, 5), (34, 34), (0, 0, 0), 1)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    page.insert_image(fitz.Rect(100, 100, 140, 140), stream=buf.tobytes())
    doc.save(str(path), garbage=3, deflate=True)
    doc.close()
    return str(path)


def _draw_box_lines(page, x0, y0, x1, y1) -> None:
    page.draw_line((x0, y0), (x1, y0))
    page.draw_line((x0, y1), (x1, y1))
    page.draw_line((x0, y0), (x0, y1))
    page.draw_line((x1, y0), (x1, y1))


def _fake_ocr(texts: list[str]):
    def _engine(arr):
        quads = [[[0, 0], [10, 0], [10, 10], [0, 10]]] * len(texts)
        return ([(q, t, 0.99) for q, t in zip(quads, texts)], 0.1)

    return _engine


def test_verify_hit_promotes_unboxed_image(tmp_path, monkeypatch) -> None:
    """D3：无框 Logo 图片，内容验证命中 → 补漏自动执行（不再 FALLBACK）。"""
    monkeypatch.setattr(
        "core.detector.image_verify.get_ocr_engine", lambda: _fake_ocr(["CONFIDENTIAL"])
    )
    pdf = _page_with_image(tmp_path, with_grid=False)
    out = str(tmp_path / "logo_desensitized.pdf")
    audit = str(tmp_path / "audit_logo.json")
    result = Pipeline(PipelineConfig(use_ocr=False)).process_and_redact(
        pdf, RedactMode.ERASE, out, audit
    )
    assert result.output_path is not None
    data = json.loads(Path(audit).read_text(encoding="utf-8"))
    row = data["boxes"][0]
    assert row["boxed"] is True
    assert row["manual_required"] is False
    assert "confidential" in [t.lower() for t in row["terms"]]


def test_verify_miss_downgrades_boxed_image(tmp_path, monkeypatch) -> None:
    """R1：格内正常图片（PART NUMBER 表），验证未命中 → 降级待人工，不自动执行。"""
    monkeypatch.setattr(
        "core.detector.image_verify.get_ocr_engine",
        lambda: _fake_ocr(["PARTNUMBER ES-09708-1~17"]),
    )
    pdf = _page_with_image(tmp_path, with_grid=True)
    out = str(tmp_path / "pn_desensitized.pdf")
    audit = str(tmp_path / "audit_pn.json")
    result = Pipeline(PipelineConfig(use_ocr=False)).process_and_redact(
        pdf, RedactMode.ERASE, out, audit
    )
    assert result.output_path is None  # 全部待人工，无自动输出
    assert not Path(out).exists()
    data = json.loads(Path(audit).read_text(encoding="utf-8"))
    row = data["boxes"][0]
    assert row["boxed"] is False
    assert row["manual_required"] is True


def test_image_verify_disabled_keeps_boxed(tmp_path) -> None:
    """image_verify=False：不做内容验证，格内图片保持原归位自动执行；不得崩（回归锚点）。"""
    pdf = _page_with_image(tmp_path, with_grid=True)
    out = str(tmp_path / "nov_desensitized.pdf")
    audit = str(tmp_path / "audit_nov.json")
    result = Pipeline(PipelineConfig(use_ocr=False, image_verify=False)).process_and_redact(
        pdf, RedactMode.ERASE, out, audit
    )
    assert result.output_path is not None
    data = json.loads(Path(audit).read_text(encoding="utf-8"))
    assert data["boxes"][0]["boxed"] is True


# ---------- 人工确认执行通道（UI 复用同一语义） ----------


def _manual_only_pdf(tmp_path) -> str:
    """一页：两段无框敏感文字（全 FALLBACK），+ 一段普通文字。"""
    path = tmp_path / "manual_only.pdf"
    doc = fitz.open()
    page = doc.new_page(width=400, height=400)
    page.insert_text((110, 100), "PROPRIETARY", fontname="helv", fontsize=12)
    page.insert_text((110, 300), "RESTRICTED", fontname="helv", fontsize=12)
    doc.save(str(path), garbage=3, deflate=True)
    doc.close()
    return str(path)


def test_box_ids_are_unique() -> None:
    doc = fitz.open()
    page = doc.new_page(width=400, height=400)
    merged = fuse_page([_ocr_hit(Box(100, 100, 200, 150), "SECRET")])
    rbs = BoxFinder().assign(page, merged)
    doc.close()
    ids = [rb.box_id for rb in rbs]
    assert len(ids) == len(set(ids)) == 1
    assert all(isinstance(i, str) and len(i) == 8 for i in ids)


def test_audit_includes_box_id(mixed_pdf: str, tmp_path) -> None:
    audit = str(tmp_path / "audit_ids.json")
    _pipeline().process_and_redact(mixed_pdf, RedactMode.ERASE, audit_path=audit)
    data = json.loads(Path(audit).read_text(encoding="utf-8"))
    assert all("box_id" in r and len(r["box_id"]) == 8 for r in data["boxes"])


def test_manual_not_executed_without_confirmation(tmp_path) -> None:
    """宪法锚点：全 FALLBACK 文件，不确认 → 无输出。"""
    pdf = _manual_only_pdf(tmp_path)
    out = str(tmp_path / "m_desensitized.pdf")
    audit = str(tmp_path / "audit_m.json")
    result = Pipeline(PipelineConfig(use_ocr=False)).process_and_redact(
        pdf, RedactMode.ERASE, out, audit
    )
    assert result.output_path is None
    data = json.loads(Path(audit).read_text(encoding="utf-8"))
    assert all(r["manual_required"] for r in data["boxes"])


def test_manual_executed_after_user_confirmation(tmp_path) -> None:
    """人工确认通道：确认全部 manual 框 → 执行并抹除原文。"""
    pdf = _manual_only_pdf(tmp_path)
    out = str(tmp_path / "m_confirmed_desensitized.pdf")
    audit = str(tmp_path / "audit_mc.json")
    pipeline = Pipeline(PipelineConfig(use_ocr=False))
    result = pipeline.process(pdf)
    ids = {rb.box_id for rb in result.all_redact_boxes()}
    pipeline.redact_result(result, RedactMode.ERASE, out, audit, confirm_box_ids=ids)
    assert result.output_path is not None
    doc = fitz.open(out)
    text = doc[0].get_text()
    doc.close()
    assert "PROPRIETARY" not in text
    assert "RESTRICTED" not in text


def test_partial_confirmation_executes_only_selected(tmp_path) -> None:
    pdf = _manual_only_pdf(tmp_path)
    out = str(tmp_path / "m_partial_desensitized.pdf")
    pipeline = Pipeline(PipelineConfig(use_ocr=False))
    result = pipeline.process(pdf)
    rbs = result.all_redact_boxes()
    assert len(rbs) == 2
    pipeline.redact_result(result, RedactMode.ERASE, out, confirm_box_ids={rbs[0].box_id})
    assert result.output_path is not None
    doc = fitz.open(out)
    text = doc[0].get_text()
    doc.close()
    # 只确认第一框（PROPRIETARY 在 y=100 处），RESTRICTED 保留
    assert "RESTRICTED" in text


def test_pipeline_add_and_remove_manual_box(tmp_path) -> None:
    pdf = _manual_only_pdf(tmp_path)
    pipeline = Pipeline(PipelineConfig(use_ocr=False))
    result = pipeline.process(pdf)
    initial_count = len(result.all_redact_boxes())

    # Add custom manual box
    added_box = pipeline.add_manual_box(result, page_index=0, box=Box(50, 50, 150, 80), terms=["CUSTOM"])
    assert added_box is not None
    assert len(result.all_redact_boxes()) == initial_count + 1
    assert added_box.manual_required is False  # Explicit user drawn box is direct
    assert added_box.terms == ["CUSTOM (人工添加)"]

    # Remove the box
    removed = pipeline.remove_box(result, added_box.box_id)
    assert removed is True
    assert len(result.all_redact_boxes()) == initial_count

    # Clear all
    pipeline.clear_boxes(result)
    assert len(result.all_redact_boxes()) == 0