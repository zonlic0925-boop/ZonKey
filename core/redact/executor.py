"""抹除执行：pikepdf 内容流引擎真删除，覆盖/删除模式可切换（Phase M 去 AGPL）。

迁移自 PyMuPDF apply_redactions 两阶段语义（见 pikepdf_engine 模块 docstring）：
- 普通框：字形按整框相交删除、格线保留、相交图像像素化、整框填充；
- redact_graphics 框（Logo）：触碰线画整块删除 + 图像像素化 + 填充；
- 行政公文 AcroForm：相交/值命中控件整体清除。
"""

from __future__ import annotations

import zipfile
from pathlib import Path
from typing import Iterable

import pikepdf

from core.errors import RedactError
from core.model import Box, RedactBox, RedactMode
from core.pdfio import page_count as pdfio_page_count
from core.redact.pikepdf_engine import (
    FILL_COVER,
    FILL_ERASE,
    RedactPlan,
    apply_page_redactions,
    field_value_matches_purged,
    purge_form_widgets,
)

# 保留常量与语义注释：字形删除按整框相交判定（与迁移前 MuPDF 行为一致）。
INSET_PT = 1.5

FILL = {RedactMode.ERASE: FILL_ERASE, RedactMode.COVER: FILL_COVER}


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
    fill = FILL[mode]
    try:
        by_page: dict[int, list[RedactBox]] = {}
        for rb in redact_boxes:
            by_page.setdefault(rb.page_index, []).append(rb)

        total_pages = pdfio_page_count(source)
        for page_index in by_page:
            if page_index < 0 or page_index >= total_pages:
                raise RedactError(page_index, f"页号越界: {page_index}")

        pdf = pikepdf.open(source)
        try:
            for page_index, rboxes in by_page.items():
                page = pdf.pages[page_index]

                # 分离普通文字/图片抹除框与需抹除矢量图形（Logo）的抹除框
                normal_boxes = [rb.box for rb in rboxes if not rb.redact_graphics]
                graphic_boxes = [rb.box for rb in rboxes if rb.redact_graphics]

                plan = RedactPlan(fill_rgb=fill)
                # 普通框（保留图纸格线）：文本按整框相交删除 + 图像像素化 + 整框填充
                for box in _merge_overlapping(normal_boxes):
                    if box.x1 <= box.x0 or box.y1 <= box.y0:
                        continue
                    plan.text_rects.append(box)
                    plan.image_rects.append(box)
                    plan.paint_rects.append(box)
                # Logo 框：触碰线画整块删除（对应迁移前 graphics=2）+ 图像像素化 + 填充
                if graphic_boxes:
                    merged = _merge_overlapping(graphic_boxes)
                    plan.graphics_rects.extend(merged)
                    plan.graphics_mode = "touched"
                    plan.image_rects.extend(merged)
                    plan.text_rects.extend(merged)
                    plan.paint_rects.extend(merged)

                if plan.text_rects or plan.image_rects or plan.graphics_rects or plan.paint_rects:
                    apply_page_redactions(pdf, page, plan)

                # 行政公文 AcroForm：redaction 后仍需清除相交表单控件
                matched_values = [
                    term
                    for rb in rboxes
                    for term in (rb.terms or [])
                    if term and not term.startswith("[") and term not in ("人工框选", "人工调整", "敏感项")
                ]
                all_rects = list(plan.paint_rects)
                purge_form_widgets(page, all_rects, matched_values)

            pdf.save(
                out,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                compress_streams=True,
            )
        finally:
            pdf.close()
    except RedactError:
        raise
    except Exception as exc:  # noqa: BLE001
        raise RedactError(-1, f"抹除执行失败: {exc}") from exc
    return out
