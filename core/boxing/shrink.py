"""行级收缩：单元格归位框收缩到敏感命中文字行范围。

背景（D8，2026-08-17 用户授权修复）：框线归位把敏感框扩大到整个表格单元格，
单元格内非敏感内容（图纸编号、材料规格等）被整格连坐抹除。
规则：单元格内仅含文字命中（OCR/矢量文字）时，抹除框收缩为
"全部关联命中的 source_box 并集 + padding"；命中面积已覆盖单元格大部分
（> max_ratio）或含图片命中（图像无"行"概念）时保持整格。
FALLBACK（未归位）框维持原状（文字框 + padding，见 box_finder）。

相邻行保护（ES-09805 回归修复，2026-08-17）：MuPDF 字形渲染可超出 span bbox
上缘约 1.2pt，执行时抹除矩形按"相交即删文字"处理（PDF_REDACT_TEXT 无
"完全包含才删"档位）；行距 < padding + 字形溢出（~3.2pt）时，收缩框会连坐
删除相邻行整字符（框外污染）。故收缩前检查：候选框外扩 TEXT_OVERFLOW_TOL
容差带内存在"非命中关联"的矢量文字 span 时，放弃收缩保持整格（安全优先：
宁可整格连坐，不可越框切字）。纯栅格/OCR 命中无矢量 span，图像按像素处理、
框外像素不动，无此问题。
"""

from __future__ import annotations

from core.model import Box, Channel, RedactBox, SensitiveHit

SHRINK_PADDING = 2.0
SHRINK_MAX_RATIO = 0.7  # 命中面积 / 单元格面积 超过该值则保持整格抹除
# 收缩框外扩容差带：防相邻行字形渲染溢出（~1.2pt）+ 执行矩形相交判定，
# 与收缩框 padding 叠加后仍与相邻行 bbox 保持安全间隙。
TEXT_OVERFLOW_TOL = 3.5


# 保密/受限声明关键词集合：此类声明通常独占方框，必须整框抹除，绝不收缩
CONFIDENTIAL_TERMS = {
    "confidential",
    "proprietary",
    "restricted",
    "do not copy",
    "secret",
}


def _is_confidential_box(
    hit_list: list[SensitiveHit], terms: list[str], spans: list[Box] | None
) -> bool:
    """检查是否属于整框保密声明（CONFIDENTIAL类），此类方框豁免收缩。
    若单元格内存在明显的非敏感业务文字行（如 DWG.NO./PART NUMBER 等），则仍允许收缩以防误伤。
    """
    has_confidential = False
    for term in terms:
        if any(c in term.lower() for c in CONFIDENTIAL_TERMS):
            has_confidential = True
            break
    if not has_confidential:
        for h in hit_list:
            for t in h.matched_terms:
                if any(c in t.lower() for c in CONFIDENTIAL_TERMS):
                    has_confidential = True
                    break
            if has_confidential or any(c in h.text.lower() for c in CONFIDENTIAL_TERMS):
                has_confidential = True
                break

    if not has_confidential:
        return False

    # 若提供了页面 spans，仅当单元格内存在完全独立的非敏感业务文字时才允许收缩
    if spans is not None:
        has_other_spans = False
        for span in spans:
            # 只有当 span 位于单元格内部且不与任何命中行重叠时，才视为可能存在的独立业务文字
            if not any(span.intersects(h.source_box.grow(1.0)) for h in hit_list):
                has_other_spans = True
                break
        if has_other_spans:
            return False  # 单元格内有其他业务文字，不执行整框豁免，允许行级精准收缩

    return True


def shrink_boxes_to_hits(
    redact_boxes: list[RedactBox],
    hits: list[SensitiveHit],
    *,
    padding: float = SHRINK_PADDING,
    max_ratio: float = SHRINK_MAX_RATIO,
    spans: list[Box] | None = None,
    tol: float = TEXT_OVERFLOW_TOL,
) -> list[RedactBox]:
    """把已归位的单元格抹除框收缩到敏感文字行范围（保护格内非敏感内容）。

    保持 box_id / boxed / manual_required / terms 等语义字段不变，
    仅当满足全部条件时替换抹除框：
    - 该框已归位（boxed=True，FALLBACK 不收缩）；
    - 非保密整框（CONFIDENTIAL / PROPRIETARY 类保持整框抹除）；
    - 关联命中全部为文字通道（含图片/矢量图形命中则保持整格）；
    - 命中并集面积不超过单元格的 max_ratio；
    - 收缩候选框外扩 tol 容差带内无非命中关联的矢量 span（相邻行保护）。
    """
    by_id = {h.hit_id: h for h in hits}
    out: list[RedactBox] = []
    for rb in redact_boxes:
        if not rb.boxed:
            out.append(rb)
            continue
        hit_list = [by_id[i] for i in rb.hit_ids if i in by_id]
        if not hit_list:
            out.append(rb)
            continue
        # 包含图片或矢量图形对象，保持整格
        if any(h.channel in (Channel.VECTOR_IMAGE, Channel.VECTOR_DRAWING) for h in hit_list):
            out.append(rb)
            continue
        # 保密声明类独立方框豁免收缩，整框抹除
        if _is_confidential_box(hit_list, rb.terms, spans):
            out.append(rb)
            continue
        union: Box | None = None
        for h in hit_list:
            union = h.source_box if union is None else union.union(h.source_box)
        assert union is not None
        cell_area = rb.box.area()
        if cell_area <= 0 or union.area() / cell_area > max_ratio:
            out.append(rb)
            continue
        shrunk = Box(
            union.x0 - padding,
            union.y0 - padding,
            union.x1 + padding,
            union.y1 + padding,
        )
        if spans is not None and _touches_foreign_span(
            shrunk, hit_list, spans, tol
        ):
            out.append(rb)
            continue
        out.append(
            RedactBox(
                page_index=rb.page_index,
                box=shrunk,
                boxed=rb.boxed,
                manual_required=rb.manual_required,
                hit_ids=rb.hit_ids,
                channel_labels=rb.channel_labels,
                terms=rb.terms,
                redact_graphics=rb.redact_graphics,
                box_id=rb.box_id,
            )
        )
    return out


def _touches_foreign_span(
    shrunk: Box, hit_list: list[SensitiveHit], spans: list[Box], tol: float
) -> bool:
    """收缩框外扩容差带内是否存在非命中关联的矢量 span。"""
    zone = shrunk.grow(tol)
    for span in spans:
        if not span.intersects(zone):
            continue
        if any(span.intersects(h.source_box) for h in hit_list):
            continue  # 命中行自身（含并集邻行），非相邻行
        return True
    return False