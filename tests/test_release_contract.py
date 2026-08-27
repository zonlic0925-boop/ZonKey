"""公司内建版核心契约测试：
1. 验证内置 Fisher / Emerson / TopWorx / MKS 词表与 Logo 模板已就位；
2. 验证全链路识别、框线归位与执行脱敏能力；
3. 验证 LogoMatcher 可加载内置模板。
"""

from __future__ import annotations

from pathlib import Path

import fitz
import pytest

from core.app_paths import get_app_root
from core.detector.logo_matcher import LogoMatcher
from core.detector.rule_engine import RuleEngine, load_terms
from core.model import RedactMode
from core.pipeline import Pipeline, PipelineConfig
from core.redact.executor import redact_pdf

# 公司内建版必须包含的目标企业词
_REQUIRED_VENDOR_TERMS = {
    "FISHER CONTROLS",
    "FISHER",
    "EMERSON",
    "EMERSON PROCESS MANAGEMENT",
    "TOPWORX",
    "MKS",
}

_EXPECTED_LOGO_FILES = {
    "fisher_logo.png",
    "emerson_logo_raster.png",
    "emerson_logo_vector.png",
    "topworx_logo.jpeg",
}


def test_company_rules_have_builtin_vendor_terms() -> None:
    root = get_app_root()
    terms_path = root / "rules" / "sensitive_terms.txt"
    terms_upper = {t.upper() for t in load_terms(terms_path)}
    missing = [t for t in _REQUIRED_VENDOR_TERMS if t not in terms_upper]
    assert not missing, f"公司词表缺少内置企业名: {missing}"


def test_company_logo_dir_has_builtin_vendor_images() -> None:
    logos_dir = get_app_root() / "rules" / "logos"
    images = {p.name for p in logos_dir.glob("*") if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".bmp"}}
    missing = _EXPECTED_LOGO_FILES - images
    assert not missing, f"公司 Logo 目录缺少内置模板: {missing}"


def test_logo_matcher_loads_builtin_templates() -> None:
    matcher = LogoMatcher()
    assert len(matcher.templates) >= 4, "LogoMatcher 应加载至少 4 个内置模板"


def test_company_rules_pipeline_desensitize(tmp_path) -> None:
    """合成图纸含 Fisher Controls + CONFIDENTIAL，验证检测与抹除。"""
    pdf_path = tmp_path / "vendor_drawing.pdf"
    doc = fitz.open()
    page = doc.new_page(width=400, height=300)
    page.draw_rect(fitz.Rect(50, 50, 200, 150), color=(0, 0, 0), width=1)
    page.insert_text((60, 80), "Fisher Controls Intl. LLC", fontname="helv", fontsize=12)
    page.insert_text((60, 110), "CONFIDENTIAL", fontname="helv", fontsize=10)
    doc.save(str(pdf_path))
    doc.close()

    cfg = PipelineConfig(use_ocr=False)
    pipeline = Pipeline(cfg)
    res = pipeline.process(str(pdf_path))

    assert len(res.all_hits()) >= 1
    assert len(res.all_redact_boxes()) >= 1

    out_pdf = tmp_path / "out_desensitized.pdf"
    redact_pdf(str(pdf_path), res.all_redact_boxes(), RedactMode.ERASE, str(out_pdf))
    assert out_pdf.exists()

    doc_out = fitz.open(str(out_pdf))
    text_out = doc_out[0].get_text().upper()
    doc_out.close()
    assert "FISHER" not in text_out
    assert "CONFIDENTIAL" not in text_out


def test_rule_engine_matches_vendor_short_terms() -> None:
    terms_path = get_app_root() / "rules" / "sensitive_terms.txt"
    engine = RuleEngine(load_terms(terms_path))
    assert "MKS" in engine.match("MKS-1000")
    assert "EMERSON" in engine.match("A SUBSIDIARY OF EMERSON ELECTRIC")
