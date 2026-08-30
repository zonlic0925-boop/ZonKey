"""公文 PDF 脱敏管线（Phase M 去 AGPL：pdfio 检测 + pikepdf 引擎执行）。"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Callable, List, Optional

import pikepdf

from core.detector.rule_engine import RuleEngine
from core.detector.seal_detector import SealDetector
from core.errors import OcrUnavailableError
from core.model import (
    Box, Channel,
    FileResult, PageResult, RedactBox, RedactMode, SensitiveHit,
)
from core.pdfio import PdfDocView
from core.redact.pikepdf_engine import (
    FILL_ERASE,
    RedactPlan,
    apply_page_redactions,
    purge_form_widgets,
)

logger = logging.getLogger(__name__)


class DocPdfPipeline:
    def __init__(
        self,
        rule_engine: RuleEngine,
        seal_detector: Optional[SealDetector] = None,
        dpi: int = 200,
        use_ocr: bool = True,
    ) -> None:
        self.rule_engine = rule_engine
        self.seal_detector = seal_detector or SealDetector()
        self.dpi = dpi
        self.use_ocr = use_ocr
        self._ocr_channel = None

    def process_pdf(
        self,
        input_path: str | Path,
        output_path: str | Path,
        config: Optional[object] = None,
        progress_callback: Optional[Callable[[int, int], None]] = None,
        enable_seal: bool = True,
    ) -> FileResult:
        in_p = Path(input_path)
        out_p = Path(output_path)
        cfg = config or object()
        if not in_p.exists():
            raise FileNotFoundError(f"Input file not found: {in_p}")
        out_p.parent.mkdir(parents=True, exist_ok=True)

        # 第一遍：pdfio 只读检测（文本 + OCR + 可选印章 + 控件值）
        pages_hits: List[List[SensitiveHit]] = []
        with PdfDocView(in_p) as doc:
            total = doc.page_count
            for pidx in range(total):
                page = doc.page(pidx)
                hits = self.collect_page_hits(page, pidx, enable_seal=enable_seal, doc_view=doc)
                pages_hits.append(hits)
                if progress_callback:
                    progress_callback(pidx + 1, total)

        # 第二遍：pikepdf 引擎逐页执行抹除
        pdf = pikepdf.open(str(in_p))
        try:
            pages_res: List[PageResult] = []
            for pidx, hits in enumerate(pages_hits):
                redact_boxes: List[RedactBox] = []
                for h in hits:
                    redact_boxes.append(RedactBox(
                        page_index=pidx,
                        box=h.source_box,
                        boxed=True,
                        manual_required=False,
                        hit_ids=[h.hit_id],
                        channel_labels=[str(h.channel)],
                        terms=list(h.matched_terms or ([h.text] if h.text else [])),
                    ))
                self._apply_redactions_to_page(pdf, pdf.pages[pidx], redact_boxes, cfg)
                pages_res.append(PageResult(
                    page_index=pidx,
                    hits=hits,
                    redact_boxes=redact_boxes,
                ))
            pdf.save(
                str(out_p),
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                compress_streams=True,
            )
        finally:
            pdf.close()
        return FileResult(source_path=in_p, output_path=out_p, pages=pages_res)

    def collect_page_hits(
        self,
        page,
        page_index: int,
        *,
        enable_seal: bool = False,
        doc_view: Optional[PdfDocView] = None,
    ) -> List[SensitiveHit]:
        """矢量文本 + 控件值 + OCR 双通道（混合/扫描公文）+ 可选印章，IoU 去重后返回。

        page: core.pdfio.PdfPageView；doc_view 用于补充 AcroForm 控件值命中
        （等价迁移前 fitz get_text 提取控件外观文本的行为）。
        """
        hits = self._search_text_page(page, page_index)
        if doc_view is not None:
            hits = self._merge_hits(hits, self._search_widget_hits(doc_view, page_index))
        if self.use_ocr:
            hits = self._merge_hits(hits, self._search_ocr_page(page, page_index))
        if enable_seal and self.seal_detector:
            hits = self._merge_hits(hits, self.seal_detector.detect(page, page_index))
        return hits

    def _search_widget_hits(self, doc_view: PdfDocView, page_index: int) -> List[SensitiveHit]:
        hits: List[SensitiveHit] = []
        for text, wbox in doc_view.widget_texts(page_index):
            matched: list[str] = []
            for term in self.rule_engine.terms:
                if term and term.lower() in text.lower():
                    matched.append(term)
            for matched_text, rule_name in self.rule_engine.iter_regex_matches(text):
                matched.append(RuleEngine.expand_match_in_text(text, matched_text))
            if not matched:
                continue
            for term in dict.fromkeys(matched):
                hits.append(SensitiveHit(
                    page_index=page_index,
                    source_box=wbox,
                    channel=Channel.VECTOR_TEXT,
                    matched_terms=[term],
                    text=term,
                    confidence=1.0,
                ))
        return hits

    def _search_ocr_page(self, page, page_index: int) -> List[SensitiveHit]:
        try:
            from core.detector.ocr_channel import get_ocr_engine
            get_ocr_engine()
        except OcrUnavailableError as exc:
            logger.warning("公文 OCR 不可用: %s", exc.message)
            return []
        if self._ocr_channel is None:
            from core.detector.ocr_channel import OcrChannel
            self._ocr_channel = OcrChannel(self.rule_engine)
        return self._ocr_channel.detect(page, page_index)

    @staticmethod
    def _merge_hits(existing: List[SensitiveHit], extra: List[SensitiveHit]) -> List[SensitiveHit]:
        merged = list(existing)
        for h in extra:
            if DocPdfPipeline._is_duplicate_hit(h, merged):
                continue
            merged.append(h)
        return merged

    @staticmethod
    def _is_duplicate_hit(candidate: SensitiveHit, existing: List[SensitiveHit]) -> bool:
        for hi in existing:
            if hi.page_index != candidate.page_index:
                continue
            if hi.source_box.iou(candidate.source_box) > 0.45:
                return True
            hi_terms = {t for t in (hi.matched_terms or []) if t}
            c_terms = {t for t in (candidate.matched_terms or []) if t}
            if hi_terms & c_terms:
                return True
            hi_blob = " ".join([hi.text or "", *(hi.matched_terms or [])])
            for term in c_terms:
                if len(term) >= 6 and term in hi_blob:
                    return True
            c_blob = " ".join([candidate.text or "", *(candidate.matched_terms or [])])
            for term in hi_terms:
                if len(term) >= 6 and term in c_blob:
                    return True
        return False

    def _search_text_page(self, page, page_index: int) -> List[SensitiveHit]:
        """词表与 PII 正则命中（page.search 大小写不敏感，等价 fitz search_for）。"""
        hits: List[SensitiveHit] = []
        for term in self.rule_engine.terms:
            for r in page.search(term):
                hits.append(SensitiveHit(
                    page_index=page_index,
                    source_box=r,
                    channel=Channel.VECTOR_TEXT,
                    matched_terms=[term],
                    text=term,
                    confidence=1.0,
                ))
        page_text = page.page_text()
        search_cache: dict[str, list[Box]] = {}
        for matched_text, rule_name in self.rule_engine.iter_regex_matches(page_text):
            expanded = RuleEngine.expand_match_in_text(page_text, matched_text)
            if expanded not in search_cache:
                rects = page.search(expanded)
                if not rects:
                    rects = page.search(matched_text)
                if not rects:
                    rects = self._rects_from_spans(page, expanded)
                if not rects:
                    rects = self._rects_from_spans(page, matched_text)
                search_cache[expanded] = rects
            for r in search_cache[expanded]:
                hits.append(SensitiveHit(
                    page_index=page_index,
                    source_box=r,
                    channel=Channel.VECTOR_TEXT,
                    matched_terms=[expanded],
                    text=f"[{rule_name}]",
                    confidence=1.0,
                ))
        return self._merge_hits([], hits)

    @staticmethod
    def _rects_from_spans(page, needle: str) -> list[Box]:
        """span 级兜底：span 文本包含 needle 时返回其包围盒（等价 _rects_from_text_dict）。"""
        if not needle:
            return []
        return [span.box for span in page.spans() if needle in span.text]

    def _apply_redactions_to_page(
        self,
        pdf: pikepdf.Pdf,
        page: pikepdf.Page,
        redact_boxes: List[RedactBox],
        config: object,
    ) -> None:
        mode = getattr(config, "redact_mode", RedactMode.ERASE)
        rects: list[Box] = [rb.box for rb in redact_boxes if not rb.manual_required]
        if mode == RedactMode.ERASE:
            # 迁移前 apply_redactions() 默认：images=PIXELS、graphics=REMOVE_IF_COVERED
            if rects:
                plan = RedactPlan(
                    text_rects=list(rects),
                    image_rects=list(rects),
                    paint_rects=list(rects),
                    fill_rgb=FILL_ERASE,
                    graphics_mode="covered",
                )
                apply_page_redactions(pdf, page, plan)
            matched_values = [
                term
                for rb in redact_boxes
                if not rb.manual_required
                for term in (rb.terms or [])
                if term and not term.startswith("[") and term not in ("人工框选", "人工调整", "敏感项")
            ]
            purge_form_widgets(page, rects, matched_values)
        elif mode == RedactMode.COVER:
            # 迁移前行为：COVER 仅涂白覆盖（不删除文本层）
            if rects:
                plan = RedactPlan(paint_rects=list(rects), fill_rgb=(1.0, 1.0, 1.0))
                apply_page_redactions(pdf, page, plan)
        else:  # pragma: no cover - 与迁移前一致：枚举外模式涂黑
            if rects:
                plan = RedactPlan(paint_rects=list(rects), fill_rgb=(0.0, 0.0, 0.0))
                apply_page_redactions(pdf, page, plan)
