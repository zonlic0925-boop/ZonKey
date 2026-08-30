"""图片内容验证：对无文字支撑的图片命中做定向 OCR 词表核对。

背景（D3/R1）：vector_image 通道按坐标命中所有非整页图片对象，但
（1）无封闭格线的 Logo 图片会落入 FALLBACK 不执行（D3 漏抹）；
（2）边框区正常图片（如 PART NUMBER 表）会被格线归位后自动执行（R1 误抹）。
本模块对 terms 为空的图片 MergedHit 渲染 crop 做 RapidOCR，
用 rule_engine.match_image 判别 token 核对，命中才允许自动执行。
"""

from __future__ import annotations

import logging

from core.detector.fusion import MergedHit  # noqa: F401  # 类型注解用
from core.detector.ocr_channel import get_ocr_engine
from core.detector.rule_engine import RuleEngine

logger = logging.getLogger(__name__)

VERIFY_DPI = 200
VERIFY_INSET_PT = 2.0


def is_title_block_logo_candidate(page, box) -> bool:
    """基于图纸标题栏区域与几何特征，判断是否属于高置信 Logo 候选。"""
    pw, ph = page.rect.width, page.rect.height
    w = getattr(box, "width", max(0.0, box.x1 - box.x0))
    h = getattr(box, "height", max(0.0, box.y1 - box.y0))
    if w <= 0 or h <= 0:
        return False
    # 尺寸过大（如整页背景或大幅装配/透视视图）不属于 Logo
    if w > pw * 0.30 or h > ph * 0.20:
        return False
    # 严格标题栏先验区域（标准工程图标题栏位于右下角或页底窄条区）
    # 严禁匹配左上角/中上方/图纸中央的主视图绘图区（保护 3D 零件图）
    in_title_block = (
        (box.x0 >= pw * 0.50 and box.y0 >= ph * 0.65)  # 仅限右下角标准标题栏
        or (box.y0 >= ph * 0.88)  # 或极端贴近页底的窄条区
    )
    return in_title_block


def verify_image_boxes(
    page,
    merged: list[MergedHit],
    engine: RuleEngine,
) -> dict[int, list[str]]:
    """对 terms 为空的图片命中做内容验证。

    Args:
        page: 当前页（core.pdfio.PdfPageView）。
        merged: 该页融合后的命中列表。
        engine: 规则引擎（词表）。

    Returns:
        {merged 下标: 命中的判别 token 列表}。包含 OCR 验证命中或标题栏几何高置信命中。
    """
    verified: dict[int, list[str]] = {}
    for idx, m in enumerate(merged):
        if "vector_image" not in m.channels:
            continue
        if m.terms:
            continue
        # 1. 标题栏/角标区域高置信几何判定（纯图形/特殊艺术字 Logo）
        if is_title_block_logo_candidate(page, m.box):
            verified[idx] = ["TITLE_BLOCK_LOGO"]
            logger.info(
                "图片几何验证命中(标题栏Logo): box=%s", m.box.as_tuple()
            )
            continue
        # 2. OCR 内容核对
        texts = _ocr_image_region(page, m.box)
        if not texts:
            continue
        hits = engine.match_image(" ".join(texts))
        if hits:
            verified[idx] = hits
            logger.info(
                "图片内容验证命中(OCR): box=%s tokens=%s", m.box.as_tuple(), hits
            )
    return verified


def _ocr_image_region(page, box) -> list[str]:
    x0 = box.x0 + VERIFY_INSET_PT
    y0 = box.y0 + VERIFY_INSET_PT
    x1 = box.x1 - VERIFY_INSET_PT
    y1 = box.y1 - VERIFY_INSET_PT
    if x1 <= x0 or y1 <= y0:
        return []
    try:
        engine = get_ocr_engine()
    except Exception:  # noqa: BLE001
        logger.warning("图片内容验证: OCR 不可用，跳过")
        return []
    try:
        arr = page.render_np(dpi=VERIFY_DPI, clip=(x0, y0, x1, y1))
        result = engine(arr)
    except Exception as exc:  # noqa: BLE001
        logger.warning("图片内容验证失败: %s", exc)
        return []
    if not result or not result[0]:
        return []
    return [text for _, text, _ in result[0] if text and text.strip()]
