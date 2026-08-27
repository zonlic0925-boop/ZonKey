"""识别管线：三通道检测 -> 融合 -> 框线归位 -> 可选的抹除执行。"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

import fitz

from core.boxing.box_finder import BoxFinder
from core.boxing.shrink import shrink_boxes_to_hits
from core.detector.fusion import fuse_page
from core.detector.image_verify import verify_image_boxes
from core.detector.logo_matcher import LogoMatcher
from core.detector.ocr_channel import OcrChannel, get_ocr_engine
from core.detector.rule_engine import RuleEngine, load_terms
from core.detector.vector_channel import VectorChannel
from core.errors import DesensError, FileOpenError, OcrUnavailableError
from core.model import Box, FileResult, PageResult, RedactBox, RedactMode
from core.redact.executor import redact_pdf

logger = logging.getLogger(__name__)

DEFAULT_TERMS_REL = Path("rules") / "sensitive_terms.txt"


def _page_spans(page: fitz.Page) -> list[Box]:
    """页面全部矢量文字 span bbox（相邻行保护用）。"""
    spans: list[Box] = []
    for block in page.get_text("dict").get("blocks", []):
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                spans.append(Box(*span["bbox"]))
    return spans


@dataclass
class PipelineConfig:
    terms_file: str = str(DEFAULT_TERMS_REL)
    terms: list[str] | None = None
    use_ocr: bool = True
    use_logo_matcher: bool = True
    image_verify: bool = True
    boxfinder: BoxFinder = field(default_factory=BoxFinder)


def to_audit_dict(result: FileResult) -> dict:
    rows = []
    for page in result.pages:
        for rb in page.redact_boxes:
            rows.append(
                {
                    "box_id": rb.box_id,
                    "page": rb.page_index,
                    "box": [round(v, 2) for v in rb.box.as_tuple()],
                    "boxed": rb.boxed,
                    "manual_required": rb.manual_required,
                    "terms": rb.terms,
                    "channels": rb.channel_labels,
                }
            )
    return {
        "source": result.source_path,
        "output": result.output_path,
        "boxes": rows,
    }


class Pipeline:
    def __init__(self, config: PipelineConfig | None = None):
        cfg = config or PipelineConfig()
        if cfg.terms is not None:
            engine = RuleEngine(terms=cfg.terms)
        else:
            engine = RuleEngine.load_drawing()
        self._engine = engine
        self._vector = VectorChannel(engine)
        self._ocr = OcrChannel(engine) if cfg.use_ocr else None
        self._logo_matcher = LogoMatcher() if cfg.use_logo_matcher else None
        self._image_verify = cfg.image_verify
        self._boxfinder = cfg.boxfinder

    @property
    def rule_engine(self) -> RuleEngine:
        """提供统一规则引擎访问接口。"""
        return self._engine

    def process(self, source: str, *, with_ocr: bool | None = None) -> FileResult:
        if not Path(source).exists():
            raise FileOpenError(source, "输入文件不存在")
        use_ocr = self._ocr is not None if with_ocr is None else with_ocr
        if use_ocr:
            try:
                get_ocr_engine()
            except OcrUnavailableError as exc:
                logger.warning("OCR 通道不可用: %s", exc.message)
                use_ocr = False
        result = FileResult(source_path=str(Path(source).resolve()))
        try:
            doc = fitz.open(source)
        except Exception as exc:  # noqa: BLE001
            raise FileOpenError(source, f"PDF 打开失败: {exc}") from exc
        try:
            for page_index in range(doc.page_count):
                page = doc[page_index]
                hits = list(self._vector.detect(page, page_index))
                if self._logo_matcher is not None:
                    try:
                        hits.extend(self._logo_matcher.detect(page, page_index))
                    except Exception as exc:
                        logger.warning("LogoMatcher 执行异常: %s", exc)
                if use_ocr:
                    try:
                        hits.extend(self._ocr.detect(page, page_index))
                    except OcrUnavailableError as exc:
                        result.ocr_available = False
                        page_result = PageResult(page_index=page_index)
                        page_result.warnings.append(exc.message)
                        result.pages.append(page_result)
                        continue
                merged = fuse_page(hits)
                redact_boxes = self._boxfinder.assign(page, merged)
                # D8（2026-08-17 用户授权）：单元格归位框收缩到敏感文字行范围，
                # 保护格内非敏感内容（图纸编号/材料规格）不被整格连坐抹除；
                # 图片命中（无行概念）与命中覆盖大部分单元格的框保持整格。
                # 相邻行保护：收缩框外扩容差带内有非命中矢量 span 时放弃收缩
                # （ES-09805 回归：行距 <3.2pt 时 MuPDF 会连坐删除相邻行字形）。
                redact_boxes = shrink_boxes_to_hits(
                    redact_boxes, hits, spans=_page_spans(page)
                )
                # D3/R1：纯图片命中（无文字支撑）做内容验证——
                # 验证命中（图片内含公司名/标记）允许无框自动执行（补漏）；
                # 验证未命中（如 PART NUMBER 表等正常图纸内容）降级待人工（防误抹）。
                verified: dict[int, list[str]] = {}
                if self._image_verify and merged:
                    verified = verify_image_boxes(page, merged, self._engine)
                    for idx, tokens in verified.items():
                        rb = redact_boxes[idx]
                        redact_boxes[idx] = RedactBox(
                            page_index=rb.page_index,
                            box=rb.box,
                            boxed=True,
                            manual_required=False,
                            hit_ids=rb.hit_ids,
                            channel_labels=rb.channel_labels,
                            terms=rb.terms + tokens,
                            redact_graphics=True,
                        )
                    # 验证未命中（正常图纸内容）降级待人工，防 R1 类误抹；
                    # 仅验证机制启用时生效，关闭验证则保持 box_finder 原归位结果。
                    for idx, m in enumerate(merged):
                        if (
                            "vector_image" in m.channels
                            and not m.terms
                            and idx not in verified
                        ):
                            rb = redact_boxes[idx]
                            redact_boxes[idx] = RedactBox(
                                page_index=rb.page_index,
                                box=rb.box,
                                boxed=False,
                                manual_required=True,
                                hit_ids=rb.hit_ids,
                                channel_labels=rb.channel_labels,
                                terms=rb.terms,
                            )
                page_result = PageResult(
                    page_index=page_index,
                    hits=merged,
                    redact_boxes=redact_boxes,
                )
                result.pages.append(page_result)
        finally:
            doc.close()
        return result

    def redact_result(
        self,
        result: FileResult,
        mode: RedactMode,
        output: str | None = None,
        audit_path: str | None = None,
        confirm_box_ids: set[str] | None = None,
        disabled_box_ids: set[str] | None = None,
    ) -> FileResult:
        """对已检测的 FileResult 执行抹除（UI 确认通道复用同一语义）。

        confirm_box_ids：用户显式确认执行的待人工框 box_id 集合；
        disabled_box_ids：用户显式取消/禁用的抹除框 box_id 集合（自动框被用户取消抹除）；
        未确认的 manual 框按宪法不得执行。未被禁用的 boxed 框正常执行。
        """
        confirmed = confirm_box_ids or set()
        disabled = disabled_box_ids or set()
        redact_boxes = [
            rb
            for rb in result.all_redact_boxes()
            if rb.box_id not in disabled and (rb.boxed or rb.box_id in confirmed)
        ]
        if redact_boxes:
            result.output_path = redact_pdf(result.source_path, redact_boxes, mode, output)
        elif audit_path is not None:
            logger.info("无执行框（全部待人工确认或已取消），不生成输出文件")
        if audit_path is not None:
            Path(audit_path).parent.mkdir(parents=True, exist_ok=True)
            Path(audit_path).write_text(
                json.dumps(to_audit_dict(result), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        return result

    def create_manual_result(self, source: str) -> FileResult:
        """为未执行自动检测的文档创建空 FileResult（用于用户直接手动框选）。"""
        try:
            doc = fitz.open(source)
            try:
                pages = [PageResult(page_index=i) for i in range(doc.page_count)]
                return FileResult(source_path=source, pages=pages, ocr_available=True)
            finally:
                doc.close()
        except Exception as exc:
            raise FileOpenError(source, f"打开图纸失败: {exc}") from exc

    def add_manual_box(
        self,
        result: FileResult,
        page_index: int,
        box: Box,
        terms: list[str] | None = None,
        redact_graphics: bool = True,
    ) -> RedactBox:
        """人工交互：向结果中添加一个自定义抹除框。"""
        if terms is None:
            terms = ["人工添加"]
        else:
            terms = [f"{t} (人工添加)" if "人工" not in t else t for t in terms]
        rb = RedactBox(
            page_index=page_index,
            box=box,
            boxed=True,
            manual_required=False,
            channel_labels=["MANUAL"],
            terms=terms,
            redact_graphics=redact_graphics,
        )
        if 0 <= page_index < len(result.pages):
            result.pages[page_index].redact_boxes.append(rb)
        return rb

    def remove_box(self, result: FileResult, box_id: str) -> bool:
        """人工交互：从结果中删除指定 box_id 的抹除框。"""
        removed = False
        for p in result.pages:
            orig_len = len(p.redact_boxes)
            p.redact_boxes = [b for b in p.redact_boxes if b.box_id != box_id]
            if len(p.redact_boxes) < orig_len:
                removed = True
        return removed

    def clear_boxes(self, result: FileResult) -> None:
        """人工交互：清空全部抹除框。"""
        for p in result.pages:
            p.redact_boxes.clear()

    def process_and_redact(
        self,
        source: str,
        mode: RedactMode,
        output: str | None = None,
        audit_path: str | None = None,
        confirm_box_ids: set[str] | None = None,
        disabled_box_ids: set[str] | None = None,
    ) -> FileResult:
        result = self.process(source)
        return self.redact_result(
            result, mode, output=output, audit_path=audit_path,
            confirm_box_ids=confirm_box_ids,
            disabled_box_ids=disabled_box_ids,
        )