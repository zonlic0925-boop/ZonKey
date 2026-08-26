from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum


class Channel(str, Enum):
    VECTOR_TEXT = 'vector_text'
    VECTOR_IMAGE = 'vector_image'
    VECTOR_DRAWING = 'vector_drawing'
    OCR = 'ocr'
    SEAL = 'seal'


class RedactMode(str, Enum):
    ERASE = 'erase'
    COVER = 'cover'


@dataclass(frozen=True)
class Box:
    x0: float
    y0: float
    x1: float
    y1: float

    def union(self, other: Box) -> Box:
        return Box(
            min(self.x0, other.x0),
            min(self.y0, other.y0),
            max(self.x1, other.x1),
            max(self.y1, other.y1),
        )

    def intersects(self, other: Box) -> bool:
        return not (
            self.x1 <= other.x0
            or other.x1 <= self.x0
            or self.y1 <= other.y0
            or other.y1 <= self.y0
        )

    def grow(self, delta: float) -> Box:
        return Box(self.x0 - delta, self.y0 - delta, self.x1 + delta, self.y1 + delta)

    def area(self) -> float:
        return max(0.0, self.x1 - self.x0) * max(0.0, self.y1 - self.y0)

    @property
    def width(self) -> float:
        return max(0.0, self.x1 - self.x0)

    @property
    def height(self) -> float:
        return max(0.0, self.y1 - self.y0)

    def iou(self, other: Box) -> float:
        iw = min(self.x1, other.x1) - max(self.x0, other.x0)
        ih = min(self.y1, other.y1) - max(self.y0, other.y0)
        inter = max(0.0, iw) * max(0.0, ih)
        union = self.area() + other.area() - inter
        if union <= 0:
            return 0.0
        return inter / union

    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.x0, self.y0, self.x1, self.y1)


@dataclass
class SensitiveHit:
    page_index: int
    channel: Channel
    source_box: Box
    text: str = ''
    matched_terms: list[str] = field(default_factory=list)
    confidence: float = 1.0

    @property
    def score(self) -> float:
        return self.confidence

    @property
    def term(self) -> str:
        return self.matched_terms[0] if self.matched_terms else ""
    hit_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])

    def unique_term(self) -> str:
        return max(self.matched_terms, key=len) if self.matched_terms else ''


@dataclass
class RedactBox:
    page_index: int
    box: Box
    boxed: bool
    manual_required: bool
    hit_ids: list[str] = field(default_factory=list)
    channel_labels: list[str] = field(default_factory=list)
    terms: list[str] = field(default_factory=list)
    redact_graphics: bool = False
    box_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])

    @property
    def id(self) -> str:
        return self.box_id


@dataclass
class PageResult:
    page_index: int
    hits: list[SensitiveHit] = field(default_factory=list)
    redact_boxes: list[RedactBox] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class FileResult:
    source_path: str
    output_path: str | None = None
    pages: list[PageResult] = field(default_factory=list)
    ocr_available: bool = True

    def all_hits(self) -> list[SensitiveHit]:
        return [h for p in self.pages for h in p.hits]

    def all_redact_boxes(self) -> list[RedactBox]:
        return [r for p in self.pages for r in p.redact_boxes]


@dataclass
class WordReplaceRule:
    find: str
    replace: str = '[已脱敏]'
    mode: str = 'exact'  # exact or regex
    enabled: bool = True


@dataclass
class WordMatch:
    start: int
    end: int
    text: str
    replacement: str
    mode: str = 'exact'
    source: str = 'rule'
    rule_index: int = -1
