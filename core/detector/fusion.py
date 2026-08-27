"""融合器：跨通道命中去重与相邻合并。"""

from __future__ import annotations

from dataclasses import dataclass, field

from core.model import Box, SensitiveHit

IOU_MERGE_THRESHOLD = 0.5
NEIGHBOR_GAP_PT = 20.0


@dataclass
class MergedHit:
    box: Box
    hits: list[SensitiveHit] = field(default_factory=list)

    @property
    def page_index(self) -> int:
        return self.hits[0].page_index

    @property
    def text(self) -> str:
        texts = [h.text for h in self.hits if h.text]
        return max(texts, key=len) if texts else ""

    @property
    def terms(self) -> list[str]:
        union: list[str] = []
        seen = set()
        for h in sorted(self.hits, key=lambda x: x.unique_term(), reverse=True):
            for t in h.matched_terms:
                if t not in seen:
                    seen.add(t)
                    union.append(t)
        return union

    @property
    def channels(self) -> list[str]:
        seen = set()
        out = []
        for h in self.hits:
            if h.channel.value not in seen:
                seen.add(h.channel.value)
                out.append(h.channel.value)
        return out

    @property
    def mean_confidence(self) -> float:
        return sum(h.confidence for h in self.hits) / max(1, len(self.hits))


def merge_duplicates(hits: list[SensitiveHit]) -> list[SensitiveHit]:
    merged: list[SensitiveHit] = []
    for hit in hits:
        target = None
        for m in merged:
            inter = hit.source_box.iou(m.source_box)
            if inter >= IOU_MERGE_THRESHOLD:
                target = m
                break
        if target is None:
            merged.append(hit)
        else:
            target.source_box = target.source_box.union(hit.source_box)
            if hit.text and len(hit.text) > len(target.text):
                target.text = hit.text
            for t in hit.matched_terms:
                if t not in target.matched_terms:
                    target.matched_terms.append(t)
            target.confidence = max(target.confidence, hit.confidence)
    return merged


def _boxes_near(a: Box, b: Box) -> bool:
    dx = max(0.0, max(a.x0, b.x0) - min(a.x1, b.x1)) if a.x1 <= b.x0 or b.x1 <= a.x0 else 0.0
    dy = max(0.0, max(a.y0, b.y0) - min(a.y1, b.y1)) if a.y1 <= b.y0 or b.y1 <= a.y0 else 0.0
    overlap_x = min(a.x1, b.x1) - max(a.x0, b.x0)
    overlap_y = min(a.y1, b.y1) - max(a.y0, b.y0)
    horizontal_neighbor = (
        dx <= 45.0
        and overlap_y >= min(a.y1 - a.y0, b.y1 - b.y0) * 0.4
    )
    vertical_neighbor = (
        dy <= 25.0
        and overlap_x >= min(a.x1 - a.x0, b.x1 - b.x0) * 0.4
    )
    return horizontal_neighbor or vertical_neighbor


def merge_neighbors(hits: list[SensitiveHit]) -> list[MergedHit]:
    hits = merge_duplicates(hits)
    if not hits:
        return []
    parent = list(range(len(hits)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        ri, rj = find(i), find(j)
        if ri != rj:
            parent[rj] = ri

    for i in range(len(hits)):
        for j in range(i + 1, len(hits)):
            if _boxes_near(hits[i].source_box, hits[j].source_box):
                union(i, j)

    groups: dict[int, list[SensitiveHit]] = {}
    for i, hit in enumerate(hits):
        groups.setdefault(find(i), []).append(hit)

    out: list[MergedHit] = []
    for members in groups.values():
        box = members[0].source_box
        for m in members[1:]:
            box = box.union(m.source_box)
        out.append(MergedHit(box=box, hits=members))
    return out


def fuse_page(hits: list[SensitiveHit]) -> list[MergedHit]:
    return merge_neighbors(hits)