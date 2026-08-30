"""框线归位：将敏感命中块向上归位到最小封闭表格单元格。

图纸格线常被拆成大量短线段，必须先做共线聚类与区间合并，
再对每个命中块在局部半径内寻找最近格线，四边齐备才构成单元格。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from core.detector.fusion import MergedHit
from core.model import Box, RedactBox

logger = logging.getLogger(__name__)

LINE_TOL = 1.5
GAP_TOL = 3.0
MIN_LINE_LEN = 5.0
LOCAL_RADIUS = 150.0
SNAP_TOL = 4.0
FALLBACK_PADDING = 2.0
OVERLAP_MIN = 10.0

# 栅格框线检测（纯栅格扫描图，D4）：矢量格线不足时启用
RASTER_TRIGGER_LINES = 8
RASTER_DPI = 150
RASTER_MIN_LEN_PT = 12.0
RASTER_LINE_DENSITY = 0.9
RASTER_MAX_THICK_PT = 3.0
RASTER_SEARCH_RADIUS_PT = 1200.0
RASTER_BOX_RATIO_CAP = 20.0
RASTER_EDGE_TOL_PT = 60.0

# 行/列投影实心段检测：扫描图框线是长而实心的细黑段；
# 文字行因笔画间有空白（密度低）或厚度大（字高）被自然排除。


@dataclass(frozen=True)
class HLine:
    y: float
    x0: float
    x1: float


@dataclass(frozen=True)
class VLine:
    x: float
    y0: float
    y1: float


def _merge_intervals(intervals: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if not intervals:
        return []
    ordered = sorted(intervals)
    merged: list[tuple[float, float]] = [list(ordered[0])]
    for lo, hi in ordered[1:]:
        last = merged[-1]
        if lo <= last[1] + GAP_TOL:
            if hi > last[1]:
                last[1] = hi
        else:
            merged.append([lo, hi])
    return [(lo, hi) for lo, hi in merged]


class BoxFinder:
    def __init__(
        self,
        *,
        line_tol: float = LINE_TOL,
        gap_tol: float = GAP_TOL,
        min_line_len: float = MIN_LINE_LEN,
        local_radius: float = LOCAL_RADIUS,
        fallback_padding: float = FALLBACK_PADDING,
    ):
        self._line_tol = line_tol
        self._gap_tol = gap_tol
        self._min_line_len = min_line_len
        self._local_radius = local_radius
        self._fallback_padding = fallback_padding

    def _extract_grid(self, page) -> tuple[list[HLine], list[VLine]]:
        """矢量格线提取（page: core.pdfio.PdfPageView）。

        只取 stroke 线段（等价迁移前 fitz get_drawings 的 "l" 项），
        "re" 矩形不参与格线，行为与原实现一致。
        """
        bucket = max(1.0, self._line_tol * 2)
        h_segs: dict[float, list[tuple[float, float]]] = {}
        v_segs: dict[float, list[tuple[float, float]]] = {}
        for (px1, py1), (px2, py2) in page.line_segments():
            if abs(py1 - py2) <= self._line_tol and abs(px1 - px2) >= self._min_line_len:
                key = round((py1 + py2) / 2 / bucket) * bucket
                h_segs.setdefault(key, []).append(
                    (min(px1, px2), max(px1, px2))
                )
            elif abs(px1 - px2) <= self._line_tol and abs(py1 - py2) >= self._min_line_len:
                key = round((px1 + px2) / 2 / bucket) * bucket
                v_segs.setdefault(key, []).append(
                    (min(py1, py2), max(py1, py2))
                )
        hlines: list[HLine] = []
        for y_key, segs in h_segs.items():
            for x0, x1 in _merge_intervals(segs):
                if x1 - x0 >= self._min_line_len:
                    hlines.append(HLine(y=float(y_key), x0=x0, x1=x1))
        vlines: list[VLine] = []
        for x_key, segs in v_segs.items():
            for y0, y1 in _merge_intervals(segs):
                if y1 - y0 >= self._min_line_len:
                    vlines.append(VLine(x=float(x_key), y0=y0, y1=y1))
        return hlines, vlines

    def _extract_grid_raster(self, page) -> tuple[list[HLine], list[VLine]]:
        """纯栅格页的像素级框线检测：行/列投影找长实心细段。

        扫描图方框线是栅格像素，矢量 drawings 提取不到（D4）。
        线行特征：长度 >= 阈值、段内实心度 >= 0.9、厚度 <= 3pt；
        文字行笔画间有空隙（密度低）或字高超过厚度上限，不会误判。
        仅在矢量格线不足时调用（见 assign）。
        """
        try:
            import cv2
            import numpy as np
        except ImportError as exc:  # noqa: BLE001
            logger.warning("box_finder: 栅格框线检测不可用（缺少 cv2/numpy）: %s", exc)
            return [], []

        zoom = RASTER_DPI / 72.0
        gray = page.render_np(dpi=RASTER_DPI)
        if gray.ndim == 3:
            gray = cv2.cvtColor(gray, cv2.COLOR_RGB2GRAY)
        _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)

        min_len_px = RASTER_MIN_LEN_PT * zoom
        max_thick_px = RASTER_MAX_THICK_PT * zoom
        hlines = self._raster_axis_lines(bw, min_len_px, max_thick_px, horizontal=True, zoom=zoom)
        vlines = self._raster_axis_lines(bw, min_len_px, max_thick_px, horizontal=False, zoom=zoom)
        return hlines, vlines

    @staticmethod
    def _raster_axis_lines(
        bw: "np.ndarray", min_len_px: float, max_thick_px: float,
        *, horizontal: bool, zoom: float,
    ) -> list:
        import numpy as np

        if horizontal:
            img = bw
        else:
            img = bw.T
        h, w = img.shape
        # 每行找长实心段
        seg_rows: dict[int, list[tuple[int, int]]] = {}
        for y in range(h):
            idx = np.where(img[y] > 0)[0]
            if idx.size == 0:
                continue
            splits = np.where(np.diff(idx) > 1)[0] + 1
            for seg in np.split(idx, splits):
                if seg.size < min_len_px:
                    continue
                density = seg.size / (seg[-1] - seg[0] + 1)
                if density >= RASTER_LINE_DENSITY:
                    seg_rows.setdefault(y, []).append((int(seg[0]), int(seg[-1])))
        # 相邻行聚类（厚度上限）
        lines: list = []
        for y in sorted(seg_rows):
            segs = seg_rows[y]
            for x0, x1 in segs:
                placed = False
                for line in lines:
                    ly, lx0, lx1 = line[0], line[1], line[2]
                    if y - ly <= max_thick_px and x0 <= lx1 + 1 and x1 >= lx0 - 1:
                        if y - ly > 0:
                            line[0] = y
                        line[1] = min(line[1], x0)
                        line[2] = max(line[2], x1)
                        placed = True
                        break
                if not placed:
                    lines.append([y, x0, x1])
        out = []
        for y, x0, x1 in lines:
            if x1 - x0 < min_len_px:
                continue
            if horizontal:
                out.append(HLine(y=(y + 0.5) / zoom, x0=x0 / zoom, x1=x1 / zoom))
            else:
                out.append(VLine(x=(y + 0.5) / zoom, y0=x0 / zoom, y1=x1 / zoom))
        return out

    @staticmethod
    def _x_overlap(a: Box, x0: float, x1: float) -> float:
        return max(0.0, min(a.x1, x1) - max(a.x0, x0))

    @staticmethod
    def _y_overlap(a: Box, y0: float, y1: float) -> float:
        return max(0.0, min(a.y1, y1) - max(a.y0, y0))

    def _snap(self, box: Box, hlines: list[HLine], vlines: list[VLine]) -> tuple[Box, bool]:
        min_overlap = min(OVERLAP_MIN, box.x1 - box.x0, box.y1 - box.y0)
        up = None
        for hl in hlines:
            if box.y1 - SNAP_TOL <= hl.y <= box.y1 + self._local_radius:
                if self._x_overlap(box, hl.x0, hl.x1) >= min_overlap * 0.3:
                    if up is None or hl.y < up.y:
                        up = hl
        down = None
        for hl in hlines:
            if box.y0 - self._local_radius <= hl.y <= box.y0 + SNAP_TOL:
                if self._x_overlap(box, hl.x0, hl.x1) >= min_overlap * 0.3:
                    if down is None or hl.y > down.y:
                        down = hl
        left = None
        for vl in vlines:
            if box.x0 - self._local_radius <= vl.x <= box.x0 + SNAP_TOL:
                if self._y_overlap(box, vl.y0, vl.y1) >= min_overlap * 0.3:
                    if left is None or vl.x > left.x:
                        left = vl
        right = None
        for vl in vlines:
            if box.x1 - SNAP_TOL <= vl.x <= box.x1 + self._local_radius:
                if self._y_overlap(box, vl.y0, vl.y1) >= min_overlap * 0.3:
                    if right is None or vl.x < right.x:
                        right = vl
        if up is not None and down is not None and left is not None and right is not None:
            return (
                Box(left.x, down.y, right.x, up.y),
                True,
            )
        # 三边闭合且贴近页面边缘（如页眉/页脚单边开放长条保密框）的特殊归位
        if up is not None and down is not None:
            if left is not None and right is None and (box.x1 >= 0.7 * (hlines[0].x1 if hlines else 500)):
                # 靠右侧延伸到最右线
                rx = max((hl.x1 for hl in hlines if abs(hl.y - up.y) < 5 or abs(hl.y - down.y) < 5), default=box.x1 + self._fallback_padding)
                return (Box(left.x, down.y, rx, up.y), True)
            if right is not None and left is None and box.x0 <= 0.3 * (hlines[0].x1 if hlines else 500):
                # 靠左侧延伸到最左线
                lx = min((hl.x0 for hl in hlines if abs(hl.y - up.y) < 5 or abs(hl.y - down.y) < 5), default=box.x0 - self._fallback_padding)
                return (Box(lx, down.y, right.x, up.y), True)
        pad = self._fallback_padding
        return (Box(box.x0 - pad, box.y0 - pad, box.x1 + pad, box.y1 + pad), False)

    @staticmethod
    def _snap_line_endpoints(
        hlines: list[HLine], vlines: list[VLine], tol: float = 4.0
    ) -> tuple[list[HLine], list[VLine]]:
        """对齐格线端点：若横线端点距某竖线 <= tol，延伸/吸附至竖线 x；同理竖线端点吸附至横线 y。"""
        new_h: list[HLine] = []
        for hl in hlines:
            nx0, nx1 = hl.x0, hl.x1
            for vl in vlines:
                if vl.y0 - tol <= hl.y <= vl.y1 + tol:
                    if abs(hl.x0 - vl.x) <= tol:
                        nx0 = vl.x
                    if abs(hl.x1 - vl.x) <= tol:
                        nx1 = vl.x
            new_h.append(HLine(y=hl.y, x0=nx0, x1=nx1))

        new_v: list[VLine] = []
        for vl in vlines:
            ny0, ny1 = vl.y0, vl.y1
            for hl in new_h:
                if hl.x0 - tol <= vl.x <= hl.x1 + tol:
                    if abs(vl.y0 - hl.y) <= tol:
                        ny0 = hl.y
                    if abs(vl.y1 - hl.y) <= tol:
                        ny1 = hl.y
            new_v.append(VLine(x=vl.x, y0=ny0, y1=ny1))

        return new_h, new_v

    @staticmethod
    def _snap_raycast(
        box: Box, hlines: list[HLine], vlines: list[VLine], tol: float = 8.0
    ) -> Box | None:
        """射线法/正交相交单元格检测：从 box 中心向上下左右寻找最近的相交格线。

        特别适用于图形/图片命中框（如 Logo）略微超出单元格几个 pt 的边界情况。
        """
        cx = (box.x0 + box.x1) / 2.0
        cy = (box.y0 + box.y1) / 2.0

        cand_up = [hl for hl in hlines if hl.y >= cy - tol and hl.x0 - tol <= cx <= hl.x1 + tol]
        cand_down = [hl for hl in hlines if hl.y <= cy + tol and hl.x0 - tol <= cx <= hl.x1 + tol]
        cand_left = [vl for vl in vlines if vl.x <= cx + tol and vl.y0 - tol <= cy <= vl.y1 + tol]
        cand_right = [vl for vl in vlines if vl.x >= cx - tol and vl.y0 - tol <= cy <= vl.y1 + tol]

        if not (cand_up and cand_down and cand_left and cand_right):
            return None

        up = min(cand_up, key=lambda l: l.y)
        down = max(cand_down, key=lambda l: l.y)
        left = max(cand_left, key=lambda l: l.x)
        right = min(cand_right, key=lambda l: l.x)

        if right.x > left.x and up.y > down.y:
            cell = Box(left.x, down.y, right.x, up.y)
            # 确保 cell 完整包含中心且至少覆盖 box 的主体部分
            if (cell.x0 <= box.x0 + tol and cell.x1 >= box.x1 - tol and
                cell.y0 <= box.y0 + tol and cell.y1 >= box.y1 - tol):
                return cell
        return None

    def _snap_box(self, box: Box, hlines: list[HLine], vlines: list[VLine],
                  raster_bw=None) -> tuple[Box, bool]:
        box_res, boxed = self._snap(box, hlines, vlines)
        if boxed:
            return box_res, True
        # 尝试射线/正交相交检测
        ray_box = self._snap_raycast(box, hlines, vlines)
        if ray_box is not None:
            return ray_box, True
        if raster_bw is not None:
            rbox = self._snap_raster_box(raster_bw, box, RASTER_SEARCH_RADIUS_PT)
            if rbox is not None:
                return rbox, True
        return box_res, False

    def assign(
        self, page, merged: list[MergedHit]
    ) -> list[RedactBox]:
        hlines, vlines = self._extract_grid(page)
        raster_bw = None
        if len(hlines) + len(vlines) < RASTER_TRIGGER_LINES:
            rh, rv = self._extract_grid_raster(page)
            hlines.extend(rh)
            vlines.extend(rv)
            raster_bw = self._raster_binary(page)
        elif hlines and vlines:
            hlines, vlines = self._snap_line_endpoints(hlines, vlines)
        results: list[RedactBox] = []
        for m in merged:
            # 针对包含保密声明的命中，优先检查是否处于图纸顶部页眉长条区，若在页眉则整格吞并
            is_confidential = any(
                any(c in t.upper() for c in ("CONFIDENTIAL", "PROPRIETARY", "RESTRICTED", "PROPERTY OF", "DO NOT COPY"))
                for t in m.terms
            )
            if is_confidential and m.box.y0 < page.rect.height * 0.2:
                # 顶部保密框：横向寻找最贴近的左右边框线或扩展到包含该保密段落的整条区域
                box, boxed = self._snap_box(m.box, hlines, vlines, raster_bw)
                results.append(
                    RedactBox(
                        page_index=m.page_index,
                        box=box,
                        boxed=True,
                        manual_required=False,
                        hit_ids=[h.hit_id for h in m.hits],
                        channel_labels=m.channels,
                        terms=m.terms,
                    )
                )
                continue

            box, boxed = self._snap_box(m.box, hlines, vlines, raster_bw)
            if boxed:
                results.append(
                    RedactBox(
                        page_index=m.page_index,
                        box=box,
                        boxed=True,
                        manual_required=False,
                        hit_ids=[h.hit_id for h in m.hits],
                        channel_labels=m.channels,
                        terms=m.terms,
                    )
                )
                continue
            # 合并框归位失败（跨单元格相邻行被融合，无闭合格线包含）：
            # 拆回逐命中行独立归位，避免一个 FALLBACK 大框同时漏抹与越界。
            for h in m.hits:
                hbox, hboxed = self._snap_box(h.source_box, hlines, vlines, raster_bw)
                results.append(
                    RedactBox(
                        page_index=m.page_index,
                        box=hbox,
                        boxed=hboxed,
                        manual_required=not hboxed,
                        hit_ids=[h.hit_id],
                        channel_labels=[h.channel.value],
                        terms=h.matched_terms,
                    )
                )
        return results

    @staticmethod
    def _raster_binary(page) -> "np.ndarray":
        """栅格页二值图（150dpi 反色），供局部边扫描复用。"""
        import cv2
        import numpy as np

        gray = page.render_np(dpi=RASTER_DPI)
        if gray.ndim == 3:
            gray = cv2.cvtColor(gray, cv2.COLOR_RGB2GRAY)
        _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
        return bw

    def _snap_raster_box(self, bw: "np.ndarray", box: Box, radius: float) -> Box | None:
        """纯栅格页的方框归位：命中框四方向的候选边组合出闭合方框。

        扫描图框线是栅格像素且常带页面旋转（skew），全局线模型不可用；
        改为局部边扫描：从命中框边缘出发，逐行找"覆盖框中心 x/y、
        段内实心度 >= 阈值、行簇厚度 <= 上限"的段簇（候选边）。
        文字行因笔画间隙（密度低）或字高（厚度超限）被跳过。

        候选组合规则：每边候选从远到近组合，取第一个满足
        "矩形包含命中框 且 矩形宽高 <= 命中框宽高 x RASTER_BOX_RATIO_CAP"
        的组合。比例上限防止把命中框所在的单元格误扩到相邻大方框
        （如免责声明下方的大表格），同时允许包含框内分隔线之外的完整方框。
        """
        import numpy as np

        zoom = RASTER_DPI / 72.0
        min_len_px = RASTER_MIN_LEN_PT * zoom
        max_thick_px = RASTER_MAX_THICK_PT * zoom
        cx = ((box.x0 + box.x1) / 2) * zoom
        cy = ((box.y0 + box.y1) / 2) * zoom
        max_dist = int(radius * zoom)

        y_top = self._scan_edge_candidates(
            bw, int(box.y0 * zoom) - 2, -1, center=cx,
            min_len_px=min_len_px, max_thick_px=max_thick_px, max_dist=max_dist,
        )
        y_bot = self._scan_edge_candidates(
            bw, int(box.y1 * zoom) + 2, 1, center=cx,
            min_len_px=min_len_px, max_thick_px=max_thick_px, max_dist=max_dist,
        )
        x_left = self._scan_edge_candidates(
            bw.T, int(box.x0 * zoom) - 2, -1, center=cy,
            min_len_px=min_len_px, max_thick_px=max_thick_px, max_dist=max_dist,
        )
        x_right = self._scan_edge_candidates(
            bw.T, int(box.x1 * zoom) + 2, 1, center=cy,
            min_len_px=min_len_px, max_thick_px=max_thick_px, max_dist=max_dist,
        )
        if not (y_top and y_bot and x_left and x_right):
            # 方框贴页面边界时，该方向线可能落在渲染边界外：退化为页面边界。
            # 仅当至少 3 边有真实候选时允许退化，防止无框内容退化成整页。
            empty_sides = sum(1 for lst in (y_top, y_bot, x_left, x_right) if not lst)
            if empty_sides and (4 - empty_sides) < 3:
                return None
            page_h = bw.shape[0] / zoom
            page_w = bw.shape[1] / zoom
            if not y_bot and (page_h - box.y1) <= RASTER_EDGE_TOL_PT:
                y_bot = [page_h]
            if not y_top and box.y0 <= RASTER_EDGE_TOL_PT:
                y_top = [0.0]
            if not x_right and (page_w - box.x1) <= RASTER_EDGE_TOL_PT:
                x_right = [page_w]
            if not x_left and box.x0 <= RASTER_EDGE_TOL_PT:
                x_left = [0.0]
            if not (y_top and y_bot and x_left and x_right):
                return None
        h_cap = max(1.0, (box.y1 - box.y0)) * RASTER_BOX_RATIO_CAP
        w_cap = max(1.0, (box.x1 - box.x0)) * RASTER_BOX_RATIO_CAP
        for yt in reversed(y_top):
            for yb in reversed(y_bot):
                for xl in reversed(x_left):
                    for xr in reversed(x_right):
                        if yt >= yb or xl >= xr:
                            continue
                        if (yb - yt) / zoom > h_cap or (xr - xl) / zoom > w_cap:
                            continue
                        cand = Box(xl / zoom, yt / zoom, xr / zoom, yb / zoom)
                        if (cand.x0 <= box.x0 and cand.x1 >= box.x1
                                and cand.y0 <= box.y0 and cand.y1 >= box.y1):
                            return cand
        return None

    @staticmethod
    def _scan_edge_candidates(
        img: "np.ndarray", from_idx: int, step: int, *, center: float,
        min_len_px: float, max_thick_px: float, max_dist: int,
    ) -> list[float]:
        """从 from_idx 起沿 step 方向扫描，收集全部"覆盖 center 的长实心细段簇"。

        返回按扫描方向排序（近 -> 远）的候选簇中心像素坐标；无候选返回空列表。
        """
        import numpy as np

        h = img.shape[0]
        candidates: list[float] = []
        cluster: list[int] = []
        for i in range(max_dist):
            y = from_idx + step * i
            if y < 0 or y >= h:
                break
            row = img[y]
            idx = np.where(row > 0)[0]
            if idx.size == 0:
                if cluster:
                    candidates.append(sum(cluster) / len(cluster))
                    cluster = []
                continue
            splits = np.where(np.diff(idx) > 1)[0] + 1
            covers = False
            for seg in np.split(idx, splits):
                if seg[0] <= center <= seg[-1] and seg.size >= min_len_px:
                    density = seg.size / (seg[-1] - seg[0] + 1)
                    if density >= RASTER_LINE_DENSITY:
                        covers = True
                        break
            if covers:
                cluster.append(y)
            elif cluster:
                if len(cluster) <= max_thick_px:
                    candidates.append(sum(cluster) / len(cluster))
                cluster = []
        if cluster and len(cluster) <= max_thick_px:
            candidates.append(sum(cluster) / len(cluster))
        return candidates