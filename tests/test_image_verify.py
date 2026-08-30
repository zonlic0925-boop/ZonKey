"""图片内容验证测试：mock OCR 引擎，覆盖命中/未命中/不可用/跳过路径。"""

from __future__ import annotations

import numpy as np
import pytest

from core.detector.fusion import MergedHit
from core.detector.image_verify import verify_image_boxes
from core.detector.rule_engine import RuleEngine, load_terms
from core.model import Box, Channel, SensitiveHit


def _image_hit(x0: float = 10.0, y0: float = 10.0, x1: float = 110.0, y1: float = 60.0) -> SensitiveHit:
    return SensitiveHit(
        page_index=0,
        channel=Channel.VECTOR_IMAGE,
        source_box=Box(x0, y0, x1, y1),
    )


def _text_hit() -> SensitiveHit:
    return SensitiveHit(
        page_index=0,
        channel=Channel.VECTOR_TEXT,
        source_box=Box(10, 10, 110, 60),
        text="CONFIDENTIAL CORP",
        matched_terms=["CONFIDENTIAL CORP"],
    )


def _merged(*hits: SensitiveHit) -> list[MergedHit]:
    return [MergedHit(box=hits[0].source_box, hits=list(hits))]


def _fake_engine(texts: list[str]):
    def _engine(arr: np.ndarray) -> tuple:
        quads = [[[0, 0], [10, 0], [10, 10], [0, 10]]] * len(texts)
        return ([(q, t, 0.99) for q, t in zip(quads, texts)], 0.1)

    return _engine


@pytest.fixture
def page(tmp_path):
    from pdf_helpers import make_pdf, open_view

    path = tmp_path / "blank_page.pdf"
    make_pdf(path, width=400, height=400)
    view = open_view(path)
    yield view.page(0)
    view.close()


def test_verify_hits_brand_token(page, monkeypatch) -> None:
    monkeypatch.setattr(
        "core.detector.image_verify.get_ocr_engine",
        lambda: _fake_engine(["CONFIDENTIAL"]),
    )
    engine = RuleEngine(load_terms("rules/sensitive_terms.txt"))
    verified = verify_image_boxes(page, _merged(_image_hit()), engine)
    assert 0 in verified
    assert "confidential" in [t.lower() for t in verified[0]]


def test_verify_ignores_normal_content(page, monkeypatch) -> None:
    monkeypatch.setattr(
        "core.detector.image_verify.get_ocr_engine",
        lambda: _fake_engine(["PARTNUMBER", "ES-09708-1~17"]),
    )
    engine = RuleEngine(load_terms("rules/sensitive_terms.txt"))
    assert verify_image_boxes(page, _merged(_image_hit()), engine) == {}


def test_verify_ocr_unavailable_returns_empty(page, monkeypatch) -> None:
    def _boom():
        raise RuntimeError("model missing")

    monkeypatch.setattr("core.detector.image_verify.get_ocr_engine", _boom)
    engine = RuleEngine(load_terms("rules/sensitive_terms.txt"))
    assert verify_image_boxes(page, _merged(_image_hit()), engine) == {}


def test_verify_skips_non_image_channel(page, monkeypatch) -> None:
    monkeypatch.setattr(
        "core.detector.image_verify.get_ocr_engine",
        lambda: _fake_engine(["CONFIDENTIAL"]),
    )
    engine = RuleEngine(load_terms("rules/sensitive_terms.txt"))
    assert verify_image_boxes(page, _merged(_text_hit()), engine) == {}


def test_verify_skips_image_with_text_terms(page, monkeypatch) -> None:
    # 图片与文字融合且文字已带词条命中：跳过验证（已有文字证据）
    hit = _image_hit()
    hit.text = "CONFIDENTIAL"
    hit.matched_terms = ["CONFIDENTIAL"]
    monkeypatch.setattr(
        "core.detector.image_verify.get_ocr_engine",
        lambda: _fake_engine(["NOTHING SENSITIVE"]),
    )
    engine = RuleEngine(load_terms("rules/sensitive_terms.txt"))
    assert verify_image_boxes(page, _merged(hit), engine) == {}