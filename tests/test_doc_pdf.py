import fitz
from core.doc_pdf.pipeline import DocPdfPipeline
from core.detector.rule_engine import RuleEngine

def test_doc_pdf_pipeline(tmp_path):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((fitz.Point(50, 50)), "This is a SECRET document.")
    pdf_path = str(tmp_path / "test_input.pdf")
    out_path = str(tmp_path / "test_out.pdf")
    doc.save(pdf_path)
    doc.close()

    re = RuleEngine(["SECRET"])
    pl = DocPdfPipeline(rule_engine=re)
    res = pl.process_pdf(pdf_path, out_path)
    assert len(res.pages) == 1
    assert len(res.pages[0].hits) == 1
    assert res.pages[0].hits[0].text == "SECRET"


def test_doc_pdf_detects_id_card_and_phone():
    rule_engine = RuleEngine.load_document()
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((fitz.Point(50, 50)), "身份证号：110101199003072345，电话：13912345678")
    hits = DocPdfPipeline(rule_engine)._search_text_page(page, 0)
    matched = {h.matched_terms[0] for h in hits}
    assert "110101199003072345" in matched
    assert "13912345678" in matched
    assert any("身份证" in h.text for h in hits)


def test_doc_pdf_collect_page_hits_merges_ocr_when_available():
    """扫描件/图片页需 OCR 通道才能命中 PII；有 OCR 引擎时 collect_page_hits 应合并 OCR 结果。"""
    try:
        from core.detector.ocr_channel import get_ocr_engine
        get_ocr_engine()
    except Exception:
        import pytest
        pytest.skip("OCR engine unavailable")

    rule_engine = RuleEngine.load_document()
    pl = DocPdfPipeline(rule_engine, use_ocr=True)
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((fitz.Point(50, 50)), "身份证号：110101199003072345")
    vector_hits = pl._search_text_page(page, 0)
    merged = pl.collect_page_hits(page, 0, enable_seal=False)
    assert len(vector_hits) >= 1
    assert len(merged) >= len(vector_hits)


def test_doc_pdf_text_dict_fallback_when_search_for_empty(monkeypatch):
    rule_engine = RuleEngine.load_document()
    pl = DocPdfPipeline(rule_engine, use_ocr=False)
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((fitz.Point(50, 50)), "身份证号：110101199003072345")

    monkeypatch.setattr(page, "search_for", lambda *_args, **_kwargs: [])
    hits = pl._search_text_page(page, 0)
    assert any("110101199003072345" in h.matched_terms[0] for h in hits)
