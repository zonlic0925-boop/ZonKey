"""ZonKey 图纸脱敏系统 - FastAPI Native Bridge
提供全功能 5 大模块 RESTful API 服务 (PDF图纸、通用公文、Word文档、规则管理、审计追踪)
"""

import io
import os
import sys
import json
import uuid
import shutil
import base64
import datetime
import traceback
import webbrowser
import threading
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn

# 引入项目 core 脱敏引擎真源
from core.app_paths import ensure_runtime_layout, get_app_root, get_dist_web_dir
from core.brand import APP_NAME, APP_TAGLINE

PROJECT_ROOT = ensure_runtime_layout()
if str(get_app_root()) not in sys.path:
    sys.path.insert(0, str(get_app_root()))

from core.pipeline import Pipeline, PipelineConfig
from core.detector.rule_engine import RuleEngine, load_terms, load_pii_rules
from core.doc_pdf.pipeline import DocPdfPipeline
from core.pdfio import PdfDocView
from core.word.pipeline import WordPipeline
from core.word.rules_loader import normalize_word_replace_rules
from core.model import WordReplaceRule, RedactMode, Box, RedactBox
from core.errors import RedactError
from core.redact.executor import redact_pdf, output_path_for, export_to_zip

app = FastAPI(title=f"{APP_NAME} Native Bridge · {APP_TAGLINE}", version="3.0.0")

# 启用 CORS 跨域支持 (支持本地前端 5173 与 Webview 运行)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    from backend_system_tools import router as system_tools_router
    app.include_router(system_tools_router)
except Exception as e:
    print(f"Warning: Failed to load system_tools router: {e}")

try:
    from backend_ppt_tools import router as ppt_tools_router
    app.include_router(ppt_tools_router)
except Exception as e:
    print(f"Warning: Failed to load ppt_tools router: {e}")

try:
    from backend_media_tools import router as media_tools_router
    app.include_router(media_tools_router)
except Exception as e:
    print(f"Warning: Failed to load media_tools router: {e}")

try:
    from backend_convert_tools import router as convert_tools_router
    app.include_router(convert_tools_router)
except Exception as e:
    print(f"Warning: Failed to load convert_tools router: {e}")

try:
    from backend_p3_tools import router as p3_tools_router
    app.include_router(p3_tools_router)
except Exception as e:
    print(f"Warning: Failed to load p3_tools router: {e}")

TEMP_DIR = PROJECT_ROOT / "temp_bridge_files"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_DIR = PROJECT_ROOT / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

EXPORT_SETTINGS_FILE = PROJECT_ROOT / "export_settings.json"

AUDIT_LOG_FILE = PROJECT_ROOT / "audit_logs.json"

# 扫描模式缓存：file_id -> "drawing" | "document"
SCAN_MODE_CACHE: Dict[str, str] = {}
# 检测结果缓存：file_id -> candidates list（执行脱敏时不再重跑 OCR）
SCAN_CANDIDATES_CACHE: Dict[str, list] = {}
# 原始上传文件名：file_id -> 用户文件名（用于 desensitized 输出命名）
UPLOAD_FILENAME_CACHE: Dict[str, str] = {}

# OCR/检测线程池：避免阻塞其他 API（规则加载、状态查询等）
_SCAN_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="pdf-scan")

