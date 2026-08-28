import fitz
from core.doc_pdf.pipeline import DocPdfPipeline
from core.detector.rule_engine import RuleEngine
from core.model import Box

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


def test_doc_pdf_redacts_acroform_widget_values(tmp_path):
    """行政公文常见可填写 PDF：apply_redactions 须配合删除 AcroForm 控件。"""
    from core.model import RedactBox, RedactMode
    from core.redact.executor import redact_pdf

    src = tmp_path / "form.pdf"
    out = tmp_path / "form_desensitized.pdf"

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Passport No:")
    widget = fitz.Widget()
    widget.field_name = "passport"
    widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
    widget.field_value = "E12345678"
    widget.rect = fitz.Rect(120, 45, 250, 65)
    page.add_widget(widget)
    doc.save(str(src))
    doc.close()

    rule_engine = RuleEngine.load_document()
    doc = fitz.open(str(src))
    hits = DocPdfPipeline(rule_engine, use_ocr=False).collect_page_hits(
        doc[0], 0, enable_seal=False
    )
    doc.close()
    assert hits, "应检测到护照号"

    boxes = [
        RedactBox(
            page_index=0,
            box=hits[0].source_box,
            boxed=True,
            manual_required=False,
            terms=[hits[0].text],
        )
    ]
    redact_pdf(str(src), boxes, RedactMode.ERASE, str(out))

    redacted = fitz.open(str(out))
    page_out = redacted[0]
    text = page_out.get_text()
    widgets = list(page_out.widgets() or [])
    redacted.close()

    assert "E12345678" not in text
    assert not widgets


def test_doc_pdf_redacts_passport_with_check_digit_suffix(tmp_path):
    """护照号带 (校验位) 后缀时，抹除框须覆盖完整字段。"""
    from core.model import RedactMode
    from core.redact.executor import redact_pdf

    src = tmp_path / "passport_suffix.pdf"
    out = tmp_path / "passport_suffix_desensitized.pdf"
    passport = "F764486(4)"

    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((200, 115), passport, fontsize=11)
    doc.save(str(src))
    doc.close()

    rule_engine = RuleEngine.load_document()
    doc = fitz.open(str(src))
    hits = DocPdfPipeline(rule_engine, use_ocr=False).collect_page_hits(doc[0], 0, enable_seal=False)
    doc.close()
    assert hits
    assert hits[0].matched_terms == [passport]

    from core.model import RedactBox

    boxes = [
        RedactBox(
            page_index=0,
            box=hits[0].source_box,
            boxed=True,
            manual_required=False,
            terms=list(hits[0].matched_terms),
        )
    ]
    redact_pdf(str(src), boxes, RedactMode.ERASE, str(out))

    redacted = fitz.open(str(out))
    assert redacted[0].get_text().strip() == ""
    redacted.close()


def test_doc_pdf_redacts_acroform_when_box_misaligned(tmp_path):
    """表单字段值比正则命中更长时，仍应通过模糊值匹配清除控件。"""
    from core.model import RedactBox, RedactMode
    from core.redact.executor import redact_pdf

    src = tmp_path / "misaligned_form.pdf"
    out = tmp_path / "misaligned_form_desensitized.pdf"
    passport = "F764486(4)"

    doc = fitz.open()
    page = doc.new_page()
    widget = fitz.Widget()
    widget.field_name = "passport"
    widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
    widget.field_value = passport
    widget.rect = fitz.Rect(200, 100, 350, 120)
    page.add_widget(widget)
    doc.save(str(src))
    doc.close()

    rule_engine = RuleEngine.load_document()
    doc = fitz.open(str(src))
    hits = DocPdfPipeline(rule_engine, use_ocr=False).collect_page_hits(doc[0], 0, enable_seal=False)
    doc.close()
    assert hits[0].matched_terms == [passport]

    # 故意使用与控件不相交的窄框，依赖 matched_terms 清除
    boxes = [
        RedactBox(
            page_index=0,
            box=Box(10, 10, 40, 20),
            boxed=True,
            manual_required=False,
            terms=list(hits[0].matched_terms),
        )
    ]
    redact_pdf(str(src), boxes, RedactMode.ERASE, str(out))

    redacted = fitz.open(str(out))
    assert passport not in redacted[0].get_text()
    assert not list(redacted[0].widgets() or [])
    redacted.close()


