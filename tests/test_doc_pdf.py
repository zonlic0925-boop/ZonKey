"""公文管线测试（Phase M 去 AGPL：reportlab 样本 + pikepdf 控件清理断言）。"""

from pdf_helpers import count_widgets, extract_text, make_pdf, open_view

from core.doc_pdf.pipeline import DocPdfPipeline
from core.detector.rule_engine import RuleEngine


def _open_page(path):
    view = open_view(path)
    return view, view.page(0)


def test_doc_pdf_pipeline(tmp_path):
    src = tmp_path / "test_input.pdf"
    make_pdf(src, width=612, height=792, texts=[(50, 50, "This is a SECRET document.")])
    out_path = tmp_path / "test_out.pdf"

    re = RuleEngine(["SECRET"])
    pl = DocPdfPipeline(rule_engine=re)
    res = pl.process_pdf(src, out_path)
    assert len(res.pages) == 1
    assert len(res.pages[0].hits) == 1
    assert res.pages[0].hits[0].text == "SECRET"


def test_doc_pdf_detects_id_card_and_phone(tmp_path):
    src = tmp_path / "cjk.pdf"
    make_pdf(
        src,
        width=612,
        height=792,
        texts=[(50, 50, "身份证号：110101199003072345，电话：13912345678", 12, "MSyh")],
        register_cjk=True,
    )
    rule_engine = RuleEngine.load_document()
    view, page = _open_page(src)
    hits = DocPdfPipeline(rule_engine)._search_text_page(page, 0)
    view.close()
    matched = {h.matched_terms[0] for h in hits}
    assert "110101199003072345" in matched
    assert "13912345678" in matched
    assert any("身份证" in h.text for h in hits)


def test_doc_pdf_collect_page_hits_merges_ocr_when_available(tmp_path):
    """扫描件/图片页需 OCR 通道才能命中 PII；有 OCR 引擎时 collect_page_hits 应合并 OCR 结果。"""
    try:
        from core.detector.ocr_channel import get_ocr_engine
        get_ocr_engine()
    except Exception:
        import pytest
        pytest.skip("OCR engine unavailable")

    src = tmp_path / "cjk2.pdf"
    make_pdf(
        src,
        width=612,
        height=792,
        texts=[(50, 50, "身份证号：110101199003072345", 12, "MSyh")],
        register_cjk=True,
    )
    rule_engine = RuleEngine.load_document()
    pl = DocPdfPipeline(rule_engine, use_ocr=True)
    view = open_view(src)
    page = view.page(0)
    vector_hits = pl._search_text_page(page, 0)
    merged = pl.collect_page_hits(page, 0, enable_seal=False, doc_view=view)
    view.close()
    assert len(vector_hits) >= 1
    assert len(merged) >= len(vector_hits)


def test_doc_pdf_text_dict_fallback_when_search_empty(tmp_path, monkeypatch):
    src = tmp_path / "cjk3.pdf"
    make_pdf(
        src,
        width=612,
        height=792,
        texts=[(50, 50, "身份证号：110101199003072345", 12, "MSyh")],
        register_cjk=True,
    )
    rule_engine = RuleEngine.load_document()
    pl = DocPdfPipeline(rule_engine, use_ocr=False)
    view, page = _open_page(src)

    monkeypatch.setattr(page, "search", lambda *_args, **_kwargs: [])
    hits = pl._search_text_page(page, 0)
    view.close()
    assert any("110101199003072345" in h.matched_terms[0] for h in hits)


def test_doc_pdf_redacts_acroform_widget_values(tmp_path):
    """行政公文常见可填写 PDF：内容流抹除须配合删除 AcroForm 控件。"""
    from core.model import RedactBox, RedactMode
    from core.redact.executor import redact_pdf

    src = tmp_path / "form.pdf"
    out = tmp_path / "form_desensitized.pdf"
    make_pdf(
        src,
        width=612,
        height=792,
        texts=[(50, 50, "Passport No:")],
        form_fields=[("passport", 120, 45, 250, 65, "E12345678")],
    )

    rule_engine = RuleEngine.load_document()
    view = open_view(src)
    hits = DocPdfPipeline(rule_engine, use_ocr=False).collect_page_hits(
        view.page(0), 0, enable_seal=False, doc_view=view
    )
    view.close()
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

    text = extract_text(out)
    assert "E12345678" not in text
    assert count_widgets(out) == 0