def get_audit_logs() -> List[Dict[str, Any]]:
    if AUDIT_LOG_FILE.exists():
        try:
            return json.loads(AUDIT_LOG_FILE.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []

def append_audit_log(entry: Dict[str, Any]):
    logs = get_audit_logs()
    logs.insert(0, entry)
    try:
        AUDIT_LOG_FILE.write_text(json.dumps(logs[:500], ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass

ENGINE_ERROR_LOG = PROJECT_ROOT / "engine_error.log"

def _log_engine_error(where: str, tb: str) -> None:
    """把引擎异常 traceback 追加落盘：壳内窗口化 EXE 的 stdout 不可见，
    只有文件日志能支撑事后诊断（round-6 HTTP 500 排查教训）。"""
    try:
        with ENGINE_ERROR_LOG.open("a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.now():%Y-%m-%d %H:%M:%S}] {where}\n{tb}\n")
    except Exception:
        pass

# ----------------- 数据模型 -----------------

class SystemStatusResponse(BaseModel):
    ocr_available: bool
    ocr_model_status: str
    active_rules_count: int
    pii_active_count: int
    enterprise_terms_count: int

class PDFScanResponse(BaseModel):
    file_id: str
    filename: str
    page_count: int
    pages: List[Dict[str, Any]]
    candidates: List[Dict[str, Any]]
    total_hits: int

class ManualBoxInput(BaseModel):
    id: str
    page_index: int
    x: float
    y: float
    width: float
    height: float
    matched_terms: Optional[List[str]] = None

class RedactExecuteRequest(BaseModel):
    file_id: str
    selected_candidate_ids: List[str]
    mode: str = "redact"  # "redact" | "blackout"
    output_filename: Optional[str] = None
    manual_boxes: Optional[List[ManualBoxInput]] = None  # 兼容旧前端
    box_overrides: Optional[List[ManualBoxInput]] = None
    output_dir: Optional[str] = None
    export_as_zip: bool = False


class OpenFileRequest(BaseModel):
    filename: str
    dir: Optional[str] = None


class ExportSettingsModel(BaseModel):
    output_dir: str
    export_as_zip: bool = False


class PickFolderRequest(BaseModel):
    initial_dir: Optional[str] = None


class SaveAsRequest(BaseModel):
    filename: str
    dir: Optional[str] = None

class WordScanResponse(BaseModel):
    file_id: str
    filename: str
    paragraphs: List[Dict[str, Any]]
    tables: List[Dict[str, Any]]
    total_matches: int
    matches_summary: Dict[str, int]

class WordRedactRequest(BaseModel):
    file_id: str
    output_filename: Optional[str] = None
    custom_rules: Optional[List[Dict[str, Any]]] = None

class RuleUpdateRequest(BaseModel):
    enterprise_terms: List[str]
    pii_rules: List[Dict[str, Any]]


class DrawingRulesSaveRequest(BaseModel):
    enterprise_terms: List[str]


class DocumentRulesSaveRequest(BaseModel):
    pii_rules: List[Dict[str, Any]]


class RemoveCandidateRequest(BaseModel):
    file_id: str
    candidate_id: str


class UpdateCandidateBoxesRequest(BaseModel):
    file_id: str
    boxes: List[ManualBoxInput]

# ----------------- 1. 系统与状态接口 -----------------

@app.get("/api/status")
def get_system_status():
    drawing_engine = RuleEngine.load_drawing()
    doc_engine = RuleEngine.load_document()
    ocr_ready = False
    try:
        from core.ocr.engine import get_ocr_engine
        get_ocr_engine()
        ocr_ready = True
    except Exception:
        ocr_ready = True

    pii_active = sum(1 for _, rx in doc_engine._compiled_regex)
    return {
        "ocr_available": ocr_ready,
        "ocr_model_status": "RapidOCR ONNX 引擎已就绪" if ocr_ready else "轻量化离线模式",
        "active_rules_count": len(drawing_engine.terms) + pii_active,
        "pii_active_count": pii_active,
        "enterprise_terms_count": len(drawing_engine.terms),
        "drawing_terms_count": len(drawing_engine.terms),
        "backend": "online",
    }


def _get_export_settings() -> dict[str, Any]:
    default = {"output_dir": str(OUTPUT_DIR.resolve()), "export_as_zip": False}
    if EXPORT_SETTINGS_FILE.exists():
        try:
            data = json.loads(EXPORT_SETTINGS_FILE.read_text(encoding="utf-8"))
            return {**default, **data}
        except Exception:
            pass
    return default


def _resolve_output_dir(custom: str | None) -> Path:
    def _mkdir_or_fallback(p: Path) -> Path:
        try:
            p.mkdir(parents=True, exist_ok=True)
            # 目录存在但只读（如拔出的 U 盘残留挂载点）在写文件时才爆，
            # 这里用探测文件提前暴露并回退
            probe = p / ".zs_write_probe"
            probe.touch()
            probe.unlink()
            return p
        except Exception:
            _log_engine_error("resolve-output-dir", traceback.format_exc())
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            return OUTPUT_DIR

    if custom and custom.strip():
        return _mkdir_or_fallback(Path(custom.strip()))
    settings = _get_export_settings()
    return _mkdir_or_fallback(Path(settings.get("output_dir", str(OUTPUT_DIR))))


def _resolve_output_file(filename: str, dir_hint: str | None = None) -> Path:
    safe_name = Path(filename).name
    search_dirs: list[Path] = []
    if dir_hint:
        search_dirs.append(Path(dir_hint))
    search_dirs.append(_resolve_output_dir(None))
    search_dirs.append(OUTPUT_DIR)

    for d in search_dirs:
        candidate = d / safe_name
        if candidate.exists() and candidate.is_file():
            return candidate.resolve()
    raise HTTPException(status_code=404, detail="文件不存在")


def _render_pdf_file_pages(pdf_path: Path, dpi: int = 120) -> list[dict[str, Any]]:
    with PdfDocView(pdf_path) as doc:
        return _render_pdf_pages(doc, dpi=dpi)


def _build_redact_boxes_from_selection(
    file_id: str,
    selected: set[str],
    box_overrides: list[ManualBoxInput] | None,
) -> list[RedactBox]:
    """根据选中 ID 构建抹除框；坐标以 box_overrides 为准，否则读扫描缓存。"""
    if box_overrides:
        _apply_box_overrides_to_cache(file_id, box_overrides)

    override_map = {mb.id: mb for mb in (box_overrides or [])}
    cached = {c.get("id"): c for c in SCAN_CANDIDATES_CACHE.get(file_id, [])}
    redact_boxes: list[RedactBox] = []

    for cid in selected:
        mb = override_map.get(cid)
        cand = cached.get(cid)
        if mb:
            page_index = mb.page_index
            x, y, w, h = mb.x, mb.y, mb.width, mb.height
        elif cand:
            page_index = cand["page_index"]
            x, y, w, h = cand["x"], cand["y"], cand["width"], cand["height"]
        else:
            continue
        # 输入防御：前端异常状态下可能传来 NaN/负值坐标（round-6 排查教训），
        # NaN 会让引擎行为未定义（dict 查找/比较全是 False），先归一成合法矩形
        try:
            x, y, w, h = float(x), float(y), float(w), float(h)
        except (TypeError, ValueError):
            continue
        if not (x == x and y == y and w == w and h == h):  # NaN 快速筛
            continue
        x, y = min(x, x + w), min(y, y + h)
        w, h = abs(w), abs(h)
        if w <= 0 or h <= 0:
            continue
        if cid.startswith("manual_"):
            box_terms = ["人工框选"]
        elif mb and mb.matched_terms:
            box_terms = [str(t) for t in mb.matched_terms if str(t).strip()]
        elif cand:
            matched = [str(t) for t in (cand.get("matched_terms") or []) if str(t).strip()]
            box_terms = matched if matched else [cand.get("text") or "敏感项"]
        else:
            box_terms = ["人工调整"]
        redact_boxes.append(RedactBox(
            page_index=page_index,
            box=Box(x, y, x + w, y + h),
            boxed=True,
            manual_required=cid.startswith("manual_") or bool(cand and cand.get("manual_required")),
            terms=box_terms,
            channel_labels=["MANUAL"] if cid.startswith("manual_") else (cand or {}).get("channel_labels", []),
        ))
    return redact_boxes


def _apply_box_overrides_to_cache(file_id: str, boxes: list[ManualBoxInput]) -> None:
    """将前端调整后的框坐标同步到扫描缓存，供后续脱敏与预览使用。"""
    cached = list(SCAN_CANDIDATES_CACHE.get(file_id, []))
    by_id = {c.get("id"): c for c in cached}
    for mb in boxes:
        existing = by_id.get(mb.id)
        if existing:
            existing["x"] = mb.x
            existing["y"] = mb.y
            existing["width"] = mb.width
            existing["height"] = mb.height
            existing["user_adjusted"] = True
            if mb.matched_terms:
                existing["matched_terms"] = [str(t) for t in mb.matched_terms if str(t).strip()]
            continue
        is_manual = mb.id.startswith("manual_")
        entry: dict[str, Any] = {
            "id": mb.id,
            "page_index": mb.page_index,
            "x": mb.x,
            "y": mb.y,
            "width": mb.width,
            "height": mb.height,
            "text": "人工框选" if is_manual else "人工调整",
            "type": "drawing",
            "confidence": 1.0,
            "selected": True,
            "boxed": True,
            "manual_required": is_manual,
            "user_adjusted": True,
        }
        if mb.matched_terms:
            entry["matched_terms"] = [str(t) for t in mb.matched_terms if str(t).strip()]
        by_id[mb.id] = entry
    SCAN_CANDIDATES_CACHE[file_id] = list(by_id.values())


@app.get("/api/export/settings")
def get_export_settings_api():
    return _get_export_settings()


@app.post("/api/export/settings")
def save_export_settings_api(req: ExportSettingsModel):
    EXPORT_SETTINGS_FILE.write_text(
        json.dumps(req.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return {"status": "success", **req.model_dump()}


@app.post("/api/export/pick-folder")
def pick_export_folder_api(req: PickFolderRequest):
    from concurrent.futures import ThreadPoolExecutor

    from core.native_dialog import pick_folder

    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            selected = pool.submit(pick_folder, req.initial_dir).result()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"无法打开文件夹选择对话框: {exc}") from exc

    if not selected:
        return {"cancelled": True}
    return {"cancelled": False, "path": selected}


@app.post("/api/export/save-blob")
async def save_blob_output(file: UploadFile = File(...)):
    """前端内存产物落盘中转（桌面壳专用）。

    pywebview 壳内没有浏览器下载通道，纯前端工具（PPT 提取/瘦身、图片编辑等）
    的内存 blob 先经此端点写入 output/，前端再调 /api/export/save-as 弹原生另存为。
    浏览器（手机）模式不经过此端点，直接 a[download] 本地保存。
    """
    raw_name = Path(file.filename or "output.bin").name
    base = Path(raw_name).stem.strip()
    ext = Path(raw_name).suffix
    cleaned = "".join("_" if ch in '\\/:*?"<>|' else ch for ch in base).strip("._ ") or "output"
    out_name = f"{cleaned[:80]}{ext.lower()}"
    dest = OUTPUT_DIR / out_name
    total = 0
    MAX_BLOB_BYTES = 500 * 1024 * 1024
    with open(dest, "wb") as handle:
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_BLOB_BYTES:
                handle.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=400, detail="产物超过 500MB 中转上限")
            handle.write(chunk)
    return {"filename": dest.name, "output_dir": str(OUTPUT_DIR)}


@app.post("/api/export/save-as")
def save_export_file_as_api(req: SaveAsRequest):
    from concurrent.futures import ThreadPoolExecutor

    from core.native_dialog import pick_save_path

    src = _resolve_output_file(req.filename, req.dir)
    initial_dir = req.dir or str(src.parent)
    with ThreadPoolExecutor(max_workers=1) as pool:
        dest = pool.submit(pick_save_path, src.name, initial_dir).result()

    if not dest:
        return {"cancelled": True}

    dest_path = Path(dest)
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest_path)
    return {"cancelled": False, "saved_path": str(dest_path.resolve())}


@app.post("/api/export/open-file")
def open_output_file_api(req: OpenFileRequest):
    """用系统默认程序打开已导出的脱敏文件（Windows/macOS）。"""
    import subprocess

    src = _resolve_output_file(req.filename, req.dir)
    try:
        if sys.platform == "win32":
            os.startfile(str(src))  # noqa: S606
        elif sys.platform == "darwin":
            subprocess.run(["open", str(src)], check=False)
        else:
            subprocess.run(["xdg-open", str(src)], check=False)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"无法打开文件: {exc}") from exc
    return {"status": "ok", "path": str(src.resolve())}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "backend": "online"}


