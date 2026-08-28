from __future__ import annotations
import logging
from pathlib import Path
from typing import Callable, List, Optional
import fitz
from core.detector.rule_engine import RuleEngine
from core.detector.seal_detector import SealDetector
from core.errors import OcrUnavailableError
from core.redact.executor import _purge_form_widgets
from core.model import (
    Box, Channel,
    FileResult, PageResult, RedactBox, RedactMode, SensitiveHit,
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
        doc = fitz.open(in_p)
        pages_res: List[PageResult] = []
        for pidx, page in enumerate(doc):
            hits: List[SensitiveHit] = self.collect_page_hits(page, pidx, enable_seal=enable_seal)
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
            self._apply_redactions_to_page(page, redact_boxes, cfg)
            pages_res.append(PageResult(
                page_index=pidx,
                hits=hits,
                redact_boxes=redact_boxes,
            ))
            if progress_callback:
                progress_callback(pidx + 1, len(doc))
        doc.save(str(out_p), garbage=4, deflate=True)
        doc.close()
        return FileResult(source_path=in_p, output_path=out_p, pages=pages_res)

    def collect_page_hits(
        self,
        page: fitz.Page,
        page_index: int,
        *,
        enable_seal: bool = False,
    ) -> List[SensitiveHit]:
        """矢量文本 + OCR 双通道（混合/扫描公文）+ 可选印章，IoU 去重后返回。"""
        hits = self._search_text_page(page, page_index)
        if self.use_ocr:
            hits = self._merge_hits(hits, self._search_ocr_page(page, page_index))
        if enable_seal and self.seal_detector:
            hits = self._merge_hits(hits, self.seal_detector.detect(page, page_index))
        return hits

    def _search_ocr_page(self, page: fitz.Page, page_index: int) -> List[SensitiveHit]:
        try:
            from core.detector.ocr_channel import OcrChannel, get_ocr_engine
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

    def _search_text_page(self, page: fitz.Page, page_index: int) -> List[SensitiveHit]:
        hits: List[SensitiveHit] = []
        for term in self.rule_engine.terms:
            for r in page.search_for(term):
                hits.append(SensitiveHit(
                    page_index=page_index,
                    source_box=Box(r.x0, r.y0, r.x1, r.y1),
                    channel=Channel.VECTOR_TEXT,
                    matched_terms=[term],
                    text=term,
                    confidence=1.0,
                ))
        page_text = page.get_text("text")
        search_cache: dict[str, list] = {}
        for matched_text, rule_name in self.rule_engine.iter_regex_matches(page_text):
            expanded = RuleEngine.expand_match_in_text(page_text, matched_text)
            if expanded not in search_cache:
                try:
                    rects = page.search_for(expanded)
                except RuntimeError as exc:
                    logger.warning("search_for failed for %r: %s", expanded, exc)
                    rects = []
                if not rects:
                    rects = page.search_for(matched_text)
                if not rects:
                    rects = self._rects_from_text_dict(page, expanded)
                if not rects:
                    rects = self._rects_from_text_dict(page, matched_text)
                search_cache[expanded] = rects
            for r in search_cache[expanded]:
                hits.append(SensitiveHit(
                    page_index=page_index,
                    source_box=Box(r.x0, r.y0, r.x1, r.y1),
                    channel=Channel.VECTOR_TEXT,
                    matched_terms=[expanded],
                    text=f"[{rule_name}]",
                    confidence=1.0,
                ))
        return self._merge_hits([], hits)

    @staticmethod
    def _rects_from_text_dict(page: fitz.Page, needle: str) -> list[fitz.Rect]:
        if not needle:
            return []
        rects: list[fitz.Rect] = []
        try:
            blocks = page.get_text("dict").get("blocks", [])
        except Exception:
            return rects
        for block in blocks:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span.get("text", "")
                    if needle in text:
                        bbox = span.get("bbox")
                        if bbox and len(bbox) == 4:
                            rects.append(fitz.Rect(bbox))
        return rects

    def _apply_redactions_to_page(self, page: fitz.Page, redact_boxes: List[RedactBox], config: object) -> None:
        mode = getattr(config, "redact_mode", RedactMode.ERASE)
        rects: list[fitz.Rect] = []
        for rb in redact_boxes:
            if rb.manual_required:
                continue
            r = fitz.Rect(rb.box.x0, rb.box.y0, rb.box.x1, rb.box.y1)
            rects.append(r)
            if mode == RedactMode.ERASE:
                page.add_redact_annot(r, fill=(1, 1, 1))
            elif mode == RedactMode.COVER:
                page.draw_rect(r, color=None, fill=(1, 1, 1))
            else:
                page.draw_rect(r, color=None, fill=(0, 0, 0))
        if mode == RedactMode.ERASE:
            page.apply_redactions()
            matched_values = [
                term
                for rb in redact_boxes
                if not rb.manual_required
                for term in (rb.terms or [])
                if term and not term.startswith("[") and term not in ("人工框选", "人工调整", "敏感项")
            ]
            _purge_form_widgets(page, rects, matched_values)
