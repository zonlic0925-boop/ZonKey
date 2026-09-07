"""第三梯队小工具后端桥（工具箱：二维码 / 图片打码 / 证件照 / 重复文件 / PDF 书签 / TTS）。

许可合规（零 AGPL 门禁）：qrcode=BSD、zxing-cpp=Apache-2.0、
pikepdf/pypdfium2=PDL(BSD/MIT 系)、Pillow/opencv=宽松许可，全部离线本地处理。
TTS 走 Windows SAPI COM（系统内置，pywin32 MIT/BSD），无任何第三方语音服务。

产物写入 output/ 目录，经 /api/download/{filename} 与原生另存为取件，
不经浏览器 blob 下载通道（pywebview 壳兼容，同 backend_media_tools 约定）。
"""

from __future__ import annotations

import os
import re
import hashlib
import shutil
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from core.app_paths import ensure_runtime_layout

router = APIRouter(prefix="/api/toolbox", tags=["toolbox-tools"])

PROJECT_ROOT = ensure_runtime_layout()
OUTPUT_DIR = PROJECT_ROOT / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MAX_INPUT_BYTES = 200 * 1024 * 1024  # 上传文件 200MB 保守上限
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".tif", ".tiff"}
ID_PHOTO_SIZES: dict[str, tuple[int, int, int]] = {
    # name -> (宽mm, 高mm, 打印 DPI)
    "one-inch": (25, 35, 300),
    "two-inch": (35, 49, 300),
    "small-two-inch": (33, 48, 300),
    "one-inch-large": (33, 48, 300),
}

_sapi_voices_cache: Optional[list[dict[str, str]]] = None


def _safe_base_name(source_name: Optional[str]) -> str:
    base = Path(source_name or "file").stem.strip()
    cleaned = "".join("_" if ch in '\\/:*?"<>|' else ch for ch in base).strip("._ ") or "file"
    return cleaned[:80]


def _unique_output_path(base: str, suffix: str) -> Path:
    candidate = OUTPUT_DIR / f"{base}{suffix}"
    counter = 1
    while candidate.exists():
        candidate = OUTPUT_DIR / f"{base}_{counter}{suffix}"
        counter += 1
    return candidate


def _save_upload(tmp_dir: Path, file: UploadFile, allowed_exts: Optional[set[str]], kind: str) -> Path:
    raw_name = Path(file.filename or f"{kind}.bin").name
    ext = Path(raw_name).suffix.lower()
    if allowed_exts is not None and ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {ext or '(无扩展名)'}")
    dest = tmp_dir / f"{kind}_{uuid.uuid4().hex[:8]}{ext}"
    total = 0
    with open(dest, "wb") as handle:
        while chunk := file.file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_INPUT_BYTES:
                handle.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail="文件超过 200MB 上限")
            handle.write(chunk)
    return dest


# ---------------------------------------------------------------------------
# 二维码生成（qrcode, BSD）
# ---------------------------------------------------------------------------

@router.post("/qr/generate")
def qr_generate(
    text: str = Form(...),
    box_size: int = Form(10),
    border: int = Form(4),
    ecc: str = Form("M"),
    dark_color: str = Form("#000000"),
    light_color: str = Form("#FFFFFF"),
):
    import qrcode
    from qrcode.constants import ERROR_CORRECT_L, ERROR_CORRECT_M, ERROR_CORRECT_Q, ERROR_CORRECT_H

    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="二维码内容不能为空")
    if len(text.encode("utf-8")) > 2000:
        raise HTTPException(status_code=400, detail="内容过长（UTF-8 上限 2000 字节）")
    ecc_map = {"L": ERROR_CORRECT_L, "M": ERROR_CORRECT_M, "Q": ERROR_CORRECT_Q, "H": ERROR_CORRECT_H}
    if ecc not in ecc_map:
        raise HTTPException(status_code=400, detail="纠错级别须为 L/M/Q/H")
    box_size = max(2, min(40, int(box_size)))
    border = max(1, min(10, int(border)))

    def _safe_color(value: str, fallback: str) -> str:
        value = value.strip()
        return value if re.fullmatch(r"#[0-9a-fA-F]{6}", value) else fallback

    qr = qrcode.QRCode(
        version=None,
        error_correction=ecc_map[ecc],
        box_size=box_size,
        border=border,
    )
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(
        fill_color=_safe_color(dark_color, "#000000"),
        back_color=_safe_color(light_color, "#FFFFFF"),
    )
    out_path = _unique_output_path("qrcode", ".png")
    img.save(out_path)
    return FileResponse(out_path, media_type="image/png", filename="qrcode.png")