def test_doc_pdf_redacts_passport_with_check_digit_suffix(tmp_path):
    """护照号带 (校验位) 后缀时，抹除框须覆盖完整字段。"""
    from core.model import RedactBox, RedactMode
    from core.redact.executor import redact_pdf

    passport = "F764486(4)"
    src = tmp_path / "passport_suffix.pdf"
    out = tmp_path / "passport_suffix_desensitized.pdf"
    make_pdf(src, width=612, height=792, texts=[(200, 115, passport, 11)])

    rule_engine = RuleEngine.load_document()
    view, page = _open_page(src)
    hits = DocPdfPipeline(rule_engine, use_ocr=False).collect_page_hits(page, 0, enable_seal=False)
    view.close()
    assert hits
    assert hits[0].matched_terms == [passport]

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
    assert extract_text(out).strip() == ""


def test_doc_pdf_redacts_acroform_when_box_misaligned(tmp_path):
    """表单字段值比正则命中更长时，仍应通过模糊值匹配清除控件。"""
    from core.model import Box, RedactBox, RedactMode
    from core.redact.executor import redact_pdf

    passport = "F764486(4)"
    src = tmp_path / "misaligned_form.pdf"
    out = tmp_path / "misaligned_form_desensitized.pdf"
    make_pdf(
        src,
        width=612,
        height=792,
        form_fields=[("passport", 200, 100, 350, 120, passport)],
    )

    rule_engine = RuleEngine.load_document()
    view, page = _open_page(src)
    hits = DocPdfPipeline(rule_engine, use_ocr=False).collect_page_hits(
        page, 0, enable_seal=False, doc_view=view
    )
    view.close()
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

    assert passport not in extract_text(out)
    assert count_widgets(out) == 0


def test_rule_engine_expand_match_in_text():
    text = "Passport: F764486(4) end"
    assert RuleEngine.expand_match_in_text(text, "F764486") == "F764486(4)"
    assert RuleEngine.expand_match_in_text(text, "EL911550") == "EL911550"


def test_rule_engine_extract_match_values_for_ocr():
    engine = RuleEngine.load_document()
    values, label = engine.extract_match_values("EL911550 +852 84957302")
    assert "EL911550" in values
    assert label.startswith("[")


def test_doc_pdf_redacts_duplicate_acroform_values(tmp_path):
    """同一敏感值可能绑定多个表单控件，须全部清除。"""
    from core.model import RedactBox, RedactMode
    from core.redact.executor import redact_pdf

    phone = "+852 84957302"
    src = tmp_path / "dup_form.pdf"
    out = tmp_path / "dup_form_desensitized.pdf"
    make_pdf(
        src,
        width=612,
        height=792,
        form_fields=[
            ("phone_80", 80, 70, 200, 90, phone),
            ("phone_280", 280, 70, 400, 90, phone),
        ],
    )

    rule_engine = RuleEngine.load_document()
    view = open_view(src)
    hits = DocPdfPipeline(rule_engine, use_ocr=False).collect_page_hits(
        view.page(0), 0, enable_seal=False, doc_view=view
    )
    view.close()
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

    assert phone not in extract_text(out)
    assert count_widgets(out) == 0


def test_doc_pdf_redacts_acroform_with_override_terms_when_cache_empty(tmp_path):
    """模拟后端重启：仅有前端回传的 matched_terms 时仍须清除 AcroForm。"""
    from core.model import RedactMode
    from core.redact.executor import redact_pdf
    from server_bridge import ManualBoxInput, SCAN_CANDIDATES_CACHE, _build_redact_boxes_from_selection

    passport = "F764486(4)"
    src = tmp_path / "visa_form.pdf"
    out = tmp_path / "visa_form_desensitized.pdf"
    make_pdf(
        src,
        width=612,
        height=792,
        form_fields=[("passport", 200, 100, 350, 120, passport)],
    )

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

    assert passport not in extract_text(out)
    assert count_widgets(out) == 0
    SCAN_CANDIDATES_CACHE.pop(file_id, None)
