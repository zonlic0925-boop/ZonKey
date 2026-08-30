"""矢量通道：从 PDF 内容流提取文字层 span 坐标与图片对象坐标（pdfplumber 实现）。"""

from __future__ import annotations

from dataclasses import dataclass

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

    def extract_spans(self, page) -> list[VecSpan]:
        """page: core.pdfio.PdfPageView（显示空间坐标，fitz span 语义等价）。"""
        return [
            VecSpan(text=s.text, box=s.box, font=s.font, size=s.size)
            for s in page.spans()
        ]

    def extract_images(self, page) -> list[VecImage]:
        page_area = page.rect.width * page.rect.height
        images: list[VecImage] = []
        for idx, img in enumerate(page.images()):
            if img.box.area() >= page_area * MAX_PAGE_IMAGE_AREA_FRACTION:
                continue
            images.append(VecImage(xref=idx, box=img.box, pixel_size=img.pixel_size))
        return images

    def detect(self, page, page_index: int) -> list[SensitiveHit]:
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