@router.post("/qr/read")
async def qr_read(file: UploadFile = File(...)):
    """识别二维码/条形码（zxing-cpp, Apache-2.0；多码一次全出）。"""
    import numpy as np
    import zxingcpp
    from PIL import Image

    tmp = Path(tempfile.gettempdir()) / f"qr_{uuid.uuid4().hex[:8]}{Path(file.filename or '').suffix.lower()}"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    with open(tmp, "wb") as handle:
        while chunk := await file.read(1024 * 1024):
            handle.write(chunk)
    try:
        try:
            img = Image.open(tmp)
            img = img.convert("RGB")
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"无法读取图片: {exc}")
        results = zxingcpp.read_barcodes(img)
        if not results:
            arr = np.asarray(img)
            arr = cv2_scale_for_scan(arr)
            img2 = Image.fromarray(arr)
            results = zxingcpp.read_barcodes(img2)
        items = [
            {
                "text": r.text,
                "format": str(r.format).split(".")[-1],
                "position": bool(r.position),
            }
            for r in results
        ]
        return {"found": len(items), "results": items}
    finally:
        tmp.unlink(missing_ok=True)


def cv2_scale_for_scan(arr):
    """低分辨率图放大一档再试（手机拍小码常见）。"""
    import cv2

    h, w = arr.shape[:2]
    if max(h, w) >= 1600:
        gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
        sharp = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
        return cv2.cvtColor(sharp, cv2.COLOR_GRAY2RGB)
    scale = max(2, 1600 // max(1, max(h, w)))
    arr = cv2.resize(arr, (w * scale, h * scale), interpolation=cv2.INTER_CUBIC)
    return arr


# ---------------------------------------------------------------------------
# 图片打码 / 局部模糊（图片版脱敏）
# ---------------------------------------------------------------------------

MASK_MODES = {"mosaic", "blur", "solid"}


@router.post("/image/mask")
async def image_mask(
    file: UploadFile = File(...),
    regions: str = Form(...),
    mode: str = Form("mosaic"),
    strength: int = Form(20),
):
    """对图片指定矩形区域打码。

    regions 为 JSON 数组：[{"x":int,"y":int,"w":int,"h":int}, ...]（原始图像素坐标）。
    mode: mosaic=马赛克 / blur=高斯模糊 / solid=纯色涂黑。
    strength: 像素块尺寸或模糊半径（1-80）。
    """
    import json as _json

    import cv2
    import numpy as np
    from PIL import Image
    import io as _io

    if mode not in MASK_MODES:
        raise HTTPException(status_code=400, detail="mode 须为 mosaic/blur/solid")
    strength = max(2, min(80, int(strength)))
    try:
        boxes = _json.loads(regions)
        boxes = [(int(b["x"]), int(b["y"]), int(b["w"]), int(b["h"])) for b in boxes]
    except Exception:
        raise HTTPException(status_code=400, detail="regions 参数无法解析")
    boxes = [(x, y, w, h) for x, y, w, h in boxes if w > 0 and h > 0]
    if not boxes:
        raise HTTPException(status_code=400, detail="至少需要一个有效区域")

    raw = await file.read()
    try:
        pil = Image.open(_io.BytesIO(raw))
        pil = pil.convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"无法读取图片: {exc}")
    # np.array 拷贝为可写数组（np.asarray 是只读视图，原地打码会 ValueError）
    arr = np.array(pil)
    h_img, w_img = arr.shape[:2]

    for x, y, w, h in boxes:
        x0 = max(0, min(w_img - 1, x))
        y0 = max(0, min(h_img - 1, y))
        x1 = max(1, min(w_img, x + w))
        y1 = max(1, min(h_img, y + h))
        roi = arr[y0:y1, x0:x1]
        if roi.size == 0:
            continue
        if mode == "mosaic":
            small = cv2.resize(roi, (max(1, (x1 - x0) // strength), max(1, (y1 - y0) // strength)),
                               interpolation=cv2.INTER_LINEAR)
            arr[y0:y1, x0:x1] = cv2.resize(small, (x1 - x0, y1 - y0), interpolation=cv2.INTER_NEAREST)
        elif mode == "blur":
            k = strength * 2 + 1
            arr[y0:y1, x0:x1] = cv2.GaussianBlur(roi, (k, k), 0)
        else:  # solid
            arr[y0:y1, x0:x1] = (0, 0, 0)

    out_img = Image.fromarray(arr)
    buf = _io.BytesIO()
    out_img.save(buf, format="PNG")
    out_path = _unique_output_path(f"{_safe_base_name(file.filename)}_masked", ".png")
    out_path.write_bytes(buf.getvalue())
    return FileResponse(out_path, media_type="image/png", filename=out_path.name)


# ---------------------------------------------------------------------------
# 证件照换底色 + 尺寸裁剪
# ---------------------------------------------------------------------------

@router.post("/id-photo")
async def id_photo(
    file: UploadFile = File(...),
    bg_color: str = Form("#438EDB"),
    size_preset: str = Form("one-inch"),
    top_ratio: float = Form(0.12),
    bottom_ratio: float = Form(0.10),
    tolerance: int = Form(40),
    crop_x: int = Form(-1),
    crop_y: int = Form(-1),
    crop_w: int = Form(-1),
    crop_h: int = Form(-1),
    bg_mode: str = Form("replace"),
):
    """证件照：背景色距抠人像 + 换纯色底 + 标准尺寸裁剪。

    主通道为色彩距离（对纯色/近似纯色底最可靠）：四角中值估计底色，
    与底色距离小于 tolerance 的像素判为背景；GrabCut 仅作对比度弱底色的回退。
    诚实边界：不做人像 AI 分割。top_ratio/bottom_ratio 控制头留白与底部裁剪比例（0-0.3）。
    crop_x/y/w/h（前端裁剪画布输出，原图像素）全部 ≥0 时先按该区域预裁剪，
    之后再走自动人像定位——用户手动框选优先于全自动包围盒。

    bg_mode：replace=换底色（默认，色距抠人像后合成新底）；keep=仅裁剪尺寸——
    不识别不换底，手动框选区域原样缩放到目标尺寸（无 crop 时按目标比例居中裁剪）。
    keep 模式永不做像素替换，衣服/背景一律保留（round-26：用户实拍衣服色接近
    底色估色时被整片消除的根治出口），且不触发人像识别 422。
    """
    import cv2
    import numpy as np
    from PIL import Image
    import io as _io

    if size_preset not in ID_PHOTO_SIZES:
        raise HTTPException(status_code=400, detail="尺寸预设不支持")
    if bg_mode not in ("replace", "keep"):
        raise HTTPException(status_code=400, detail="bg_mode 须为 replace 或 keep")
    width_mm, height_mm, dpi = ID_PHOTO_SIZES[size_preset]
    tolerance = max(10, min(120, int(tolerance)))
    top_ratio = max(0.0, min(0.3, float(top_ratio)))
    bottom_ratio = max(0.0, min(0.3, float(bottom_ratio)))
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", bg_color.strip()):
        raise HTTPException(status_code=400, detail="底色须为 #RRGGBB 格式")
    target_px_w = round(width_mm / 25.4 * dpi)
    target_px_h = round(height_mm / 25.4 * dpi)

    raw = await file.read()
    try:
        pil = Image.open(_io.BytesIO(raw))
        pil = pil.convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"无法读取图片: {exc}")
    arr = np.asarray(pil)
    h_img, w_img = arr.shape[:2]
    if max(h_img, w_img) < 100:
        raise HTTPException(status_code=400, detail="图片尺寸过小")

    # 0) 用户预裁剪：前端裁剪画布输出有效区域时先裁（手动框选优先于自动定位）
    if min(crop_x, crop_y, crop_w, crop_h) >= 0:
        cx0 = max(0, min(w_img - 1, int(crop_x)))
        cy0 = max(0, min(h_img - 1, int(crop_y)))
        cx1 = max(cx0 + 1, min(w_img, int(crop_x + crop_w)))
        cy1 = max(cy0 + 1, min(h_img, int(crop_y + crop_h)))
        if (cx1 - cx0) < 50 or (cy1 - cy0) < 50:
            raise HTTPException(status_code=400, detail="裁剪区域过小（至少 50×50 像素）")
        arr = arr[cy0:cy1, cx0:cx1]
        h_img, w_img = arr.shape[:2]

    # 仅裁剪尺寸：跳过识别与换底，纯几何裁剪 + 缩放（keep 模式分支）
    if bg_mode == "keep":
        target_ratio = width_mm / height_mm
        src_ratio = w_img / h_img
        if src_ratio > target_ratio:
            # 源过宽 → 裁左右（居中）
            keep_w = int(round(h_img * target_ratio))
            x0 = (w_img - keep_w) // 2
            crop = arr[:, x0:x0 + keep_w]
        else:
            # 源过高 → 裁下侧（证件照头部居上，保留上部）
            keep_h = int(round(w_img / target_ratio))
            crop = arr[:keep_h, :]
        resized = cv2.resize(crop, (target_px_w, target_px_h), interpolation=cv2.INTER_AREA)
        out_img = Image.fromarray(resized)
        buf = _io.BytesIO()
        out_img.save(buf, format="PNG", dpi=(dpi, dpi))
        out_path = _unique_output_path(f"{_safe_base_name(file.filename)}_idphoto", ".png")
        out_path.write_bytes(buf.getvalue())
        return FileResponse(out_path, media_type="image/png", filename=out_path.name)

    # 1) 主通道：背景色距离（四角中值色）——纯色/近似纯色底最稳
    corners = np.concatenate([
        arr[: max(1, h_img // 20), : max(1, w_img // 20)].reshape(-1, 3),
        arr[: max(1, h_img // 20), -max(1, w_img // 20):].reshape(-1, 3),
        arr[-max(1, h_img // 20):, : max(1, w_img // 20)].reshape(-1, 3),
        arr[-max(1, h_img // 20):, -max(1, w_img // 20):].reshape(-1, 3),
    ])
    bg = np.median(corners, axis=0)
    dist = np.sqrt(((arr.astype(int) - bg.astype(int)) ** 2).sum(axis=2))
    person = (dist > tolerance).astype("uint8")

    # 2) 主通道失效（前景占比异常：整图同色或底色不均）→ GrabCut 回退
    person_mean = person.mean()
    if person_mean < 0.02 or person_mean > 0.9:
        mask = np.zeros((h_img, w_img), np.uint8)
        bgd = np.zeros((1, 65), np.float64)
        fgd = np.zeros((1, 65), np.float64)
        rect = (int(w_img * 0.05), int(h_img * 0.05), int(w_img * 0.9), int(h_img * 0.9))
        cv2.grabCut(arr, mask, rect, bgd, fgd, 5, cv2.GC_INIT_WITH_RECT)
        person = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 1, 0).astype("uint8")
        if person.mean() < 0.02 or person.mean() > 0.95:
            raise HTTPException(status_code=422, detail="未能识别到前景人像，请换一张背景更干净的证件照")

    # 3) 形态学清理：去背景侧小噪点 + 填人像内部孔洞（衣扣/阴影误判补回）
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    person = cv2.morphologyEx(person, cv2.MORPH_OPEN, kernel)
    person = cv2.morphologyEx(person, cv2.MORPH_CLOSE, kernel)

    # 4) 取前景最大连通域（比全前景包围盒更抗孤立噪块），按证件照比例裁剪（头部居上）
    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(person, connectivity=8)
    if n_labels <= 1:
        raise HTTPException(status_code=422, detail="未能识别到前景人像，请换一张背景更干净的证件照")
    largest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    ys, xs = np.where(labels == largest)
    if len(xs) < 100:
        raise HTTPException(status_code=422, detail="未能识别到前景人像，请换一张背景更干净的证件照")
    px0, px1 = int(xs.min()), int(xs.max())
    py0, py1 = int(ys.min()), int(ys.max())
    fw, fh = px1 - px0 + 1, py1 - py0 + 1
    target_ratio = width_mm / height_mm
    crop_w = max(fw, int(fh * target_ratio))
    crop_h = max(fh, int(crop_w / target_ratio))
    cx = (px0 + px1) // 2
    top_pad = int(crop_h * top_ratio)
    cx0 = max(0, min(w_img - crop_w, cx - crop_w // 2))
    cy0 = max(0, py0 - top_pad)
    cy1 = min(h_img, cy0 + crop_h)
    cy0 = max(0, cy1 - crop_h)
    cx0 = max(0, min(w_img - crop_w, cx0))
    crop = arr[cy0:cy1, cx0:cx0 + crop_w]
    ch, cw = crop.shape[:2]

    # 5) 裁剪区域内重建 alpha 并合成目标底色（边缘羽化 2px）
    local_person = person[cy0:cy1, cx0:cx0 + crop_w]
    alpha = cv2.GaussianBlur(local_person.astype(float), (5, 5), 0)
    alpha = np.clip(alpha[..., None], 0, 1)
    bg_rgb = np.array([
        int(bg_color[1:3], 16), int(bg_color[3:5], 16), int(bg_color[5:7], 16)
    ], dtype=float)
    blended = crop.astype(float) * alpha + bg_rgb[None, None, :] * (1 - alpha)

    # 6) 缩放到目标尺寸（300DPI 标准像素）
    resized = cv2.resize(blended.astype(np.uint8), (target_px_w, target_px_h), interpolation=cv2.INTER_AREA)
    out_img = Image.fromarray(resized)
    buf = _io.BytesIO()
    out_img.save(buf, format="PNG", dpi=(dpi, dpi))
    out_path = _unique_output_path(f"{_safe_base_name(file.filename)}_idphoto", ".png")
    out_path.write_bytes(buf.getvalue())
    return FileResponse(out_path, media_type="image/png", filename=out_path.name)


# ---------------------------------------------------------------------------
# 重复文件查找（扫描目录，只读不删——与清理中心协同）
# ---------------------------------------------------------------------------

@router.post("/duplicates/scan")
def duplicates_scan(
    directory: str = Form(...),
    min_size_kb: int = Form(1),
):
    """扫描目录下重复文件（size → 部分哈希 → 全量 sha256 三级漏斗，只读）。

    返回按组聚合的重复清单，由用户自行决定清理对象；本端点不做删除。
    """
    root = Path(directory)
    if not root.is_dir():
        raise HTTPException(status_code=400, detail=f"目录不存在或不可访问: {directory}")
    min_bytes = max(0, int(min_size_kb)) * 1024

    by_size: dict[int, list[Path]] = {}
    scanned = 0
    for path in root.rglob("*"):
        try:
            if path.is_symlink() or not path.is_file():
                continue
            size = path.stat().st_size
        except OSError:
            continue
        scanned += 1
        if size < min_bytes:
            continue
        by_size.setdefault(size, []).append(path)

    candidates = [paths for paths in by_size.values() if len(paths) > 1]

    def _partial_hash(path: Path) -> Optional[str]:
        try:
            size = path.stat().st_size
            h = hashlib.sha256()
            with open(path, "rb") as f:
                h.update(f.read(65536))
                if size > 65536:
                    # 文件大于首块时才补读尾块（小文件 seek(-N, END) 会 EINVAL）
                    f.seek(-65536, os.SEEK_END)
                    h.update(f.read(65536))
            return h.hexdigest()
        except OSError:
            return None

    by_partial: dict[str, list[Path]] = {}
    for paths in candidates:
        for p in paths:
            key = _partial_hash(p)
            if key:
                by_partial.setdefault((paths[0].stat().st_size, key), []).append(p)

    groups: list[list[dict[str, Any]]] = []
    for (_, _), paths in by_partial.items():
        if len(paths) < 2:
            continue
        by_full: dict[str, list[Path]] = {}
        for p in paths:
            try:
                h = hashlib.sha256()
                with open(p, "rb") as f:
                    for chunk in iter(lambda: f.read(1024 * 1024), b""):
                        h.update(chunk)
                by_full.setdefault(h.hexdigest(), []).append(p)
            except OSError:
                continue
        for dup_paths in by_full.values():
            if len(dup_paths) > 1:
                groups.append([
                    {
                        "path": str(p.resolve()),
                        "name": p.name,
                        "size": p.stat().st_size,
                        "mtime": int(p.stat().st_mtime),
                        "dir": str(p.parent),
                    }
                    for p in dup_paths
                ])
    groups.sort(key=lambda g: -g[0]["size"])
    wasted = sum(g[0]["size"] * (len(g) - 1) for g in groups)
    return {
        "scanned": scanned,
        "groups": groups[:200],
        "group_count": len(groups),
        "wasted_bytes": wasted,
        "truncated": len(groups) > 200,
    }


# ---------------------------------------------------------------------------
# PDF 书签 / 目录编辑（pikepdf）
# ---------------------------------------------------------------------------

@router.get("/pdf/bookmarks")
def pdf_bookmarks_read():
    raise HTTPException(status_code=400, detail="请使用 POST /api/toolbox/pdf/bookmarks-get")


@router.post("/pdf/bookmarks-get")
async def pdf_bookmarks_get(file: UploadFile = File(...)):
    """读取 PDF 大纲（书签树）。基于 pikepdf 高层 outline API（root 为 OutlineItem 列表）。"""
    import pikepdf

    tmp = Path(tempfile.gettempdir()) / f"bm_{uuid.uuid4().hex[:8]}.pdf"
    with open(tmp, "wb") as handle:
        while chunk := await file.read(1024 * 1024):
            handle.write(chunk)
    try:
        with pikepdf.open(tmp) as pdf:
            def walk(items, depth: int) -> list[dict[str, Any]]:
                out: list[dict[str, Any]] = []
                for node in items:
                    entry: dict[str, Any] = {
                        "title": str(node.title or ""),
                        "depth": depth,
                        "page": _page_index(pdf, node),
                    }
                    out.append(entry)
                    if node.children:
                        out.extend(walk(node.children, depth + 1))
                return out

            with pdf.open_outline() as outline:
                items = walk(outline.root, 0)
            return {"page_count": len(pdf.pages), "items": items}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"读取书签失败: {exc}")
    finally:
        tmp.unlink(missing_ok=True)


def _page_index(pdf, item) -> int:
    """OutlineItem → 0 基页码（objgen 匹配；无法定位返回 -1）。"""
    try:
        dest = item.destination
        if dest is None:
            return -1
        page_ref = dest[0]
        ref_objgen = page_ref.objgen
        for idx, page in enumerate(pdf.pages):
            if page.objgen == ref_objgen:
                return idx
    except Exception:
        pass
    return -1


@router.post("/pdf/bookmarks-set")
async def pdf_bookmarks_set(
    file: UploadFile = File(...),
    items: str = Form(...),
    mode: str = Form("replace"),
):
    """写入 PDF 大纲。items JSON: [{"title":str,"page":int,"depth":int}, ...]。

    mode: replace=清空重写 / append=在现有书签后追加。
    page 为 0 基页码，越界自动夹紧；title 空则跳过。
    """
    import json as _json

    import pikepdf
    from pikepdf import OutlineItem

    try:
        parsed = _json.loads(items)
        entries = [
            {"title": str(it.get("title", "")).strip(), "page": int(it.get("page", -1)), "depth": max(0, int(it.get("depth", 0)))}
            for it in parsed
            if str(it.get("title", "")).strip()
        ]
    except Exception:
        raise HTTPException(status_code=400, detail="items 参数无法解析")
    if not entries:
        raise HTTPException(status_code=400, detail="书签列表为空")
    if mode not in {"replace", "append"}:
        raise HTTPException(status_code=400, detail="mode 须为 replace/append")

    tmp = Path(tempfile.gettempdir()) / f"bmw_{uuid.uuid4().hex[:8]}.pdf"
    out_path = _unique_output_path(f"{_safe_base_name(file.filename)}_bookmarks", ".pdf")
    with open(tmp, "wb") as handle:
        while chunk := await file.read(1024 * 1024):
            handle.write(chunk)
    try:
        with pikepdf.open(tmp) as pdf:
            page_count = len(pdf.pages)
            with pdf.open_outline() as outline:
                if mode == "replace":
                    outline.root.clear()
                stack: dict[int, Any] = {}
                for entry in entries:
                    page_no = min(max(entry["page"], 0), page_count - 1) if page_count else 0
                    item = OutlineItem(entry["title"], page_no)
                    depth = entry["depth"]
                    if depth == 0 or 0 not in stack:
                        outline.root.append(item)
                    else:
                        parent = stack.get(depth - 1)
                        if parent is None:
                            # 深度跳跃（0→2）挂到最近可用父节点
                            for d in range(depth - 1, -1, -1):
                                if d in stack:
                                    parent = stack[d]
                                    break
                        if parent is not None:
                            parent.children.append(item)
                    # 保留各级祖先（更深层残留会被同名覆盖），供后续子项回溯挂父
                    stack[depth] = item
                    for d in range(depth + 1, len(stack) + 2):
                        stack.pop(d, None)
            pdf.save(out_path)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"写入书签失败: {exc}")
    finally:
        tmp.unlink(missing_ok=True)
    return FileResponse(out_path, media_type="application/pdf", filename=out_path.name)


# ---------------------------------------------------------------------------
# TTS 文字转朗读（Windows SAPI，系统内置离线引擎）
# ---------------------------------------------------------------------------

def _list_sapi_voices() -> list[dict[str, str]]:
    global _sapi_voices_cache
    if _sapi_voices_cache is not None:
        return _sapi_voices_cache
    voices: list[dict[str, str]] = []
    if sys_platform_win():
        try:
            import pythoncom
            import win32com.client

            pythoncom.CoInitialize()
            try:
                sapi = win32com.client.Dispatch("SAPI.SpVoice")
                for voice in sapi.GetVoices():
                    voices.append({
                        "id": voice.Id,
                        "name": voice.GetDescription(),
                    })
            finally:
                pythoncom.CoUninitialize()
        except Exception:
            voices = []
    _sapi_voices_cache = voices
    return voices


def sys_platform_win() -> bool:
    return sys.platform == "win32"


@router.get("/tts/voices")
def tts_voices():
    voices = _list_sapi_voices()
    return {"available": bool(voices), "voices": voices}


@router.post("/tts/synthesize")
def tts_synthesize(
    text: str = Form(...),
    voice_id: str = Form(""),
    rate: int = Form(0),
    format_choice: str = Form("wav"),
):
    """文字转语音（Windows SAPI 离线合成）→ WAV/MP3 产物入 output/。

    rate: SAPI 语速 -10..10；format_choice: wav / mp3（mp3 需本机 ffmpeg）。
    """
    text = text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="朗读文本不能为空")
    if len(text) > 20000:
        raise HTTPException(status_code=400, detail="文本超过 20000 字上限")
    if not sys_platform_win():
        raise HTTPException(status_code=503, detail="SAPI 语音引擎仅 Windows 可用")
    rate = max(-10, min(10, int(rate)))
    fmt = format_choice.lower() if format_choice.lower() in {"wav", "mp3"} else "wav"

    import pythoncom
    import win32com.client

    voices = _list_sapi_voices()
    if not voices:
        raise HTTPException(status_code=503, detail="未检测到 SAPI 语音引擎（Windows TTS 组件缺失）")

    pythoncom.CoInitialize()
    tmp_wav: Optional[Path] = None
    try:
        sapi = win32com.client.Dispatch("SAPI.SpVoice")
        if voice_id:
            for voice in sapi.GetVoices():
                if str(voice.Id) == voice_id:
                    sapi.Voice = voice
                    break
        sapi.Rate = rate
        tmp_wav = Path(tempfile.gettempdir()) / f"tts_{uuid.uuid4().hex[:8]}.wav"
        # SpFileStream 只支持 PCM WAV（SAPI5 无 MP3 格式位）→ 先落 WAV，mp3 由 ffmpeg 转码
        stream = win32com.client.Dispatch("SAPI.SpFileStream")
        stream.Format.Type = 38  # SAFT44kHz16bitStereo
        stream.Open(str(tmp_wav), 3)  # SSFMCreateForWrite
        sapi.AudioOutputStream = stream
        sapi.Speak(text)
        stream.Close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"语音合成失败: {exc}")
    finally:
        pythoncom.CoUninitialize()

    try:
        if fmt == "mp3":
            out_path = _unique_output_path(f"tts_{int(time.time())}", ".mp3")
            if _wav_to_mp3(tmp_wav, out_path):
                return FileResponse(out_path, media_type="audio/mpeg", filename=out_path.name)
            # ffmpeg 缺失：诚实回退交付 WAV（前端已提示）
            out_path = _unique_output_path(f"tts_{int(time.time())}", ".wav")
        else:
            out_path = _unique_output_path(f"tts_{int(time.time())}", ".wav")
        shutil.copy2(tmp_wav, out_path)
    finally:
        tmp_wav.unlink(missing_ok=True)
    return FileResponse(
        out_path,
        media_type="audio/wav" if out_path.suffix == ".wav" else "audio/mpeg",
        filename=out_path.name,
    )


def _wav_to_mp3(wav_path: Path, out_path: Path) -> bool:
    import subprocess

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        tools_ffmpeg = PROJECT_ROOT / "tools" / "ffmpeg" / "ffmpeg.exe"
        if tools_ffmpeg.exists():
            ffmpeg = str(tools_ffmpeg)
    if not ffmpeg:
        return False
    try:
        subprocess.run(
            [ffmpeg, "-y", "-i", str(wav_path), "-codec:a", "libmp3lame", "-q:a", "4", str(out_path)],
            capture_output=True,
            timeout=300,
            check=True,
        )
        return out_path.exists()
    except Exception:
        return False
