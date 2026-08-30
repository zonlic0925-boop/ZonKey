# Seal detector
from __future__ import annotations
import logging
from typing import Iterator, List
import cv2
import numpy as np
from core.model import Box, Channel, SensitiveHit

logger = logging.getLogger(__name__)

class SealDetector:
    def __init__(self, dpi: int = 300, min_area: int = 500, max_area: int = 500000, min_circularity: float = 0.35, min_aspect_ratio: float = 0.5, max_aspect_ratio: float = 2.0):
        self.dpi = dpi
        self.min_area = min_area
        self.max_area = max_area
        self.min_circularity = min_circularity
        self.min_aspect_ratio = min_aspect_ratio
        self.max_aspect_ratio = max_aspect_ratio

    def match(self, image: np.ndarray, page_index: int = 0) -> List[SensitiveHit]:
        if image is None or image.size == 0 or len(image.shape) == 2:
            return []
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        lower_red1 = np.array([0, 43, 46])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([156, 43, 46])
        upper_red2 = np.array([180, 255, 255])
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        red_mask = cv2.bitwise_or(mask1, mask2)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        closed = cv2.morphologyEx(red_mask, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        hits = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < self.min_area or area > self.max_area:
                continue
            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = float(w) / float(h)
            if aspect_ratio < self.min_aspect_ratio or aspect_ratio > self.max_aspect_ratio:
                continue
            perimeter = cv2.arcLength(contour, True)
            circularity = 4 * np.pi * (area / (perimeter * perimeter)) if perimeter > 0 else 0.0
            confidence = min(1.0, max(0.6, circularity * 0.7 + 0.3))
            box = Box(x0=float(x), y0=float(y), x1=float(x + w), y1=float(y + h))
            hit = SensitiveHit(
                page_index=page_index,
                channel=Channel.SEAL,
                source_box=box,
                text='[SEAL:RED_STAMP]',
                matched_terms=['RED_STAMP'],
                confidence=confidence,
            )
            hits.append(hit)
        return hits

    def detect(self, page, page_index: int) -> Iterator[SensitiveHit]:
        """page: core.pdfio.PdfPageView。渲染整页后做红色印章检测。"""
        scale = self.dpi / 72.0
        arr = page.render_np(dpi=self.dpi)
        img_bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        img_hits = self.match(img_bgr, page_index=page_index)
        for h in img_hits:
            pdf_box = Box(
                x0=h.source_box.x0 / scale,
                y0=h.source_box.y0 / scale,
                x1=h.source_box.x1 / scale,
                y1=h.source_box.y1 / scale,
            )
            yield SensitiveHit(
                page_index=page_index,
                channel=Channel.SEAL,
                source_box=pdf_box,
                text=h.text,
                matched_terms=h.matched_terms,
                confidence=h.confidence,
            )
