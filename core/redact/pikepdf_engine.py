"""pikepdf 内容流抹除引擎（Phase M：替代 MuPDF apply_redactions）。

语义对齐（与迁移前 PyMuPDF 1.27 apply_redactions 行为一致）：
- 文本：字形级真删除——字形包围盒与文本矩形相交的字形从内容流移除；
  部分删除时以 TJ 补偿量保持后续字形原位（不越框挪位）；
- 图像：相交图像像素化（区域置背景主色，防整图删除，对齐 T2 取舍），
  整图几乎被覆盖时整体置背景；像素化失败抛错，绝不静默保留敏感内容；
- 线画（矢量路径）：keep=保留（图纸格线保护）/ touched=触碰即整块删除
  （Logo 框，对应 graphics=2）/ covered=完全覆盖才删除（doc 公文默认，
  对应 apply_redactions() 的 graphics=1）；
- 填充块：内容流末尾追加 re f 填充矩形（ERASE 白 / COVER 黑）；
- 表单控件：相交或值命中的 AcroForm Widget 整体清除（/Annots、/Kids、
  /Fields 引用同步移除；qpdf 保存时只写可达对象，敏感值随引用消亡）。

坐标合同：入口矩形一律为显示空间（原点左上、y 向下，与 core.model.Box
一致）；引擎内部按页面 /Rotate 与 MediaBox 换算到用户空间处理内容流。

限制（诚实登记，PROJECT_STATUS.md 同步）：
- 垂直书写（WMode 1）的 Type0 字体按水平度量处理；
- Inline image 不做像素化（由填充块视觉覆盖）；
- CropBox ≠ MediaBox 的页面按 MediaBox 处理。
"""

from __future__ import annotations

import logging
import math
import zlib
from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

import pikepdf
from pikepdf import Name
from pikepdf._core import Operator

from core.model import Box
from core.pdfio import display_rect_to_user, user_to_display

logger = logging.getLogger(__name__)

MAX_FORM_DEPTH = 8
_FULL_COVER_RATIO = 0.98

FILL_ERASE = (1.0, 1.0, 1.0)
FILL_COVER = (0.0, 0.0, 0.0)

_OP_PATH_CONSTRUCT = {"m", "l", "c", "v", "y", "re", "h"}
_OP_PATH_PAINT = {"S", "s", "f", "F", "f*", "B", "B*", "b", "b*", "n"}

Matrix = tuple[float, float, float, float, float, float]
IDENTITY: Matrix = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


def _intersects(a: Box, b: Box) -> bool:
    return a.x0 < b.x1 and a.x1 > b.x0 and a.y0 < b.y1 and a.y1 > b.y0


def _covered_by(a: Box, b: Box, tol: float = 0.5) -> bool:
    return (
        a.x0 >= b.x0 - tol
        and a.x1 <= b.x1 + tol
        and a.y0 >= b.y0 - tol
        and a.y1 <= b.y1 + tol
    )


# ---------------------------------------------------------------------------
# 仿射矩阵（a b c d e f；[x',y',1]ᵀ = M·[x,y,1]ᵀ）
# ---------------------------------------------------------------------------


def mat_mul(m2: Matrix, m1: Matrix) -> Matrix:
    """复合：先 m1 后 m2（PDF 规范 4.2.3 矩阵级联 M2·M1）。"""
    a1, b1, c1, d1, e1, f1 = m1
    a2, b2, c2, d2, e2, f2 = m2
    return (
        a2 * a1 + b2 * c1,
        a2 * b1 + b2 * d1,
        c2 * a1 + d2 * c1,
        c2 * b1 + d2 * d1,
        e2 * a1 + f2 * c1 + e1,
        e2 * b1 + f2 * d1 + f1,
    )


def mat_apply(m: Matrix, x: float, y: float) -> tuple[float, float]:
    return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])


def mat_invert(m: Matrix) -> Matrix | None:
    a, b, c, d, e, f = m
    det = a * d - b * c
    if abs(det) < 1e-12:
        return None
    ia, ib = d / det, -b / det
    ic, id_ = -c / det, a / det
    return (ia, ib, ic, id_, -(ia * e + ic * f), -(ib * e + id_ * f))


def mat_transform_rect(m: Matrix, rect: Box) -> Box:
    xs: list[float] = []
    ys: list[float] = []
    for x, y in ((rect.x0, rect.y0), (rect.x1, rect.y1)):
        px, py = mat_apply(m, x, y)
        xs.append(px)
        ys.append(py)
    return Box(min(xs), min(ys), max(xs), max(ys))


# ---------------------------------------------------------------------------
# 字体度量
# ---------------------------------------------------------------------------


@dataclass
class FontMetrics:
    simple: bool = True
    code_length: int = 1
    widths: dict[int, float] = field(default_factory=dict)
    default_width: float = 500.0
    ascent: float = 800.0
    descent: float = -200.0
    word_spacing: bool = True  # simple 字体对 code 32 应用 Tw


