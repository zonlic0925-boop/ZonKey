"r""Visual logo detector using multi-scale template matching against standard logo templates."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Iterator, List, Optional, Tuple

import cv2
import fitz  # PyMuPDF
import numpy as np

from core.app_paths import get_app_root
from core.model import Box, Channel, SensitiveHit

logger = logging.getLogger(__name__)


class LogoTemplate:
    """Represents a single logo template loaded from disk."""

    def __init__(self, name: str, image_gray: np.ndarray, term: str = "LOGO", threshold: float = 0.80):
        self.name = name
        self.image_gray = image_gray
        self.term = term
        self.threshold = threshold
        self.height, self.width = image_gray.shape[:2]


class LogoMatcher:
    """Detects company logos in PDF pages via multi-scale normalized cross-correlation template matching."""

    def __init__(
        self,
        template_dir: Optional[str | Path] = None,
        logo_dir: Optional[str | Path] = None,
        dpi: int = 300,
        scales: Optional[List[float]] = None,
        threshold: Optional[float] = None,
    ):
        self.dpi = dpi
        self.scales = scales or [0.5, 0.6, 0.75, 0.85, 1.0, 1.15, 1.3, 1.5, 1.66667, 1.8, 2.0]
        if template_dir is None:
            template_dir = logo_dir
        if template_dir is None:
            template_dir = get_app_root() / "rules" / "logos"
        self.template_dir = Path(template_dir)
        self.templates: List[LogoTemplate] = []
        self._load_templates()

    def _load_templates(self) -> None:
        if not self.template_dir.exists():
            logger.warning(f"Logo template directory {self.template_dir} does not exist.")
            return

        for ext in ("*.png", "*.jpg", "*.jpeg", "*.bmp"):
            for tmpl_path in sorted(self.template_dir.glob(ext)):
                img = cv2.imread(str(tmpl_path), cv2.IMREAD_GRAYSCALE)
                if img is None or img.size == 0:
                    continue

                term = tmpl_path.stem.split("_")[0].upper() if "_" in tmpl_path.stem else tmpl_path.stem.upper()
                thresh = 0.80
                self.templates.append(LogoTemplate(name=tmpl_path.stem, image_gray=img, term=term, threshold=thresh))

    def match(self, image: np.ndarray, page_index: int = 0) -> List[SensitiveHit]:
        """Runs template matching directly on an OpenCV image array (grayscale or BGR)."""
        if not self.templates or image is None or image.size == 0:
            return []

        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image

        found_boxes: List[Tuple[float, float, float, float, float, str]] = []

        for tmpl in self.templates:
            th, tw = tmpl.height, tmpl.width
            best_val = -1.0
            best_rect = None

            for scale in self.scales:
                nw = int(tw * scale)
                nh = int(th * scale)
                if nw < 10 or nh < 10 or nw >= gray.shape[1] or nh >= gray.shape[0]:
                    continue

                resized = cv2.resize(tmpl.image_gray, (nw, nh), interpolation=cv2.INTER_AREA if scale < 1.0 else cv2.INTER_CUBIC)
                res = cv2.matchTemplate(gray, resized, cv2.TM_CCOEFF_NORMED)
                _, max_val, _, max_loc = cv2.minMaxLoc(res)

                if max_val >= tmpl.threshold and max_val > best_val:
                    best_val = float(max_val)
                    x0 = float(max_loc[0])
                    y0 = float(max_loc[1])
                    x1 = x0 + float(nw)
                    y1 = y0 + float(nh)
                    best_rect = (x0, y0, x1, y1, best_val, tmpl.term)

            if best_rect is not None:
                found_boxes.append(best_rect)

        kept_boxes: List[Tuple[float, float, float, float, float, str]] = []
        for fb in sorted(found_boxes, key=lambda x: x[4], reverse=True):
            bx0, by0, bx1, by1, score, term = fb
            overlap = False
            for kb in kept_boxes:
                kx0, ky0, kx1, ky1, _, _ = kb
                inter_x0 = max(bx0, kx0)
                inter_y0 = max(by0, ky0)
                inter_x1 = min(bx1, kx1)
                inter_y1 = min(by1, ky1)
                if inter_x1 > inter_x0 and inter_y1 > inter_y0:
                    inter_area = (inter_x1 - inter_x0) * (inter_y1 - inter_y0)
                    b_area = (bx1 - bx0) * (by1 - by0)
                    if b_area > 0 and inter_area / b_area > 0.4:
                        overlap = True
                        break
            if not overlap:
                kept_boxes.append(fb)

        hits: List[SensitiveHit] = []
        for bx0, by0, bx1, by1, score, term in kept_boxes:
            hits.append(
                SensitiveHit(
                    page_index=page_index,
                    channel=Channel.VECTOR_IMAGE,
                    source_box=Box(bx0, by0, bx1, by1),
                    text=f"[LOGO:{term}]",
                    matched_terms=[term],
                    confidence=min(1.0, float(score)),
                )
            )
        return hits

    def detect(self, page: fitz.Page, page_index: int) -> Iterator[SensitiveHit]:
        """Runs template matching on page ROI and yields SensitiveHit objects."""
        if not self.templates:
            return

        pw, ph = page.rect.width, page.rect.height
        roi_x0 = int(pw * 0.45)
        roi_y0 = int(ph * 0.55)
        roi_rect = fitz.Rect(roi_x0, roi_y0, pw, ph)

        zoom = self.dpi / 72.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, clip=roi_rect)

        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        if pix.n >= 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY if pix.n == 3 else cv2.COLOR_RGBA2GRAY)
        else:
            gray = img

        if gray.shape[0] < 50 or gray.shape[1] < 50:
            return

        hits = self.match(gray, page_index=page_index)
        for h in hits:
            bx0 = roi_x0 + (h.source_box.x0 / zoom)
            by0 = roi_y0 + (h.source_box.y0 / zoom)
            bx1 = roi_x0 + (h.source_box.x1 / zoom)
            by1 = roi_y0 + (h.source_box.y1 / zoom)
            yield SensitiveHit(
                page_index=page_index,
                channel=Channel.VECTOR_IMAGE,
                source_box=Box(bx0, by0, bx1, by1),
                text=h.text,
                matched_terms=h.matched_terms,
                confidence=h.confidence,
            )
