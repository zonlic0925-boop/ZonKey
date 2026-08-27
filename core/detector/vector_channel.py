"""矢量通道：从 PDF 内容流提取文字层 span 坐标与图片对象坐标。"""

from __future__ import annotations

from dataclasses import dataclass, field

import fitz

from core.detector.rule_engine import RuleEngine
from core.model import Box, Channel, SensitiveHit

MAX_PAGE_IMAGE_AREA_FRACTION = 0.5


@dataclass
class VecSpan:
    text: str
    box: Box
    font: str
    size: float


@dataclass
class VecImage:
    xref: int
    box: Box
    pixel_size: tuple[int, int]


class VectorChannel:
    def __init__(self, engine: RuleEngine):
        self._engine = engine

    def extract_spans(self, page: fitz.Page) -> list[VecSpan]:
        spans: list[VecSpan] = []
        data = page.get_text("dict")
        for block in data.get("blocks", []):
            if block.get("type") != 0:
                continue
            for line in block.get("lines", []):
                for sp in line.get("spans", []):
                    text = sp.get("text", "")
                    if not text.strip():
                        continue
                    bbox = sp.get("bbox")
                    if not bbox:
                        continue
                    spans.append(
                        VecSpan(
                            text=text,
                            box=Box(bbox[0], bbox[1], bbox[2], bbox[3]),
                            font=sp.get("font", ""),
                            size=float(sp.get("size", 0.0)),
                        )
                    )
        return spans

    def extract_images(self, page: fitz.Page) -> list[VecImage]:
        page_area = page.rect.width * page.rect.height
        images: list[VecImage] = []
        for img in page.get_images(full=True):
            xref = img[0]
            w, h = int(img[2]), int(img[3])
            for rect in page.get_image_rects(xref):
                box = Box(rect.x0, rect.y0, rect.x1, rect.y1)
                if box.area() >= page_area * MAX_PAGE_IMAGE_AREA_FRACTION:
                    continue
                images.append(VecImage(xref=xref, box=box, pixel_size=(w, h)))
        return images

    def detect(self, page: fitz.Page, page_index: int) -> list[SensitiveHit]:
        hits: list[SensitiveHit] = []
        for span in self.extract_spans(page):
            terms = self._engine.match(span.text)
            if terms:
                hits.append(
                    SensitiveHit(
                        page_index=page_index,
                        channel=Channel.VECTOR_TEXT,
                        source_box=span.box,
                        text=span.text,
                        matched_terms=terms,
                    )
                )
        for img in self.extract_images(page):
            hits.append(
                SensitiveHit(
                    page_index=page_index,
                    channel=Channel.VECTOR_IMAGE,
                    source_box=img.box,
                    text="",
                    matched_terms=[],
                    confidence=1.0,
                )
            )
        return hits