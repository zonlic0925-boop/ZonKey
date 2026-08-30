"""PPT 渲染工具桥（PPT 工坊：转 PDF / 转长图）。

本地离线渲染链路：优先 LibreOffice（跨平台），Windows 回退 Microsoft PowerPoint COM。
产物写入 output/ 目录，前端经 /api/download/{filename} 与原生另存为对话框取件，
不经浏览器 blob 下载通道（pywebview 壳兼容）。
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import threading
import uuid
import zipfile
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from core.app_paths import ensure_runtime_layout

router = APIRouter(prefix="/api/ppt", tags=["ppt-tools"])

PROJECT_ROOT = ensure_runtime_layout()

MAX_INPUT_BYTES = 200 * 1024 * 1024
MAX_SLIDES = 500
SOFFICE_TIMEOUT_SECONDS = 180

OUTPUT_DIR = PROJECT_ROOT / "output"

# COM 初始化一次即可（FastAPI 同步端点跑在固定线程池里，但 CoInitialize 幂等，逐次调用安全）
_com_lock = threading.Lock()


def _output_dir() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR


def _find_soffice() -> Optional[str]:
    exe = shutil.which("soffice")
    if exe:
        return exe
    candidates = [
        Path("C:/Program Files/LibreOffice/program/soffice.exe"),
        Path("C:/Program Files (x86)/LibreOffice/program/soffice.exe"),
        Path("/Applications/LibreOffice.app/Contents/MacOS/soffice"),
    ]
    for path in candidates:
        if path.exists():
            return str(path)
    return None


def _render_pdf_with_soffice(source: Path, out_dir: Path) -> bool:
    soffice = _find_soffice()
    if not soffice:
        return False
    try:
        subprocess.run(
            [soffice, "--headless", "--norestore", "--convert-to", "pdf", "--outdir", str(out_dir), str(source)],
            check=True,
            timeout=SOFFICE_TIMEOUT_SECONDS,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except (subprocess.SubprocessError, OSError):
        return False
    return (out_dir / f"{source.stem}.pdf").exists()


def _render_pdf_with_powerpoint(source: Path, out_dir: Path) -> bool:
    """Windows 回退：PowerPoint COM 导出 PDF（ppSaveAsPDF=32）。"""
    if sys.platform != "win32":
        return False
    try:
        import pythoncom
        import win32com.client
    except ImportError:
        return False

    out_pdf = out_dir / f"{source.stem}.pdf"
    with _com_lock:
        pythoncom.CoInitialize()
        app = None
        pres = None
        try:
            # DispatchEx：独立实例，不附着到用户正在使用的 PowerPoint 窗口
            app = win32com.client.DispatchEx("PowerPoint.Application")
            pres = app.Presentations.Open(str(source), True, False, False)  # ReadOnly, Untitled, WithWindow
            pres.SaveAs(str(out_pdf), 32)
        except Exception:
            return False
        finally:
            try:
                if pres is not None:
                    pres.Close()
            except Exception:
                pass
            try:
                if app is not None:
                    app.Quit()
            except Exception:
                pass
            pythoncom.CoUninitialize()
    return out_pdf.exists()


def _pptx_to_pdf(source: Path, out_dir: Path) -> str:
    """返回使用的渲染器名；均不可用时抛 HTTPException。"""
    if _render_pdf_with_soffice(source, out_dir):
        return "libreoffice"
    if _render_pdf_with_powerpoint(source, out_dir):
        return "powerpoint-com"
    raise HTTPException(
        status_code=503,
        detail="本机未检测到 LibreOffice 或 Microsoft PowerPoint，无法离线渲染 PPT。请安装其一后重试。",
    )


def _save_upload_to(tmp_dir: Path, file: UploadFile) -> Path:
    name = Path(file.filename or "presentation.pptx").name
    if not name.lower().endswith(".pptx"):
        raise HTTPException(status_code=400, detail="仅支持 .pptx 文件（旧版 .ppt 请先在 PowerPoint 中另存为 .pptx）")
    dest = tmp_dir / f"src_{uuid.uuid4().hex[:8]}_{name}"
    with open(dest, "wb") as handle:
        shutil.copyfileobj(file.file, handle)
    if dest.stat().st_size > MAX_INPUT_BYTES:
        raise HTTPException(status_code=400, detail="PPTX 超过 200MB 上限")
    with open(dest, "rb") as handle:
        if handle.read(2) != b"PK":
            raise HTTPException(status_code=400, detail="PPTX 文件无效（非 ZIP 结构）")
    return dest


def _safe_base_name(source_name: str) -> str:
    base = Path(source_name).stem.strip()
    cleaned = "".join("_" if ch in '\\/:*?"<>|' else ch for ch in base).strip("._ ") or "presentation"
    return cleaned[:80]


@router.get("/render/capability")
def render_capability():
    return {
        "libreoffice": _find_soffice() is not None,
        "powerpoint_com": sys.platform == "win32" and _probe_powerpoint(),
    }


def _probe_powerpoint() -> bool:
    try:
        import pythoncom  # noqa: F401
        import win32com.client  # noqa: F401

        return True
    except ImportError:
        return False


@router.post("/render")
def render_pptx(
    file: UploadFile = File(...),
    target: str = Form("pdf"),  # "pdf" | "images"
    image_format: str = Form("png"),  # png | jpeg
    dpi: int = Form(150),
) -> dict[str, Any]:
    target_normalized = "images" if target == "images" else "pdf"
    image_format_normalized = "jpeg" if image_format == "jpeg" else "png"
    dpi = min(max(int(dpi), 72), 300)

    with tempfile.TemporaryDirectory(prefix="ppt_render_") as tmp:
        tmp_dir = Path(tmp)
        source = _save_upload_to(tmp_dir, file)
        # 导出名取用户上传的原始文件名；source 是带随机前缀的临时文件，只用于磁盘操作
        base = _safe_base_name(Path(file.filename or "presentation.pptx").name)

        renderer = _pptx_to_pdf(source, tmp_dir)
        pdf_path = tmp_dir / f"{source.stem}.pdf"

        out_dir = _output_dir()

        if target_normalized == "pdf":
            out_name = f"{base}.pdf"
            out_path = out_dir / out_name
            shutil.copy2(pdf_path, out_path)
            return {
                "status": "success",
                "renderer": renderer,
                "download_name": out_name,
                "output_dir": str(out_dir),
                "target": "pdf",
            }

        # images：pypdfium2 逐页渲染 → ZIP（Phase M：替代 PyMuPDF 渲染层）
        import io as _io

        import pypdfium2 as pdfium

        try:
            doc = pdfium.PdfDocument(str(pdf_path))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"渲染后的 PDF 无法解析: {exc}") from exc

        page_count = len(doc)
        if page_count < 1:
            doc.close()
            raise HTTPException(status_code=500, detail="渲染结果为空（0 页）")
        if page_count > MAX_SLIDES:
            doc.close()
            raise HTTPException(status_code=400, detail=f"幻灯片数超过 {MAX_SLIDES} 页上限")

        ext = "jpg" if image_format_normalized == "jpeg" else "png"
        scale = dpi / 72.0
        zip_name = f"{base}_images.zip"
        zip_path = tmp_dir / zip_name
        try:
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as bundle:
                for page_index in range(page_count):
                    pil = doc[page_index].render(scale=scale).to_pil()
                    img_path = tmp_dir / f"slide_{page_index + 1}.{ext}"
                    if ext == "jpg":
                        pil.convert("RGB").save(img_path, format="JPEG", quality=90)
                    else:
                        pil.save(img_path, format="PNG")
                    bundle.write(img_path, f"{base}_slide_{page_index + 1}.{ext}")
        finally:
            doc.close()

        out_path = out_dir / zip_name
        shutil.copy2(zip_path, out_path)
        return {
            "status": "success",
            "renderer": renderer,
            "download_name": zip_name,
            "output_dir": str(out_dir),
            "target": "images",
            "page_count": page_count,
            "image_format": image_format_normalized,
        }