def test_rule_engine_expand_match_in_text():
    text = "Passport: F764486(4) end"
    assert RuleEngine.expand_match_in_text(text, "F764486") == "F764486(4)"
    assert RuleEngine.expand_match_in_text(text, "EL911550") == "EL911550"


def test_rule_engine_extract_match_values_for_ocr():
    engine = RuleEngine.load_document()
    values, label = engine.extract_match_values("EL911550 +852 84957302")
    assert "EL911550" in values
    assert "+852 84957302" in values
    assert label.startswith("[")


def test_doc_pdf_redacts_duplicate_acroform_values(tmp_path):
    """同一敏感值可能绑定多个表单控件，须全部清除。"""
    from core.model import RedactBox, RedactMode
    from core.redact.executor import redact_pdf

    src = tmp_path / "dup_form.pdf"
    out = tmp_path / "dup_form_desensitized.pdf"
    phone = "+852 84957302"

    doc = fitz.open()
    page = doc.new_page()
    for x0 in (80, 280):
        widget = fitz.Widget()
        widget.field_name = f"phone_{x0}"
        widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
        widget.field_value = phone
        widget.rect = fitz.Rect(x0, 70, x0 + 120, 90)
        page.add_widget(widget)
    doc.save(str(src))
    doc.close()

    rule_engine = RuleEngine.load_document()
    doc = fitz.open(str(src))
    hits = DocPdfPipeline(rule_engine, use_ocr=False).collect_page_hits(doc[0], 0, enable_seal=False)
    doc.close()
    assert hits

    boxes = [
        RedactBox(
            page_index=0,
            box=hits[0].source_box,
            boxed=True,
            manual_required=False,
            terms=list(hits[0].matched_terms),
        )
    ]
    redact_pdf(str(src), boxes, RedactMode.ERASE, str(out))

    redacted = fitz.open(str(out))
    text = redacted[0].get_text()
    widgets = list(redacted[0].widgets() or [])
    redacted.close()

    assert phone not in text
    assert not widgets


def test_doc_pdf_redacts_acroform_with_override_terms_when_cache_empty(tmp_path):
    """模拟后端重启：仅有前端回传的 matched_terms 时仍须清除 AcroForm。"""
    from core.model import RedactMode
    from core.redact.executor import redact_pdf
    from server_bridge import ManualBoxInput, SCAN_CANDIDATES_CACHE, _build_redact_boxes_from_selection

    src = tmp_path / "visa_form.pdf"
    out = tmp_path / "visa_form_desensitized.pdf"
    passport = "F764486(4)"

    doc = fitz.open()
    page = doc.new_page()
    widget = fitz.Widget()
    widget.field_name = "passport"
    widget.field_type = fitz.PDF_WIDGET_TYPE_TEXT
    widget.field_value = passport
    widget.rect = fitz.Rect(200, 100, 350, 120)
    page.add_widget(widget)
    doc.save(str(src))
    doc.close()

    file_id = "cache-empty-visa"
    SCAN_CANDIDATES_CACHE[file_id] = []
    cid = f"{file_id}_0_0"
    overrides = [
        ManualBoxInput(
            id=cid,
            page_index=0,
            x=10.0,
            y=10.0,
            width=40.0,
            height=20.0,
            matched_terms=[passport],
        ),
    ]
    boxes = _build_redact_boxes_from_selection(file_id, {cid}, overrides)
    redact_pdf(str(src), boxes, RedactMode.ERASE, str(out))

    redacted = fitz.open(str(out))
    assert passport not in redacted[0].get_text()
    assert not list(redacted[0].widgets() or [])
    redacted.close()
    SCAN_CANDIDATES_CACHE.pop(file_id, None)