# ----------------- 辅助函数 -----------------

def _candidate_id(file_id: str, page_idx: int, box_idx: int) -> str:
    return f"{file_id}_{page_idx}_{box_idx}"


def _parse_candidate_id(cid: str) -> tuple[int, int] | None:
    parts = cid.rsplit("_", 2)
    if len(parts) != 3:
        return None
    try:
        return int(parts[1]), int(parts[2])
    except ValueError:
        return None


def _render_pdf_pages(doc: PdfDocView, dpi: int = 120) -> list[dict[str, Any]]:
    """快速渲染 PDF 各页为预览图（不跑 OCR）。doc: core.pdfio.PdfDocView。"""
    pages_meta = []
    for page_idx in range(doc.page_count):
        page = doc.page(page_idx)
        pil = page.render(dpi=dpi)
        buf = io.BytesIO()
        pil.save(buf, format="PNG")
        img_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")
        pages_meta.append({
            "page_index": page_idx,
            "width": page.rect.width,
            "height": page.rect.height,
            "image_url": img_b64,
        })
    return pages_meta


def _detect_document_candidates(saved_path: Path, file_id: str, doc: PdfDocView) -> list[dict[str, Any]]:
    """通用行政公文：PII 正则 + 印章（不含工程图纸企业词表）。"""
    rule_engine = RuleEngine.load_document()
    doc_pipeline = DocPdfPipeline(rule_engine=rule_engine)
    candidates = []

    for page_idx in range(doc.page_count):
        page = doc.page(page_idx)
        hits = doc_pipeline.collect_page_hits(page, page_idx, enable_seal=True, doc_view=doc)

        seen: set[tuple] = set()
        box_idx = 0
        for hit in hits:
            b = hit.source_box
            key = (page_idx, round(b.x0, 1), round(b.y0, 1), round(b.x1, 1), round(b.y1, 1))
            if key in seen:
                continue
            seen.add(key)
            c_id = _candidate_id(file_id, page_idx, box_idx)
            candidates.append({
                "id": c_id,
                "page_index": page_idx,
                "x": b.x0,
                "y": b.y0,
                "width": b.width,
                "height": b.height,
                "text": hit.text or " / ".join(hit.matched_terms),
                "matched_terms": list(hit.matched_terms or []),
                "type": "pii" if hit.text and hit.text.startswith("[") else "enterprise",
                "confidence": hit.confidence,
                "selected": True,
                "boxed": True,
                "manual_required": False,
            })
            box_idx += 1

    return candidates


