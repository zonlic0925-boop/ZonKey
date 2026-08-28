"""抹除执行：redaction 注释 + apply_redactions 真删除，覆盖/删除模式可切换。"""

from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Iterable

import fitz

from core.errors import RedactError
from core.model import Box, RedactBox, RedactMode

def _drop_stamp_annots(page: fitz.Page, rects: list[fitz.Rect]) -> None:
    """apply_redactions 在某些文档上会把 redaction 注释残留为 Stamp 注释，
    渲染时显示品红边框。仅删除与本轮任意抹除矩形相交的 Stamp 注释，
    不触碰图纸原有注释。"""
    for annot in list(page.annots() or []):
        atype = annot.type[0] if isinstance(annot.type, tuple) else annot.type
        if atype != fitz.PDF_ANNOT_STAMP:
            continue
        try:
            if any(annot.rect.intersects(r) for r in rects):
                page.delete_annot(annot)
        except Exception as exc:  # noqa: BLE001
            raise RedactError(page.number, f"清理 Stamp 注释失败: {exc}") from exc


FILL = {RedactMode.ERASE: (1.0, 1.0, 1.0), RedactMode.COVER: (0.0, 0.0, 0.0)}

# 抹除框向内收缩量(pt)：MuPDF 的 redaction 会切割与矩形相交的线画对象
# （graphics 参数对其不生效），故框必须与格线保持线宽以上的间隙，
# 否则单元格边线被误删。字形删除判定只看"相交"，收缩不影响文字抹除。
INSET_PT = 1.5


def output_path_for(source: str, out_dir: str | Path | None = None) -> str:
    """生成脱敏后输出文件路径：{stem}_desensitized{suffix}。

    若指定 out_dir 则放入该目录下（自动创建目录，若权限受限则安全回退），否则保存在与原文件相同目录。
    """
    p = Path(source)
    name = f"{p.stem}_desensitized{p.suffix}"
    if out_dir is not None:
        target_dir = Path(out_dir)
        try:
            target_dir.mkdir(parents=True, exist_ok=True)
            # 测试写入权限
            test_f = target_dir / ".test_write"
            test_f.touch()
            test_f.unlink()
            return str(target_dir / name)
        except Exception:
            # 如果指定目录没有写权限（如 WinError 5 C:\Windows\System32），回退到原文件同级或主目录
            try:
                fallback_dir = p.parent
                return str(fallback_dir / name)
            except Exception:
                fallback_dir = Path.home() / "Desensitization_Output"
                fallback_dir.mkdir(parents=True, exist_ok=True)
                return str(fallback_dir / name)
    return str(p.with_name(name))


def export_to_zip(
    file_paths: Iterable[str | Path],
    zip_path: str | Path,
    include_audit: bool = True,
) -> str:
    """将脱敏后文件（及可选的对应 audit.json）打包导出为 zip 文件。"""
    zip_p = Path(zip_path)
    zip_p.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_p, "w", zipfile.ZIP_DEFLATED) as zf:
        for fp in file_paths:
            p = Path(fp)
            if p.exists() and p.is_file():
                zf.write(p, arcname=p.name)
                if include_audit:
                    audit = p.with_name(f"{p.stem}_audit.json")
                    if audit.exists() and audit.is_file():
                        zf.write(audit, arcname=audit.name)
    return str(zip_p)


def _field_value_matches_purged(val: str, values: set[str]) -> bool:
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


def _purge_form_widgets(
    page: fitz.Page,
    rects: list[fitz.Rect],
    matched_values: Iterable[str] | None = None,
) -> None:
    """删除与抹除框相交、或字段值命中已抹除内容的 AcroForm 控件。

    行政公文（签证表、登记表等）常用可填写 PDF；apply_redactions 只处理
    页面内容流，不会清除 widget.field_value，导致脱敏后文本层仍可搜索/复制。
    同一敏感值可能出现在多个表单控件（重复字段），需按值同步清除。
    """
    if not rects and not matched_values:
        return
    values = {str(v).strip() for v in (matched_values or []) if str(v).strip()}
    for widget in list(page.widgets() or []):
        wr = widget.rect
        val = str(widget.field_value or "").strip()
        should_delete = bool(rects) and any(wr.intersects(r) for r in rects)
        if not should_delete and _field_value_matches_purged(val, values):
            should_delete = True
        if not should_delete:
            continue
        try:
            page.delete_widget(widget)
        except Exception as exc:  # noqa: BLE001
            raise RedactError(page.number, f"删除表单字段失败: {exc}") from exc