def _std14_widths(base_font: str) -> dict[int, float] | None:
    """标准 14 字体码点宽度表（reportlab 内置 AFM 数据，BSD 许可）。"""
    try:
        from reportlab.pdfbase.pdfmetrics import getFont

        font = None
        for candidate in (base_font, base_font.replace("-", "")):
            try:
                font = getFont(candidate)
                break
            except Exception:  # noqa: BLE001
                continue
        if font is None:
            return None
        raw = getattr(font, "widths", None)
        if raw is None:
            raw = getattr(getattr(font, "face", None), "widths", None)
        if not raw:
            return None
        out: dict[int, float] = {}
        items = raw.items() if isinstance(raw, dict) else enumerate(raw)
        for code, w in items:
            try:
                if w:
                    out[int(code)] = float(w)
            except (TypeError, ValueError):
                continue
        return out or None
    except Exception:  # noqa: BLE001
        return None


def _clean_font_name(name: str) -> str:
    name = name.lstrip("/")
    if "+" in name[:8]:
        return name.split("+", 1)[1]
    return name


def _norm_metric(v: float) -> float:
    # FontDescriptor 度量规范为 /1000 单位；个别 PDF 已归一化到 0..1
    return v if abs(v) > 2.0 else v * 1000.0


def resolve_font(font_obj: Any) -> FontMetrics:
    """pikepdf 字体字典 → 度量（宽度单位 = 1/1000 em）。"""
    subtype = str(font_obj.get("/Subtype") or "")
    if subtype == "/Type0":
        fm = FontMetrics(simple=False, code_length=2, default_width=1000.0, word_spacing=False)
        desc = font_obj.get("/DescendantFonts")
        if desc is not None and len(desc) > 0:
            cid_font = desc[0]
            try:
                fm.default_width = float(cid_font.get("/DW") or 1000.0)
            except (TypeError, ValueError):
                pass
            w = cid_font.get("/W")
            if w is not None:
                try:
                    items = list(w)
                    i = 0
                    while i < len(items):
                        c = int(items[i])
                        if i + 1 < len(items) and isinstance(items[i + 1], pikepdf.Array):
                            for k, wi in enumerate(items[i + 1]):
                                fm.widths[c + k] = float(wi)
                            i += 2
                        elif i + 2 < len(items):
                            c2 = int(items[i + 1])
                            wi = float(items[i + 2])
                            for ccode in range(c, c2 + 1):
                                fm.widths[ccode] = wi
                            i += 3
                        else:
                            i += 1
                except Exception as exc:  # noqa: BLE001
                    logger.debug("Type0 /W 解析失败: %s", exc)
        fm.code_length = _type0_code_length(font_obj)
        return fm

    fm = FontMetrics(simple=True)
    base = _clean_font_name(str(font_obj.get("/BaseFont") or ""))
    try:
        first = int(font_obj.get("/FirstChar") or 0)
    except (TypeError, ValueError):
        first = 0
    widths_arr = font_obj.get("/Widths")
    if widths_arr is not None:
        for k, w in enumerate(widths_arr):
            try:
                if float(w):
                    fm.widths[first + k] = float(w)
            except (TypeError, ValueError):
                continue
    if not fm.widths:
        std = _std14_widths(base)
        if std:
            fm.widths = std
    desc = font_obj.get("/FontDescriptor")
    if desc is not None:
        try:
            missing = desc.get("/MissingWidth")
            if missing is not None:
                fm.default_width = float(missing)
        except (TypeError, ValueError):
            pass
        try:
            if desc.get("/Ascent") is not None:
                fm.ascent = _norm_metric(float(desc.get("/Ascent")))
            if desc.get("/Descent") is not None:
                fm.descent = _norm_metric(float(desc.get("/Descent")))
        except (TypeError, ValueError):
            pass
    return fm