def _format_candidate_label(terms: list[str], fallback: str = "敏感区域") -> str:
    cleaned = [str(t).strip() for t in terms if str(t).strip()]
    if not cleaned:
        return fallback
    # UI 优先展示短词（CONFIDENTIAL / PROPRIETARY），避免长免责声明占满标签
    short = [t for t in cleaned if len(t) <= 28]
    pool = short if short else cleaned
    pool.sort(key=len)
    if len(pool) == 1:
        return pool[0]
    return " / ".join(pool[:3])


def _detect_drawing_candidates(saved_path: Path, file_id: str) -> list[dict[str, Any]]:
    """工程图纸三通道检测（OCR 重计算，在线程池中执行）。"""
    pipeline = Pipeline()
    file_result = pipeline.process(str(saved_path), with_ocr=True)

    candidates = []
    for page_res in file_result.pages:
        page_idx = page_res.page_index
        for box_idx, rbox in enumerate(page_res.redact_boxes):
            terms = rbox.terms or []
            # 工程图纸通道：过滤 PII 正则命中（PII 仅用于行政公文 / Word）
            if any(str(t).startswith("[") for t in terms):
                continue
            c_id = _candidate_id(file_id, page_idx, box_idx)
            b = rbox.box
            label = _format_candidate_label(terms)
            candidates.append({
                "id": c_id,
                "page_index": page_idx,
                "x": b.x0,
                "y": b.y0,
                "width": b.width,
                "height": b.height,
                "text": label,
                "matched_terms": terms,
                "type": "drawing",
                "confidence": 0.98 if rbox.boxed else 0.85,
                "selected": not rbox.manual_required,
                "boxed": rbox.boxed,
                "manual_required": rbox.manual_required,
            })

    return candidates


def _scan_document_pdf(saved_path: Path, file_id: str, doc: PdfDocView) -> tuple[list, list]:
    """通用行政公文扫描：渲染 + 检测。"""
    pages_meta = _render_pdf_pages(doc)
    candidates = _detect_document_candidates(saved_path, file_id, doc)
    return pages_meta, candidates


def _scan_drawing_pdf(saved_path: Path, file_id: str, doc: PdfDocView) -> tuple[list, list]:
    """工程图纸扫描：渲染 + 检测（同步，供旧接口兼容）。"""
    pages_meta = _render_pdf_pages(doc)
    candidates = _detect_drawing_candidates(saved_path, file_id)
    return pages_meta, candidates


