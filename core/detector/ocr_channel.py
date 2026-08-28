"""OCR 通道：栅格化 PDF 页后交给 RapidOCR 检测文字框。"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import fitz
import numpy as np

from core.detector.rule_engine import RuleEngine
from core.errors import OcrUnavailableError
from core.model import Box, Channel, SensitiveHit

logger = logging.getLogger(__name__)

MAX_SIDE_PX = 4096
DEFAULT_DPI = 300

_engine = None
_engine_error: str | None = None


def get_ocr_engine():
    global _engine, _engine_error
    if _engine is not None:
        return _engine
    if _engine_error is not None:
        raise OcrUnavailableError(_engine_error)
    try:
        from rapidocr_onnxruntime import RapidOCR

        _engine = RapidOCR()
        return _engine
    except Exception as exc:  # noqa: BLE001
        _engine_error = f"{type(exc).__name__}: {exc}"
        raise OcrUnavailableError(_engine_error)


@dataclass
class OcrResultItem:
    box: Box
    text: str
    score: float


class OcrChannel:
    def __init__(self, engine: RuleEngine):
        self._engine = engine

    @staticmethod
    def render_pixmap(page: fitz.Page) -> tuple[np.ndarray, float]:
        max_side = max(page.rect.width, page.rect.height)
        zoom = min(DEFAULT_DPI / 72.0, MAX_SIDE_PX / max_side)
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
            pix.height, pix.width, pix.n
        )
        return arr, zoom

    def detect(self, page: fitz.Page, page_index: int) -> list[SensitiveHit]:
        engine = get_ocr_engine()
        arr, zoom = self.render_pixmap(page)
        result = engine(arr)
        if not result or not result[0]:
            logger.info("OCR page %d: no text", page_index)
            return []
        hits: list[SensitiveHit] = []
        for quad, text, score in result[0]:
            if not text or not text.strip():
                continue
            xs = [p[0] for p in quad]
            ys = [p[1] for p in quad]
            box = Box(
                min(xs) / zoom,
                min(ys) / zoom,
                max(xs) / zoom,
                max(ys) / zoom,
            )
            matched_values, label = self._engine.extract_match_values(text)
            if matched_values:
                hits.append(
                    SensitiveHit(
                        page_index=page_index,
                        channel=Channel.OCR,
                        source_box=box,
                        text=label or text,
                        matched_terms=matched_values,
                        confidence=float(score),
                    )
                )
        return hits