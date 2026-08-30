"""行级收缩（D8 修复）：单元格归位框收缩到敏感文字行，保护格内非敏感内容。"""

from __future__ import annotations

from core.boxing.shrink import shrink_boxes_to_hits
from core.model import Box, Channel, RedactBox, SensitiveHit

CELL = Box(50.0, 50.0, 500.0, 120.0)  # 大单元格（如标题栏条带）


def _hit(ident: str, box: Box, channel: Channel = Channel.OCR, terms: list[str] | None = None) -> SensitiveHit:
    return SensitiveHit(
        page_index=0,
        channel=channel,
        source_box=box,
        text="sensitive",
        matched_terms=terms if terms is not None else ["GENERIC"],
        hit_id=ident,
    )


def test_shrink_text_hits_to_row():
    """纯文字命中：收缩到文字行并集 + padding。"""
    rb = RedactBox(page_index=0, box=CELL, boxed=True, manual_required=False,
                   hit_ids=["h1"], terms=["COMPANY"])
    hits = [_hit("h1", Box(60.0, 60.0, 480.0, 80.0), terms=["COMPANY"])]
    out = shrink_boxes_to_hits([rb], hits)
    assert len(out) == 1
    assert out[0].box_id == rb.box_id
    assert out[0].box == Box(58.0, 58.0, 482.0, 82.0)  # 并集 + 2pt padding


def test_shrink_multiple_hits_union():
    """多个命中取并集。"""
    rb = RedactBox(page_index=0, box=CELL, boxed=True, manual_required=False,
                   hit_ids=["h1", "h2"], terms=["A", "B"])
    hits = [
        _hit("h1", Box(60.0, 60.0, 200.0, 80.0), terms=["A"]),
        _hit("h2", Box(300.0, 90.0, 480.0, 100.0), terms=["B"]),
    ]
    out = shrink_boxes_to_hits([rb], hits)
    assert out[0].box == Box(58.0, 58.0, 482.0, 102.0)


def test_shrink_keeps_image_hit_full_cell():
    """含图片命中：无行概念，保持整格。"""
    rb = RedactBox(page_index=0, box=CELL, boxed=True, manual_required=False,
                   hit_ids=["h1", "h2"], terms=["Logo"])
    hits = [
        _hit("h1", Box(60.0, 60.0, 200.0, 80.0), Channel.VECTOR_IMAGE),
        _hit("h2", Box(300.0, 90.0, 480.0, 100.0)),
    ]
    out = shrink_boxes_to_hits([rb], hits)
    assert out[0].box == CELL


def test_shrink_keeps_cell_when_hits_cover_most():
    """命中面积 > 70% 单元格：保持整格；低于阈值：收缩。"""
    rb = RedactBox(page_index=0, box=CELL, boxed=True, manual_required=False,
                   hit_ids=["h1"], terms=["X"])
    big = Box(50.0, 50.0, 400.0, 112.0)  # 350*62=21700 / 450*70=31500 = 69% < 70% -> 收缩
    hits = [_hit("h1", big, terms=["X"])]
    out = shrink_boxes_to_hits([rb], hits)
    assert out[0].box == Box(48.0, 48.0, 402.0, 114.0)
    bigger = Box(50.0, 50.0, 420.0, 115.0)  # 370*65=24050 / 31500 = 76% > 70% -> 整格
    out2 = shrink_boxes_to_hits([rb], [_hit("h1", bigger, terms=["X"])])
    assert out2[0].box == CELL


def test_shrink_keeps_fallback_box():
    """FALLBACK（未归位）框不收缩。"""
    rb = RedactBox(page_index=0, box=Box(100.0, 100.0, 150.0, 110.0),
                   boxed=False, manual_required=True,
                   hit_ids=["h1"], terms=["MARSHALLTOWN"])
    hits = [_hit("h1", Box(101.0, 101.0, 149.0, 109.0))]
    out = shrink_boxes_to_hits([rb], hits)
    assert out[0] is rb


def test_shrink_missing_hit_refs_keeps_cell():
    """命中引用缺失：保守保持原框。"""
    rb = RedactBox(page_index=0, box=CELL, boxed=True, manual_required=False,
                   hit_ids=["ghost"], terms=["X"])
    out = shrink_boxes_to_hits([rb], [])
    assert out[0] is rb


def test_shrink_aborts_when_adjacent_span_near():
    """相邻行保护：收缩框外扩容差带内有非命中 span 时放弃收缩（保持整格）。"""
    rb = RedactBox(page_index=0, box=CELL, boxed=True, manual_required=False,
                   hit_ids=["h1"], terms=["CONFIDENTIAL"])
    hits = [_hit("h1", Box(60.0, 60.0, 480.0, 80.0))]
    # 相邻行 bbox 下缘 82.0，收缩框下缘 82.0 —— 行距 2pt < padding+字形溢出
    spans = [Box(60.0, 82.0, 480.0, 96.0)]
    out = shrink_boxes_to_hits([rb], hits, spans=spans)
    assert out[0] is rb