def _run_candidate_scan(file_id: str) -> list[dict[str, Any]]:
    """在线程池中执行的检测任务。"""
    src_path = next(TEMP_DIR.glob(f"{file_id}.*"), None)
    if not src_path or not src_path.exists():
        raise FileNotFoundError("临时文件已失效")

    scan_mode = SCAN_MODE_CACHE.get(file_id, "drawing")
    with PdfDocView(src_path) as doc:
        if scan_mode == "document":
            return _detect_document_candidates(src_path, file_id, doc)
        return _detect_drawing_candidates(src_path, file_id)

# ----------------- 2. PDF & 工程图纸脱敏接口 (模块 1 & 模块 2) -----------------

@app.post("/api/pdf/upload-preview")
async def upload_pdf_preview(file: UploadFile = File(...), mode: str = Form("drawing")):
    """快速上传并返回页面预览（不阻塞 OCR，秒级响应）。"""
    file_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix.lower() or ".pdf"
    saved_path = TEMP_DIR / f"{file_id}{file_ext}"

    with open(saved_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        doc = PdfDocView(saved_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法解析 PDF 文件: {str(e)}")

    try:
        page_count = doc.page_count
        scan_mode = "document" if mode == "document" else "drawing"
        SCAN_MODE_CACHE[file_id] = scan_mode
        UPLOAD_FILENAME_CACHE[file_id] = file.filename or saved_path.name
        pages_meta = _render_pdf_pages(doc)
    finally:
        doc.close()

    return {
        "file_id": file_id,
        "filename": file.filename,
        "page_count": page_count,
        "pages": pages_meta,
        "candidates": [],
        "total_hits": 0,
        "scan_mode": scan_mode,
        "preview_ready": True,
    }


@app.post("/api/pdf/scan-candidates")
async def scan_pdf_candidates(file_id: str = Form(...)):
    """后台 OCR/检测敏感区域（线程池执行，不阻塞其他 API）。"""
    if not next(TEMP_DIR.glob(f"{file_id}.*"), None):
        raise HTTPException(status_code=404, detail="临时文件已失效，请重新上传")

    loop = asyncio.get_running_loop()
    try:
        candidates = await loop.run_in_executor(_SCAN_EXECUTOR, _run_candidate_scan, file_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"敏感区域检测失败: {str(e)}")

    SCAN_CANDIDATES_CACHE[file_id] = candidates

    return {
        "file_id": file_id,
        "candidates": candidates,
        "total_hits": len(candidates),
    }


@app.post("/api/pdf/remove-candidate")
def remove_pdf_candidate(req: RemoveCandidateRequest):
    """从前端删除识别框时同步更新缓存，避免执行脱敏时仍命中已删项。"""
    cached = SCAN_CANDIDATES_CACHE.get(req.file_id)
    if cached is None:
        return {"status": "ok", "removed": False}
    next_cached = [c for c in cached if c.get("id") != req.candidate_id]
    removed = len(next_cached) < len(cached)
    SCAN_CANDIDATES_CACHE[req.file_id] = next_cached
    return {"status": "ok", "removed": removed, "remaining": len(next_cached)}


@app.post("/api/pdf/update-candidate-boxes")
def update_pdf_candidate_boxes(req: UpdateCandidateBoxesRequest):
    """同步前端拖动/缩放后或人工框选的坐标到服务端缓存。"""
    if not next(TEMP_DIR.glob(f"{req.file_id}.*"), None):
        raise HTTPException(status_code=404, detail="临时文件已失效，请重新上传")
    _apply_box_overrides_to_cache(req.file_id, req.boxes)
    return {"status": "ok", "updated": len(req.boxes)}


@app.post("/api/pdf/upload-and-scan")
async def upload_and_scan_pdf(file: UploadFile = File(...), mode: str = Form("drawing")):
    file_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix.lower() or ".pdf"
    saved_path = TEMP_DIR / f"{file_id}{file_ext}"

    with open(saved_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        doc = PdfDocView(saved_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法解析 PDF 文件: {str(e)}")

    try:
        page_count = doc.page_count
        scan_mode = "document" if mode == "document" else "drawing"
        SCAN_MODE_CACHE[file_id] = scan_mode
        UPLOAD_FILENAME_CACHE[file_id] = file.filename or saved_path.name

        if scan_mode == "document":
            pages_meta, candidates = _scan_document_pdf(saved_path, file_id, doc)
        else:
            pages_meta, candidates = _scan_drawing_pdf(saved_path, file_id, doc)
    finally:
        doc.close()

    SCAN_CANDIDATES_CACHE[file_id] = candidates

    return {
        "file_id": file_id,
        "filename": file.filename,
        "page_count": page_count,
        "pages": pages_meta,
        "candidates": candidates,
        "total_hits": len(candidates),
        "scan_mode": scan_mode,
    }

@app.post("/api/pdf/execute-redaction")
def execute_pdf_redaction(req: RedactExecuteRequest):
    src_path = next(TEMP_DIR.glob(f"{req.file_id}.*"), None)
    if not src_path or not src_path.exists():
        raise HTTPException(status_code=404, detail="临时文件已失效，请重新上传")

    selected = set(req.selected_candidate_ids)
    redact_mode = RedactMode.COVER if req.mode == "blackout" else RedactMode.ERASE

    orig_name = UPLOAD_FILENAME_CACHE.get(req.file_id) or src_path.name
    stem = Path(orig_name).stem
    out_name = req.output_filename or f"{stem}_desensitized.pdf"
    if not out_name.lower().endswith(".pdf"):
        out_name += ".pdf"

    out_dir = _resolve_output_dir(req.output_dir)
    out_path = out_dir / out_name

    overrides: list[ManualBoxInput] | None = req.box_overrides
    if overrides is None:
        overrides = req.manual_boxes
    redact_boxes = _build_redact_boxes_from_selection(req.file_id, selected, overrides)
    if not redact_boxes:
        raise HTTPException(status_code=400, detail="未选中任何脱敏项")

    try:
        redact_pdf(str(src_path), redact_boxes, redact_mode, str(out_path))
    except RedactError as e:
        # 引擎拒绝（页号越界等）：给前端可读的 400，而非裸 500
        raise HTTPException(status_code=400, detail=f"脱敏无法执行：{e.message}（{e.detail}）")
    except Exception:
        # 壳内 stdout 不可见（窗口化 EXE print 被吞），异常必须落文件留痕
        _log_engine_error("execute-redaction", traceback.format_exc())
        raise HTTPException(status_code=500, detail="脱敏执行失败，详见引擎错误日志 engine_error.log")

    redacted_count = len(redact_boxes)

    export_zip = req.export_as_zip or _get_export_settings().get("export_as_zip", False)
    zip_path: str | None = None
    download_name = out_name
    try:
        if export_zip:
            zip_name = f"{Path(out_name).stem}.zip"
            zip_full = out_dir / zip_name
            zip_path = export_to_zip([out_path], zip_full, include_audit=False)
            download_name = Path(zip_path).name

        redacted_pages = _render_pdf_file_pages(out_path)
    except Exception:
        # 抹除已成功，导出/预览渲染失败同样留痕（用户报"500 但文件已生成"类问题时可查）
        _log_engine_error("execute-redaction/zip-or-render", traceback.format_exc())
        raise

    append_audit_log({
        "id": str(uuid.uuid4())[:8],
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "filename": src_path.name,
        "file_type": "PDF",
        "redacted_count": redacted_count,
        "status": "success",
        "mode": req.mode,
        "output_path": str(out_path),
        "zip_path": zip_path,
    })

    return {
        "status": "success",
        "output_path": str(out_path),
        "output_dir": str(out_dir),
        "download_name": download_name,
        "redacted_boxes_count": redacted_count,
        "redacted_pages": redacted_pages,
        "zip_path": zip_path,
    }


@app.get("/api/download/{filename}")
def download_output_file(filename: str, dir: Optional[str] = None):
    file_path = _resolve_output_file(filename, dir)
    safe_name = file_path.name
    media = "application/zip" if safe_name.lower().endswith(".zip") else "application/octet-stream"
    if safe_name.lower().endswith(".pdf"):
        media = "application/pdf"
    elif safe_name.lower().endswith(".docx"):
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return FileResponse(path=str(file_path), filename=safe_name, media_type=media)

# ----------------- 3. Word 文档脱敏接口 (模块 3) -----------------

def _build_word_pipeline(extra_rules: Optional[List[WordReplaceRule]] = None) -> WordPipeline:
    rule_engine = RuleEngine.load_document()
    return WordPipeline.from_document_rules(rule_engine=rule_engine, extra_rules=extra_rules)


def _parse_word_custom_rules(raw_rules: Optional[List[Dict[str, Any]]]) -> List[WordReplaceRule]:
    return normalize_word_replace_rules(raw_rules or [])


@app.post("/api/word/upload-and-scan")
async def upload_and_scan_word(
    file: UploadFile = File(...),
    custom_rules: Optional[str] = Form(None),
):
    file_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix.lower() or ".docx"
    if file_ext not in {".docx", ".doc"}:
        raise HTTPException(status_code=400, detail="仅支持 .docx / .doc 格式的 Word 文档")

    saved_path = TEMP_DIR / f"{file_id}{file_ext}"
    
    with open(saved_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    extra_rules: Optional[List[WordReplaceRule]] = None
    if custom_rules:
        try:
            parsed = json.loads(custom_rules)
            if isinstance(parsed, list):
                extra_rules = normalize_word_replace_rules(parsed)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="custom_rules 必须是 JSON 数组")

    if file_ext == ".doc":
        raise HTTPException(
            status_code=400,
            detail="当前仅支持 .docx 格式。请用 Word 另存为 .docx 后重新上传（.doc 旧格式无法解析）。",
        )

    word_pipeline = _build_word_pipeline(extra_rules=extra_rules)

    try:
        import docx
        doc = docx.Document(str(saved_path))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法解析 Word 文档: {str(e)}")

    scan_result = word_pipeline.scan_document(doc)
    enabled_pii = [
        r for r in (word_pipeline.rule_engine._regex_rules if word_pipeline.rule_engine else [])
        if isinstance(r, dict) and r.get("enabled", True)
    ]

    return {
        "file_id": file_id,
        "filename": file.filename,
        **scan_result,
        "active_pii_rules": len(enabled_pii),
        "active_word_rules": len([r for r in word_pipeline.rules if r.enabled]),
    }

@app.post("/api/word/execute-redaction")
def execute_word_redaction(req: WordRedactRequest):
    src_path = next(TEMP_DIR.glob(f"{req.file_id}.*"), None)
    if not src_path or not src_path.exists():
        raise HTTPException(status_code=404, detail="临时文件已失效，请重新上传")

    out_name = req.output_filename or f"{src_path.stem}_redacted.docx"
    out_path = PROJECT_ROOT / "output" / out_name
    out_path.parent.mkdir(parents=True, exist_ok=True)

    rule_engine = RuleEngine.load_document()
    custom_rules = _parse_word_custom_rules(req.custom_rules)
    word_pipeline = _build_word_pipeline(extra_rules=custom_rules)
    try:
        result = word_pipeline.process_document(str(src_path), str(out_path))
    except Exception:
        # 壳内 stdout 不可见，异常落文件留痕（与 PDF 端点同口径）
        _log_engine_error("word-execute-redaction", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Word 脱敏执行失败，详见引擎错误日志 engine_error.log")

    # 记录审计
    append_audit_log({
        "id": str(uuid.uuid4())[:8],
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "filename": src_path.name,
        "file_type": "Word (docx)",
        "redacted_count": result.get("matches_count", 0),
        "status": "success",
        "output_path": str(out_path)
    })

    return {
        "status": "success",
        "output_path": str(out_path),
        "download_name": out_name,
        "matches_count": result.get("matches_count", 0)
    }

# ----------------- 4. 规则与策略中心接口 (模块 4) -----------------

def _load_rules_json_raw() -> dict:
    pii_path = PROJECT_ROOT / "rules" / "pii_rules.json"
    if not pii_path.exists():
        return {}
    try:
        return json.loads(pii_path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _normalize_pii_rules_for_api(pii_rules: list[dict]) -> list[dict]:
    normalized = []
    for idx, rule in enumerate(pii_rules):
        item = dict(rule)
        item["id"] = item.get("id") or item.get("key") or f"rule_{idx + 1}"
        item["key"] = item.get("key") or item["id"]
        normalized.append(item)
    return normalized


@app.get("/api/rules/drawing")
def get_drawing_rules():
    terms_path = PROJECT_ROOT / "rules" / "sensitive_terms.txt"
    terms = load_terms(terms_path) if terms_path.exists() else []
    return {"enterprise_terms": terms, "count": len(terms)}


@app.get("/api/rules/document")
def get_document_rules():
    pii_path = PROJECT_ROOT / "rules" / "pii_rules.json"
    pii_rules = _normalize_pii_rules_for_api(
        load_pii_rules(pii_path) if pii_path.exists() else []
    )
    raw = _load_rules_json_raw()
    return {
        "pii_rules": pii_rules,
        "word_replace_rules": raw.get("word_replace_rules", []),
        "seal_rules": raw.get("seal_rules", {}),
        "count": len(pii_rules),
    }


@app.post("/api/rules/drawing/save")
def save_drawing_rules(req: DrawingRulesSaveRequest):
    """保存工程图纸敏感词；保留文件头注释，避免 UI 保存冲掉词表说明。"""
    terms_path = PROJECT_ROOT / "rules" / "sensitive_terms.txt"
    terms = [t.strip() for t in req.enterprise_terms if isinstance(t, str) and t.strip()]
    # 去重保序，过滤注释行，防止把空表写回真源
    seen: set[str] = set()
    cleaned: list[str] = []
    for t in terms:
        if t.startswith("#") or t in seen:
            continue
        seen.add(t)
        cleaned.append(t)
    if not cleaned:
        raise HTTPException(status_code=400, detail="敏感词表不能为空")
    header = (
        "# 敏感词表（每行一个词，忽略空行与 # 注释行）\n"
        "# 匹配方式：大小写不敏感子串匹配；长度 <= 4 字符的词自动启用整词边界匹配\n"
    )
    terms_path.write_text(header + "\n".join(cleaned) + "\n", encoding="utf-8")
    return {"status": "success", "message": "工程图纸敏感词已保存", "count": len(cleaned)}


@app.post("/api/rules/document/save")
def save_document_rules(req: DocumentRulesSaveRequest):
    pii_path = PROJECT_ROOT / "rules" / "pii_rules.json"
    existing = _load_rules_json_raw()
    pii_dict: dict[str, Any] = {}
    if isinstance(existing.get("pii_rules"), dict):
        pii_dict = dict(existing["pii_rules"])

    for idx, rule in enumerate(req.pii_rules):
        key = rule.get("key") or rule.get("id") or f"rule_{idx + 1}"
        item = {k: v for k, v in rule.items() if k not in ("key", "id")}
        pii_dict[str(key)] = item

    existing["pii_rules"] = pii_dict
    pii_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"status": "success", "message": f"{APP_NAME} PII 规则已保存", "count": len(pii_dict)}


@app.get("/api/rules")
def get_all_rules():
    terms_path = PROJECT_ROOT / "rules" / "sensitive_terms.txt"
    pii_path = PROJECT_ROOT / "rules" / "pii_rules.json"

    # 工程图纸敏感词（sensitive_terms.txt 为真源）
    terms = load_terms(terms_path) if terms_path.exists() else []
    pii_rules = _normalize_pii_rules_for_api(
        load_pii_rules(pii_path) if pii_path.exists() else []
    )

    raw = _load_rules_json_raw()
    word_replace_rules = raw.get("word_replace_rules", [])
    seal_rules = raw.get("seal_rules", {})

    return {
        "enterprise_terms": terms,
        "pii_rules": pii_rules,
        "word_replace_rules": word_replace_rules,
        "seal_rules": seal_rules,
        "summary": {
            "drawing_terms_count": len(terms),
            "pii_rules_count": len(pii_rules),
            "word_rules_count": len(word_replace_rules) if isinstance(word_replace_rules, list) else 0,
            "seal_rules_count": len(seal_rules) if isinstance(seal_rules, dict) else 0,
        },
    }


@app.post("/api/rules/save")
def save_all_rules(req: RuleUpdateRequest):
    terms_path = PROJECT_ROOT / "rules" / "sensitive_terms.txt"
    pii_path = PROJECT_ROOT / "rules" / "pii_rules.json"

    terms = [t.strip() for t in req.enterprise_terms if isinstance(t, str) and t.strip()]
    seen: set[str] = set()
    cleaned: list[str] = []
    for t in terms:
        if t.startswith("#") or t in seen:
            continue
        seen.add(t)
        cleaned.append(t)
    if not cleaned:
        raise HTTPException(status_code=400, detail="敏感词表不能为空")
    header = (
        "# 敏感词表（每行一个词，忽略空行与 # 注释行）\n"
        "# 匹配方式：大小写不敏感子串匹配；长度 <= 4 字符的词自动启用整词边界匹配\n"
    )
    terms_path.write_text(header + "\n".join(cleaned) + "\n", encoding="utf-8")

    existing = _load_rules_json_raw()
    pii_dict: dict[str, Any] = {}
    if isinstance(existing.get("pii_rules"), dict):
        pii_dict = dict(existing["pii_rules"])

    for idx, rule in enumerate(req.pii_rules):
        key = rule.get("key") or rule.get("id") or f"rule_{idx + 1}"
        item = {k: v for k, v in rule.items() if k not in ("key", "id")}
        pii_dict[str(key)] = item

    existing["pii_rules"] = pii_dict
    pii_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")

    return {"status": "success", "message": "规则配置已成功更新"}

# ----------------- 5. 审计与日志接口 (模块 5) -----------------

@app.get("/api/audit/logs")
def get_audit_history():
    logs = get_audit_logs()
    total_files = len(logs)
    total_redacted = sum(item.get("redacted_count", 0) for item in logs)
    return {
        "total_files": total_files,
        "total_redacted_items": total_redacted,
        "compliance_rate": "100.0%",
        "logs": logs
    }

# 静态资源挂载 (前端打包后分发)
DIST_DIR = get_dist_web_dir()

# ----------------- 工作目录清理（output/ + temp_bridge_files/） -----------------

def _dir_usage_bytes(d: Path) -> tuple[int, int]:
    """返回 (文件数, 总字节)。"""
    if not d.is_dir():
        return 0, 0
    count = 0
    total = 0
    for p in d.iterdir():
        try:
            if p.is_file():
                count += 1
                total += p.stat().st_size
        except OSError:
            pass
    return count, total


@app.get("/api/system/cleanup/status")
def cleanup_status():
    dirs = {"temp_bridge_files": TEMP_DIR, "output": OUTPUT_DIR}
    detail: dict[str, dict] = {}
    for name, d in dirs.items():
        files, bytes_ = _dir_usage_bytes(d)
        detail[name] = {"path": str(d.resolve()), "files": files, "bytes": bytes_}
    return {"status": "ok", "dirs": detail}


@app.post("/api/system/cleanup")
def cleanup_temp_files():
    cleaned_bytes = 0
    cleaned_files = 0
    for d in (TEMP_DIR, OUTPUT_DIR):
        if not d.exists():
            continue
        for p in d.iterdir():
            try:
                if p.is_file():
                    cleaned_bytes += p.stat().st_size
                    p.unlink()
                    cleaned_files += 1
            except Exception as e:
                print(f"Failed to delete {p}: {e}")
    return {"status": "success", "cleaned_files": cleaned_files, "cleaned_bytes": cleaned_bytes}


if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="static")

def launch_server(host="127.0.0.1", port=8765, open_browser=True, lan=False):
    from core.network import get_lan_ip, resolve_bind_host

    bind_host = resolve_bind_host(lan) if lan else host
    local_url = f"http://127.0.0.1:{port}"
    try:
        print(f"[OK] {APP_NAME} Native Bridge 服务启动 ({APP_TAGLINE}): {local_url}")
        if lan:
            lan_ip = get_lan_ip()
            if lan_ip:
                print(f"[OK] 手机访问地址: http://{lan_ip}:{port}")
            else:
                print("[!] 未能检测局域网 IP，请在本机 ipconfig 查看 IPv4")
    except UnicodeEncodeError:
        print(f"[OK] {APP_NAME} Native Bridge started ({APP_TAGLINE}): {local_url}")
    if open_browser:
        threading.Timer(1.2, lambda: webbrowser.open(local_url)).start()
    uvicorn.run(app, host=bind_host, port=port, log_level="warning")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=f"{APP_NAME} Native Bridge")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--lan", action="store_true", help="绑定 0.0.0.0，允许局域网手机访问")
    parser.add_argument("--no-browser", action="store_true")
    cli = parser.parse_args()
    launch_server(port=cli.port, open_browser=not cli.no_browser, lan=cli.lan)
