from __future__ import annotations
import logging
from pathlib import Path
from typing import Callable, List, Optional
import fitz
from core.detector.rule_engine import RuleEngine
from core.detector.seal_detector import SealDetector
from core.model import (
    Box, Channel, 
    FileResult, PageResult, RedactBox, RedactMode, SensitiveHit, 
)

logger = logging.getLogger(__name__)

class DocPdfPipeline:
    def __init__(self, rule_engine: RuleEngine, seal_detector: Optional[SealDetector] = None, dpi: int = 200) -> None:
        self.rule_engine = rule_engine
        self.seal_detector = seal_detector or SealDetector()
        self.dpi = dpi

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
            hits: List[SensitiveHit] = []
            redact_boxes: List[RedactBox] = []
            hits.extend(self._search_text_page(page, pidx))
            if enable_seal and self.seal_detector:
                hits.extend(self.seal_detector.detect(page, pidx))
            for h in hits:
                redact_boxes.append(RedactBox(
                    page_index=pidx,
                    box=h.source_box,
                    boxed=True,
                    manual_required=False,
                    hit_ids=[h.hit_id],
                    channel_labels=[str(h.channel)],
                    terms=[h.text],
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
        spans = self.rule_engine.find_spans(page_text)
        for st, end, mtext in spans:
            for r in page.search_for(mtext):
                hits.append(SensitiveHit(
                    page_index=page_index,
                    source_box=Box(r.x0, r.y0, r.x1, r.y1),
                    channel=Channel.VECTOR_TEXT,
                    matched_terms=[mtext],
                    text=mtext,
                    confidence=1.0,
                ))
        unique: List[SensitiveHit] = []
        for h in hits:
            if not any(hi.source_box.iou(h.source_box) > 0.8 for hi in unique):
                unique.append(h)
        return unique

    def _apply_redactions_to_page(self, page: fitz.Page, redact_boxes: List[RedactBox], config: object) -> None:
        mode = getattr(config, "redact_mode", RedactMode.ERASE)
        for rb in redact_boxes:
            if rb.manual_required:
                continue
            r = fitz.Rect(rb.box.x0, rb.box.y0, rb.box.x1, rb.box.y1)
            if mode == RedactMode.ERASE:
                page.add_redact_annot(r, fill=(1, 1, 1))
            elif mode == RedactMode.COVER:
                page.draw_rect(r, color=None, fill=(1, 1, 1))
            else:
                page.draw_rect(r, color=None, fill=(0, 0, 0))
        if mode == RedactMode.ERASE:
            page.apply_redactions()