def _merge_overlapping(boxes: list[Box]) -> list[Box]:
    merged: list[Box] = []
    for box in boxes:
        target = None
        for i, m in enumerate(merged):
            if m.intersects(box) and (m.area() > 0 and box.area() > 0):
                target = i
                break
        if target is None:
            merged.append(box)
        else:
            merged[target] = merged[target].union(box)
    return merged


def redact_pdf(
    source: str,
    redact_boxes: list[RedactBox],
    mode: RedactMode,
    output: str | None = None,
) -> str:
    out = output or output_path_for(source)
    try:
        doc = fitz.open(source)
        try:
            by_page: dict[int, list[RedactBox]] = {}
            for rb in redact_boxes:
                by_page.setdefault(rb.page_index, []).append(rb)
            for page_index, rboxes in by_page.items():
                if page_index < 0 or page_index >= doc.page_count:
                    raise RedactError(page_index, f"页号越界: {page_index}")
                page = doc[page_index]
                page_redact_rects: list[fitz.Rect] = []

                # 分离普通文字/图片抹除框与需抹除矢量图形（Logo）的抹除框
                normal_boxes = [rb.box for rb in rboxes if not rb.redact_graphics]
                graphic_boxes = [rb.box for rb in rboxes if rb.redact_graphics]

                # 处理需要擦除矢量线条的 Logo 框
                if graphic_boxes:
                    g_rects = [fitz.Rect(b.x0, b.y0, b.x1, b.y1) for b in _merge_overlapping(graphic_boxes)]
                    page_redact_rects.extend(g_rects)
                    for r in g_rects:
                        page.add_redact_annot(r, fill=FILL[mode])
                    # 默认 PyMuPDF apply_redactions 参数: graphics=2 (或 1=remove, 0=keep)
                    page.apply_redactions(
                        images=fitz.PDF_REDACT_IMAGE_PIXELS,
                        graphics=2,
                    )
                    _drop_stamp_annots(page, g_rects)

                # 处理普通框（保留图纸格线）
                if normal_boxes:
                    inset_rects: list[fitz.Rect] = []
                    full_rects: list[fitz.Rect] = []
                    for box in _merge_overlapping(normal_boxes):
                        if box.x1 <= box.x0 or box.y1 <= box.y0:
                            continue
                        ix0 = box.x0 + INSET_PT
                        iy0 = box.y0 + INSET_PT
                        ix1 = box.x1 - INSET_PT
                        iy1 = box.y1 - INSET_PT
                        if ix1 > ix0 and iy1 > iy0:
                            inset_rects.append(fitz.Rect(ix0, iy0, ix1, iy1))
                        full_rects.append(fitz.Rect(box.x0, box.y0, box.x1, box.y1))
                    page_redact_rects.extend(full_rects)
                    if inset_rects:
                        # 第一阶段：字形删除（inset 矩形，避开格线，graphics 保留线画）
                        for r in inset_rects:
                            page.add_redact_annot(r, fill=FILL[mode])
                        page.apply_redactions(
                            images=fitz.PDF_REDACT_IMAGE_NONE,
                            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                        )
                        _drop_stamp_annots(page, inset_rects)
                    if full_rects:
                        # 第二阶段：图像内容像素化（完整 box 矩形，覆盖贴格线文字；
                        # 图像像素由 PIXELS 处理，不影响保留线画）
                        for r in full_rects:
                            page.add_redact_annot(r, fill=FILL[mode])
                        page.apply_redactions(
                            images=fitz.PDF_REDACT_IMAGE_PIXELS,
                            graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                        )
                        _drop_stamp_annots(page, full_rects)

                # 行政公文 AcroForm：redaction 后仍需清除相交表单控件
                matched_values = [
                    term
                    for rb in rboxes
                    for term in (rb.terms or [])
                    if term and not term.startswith("[") and term not in ("人工框选", "人工调整", "敏感项")
                ]
                _purge_form_widgets(page, page_redact_rects, matched_values)
            doc.save(out, garbage=3, deflate=True)
        finally:
            doc.close()
    except RedactError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise RedactError(-1, f"抹除执行失败: {exc}") from exc
    return out