def test_shrink_proceeds_when_adjacent_span_far():
    """相邻行保护：行距充足时正常收缩。"""
    rb = RedactBox(page_index=0, box=CELL, boxed=True, manual_required=False,
                   hit_ids=["h1"], terms=["CONFIDENTIAL"])
    hits = [_hit("h1", Box(60.0, 60.0, 480.0, 80.0))]
    spans = [Box(60.0, 100.0, 480.0, 114.0)]
    out = shrink_boxes_to_hits([rb], hits, spans=spans)
    assert out[0].box == Box(58.0, 58.0, 482.0, 82.0)


def test_shrink_ignores_own_hit_span():
    """命中行自身的 span（与 hit 相交）不触发相邻行保护。"""
    rb = RedactBox(page_index=0, box=CELL, boxed=True, manual_required=False,
                   hit_ids=["h1"], terms=["CONFIDENTIAL"])
    hits = [_hit("h1", Box(60.0, 60.0, 480.0, 80.0))]
    spans = [Box(61.0, 61.0, 479.0, 79.0), Box(60.0, 90.0, 480.0, 104.0)]
    out = shrink_boxes_to_hits([rb], hits, spans=spans)
    assert out[0].box == Box(58.0, 58.0, 482.0, 82.0)


def test_pipeline_integration_cell_non_sensitive_preserved(tmp_path):
    """端到端：单元格内敏感行被抹、非敏感行（图纸编号）保留（D8 修复）。"""
    from core.model import RedactMode
    from core.pipeline import Pipeline, PipelineConfig
    from pdf_helpers import cell_lines, extract_text, make_pdf

    path = tmp_path / "cell_dwg.pdf"
    # 大单元格（标题栏条带）：显示空间 (50,50)-(550,120)
    make_pdf(
        path,
        width=600,
        height=400,
        lines=cell_lines(50, 50, 550, 120),
        texts=[
            (70, 70, "CONFIDENTIAL", 12),
            (70, 105, "DWG.NO. 12345", 12),
        ],
    )

    result = Pipeline(PipelineConfig(use_ocr=False)).process(str(path))
    assert len(result.all_redact_boxes()) == 1
    rb = result.all_redact_boxes()[0]
    assert rb.boxed
    # 收缩后只覆盖 CONFIDENTIAL 行，不覆盖 DWG.NO. 行
    assert rb.box.y0 > 50.0
    assert rb.box.y1 < 95.0
    out = result.output_path = str(tmp_path / "cell_dwg_desensitized.pdf")
    Pipeline(PipelineConfig(use_ocr=False)).redact_result(result, RedactMode.ERASE, output=out)

    text = extract_text(out)
    assert "CONFIDENTIAL" not in text
    assert "DWG.NO. 12345" in text  # 非敏感内容保留


def test_pipeline_integration_tight_line_spacing_keeps_cell(tmp_path):
    """端到端：行距过近时收缩后相邻行零污染（D8/ES-09805 安全属性）。

    Phase M 引擎变更说明：span 几何改由 pdfminer 提供（12pt 字号 span 高
    12pt，比 fitz span ~16.5pt 更紧），18pt 基线差时收缩带判定为「可收缩」；
    但字形级删除按字形包围盒（含上下伸部）相交判定，相邻行 DWG.NO 距收缩
    框仍有 ~3.9pt 净空——本用例直接断言安全属性：敏感行抹净、相邻行原样。
    （紧邻 2pt 场景的「放弃收缩」路径由 test_shrink_aborts_when_adjacent_span_near 覆盖。）
    """
    from core.model import RedactMode
    from core.pipeline import Pipeline, PipelineConfig
    from pdf_helpers import cell_lines, extract_text, make_pdf

    path = tmp_path / "tight_dwg.pdf"
    make_pdf(
        path,
        width=600,
        height=400,
        lines=cell_lines(50, 50, 550, 120),
        texts=[
            (70, 60, "CONFIDENTIAL", 12),
            (70, 78, "DWG.NO. 12345", 12),
        ],
    )

    result = Pipeline(PipelineConfig(use_ocr=False)).process(str(path))
    assert len(result.all_redact_boxes()) == 1
    rb = result.all_redact_boxes()[0]
    assert rb.boxed
    out = str(tmp_path / "tight_dwg_desensitized.pdf")
    Pipeline(PipelineConfig(use_ocr=False)).redact_result(result, RedactMode.ERASE, output=out)
    text = extract_text(out)
    assert "CONFIDENTIAL" not in text
    assert "DWG.NO. 12345" in text  # 相邻行零污染（含字形上下伸部不越框）