def _type0_code_length(font_obj: Any) -> int:
    enc = font_obj.get("/Encoding")
    if enc is None:
        return 2
    if isinstance(enc, Name):
        return 2  # Identity-H/V 及预定义 CMap 均双字节
    try:
        data = bytes(enc.read_bytes())
    except Exception:  # noqa: BLE001
        return 2
    idx = data.find(b"begincodespacerange")
    if idx >= 0:
        seg = data[idx : idx + 80]
        parts = seg.split(b"<")
        if len(parts) > 1:
            code = parts[1].split(b">")[0]
            return max(1, min(4, len(code) // 2))
    return 2


# ---------------------------------------------------------------------------
# 状态
# ---------------------------------------------------------------------------


@dataclass
class TextState:
    font: Any = None
    font_size: float = 0.0
    char_spacing: float = 0.0
    word_spacing: float = 0.0
    h_scale: float = 100.0
    leading: float = 0.0
    rise: float = 0.0
    tm: Matrix = IDENTITY
    tlm: Matrix = IDENTITY

    def clone(self) -> "TextState":
        return TextState(
            self.font,
            self.font_size,
            self.char_spacing,
            self.word_spacing,
            self.h_scale,
            self.leading,
            self.rise,
            self.tm,
            self.tlm,
        )


@dataclass
class _GS:
    ctm: Matrix
    text: TextState

    def clone(self) -> "_GS":
        return _GS(self.ctm, self.text.clone())


class _FontCache:
    def __init__(self) -> None:
        self._cache: dict[tuple, FontMetrics] = {}

    def get(self, font_obj: Any) -> FontMetrics:
        try:
            if font_obj.is_indirect:
                key: tuple = ("ind",) + tuple(font_obj.objgen)
            else:  # pragma: no cover - 资源字体几乎总是间接对象
                key = ("direct", id(font_obj))
        except Exception:  # noqa: BLE001
            key = ("direct", id(font_obj))
        fm = self._cache.get(key)
        if fm is None:
            fm = resolve_font(font_obj)
            self._cache[key] = fm
        return fm


# ---------------------------------------------------------------------------
# 抹除计划
# ---------------------------------------------------------------------------


@dataclass
class RedactPlan:
    """单页抹除计划（矩形为显示空间，y 向下）。"""

    text_rects: list[Box] = field(default_factory=list)
    image_rects: list[Box] = field(default_factory=list)
    graphics_rects: list[Box] = field(default_factory=list)
    paint_rects: list[Box] = field(default_factory=list)
    fill_rgb: tuple[float, float, float] = FILL_ERASE
    graphics_mode: str = "keep"  # keep | touched | covered


def _page_geometry(page: pikepdf.Page) -> tuple[float, float, int]:
    mb = page.get("/MediaBox")
    if mb is None:
        mb = pikepdf.Array([0, 0, 612, 792])
    vals = [float(v) for v in mb]
    w_u = abs(vals[2] - vals[0]) or 612.0
    h_u = abs(vals[3] - vals[1]) or 792.0
    rot = int(page.get("/Rotate") or 0) % 360
    return w_u, h_u, rot


def _display_rects_to_user(rects: Iterable[Box], w_u: float, h_u: float, rot: int) -> list[Box]:
    return [display_rect_to_user(r, w_u, h_u, rot) for r in rects]


def _rect_from_pikepdf_array(arr: Any) -> Box:
    vals = [float(v) for v in arr]
    return Box(min(vals[0], vals[2]), min(vals[1], vals[3]), max(vals[0], vals[2]), max(vals[1], vals[3]))


# ---------------------------------------------------------------------------
# 页面引擎
# ---------------------------------------------------------------------------


class _PageEngine:
    def __init__(self, pdf: pikepdf.Pdf, page: pikepdf.Page, plan: RedactPlan):
        self.pdf = pdf
        self.page = page
        self.plan = plan
        self.w_u, self.h_u, self.rotation = _page_geometry(page)
        self.text_rects = _display_rects_to_user(plan.text_rects, self.w_u, self.h_u, self.rotation)
        self.image_rects = _display_rects_to_user(plan.image_rects, self.w_u, self.h_u, self.rotation)
        self.graphics_rects = _display_rects_to_user(plan.graphics_rects, self.w_u, self.h_u, self.rotation)
        self.paint_rects = _display_rects_to_user(plan.paint_rects, self.w_u, self.h_u, self.rotation)
        self.fonts = _FontCache()
        self.gs_stack: list[_GS] = []
        self.changed = False

    # ---- 主入口 ----

    def run(self) -> bool:
        ops = pikepdf.parse_content_stream(self.page)
        gs = _GS(IDENTITY, TextState())
        new_ops = self._walk(ops, gs, self._resolve_resources(self.page), depth=0)
        if self.plan.paint_rects:
            new_ops.extend(self._paint_ops())
            self.changed = True
        if self.changed:
            content = pikepdf.unparse_content_stream(new_ops)
            self.page.Contents = self.pdf.make_stream(content)
        return self.changed

    def _resolve_resources(self, obj: Any) -> Any:
        seen = 0
        while obj is not None and seen < 16:
            res = obj.get("/Resources")
            if res is not None:
                return res
            obj = obj.get("/Parent")
            seen += 1
        return None

    def _paint_ops(self) -> list[tuple[list[Any], Operator]]:
        r, g, b = self.plan.fill_rgb
        ops: list[tuple[list[Any], Operator]] = [([], Operator("q")), ([r, g, b], Operator("rg"))]
        for rect in self.paint_rects:
            ops.append(([rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0], Operator("re")))
            ops.append(([], Operator("f")))
        ops.append(([], Operator("Q")))
        return ops

    # ---- 走查 ----

    def _walk(self, ops: Sequence[Any], gs: _GS, resources: Any, depth: int) -> list[tuple[list[Any], Operator]]:
        out: list[tuple[list[Any], Operator]] = []
        path_points: list[tuple[float, float]] = []
        path_rects: list[Box] = []
        path_ops: list[tuple[list[Any], Operator]] = []
        in_path = False

        def flush_path() -> None:
            nonlocal in_path, path_points, path_rects, path_ops
            if not in_path:
                return
            in_path = False
            drop = False
            if path_ops and self.plan.graphics_rects:
                bbox = self._path_bbox(path_points, path_rects, gs.ctm)
                if bbox is not None:
                    if self.plan.graphics_mode == "touched":
                        drop = any(_intersects(bbox, gr) for gr in self.plan.graphics_rects)
                    elif self.plan.graphics_mode == "covered":
                        drop = any(_covered_by(bbox, gr) for gr in self.plan.graphics_rects)
            if not drop:
                out.extend(path_ops)
            else:
                self.changed = True
            path_points = []
            path_rects = []
            path_ops = []

        for inst in ops:
            operands = inst.operands
            operator = inst.operator
            name = str(operator)

            if name in _OP_PATH_CONSTRUCT:
                in_path = True
                path_ops.append((list(operands), operator))
                if name == "re" and len(operands) >= 4:
                    x, y = float(operands[0]), float(operands[1])
                    w, h = float(operands[2]), float(operands[3])
                    path_rects.append(Box(x, y, x + w, y + h))
                elif name in ("m", "l") and len(operands) >= 2:
                    path_points.append((float(operands[0]), float(operands[1])))
                elif name in ("c", "v", "y"):
                    for i in range(0, len(operands) - 1, 2):
                        path_points.append((float(operands[i]), float(operands[i + 1])))
                continue

            if name in _OP_PATH_PAINT:
                if in_path:
                    path_ops.append((list(operands), operator))
                    flush_path()
                else:
                    out.append((list(operands), operator))
                continue

            if name == "q":
                self.gs_stack.append(gs.clone())
                out.append(([], operator))
                continue
            if name == "Q":
                if self.gs_stack:
                    gs = self.gs_stack.pop()
                out.append(([], operator))
                continue
            if name == "cm" and len(operands) >= 6:
                a, b, c, d, e, f = (float(v) for v in operands[:6])
                gs.ctm = mat_mul((a, b, c, d, e, f), gs.ctm)
                out.append((list(operands), operator))
                continue

            if name == "BT":
                gs.text.tm = IDENTITY
                gs.text.tlm = IDENTITY
                out.append(([], operator))
                continue
            if name == "Tf" and len(operands) >= 2:
                gs.text.font = operands[0]
                gs.text.font_size = float(operands[1])
                out.append((list(operands), operator))
                continue
            if name == "Tc":
                gs.text.char_spacing = float(operands[0])
                out.append((list(operands), operator))
                continue
            if name == "Tw":
                gs.text.word_spacing = float(operands[0])
                out.append((list(operands), operator))
                continue
            if name == "Tz":
                try:
                    gs.text.h_scale = float(operands[0]) or 100.0
                except (TypeError, ValueError):
                    pass
                out.append((list(operands), operator))
                continue
            if name == "TL":
                gs.text.leading = float(operands[0])
                out.append((list(operands), operator))
                continue
            if name == "Ts":
                gs.text.rise = float(operands[0])
                out.append((list(operands), operator))
                continue
            if name == "Td" and len(operands) >= 2:
                gs.text.tlm = mat_mul((1, 0, 0, 1, float(operands[0]), float(operands[1])), gs.text.tlm)
                gs.text.tm = gs.text.tlm
                out.append((list(operands), operator))
                continue
            if name == "TD" and len(operands) >= 2:
                tx, ty = float(operands[0]), float(operands[1])
                gs.text.leading = -ty
                gs.text.tlm = mat_mul((1, 0, 0, 1, tx, ty), gs.text.tlm)
                gs.text.tm = gs.text.tlm
                out.append((list(operands), operator))
                continue
            if name == "T*":
                gs.text.tlm = mat_mul((1, 0, 0, 1, 0, -gs.text.leading), gs.text.tlm)
                gs.text.tm = gs.text.tlm
                out.append(([], operator))
                continue
            if name == "Tm" and len(operands) >= 6:
                gs.text.tlm = tuple(float(v) for v in operands[:6])  # type: ignore[assignment]
                gs.text.tm = gs.text.tlm  # type: ignore[assignment]
                out.append((list(operands), operator))
                continue

            if name in ("Tj", "'", '"', "TJ"):
                if not self._emit_text_show(out, name, operands, gs, resources, depth):
                    out.append((list(operands), operator))
                continue

            if name == "Do" and operands:
                self._handle_do(out, operands[0], gs, resources, depth)
                continue

            if in_path and name in ("W", "W*"):
                path_ops.append((list(operands), operator))
                continue

            out.append((list(operands), operator))

        flush_path()
        return out

    def _path_bbox(self, points: list[tuple[float, float]], rects: list[Box], ctm: Matrix) -> Box | None:
        xs: list[float] = []
        ys: list[float] = []
        for x, y in points:
            px, py = mat_apply(ctm, x, y)
            xs.append(px)
            ys.append(py)
        for r in rects:
            dr = mat_transform_rect(ctm, r)
            xs.extend((dr.x0, dr.x1))
            ys.extend((dr.y0, dr.y1))
        if not xs:
            return None
        return Box(min(xs), min(ys), max(xs), max(ys))

    # ---- 文本 ----

    def _lookup_font(self, resources: Any, font_name: Any) -> Any:
        try:
            fonts = resources.get("/Font") if resources is not None else None
            if fonts is None:
                return None
            return fonts.get(font_name)
        except Exception:  # noqa: BLE001
            return None

    def _emit_text_show(
        self,
        out: list[tuple[list[Any], Operator]],
        name: str,
        operands: Sequence[Any],
        gs: _GS,
        resources: Any,
        depth: int,
    ) -> bool:
        """字形级删除。返回 True=已重写发出；False=无改动（调用方原样保留）。

        状态语义：无论是否重写，本方法都把原算符对文本状态的影响（'/'"'
        的换行与间距设置、显示位移对 Tm 的推进）应用到 gs.text，
        保证后续算符的位置计算正确。
        """
        if not self.text_rects:
            return False
        ts = gs.text

        # 1) 原算符的定位副作用（保持与原始内容一致的状态推进）
        prefix_ops: list[tuple[list[Any], Operator]] = []
        if name == "'":
            ts.tlm = mat_mul((1, 0, 0, 1, 0, -ts.leading), ts.tlm)
            ts.tm = ts.tlm
            prefix_ops.append(([], Operator("T*")))
        elif name == '"':
            try:
                aw = float(operands[0])
                ac = float(operands[1])
            except (IndexError, TypeError, ValueError):
                return False
            ts.word_spacing = aw
            ts.char_spacing = ac
            ts.tlm = mat_mul((1, 0, 0, 1, 0, -ts.leading), ts.tlm)
            ts.tm = ts.tlm
            prefix_ops.extend(
                [
                    ([aw], Operator("Tw")),
                    ([ac], Operator("Tc")),
                    ([], Operator("T*")),
                ]
            )
            operands = operands[2:]

        if not operands or ts.font is None:
            return False
        font_obj = self._lookup_font(resources, ts.font)
        if font_obj is None:
            return False
        fm = self.fonts.get(font_obj)

        # 2) 原子序列：("str", bytes) / ("num", float)
        atoms: list[tuple[str, Any]] = []
        if name == "TJ":
            for el in list(operands[0]):
                if isinstance(el, (int, float, pikepdf.Decimal)):
                    atoms.append(("num", float(el)))
                else:
                    try:
                        atoms.append(("str", bytes(el)))
                    except Exception:  # noqa: BLE001
                        atoms.append(("num", 0.0))
        else:
            data = operands[0]
            try:
                raw = bytes(data)
            except Exception:  # noqa: BLE001
                return False
            atoms.append(("str", raw))

        # 3) 布局：字形设备包围盒（用户空间 y-up）与累计位移
        scale_k = ts.font_size * (ts.h_scale / 100.0)
        if scale_k == 0:
            return False
        m = mat_mul(ts.tm, gs.ctm)
        asc = fm.ascent / 1000.0 * ts.font_size
        desc = fm.descent / 1000.0 * ts.font_size

        def advance_of(code: int) -> float:
            w = fm.widths.get(code, fm.default_width)
            adv = (w / 1000.0) * ts.font_size + ts.char_spacing
            if fm.word_spacing and code == 32:
                adv += ts.word_spacing
            return adv * (ts.h_scale / 100.0)

        step = 1 if fm.simple else fm.code_length
        pen = 0.0
        glyphs: list[tuple[int, int, float, Box]] = []  # (atom_idx, byte_off, advance, rect)
        for ai, (kind, val) in enumerate(atoms):
            if kind == "num":
                pen += -val / 1000.0 * scale_k
                continue
            data: bytes = val
            for i in range(0, len(data) - step + 1, step):
                code = int.from_bytes(data[i : i + step], "big")
                adv = advance_of(code)
                ox, oy = mat_apply(m, pen, ts.rise)
                pts = [
                    (ox, oy),
                    (ox + m[0] * adv, oy + m[1] * adv),
                    (ox + m[2] * asc, oy + m[3] * asc),
                    (ox + m[0] * adv + m[2] * asc, oy + m[1] * adv + m[3] * asc),
                    (ox + m[2] * desc, oy + m[3] * desc),
                    (ox + m[0] * adv + m[2] * desc, oy + m[1] * adv + m[3] * desc),
                ]
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                glyphs.append((ai, i, adv, Box(min(xs), min(ys), max(xs), max(ys))))
                pen += adv

        # 显示位移推进 Tm（Tlm 不变，符合 PDF 规范）
        ts.tm = mat_mul((1, 0, 0, 1, pen, 0), ts.tm)

        # 4) 删除决策（与矩形相交即删，等同 MuPDF 相交语义）
        removed_gi = [gi for gi, g in enumerate(glyphs) if any(_intersects(g[3], tr) for tr in self.text_rects)]
        if not removed_gi:
            return False

        # 5) 重建：删除段以 TJ 补偿量占位，保证保留字形仍在原位
        new_elements: list[Any] = []
        gi_set = set(removed_gi)
        for ai, (kind, val) in enumerate(atoms):
            if kind == "num":
                new_elements.append(val)
                continue
            atom_glyphs = [(gi, g) for gi, g in enumerate(glyphs) if g[0] == ai]
            if not any(gi in gi_set for gi, _ in atom_glyphs):
                new_elements.append(pikepdf.String(val))
                continue
            # 连续删除段合并（字节连续 = 字形连续）
            spans: list[list[float]] = []  # [start, end, advance_sum]
            for gi, g in atom_glyphs:
                if gi not in gi_set:
                    continue
                s, e, a = g[1], g[1] + step, g[2]
                if spans and s <= spans[-1][1]:
                    spans[-1][1] = max(spans[-1][1], e)
                    spans[-1][2] += a
                else:
                    spans.append([s, e, a])
            cursor = 0
            for s, e, a in spans:
                if s > cursor:
                    new_elements.append(pikepdf.String(val[cursor:s]))
                new_elements.append(-a * 1000.0 / scale_k)
                cursor = e
            if cursor < len(val):
                new_elements.append(pikepdf.String(val[cursor:]))

        while new_elements and isinstance(new_elements[-1], (int, float)):
            new_elements.pop()

        out.extend(prefix_ops)
        if new_elements:
            out.append((list(new_elements), Operator("TJ")))
        self.changed = True
        return True

    # ---- 图像 / Form XObject ----

    def _handle_do(self, out: list[tuple[list[Any], Operator]], name: Any, gs: _GS, resources: Any, depth: int) -> None:
        xobj = None
        try:
            xo = resources.get("/XObject") if resources is not None else None
            if xo is not None:
                xobj = xo.get(name)
        except Exception:  # noqa: BLE001
            xobj = None
        if xobj is None:
            out.append(([name], Operator("Do")))
            return

        subtype = str(xobj.get("/Subtype") or "")
        if subtype == "/Image" and self.image_rects:
            placement = mat_transform_rect(gs.ctm, Box(0, 0, 1, 1))
            hits = [ir for ir in self.image_rects if _intersects(placement, ir)]
            if hits:
                covered = 0.0
                pa = max(placement.area(), 1e-9)
                for ir in hits:
                    ix0, ix1 = max(placement.x0, ir.x0), min(placement.x1, ir.x1)
                    iy0, iy1 = max(placement.y0, ir.y0), min(placement.y1, ir.y1)
                    if ix1 > ix0 and iy1 > iy0:
                        covered += (ix1 - ix0) * (iy1 - iy0)
                whole = covered / pa >= _FULL_COVER_RATIO
                try:
                    pixelate_image_regions(xobj, hits, gs.ctm, whole=whole)
                    self.changed = True
                except Exception as exc:  # noqa: BLE001
                    raise RuntimeError(f"图像像素化失败（拒绝静默保留敏感图像内容）: {exc}") from exc
            out.append(([name], Operator("Do")))
            return

        if subtype == "/Form" and depth < MAX_FORM_DEPTH:
            res = xobj.get("/Resources")
            if res is None:
                res = resources
            form_ops = pikepdf.parse_content_stream(xobj)
            mtx = xobj.get("/Matrix")
            ctm = gs.ctm
            prefix: list[tuple[list[Any], Operator]] = []
            if mtx is not None:
                mvals = [float(v) for v in mtx]
                ctm = mat_mul(tuple(mvals), ctm)
                prefix.append((mvals, Operator("cm")))
            bbox = xobj.get("/BBox")
            if bbox is not None:
                bvals = [float(v) for v in bbox]
                bx0, by0 = min(bvals[0], bvals[2]), min(bvals[1], bvals[3])
                bx1, by1 = max(bvals[0], bvals[2]), max(bvals[1], bvals[3])
                prefix.append(([bx0, by0, bx1 - bx0, by1 - by0], Operator("re")))
                prefix.append(([], Operator("W")))
                prefix.append(([], Operator("n")))
            changed_before = self.changed
            inner_gs = _GS(ctm, TextState())
            new_inner = self._walk(form_ops, inner_gs, res, depth + 1)
            if self.changed != changed_before:
                out.append(([], Operator("q")))
                out.extend(prefix)
                out.extend(new_inner)
                out.append(([], Operator("Q")))
                return
            out.append(([name], Operator("Do")))
            return

        out.append(([name], Operator("Do")))


# ---------------------------------------------------------------------------
# 图像像素化
# ---------------------------------------------------------------------------


def _modal_border_value(pil: Any, box_px: tuple[int, int, int, int]) -> Any:
    """区域外边框带的主色（扫描件/图纸 = 背景色；与样本极性约定无关）。"""
    import numpy as np

    w, h = pil.size
    x0, y0, x1, y1 = box_px
    band = 4
    regions: list[tuple[int, int, int, int]] = []
    if y0 - band >= 0:
        regions.append((max(0, x0 - band), y0 - band, min(w, x1 + band), y0))
    if y1 + band <= h:
        regions.append((max(0, x0 - band), y1, min(w, x1 + band), min(h, y1 + band)))
    if x0 - band >= 0:
        regions.append((x0 - band, max(0, y0 - band), x0, min(h, y1 + band)))
    if x1 + band <= w:
        regions.append((x1, max(0, y0 - band), min(w, x1 + band), min(h, y1 + band)))
    if not regions:
        regions = [(0, 0, w, h)]
    samples: list[tuple[int, Any]] = []
    for rx0, ry0, rx1, ry1 in regions:
        crop = pil.crop((rx0, ry0, rx1, ry1))
        arr = np.asarray(crop)
        if arr.ndim == 2:
            vals, counts = np.unique(arr, return_counts=True)
            samples.append((int(counts.max()), vals[int(counts.argmax())].item()))
        else:
            flat = arr.reshape(-1, arr.shape[-1])
            vals, counts = np.unique(flat, axis=0, return_counts=True)
            samples.append((int(counts.max()), tuple(int(v) for v in vals[int(counts.argmax())])))
    samples.sort(key=lambda t: t[0], reverse=True)
    return samples[0][1]


def pixelate_image_regions(
    xobj: Any,
    rects_user: Sequence[Box],
    ctm: Matrix,
    *,
    whole: bool,
) -> None:
    """命中矩形对应的图像区域置为背景主色（像素化），原地写回。"""
    from pikepdf import PdfImage
    from PIL import ImageDraw

    inv = mat_invert(ctm)
    w_px = int(xobj.get("/Width") or 0)
    h_px = int(xobj.get("/Height") or 0)
    if w_px <= 0 or h_px <= 0:
        return

    regions_px: list[tuple[int, int, int, int]] = []
    if whole or inv is None:
        regions_px = [(0, 0, w_px, h_px)]
    else:
        for r in rects_user:
            uv = [mat_apply(inv, x, y) for x, y in ((r.x0, r.y0), (r.x1, r.y1))]
            us = sorted(min(max(p[0], 0.0), 1.0) for p in uv)
            vs = sorted(min(max(p[1], 0.0), 1.0) for p in uv)
            u0, u1 = us[0], us[-1]
            v0, v1 = vs[0], vs[-1]
            px0 = int(math.floor(u0 * w_px))
            px1 = int(math.ceil(u1 * w_px))
            py0 = int(math.floor((1.0 - v1) * h_px))
            py1 = int(math.ceil((1.0 - v0) * h_px))
            if px1 > px0 and py1 > py0:
                regions_px.append((px0, py0, px1, py1))
    if not regions_px:
        return

    pil = PdfImage(xobj).as_pil_image()
    for box in regions_px:
        fill = _modal_border_value(pil, box)
        ImageDraw.Draw(pil).rectangle([box[0], box[1], box[2] - 1, box[3] - 1], fill=fill)

    smask = xobj.get("/SMask")
    if smask is not None:
        try:
            spil = PdfImage(smask).as_pil_image()
            for box in regions_px:
                ImageDraw.Draw(spil).rectangle([box[0], box[1], box[2] - 1, box[3] - 1], fill=255)
            _write_image_stream(smask, spil, is_mask=False, source_filter="", to_gray=True)
        except Exception as exc:  # noqa: BLE001
            logger.warning("SMask 像素化失败（填充块仍覆盖显示）: %s", exc)

    filt = str(xobj.get("/Filter") or "")
    is_mask = bool(xobj.get("/ImageMask"))
    if is_mask:
        _write_image_stream(xobj, pil, is_mask=True, source_filter=filt)
        return
    if "DCTDecode" in filt and pil.mode in ("RGB", "L"):
        import io as _io

        buf = _io.BytesIO()
        pil.save(buf, format="JPEG", quality=88)
        xobj.write(buf.getvalue())
        xobj.Filter = Name.DCTDecode
        xobj.ColorSpace = Name.DeviceRGB if pil.mode == "RGB" else Name.DeviceGray
        xobj.BitsPerComponent = 8
        _drop_decode_keys(xobj)
        return
    _write_image_stream(xobj, pil, is_mask=False, source_filter=filt)


def _drop_decode_keys(obj: Any) -> None:
    for key in ("/DecodeParms", "/Decode", "/ColorTransform"):
        try:
            if key in obj:
                del obj[key]
        except Exception:  # noqa: BLE001
            pass


def _write_image_stream(obj: Any, pil: Any, *, is_mask: bool, source_filter: str, to_gray: bool = False) -> None:
    """PIL 图像 → Flate 原始样本回写（保持/推导 PDF 图像语义）。"""
    import numpy as np

    if is_mask:
        if pil.mode != "1":
            pil = pil.convert("1")
        obj.write(pil.tobytes())  # 1bpp 按行字节对齐，与 PDF ImageMask 一致
        obj.Filter = Name.FlateDecode
        obj.ImageMask = True
        obj.BitsPerComponent = 1
        try:
            if "/ColorSpace" in obj:
                del obj.ColorSpace
        except Exception:  # noqa: BLE001
            pass
        _drop_decode_keys(obj)
        return

    if pil.mode == "1":
        # CCITT 源解码出的 1 位图为传真极性（0=白）；DeviceGray 输出约定 1=白，需反转
        if "CCITTFaxDecode" in source_filter:
            arr = 255 - np.asarray(pil.convert("L"))
            pil = pil.__class__.fromarray(arr.astype("uint8"), mode="L").convert("1")
        arr = np.asarray(pil, dtype=np.uint8)
        packed = np.packbits(arr > 0, axis=1)
        obj.write(packed.tobytes())
        obj.Filter = Name.FlateDecode
        obj.ColorSpace = Name.DeviceGray
        obj.BitsPerComponent = 1
        _drop_decode_keys(obj)
        return
    if pil.mode in ("L", "I", "I;16") or to_gray:
        if pil.mode != "L":
            pil = pil.convert("L")
        obj.write(pil.tobytes())
        obj.Filter = Name.FlateDecode
        obj.ColorSpace = Name.DeviceGray
        obj.BitsPerComponent = 8
        _drop_decode_keys(obj)
        return
    if pil.mode == "CMYK":
        obj.write(pil.tobytes())
        obj.Filter = Name.FlateDecode
        obj.ColorSpace = Name.DeviceCMYK
        obj.BitsPerComponent = 8
        _drop_decode_keys(obj)
        return
    if pil.mode != "RGB":
        pil = pil.convert("RGB")
    obj.write(pil.tobytes())
    obj.Filter = Name.FlateDecode
    obj.ColorSpace = Name.DeviceRGB
    obj.BitsPerComponent = 8
    _drop_decode_keys(obj)


# ---------------------------------------------------------------------------
# 顶层 API
# ---------------------------------------------------------------------------


def apply_page_redactions(pdf: pikepdf.Pdf, page: pikepdf.Page, plan: RedactPlan) -> bool:
    """对单页执行抹除计划。返回是否发生内容改动。"""
    return _PageEngine(pdf, page, plan).run()


# ---------------------------------------------------------------------------
# AcroForm 控件清理
# ---------------------------------------------------------------------------


def field_value_matches_purged(val: str, values: set[str]) -> bool:
    if not val or not values:
        return False
    if val in values:
        return True
    for candidate in values:
        if not candidate or candidate.startswith("["):
            continue
        if len(candidate) >= 4 and (candidate in val or val in candidate):
            return True
    return False


def _obj_identity(a: Any, b: Any) -> bool:
    try:
        if a.is_indirect and b.is_indirect:
            return tuple(a.objgen) == tuple(b.objgen)
    except Exception:  # noqa: BLE001
        pass
    return False


def purge_form_widgets(
    page: pikepdf.Page,
    rects_display: Sequence[Box],
    matched_values: Iterable[str] | None,
) -> int:
    """删除与抹除框相交、或字段值命中已抹除内容的 AcroForm 控件。

    行政公文（签证表、登记表等）常用可填写 PDF；内容流抹除只处理页面
    内容流，widget.field_value 不清除则脱敏后仍可搜索/复制。同一敏感值
    可能绑定多个控件（重复字段），按值同步清除。返回删除的控件数。
    """
    values = {str(v).strip() for v in (matched_values or []) if str(v).strip()}
    if not rects_display and not values:
        return 0

    annots = page.get("/Annots")
    if annots is None:
        return 0

    w_u, h_u, rot = _page_geometry(page)
    deleted_objgens: set[tuple] = set()
    keep_annots = pikepdf.Array()
    removed = 0
    for annot in annots:
        try:
            if str(annot.get("/Subtype") or "") != "/Widget":
                keep_annots.append(annot)
                continue
            should_delete = False
            if rects_display and annot.get("/Rect") is not None:
                disp = _annot_display_rect(annot, w_u, h_u, rot)
                should_delete = any(_intersects(disp, r) for r in rects_display)
            if not should_delete and values:
                if field_value_matches_purged(_annot_field_value(annot), values):
                    should_delete = True
            if not should_delete:
                keep_annots.append(annot)
                continue
            try:
                if annot.is_indirect:
                    deleted_objgens.add(tuple(annot.objgen))
            except Exception:  # noqa: BLE001
                pass
            _unlink_widget(annot)
            removed += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning("表单控件处理异常（保留原控件）: %s", exc)
            keep_annots.append(annot)

    if not removed:
        return 0
    page.Annots = keep_annots
    try:
        acroform = page.pdf.Root.get("/AcroForm")
    except Exception:  # noqa: BLE001
        acroform = None
    if acroform is not None:
        try:
            fields = acroform.get("/Fields")
            if fields is not None:
                alive = pikepdf.Array(f for f in fields if _field_alive(f, deleted_objgens))
                if len(alive) != len(fields):
                    acroform.Fields = alive
        except Exception as exc:  # noqa: BLE001
            logger.debug("AcroForm 清理异常: %s", exc)
    return removed


def _field_alive(field: Any, deleted: set[tuple]) -> bool:
    """字段仍存活：本身未被删除，且至少有一个存活的 widget/kid。"""
    try:
        indirect = bool(getattr(field, "is_indirect", False))
        key = tuple(field.objgen) if indirect else id(field)
        if indirect and key in deleted:
            return False
        kids = field.get("/Kids")
        if kids is not None and len(kids) > 0:
            return any(_field_alive(k, deleted) for k in kids)
        return True
    except Exception:  # noqa: BLE001
        return True


def _annot_display_rect(annot: Any, w_u: float, h_u: float, rot: int) -> Box:
    r = _rect_from_pikepdf_array(annot.get("/Rect"))
    xs: list[float] = []
    ys: list[float] = []
    for x, y in ((r.x0, r.y0), (r.x1, r.y1)):
        xv, yv = user_to_display(x, y, w_u, h_u, rot)
        xs.append(xv)
        ys.append(yv)
    return Box(min(xs), min(ys), max(xs), max(ys))


def _annot_field_value(annot: Any) -> str:
    obj = annot
    seen = 0
    while obj is not None and seen < 8:
        try:
            v = obj.get("/V")
            if v is not None and not isinstance(v, pikepdf.Dictionary):
                return str(v)
        except Exception:  # noqa: BLE001
            return ""
        obj = obj.get("/Parent")
        seen += 1
    return ""


def _unlink_widget(annot: Any) -> None:
    parent = annot.get("/Parent")
    if parent is None:
        return
    try:
        kids = parent.get("/Kids")
        if kids is not None:
            alive = pikepdf.Array(k for k in kids if not _obj_identity(k, annot))
            if len(alive) != len(kids):
                parent.Kids = alive
    except Exception:  # noqa: BLE001
        pass
