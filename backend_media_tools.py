"""音视频工具桥（音视讯中心：视频格式转换 / 视频截取 GIF / 语音转写）。

视频与 GIF 依赖本机 ffmpeg（PATH 或项目 tools/ffmpeg/ 目录），编码 profile
采用成熟通用参数（libx264+aac / mpeg4+mp3 / vp9+opus / wmv2+wmav2，
GIF 两遍调色板 palettegen/paletteuse）。语音转写优先 faster-whisper
（纯离线，模型缓存于用户目录），未安装时端点返回 503 引导安装。

长任务采用 job 模式：POST 立即返回 job_id，后台线程跑 ffmpeg/模型，
前端轮询 GET /api/media/jobs/{job_id} 取进度与产物清单。
产物写入 output/ 目录，经 /api/download/{filename} 与原生另存为取件，
不经浏览器 blob 下载通道（pywebview 壳兼容）。
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from core.app_paths import ensure_runtime_layout

router = APIRouter(prefix="/api/media", tags=["media-tools"])

PROJECT_ROOT = ensure_runtime_layout()
OUTPUT_DIR = PROJECT_ROOT / "output"

MAX_INPUT_BYTES = 2 * 1024 * 1024 * 1024  # 单文件 ≤10GB，留 2GB 保守上限
GIF_MAX_CLIP_SECONDS = 30
GIF_FPS_RANGE = (1, 20)
GIF_WIDTH_RANGE = (160, 1920)

VIDEO_TARGETS = {"mp4", "mkv", "mov", "flv", "ts", "avi", "webm", "wmv"}
VIDEO_INPUT_EXTS = {
    ".mp4", ".avi", ".mkv", ".mov", ".webm", ".flv", ".wmv", ".ts", ".m4v",
    ".mpg", ".mpeg", ".3gp", ".ogv",
}
AUDIO_INPUT_EXTS = {
    ".mp3", ".aac", ".wav", ".flac", ".m4a", ".ogg", ".opus", ".wma",
    ".aiff", ".amr",
}
TRANSCRIBE_INPUT_EXTS = VIDEO_INPUT_EXTS | AUDIO_INPUT_EXTS

# 编码 profile 表
VIDEO_PROFILES: dict[str, list[str]] = {
    "mp4": ["-c:v", "libx264", "-c:a", "aac", "-preset", "fast", "-crf", "23"],
    "mkv": ["-c:v", "libx264", "-c:a", "aac", "-preset", "fast", "-crf", "23"],
    "mov": ["-c:v", "libx264", "-c:a", "aac", "-preset", "fast", "-crf", "23"],
    "flv": ["-c:v", "libx264", "-c:a", "aac", "-preset", "fast", "-crf", "23"],
    "ts": ["-c:v", "libx264", "-c:a", "aac", "-preset", "fast", "-crf", "23"],
    "avi": ["-c:v", "mpeg4", "-c:a", "libmp3lame", "-q:v", "4"],
    "webm": ["-c:v", "libvpx-vp9", "-c:a", "libopus", "-row-mt", "1", "-speed", "2", "-crf", "32", "-b:v", "0"],
    "wmv": ["-c:v", "wmv2", "-c:a", "wmav2", "-q:v", "4"],
}

# GIF 质量档位 → (max_colors, dither)
GIF_QUALITY_PROFILES: dict[str, tuple[int, str]] = {
    "high": (256, "sierra2_4a"),
    "balanced": (192, "bayer:bayer_scale=3"),
    "small": (128, "bayer:bayer_scale=4"),
    "tiny": (96, "bayer:bayer_scale=5"),
}

ASR_MODELS = {"base": "base", "small": "small", "medium": "medium"}

_jobs: dict[str, dict[str, Any]] = {}
_jobs_lock = threading.Lock()
_ffmpeg_cache: Optional[tuple[Optional[str], Optional[str]]] = None


# ---------------------------------------------------------------------------
# ffmpeg 定位与探测
# ---------------------------------------------------------------------------

def _find_ffmpeg_pair() -> tuple[Optional[str], Optional[str]]:
    """返回 (ffmpeg, ffprobe) 可执行文件路径，任一缺失为 None。"""
    global _ffmpeg_cache
    if _ffmpeg_cache is not None:
        return _ffmpeg_cache
    result: tuple[Optional[str], Optional[str]] = (None, None)
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        # 项目内置目录 + winget 包目录兜底（PATH 未刷新/便携版环境）
        candidates: list[Path] = [PROJECT_ROOT / "tools" / "ffmpeg" / "ffmpeg.exe"]
        local_app = os.environ.get("LOCALAPPDATA")
        if local_app:
            winget_root = Path(local_app) / "Microsoft" / "WinGet" / "Packages"
            if winget_root.is_dir():
                for pattern in ("Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe", "FFmpeg*/ffmpeg-*/bin/ffmpeg.exe"):
                    candidates.extend(sorted(winget_root.glob(pattern)))
        for candidate in candidates:
            if candidate.exists():
                ffmpeg = str(candidate)
                break
    if ffmpeg:
        ffprobe = shutil.which("ffprobe")
        if not ffprobe:
            ffmpeg_path = Path(ffmpeg)
            sibling = ffmpeg_path.with_name(
                "ffprobe.exe" if ffmpeg_path.suffix == ".exe" else "ffprobe"
            )
            if sibling.exists():
                ffprobe = str(sibling)
        result = (ffmpeg, ffprobe)
    _ffmpeg_cache = result
    return result


def probe_capabilities() -> dict[str, Any]:
    ffmpeg, _ = _find_ffmpeg_pair()
    engine_ready = _asr_engine_available()
    return {
        "ffmpeg": ffmpeg is not None,
        "asr_engine": engine_ready,
        "asr_default_model": "base",
    }


# ---------------------------------------------------------------------------
# 语音转写（faster-whisper，可选依赖）
# ---------------------------------------------------------------------------

def _asr_engine_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def _load_whisper_model(model_size: str):
    """加载 Whisper 模型；官方端点下载失败时自动切 hf-mirror 镜像重试。"""
    try:
        from faster_whisper import WhisperModel
        return WhisperModel(model_size, device="cpu", compute_type="int8")
    except Exception:
        import huggingface_hub.constants as hf_constants
        hf_constants.ENDPOINT = "https://hf-mirror.com"
        from faster_whisper import WhisperModel  # 已缓存导入，换端点重试
        return WhisperModel(model_size, device="cpu", compute_type="int8")


# ---------------------------------------------------------------------------
# 任务管理
# ---------------------------------------------------------------------------

def _set_job(job_id: str, **fields: Any) -> None:
    with _jobs_lock:
        _jobs[job_id].update(fields)


def _get_job(job_id: str) -> Optional[dict[str, Any]]:
    with _jobs_lock:
        return dict(_jobs.get(job_id) or {})


def _prune_jobs() -> None:
    with _jobs_lock:
        if len(_jobs) > 64:
            done_ids = [k for k, v in _jobs.items() if v.get("status") in ("done", "error")]
            for k in done_ids[:-32]:
                _jobs.pop(k, None)


def _probe_duration(ffmpeg: str, ffprobe: Optional[str], source: Path) -> float:
    if ffprobe:
        try:
            out = subprocess.run(
                [ffprobe, "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=nw=1:nk=1", str(source)],
                capture_output=True, text=True, timeout=30,
            )
            return float(out.stdout.strip())
        except (subprocess.SubprocessError, ValueError, OSError):
            pass
    try:
        out = subprocess.run(
            [ffmpeg, "-hide_banner", "-i", str(source)],
            capture_output=True, text=True, timeout=30,
        )
        match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", out.stderr)
        if match:
            h, m, s = match.groups()
            return int(h) * 3600 + int(m) * 60 + float(s)
    except (subprocess.SubprocessError, OSError):
        pass
    return 0.0


def _save_upload(tmp_dir: Path, file: UploadFile, allowed_exts: set[str], kind: str) -> Path:
    raw_name = Path(file.filename or f"input{next(iter(allowed_exts))}").name
    ext = Path(raw_name).suffix.lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"不支持的 {kind} 格式: {ext or '(无扩展名)'}")
    dest = tmp_dir / f"src_{uuid.uuid4().hex[:8]}_{raw_name}"
    try:
        with open(dest, "wb") as handle:
            shutil.copyfileobj(file.file, handle)
    except OSError as exc:
        raise HTTPException(status_code=400, detail=f"上传文件写入失败: {exc}") from exc
    if dest.stat().st_size > MAX_INPUT_BYTES:
        raise HTTPException(status_code=400, detail="文件超过 2GB 上限")
    return dest


def _safe_base_name(source_name: str) -> str:
    base = Path(source_name).stem.strip()
    cleaned = "".join("_" if ch in '\\/:*?"<>|' else ch for ch in base).strip("._ ") or "media"
    return cleaned[:80]


def _unique_output_path(base: str, suffix: str) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    candidate = OUTPUT_DIR / f"{base}{suffix}"
    if not candidate.exists():
        return candidate
    for index in range(1, 1000):
        candidate = OUTPUT_DIR / f"{base}_{index}{suffix}"
        if not candidate.exists():
            return candidate
    return OUTPUT_DIR / f"{base}_{uuid.uuid4().hex[:6]}{suffix}"


def _run_ffmpeg_with_progress(
    ffmpeg: str,
    args: list[str],
    duration: float,
    job_id: str,
    stage: str,
) -> None:
    """跑 ffmpeg 并解析 -progress pipe:1 的 out_time 更新进度（10%~95% 区间）。

    stderr 用后台线程持续排空：ffmpeg 的警告日志会写满 64KB 管道缓冲区，
    若等 stdout 读完再收 stderr 会永久死锁在 95%（Windows 实测复现）。
    """
    import threading

    cmd = [ffmpeg, "-hide_banner", "-nostdin", "-y", *args, "-progress", "pipe:1", "-nostats"]
    process = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace",
    )
    _set_job(job_id, pid=process.pid)

    stderr_chunks: list[str] = []

    def _drain_stderr() -> None:
        assert process.stderr is not None
        try:
            for err_line in process.stderr:
                if len(stderr_chunks) < 64:
                    stderr_chunks.append(err_line)
        except (OSError, ValueError):
            pass

    stderr_thread = threading.Thread(target=_drain_stderr, daemon=True)
    stderr_thread.start()

    assert process.stdout is not None
    for line in process.stdout:
        line = line.strip()
        if line.startswith("out_time_us=") and duration > 0:
            try:
                out_us = float(line.split("=", 1)[1])
                ratio = max(0.0, min(1.0, (out_us / 1_000_000) / duration))
                _set_job(job_id, progress=10 + round(ratio * 85), stage=stage)
            except ValueError:
                pass
    process.wait()
    stderr_thread.join(timeout=5)
    if process.returncode != 0:
        stderr = "".join(stderr_chunks)[-800:]
        raise RuntimeError(f"ffmpeg 失败 (code {process.returncode}): {stderr}")


# ---------------------------------------------------------------------------
# 视频格式转换
# ---------------------------------------------------------------------------

@router.post("/video/convert")
def video_convert(
    file: UploadFile = File(...),
    target: str = Form("mp4"),
) -> dict[str, Any]:
    target_normalized = target.lower().strip(".")
    if target_normalized not in VIDEO_TARGETS:
        raise HTTPException(status_code=400, detail=f"不支持的目标格式: {target}")
    ffmpeg, ffprobe = _find_ffmpeg_pair()
    if not ffmpeg:
        raise HTTPException(status_code=503, detail="本机未检测到 ffmpeg，无法转换视频。请安装 ffmpeg 或将其放入 tools/ffmpeg/ 目录。")

    tmp_dir = Path(tempfile.mkdtemp(prefix="video_convert_"))
    source = _save_upload(tmp_dir, file, VIDEO_INPUT_EXTS, "视频")
    base = _safe_base_name(source.name)
    out_path = _unique_output_path(f"{base}_converted", f".{target_normalized}")
    duration = _probe_duration(ffmpeg, ffprobe, source)

    job_id = uuid.uuid4().hex[:12]
    with _jobs_lock:
        _jobs[job_id] = {
            "job_id": job_id, "kind": "video-convert", "status": "running",
            "progress": 5, "stage": "convert", "error": None, "outputs": [],
        }
    _prune_jobs()

    args = [
        "-i", str(source),
        "-map", "0:v:0?", "-map", "0:a?", "-map_metadata", "0",
        *VIDEO_PROFILES[target_normalized],
        "-pix_fmt", "yuv420p",
        str(out_path),
    ]

    def worker() -> None:
        try:
            _run_ffmpeg_with_progress(ffmpeg, args, duration, job_id, "convert")
            if not out_path.exists() or out_path.stat().st_size == 0:
                raise RuntimeError("ffmpeg 未产出有效文件")
            _set_job(job_id, status="done", progress=100, stage="done",
                     outputs=[{"name": out_path.name, "dir": str(out_path.parent)}])
        except Exception as exc:  # noqa: BLE001 — 任务线程内统一兜底为 error 状态
            _set_job(job_id, status="error", error=str(exc))
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    threading.Thread(target=worker, daemon=True).start()
    return {"job_id": job_id, "status": "running"}


# ---------------------------------------------------------------------------
# 视频截取 GIF
# ---------------------------------------------------------------------------

@router.post("/video/gif")
def video_gif(
    file: UploadFile = File(...),
    start_s: float = Form(0.0),
    end_s: float = Form(5.0),
    fps: int = Form(12),
    width: int = Form(640),
    quality: str = Form("balanced"),
) -> dict[str, Any]:
    ffmpeg, ffprobe = _find_ffmpeg_pair()
    if not ffmpeg:
        raise HTTPException(status_code=503, detail="本机未检测到 ffmpeg，无法生成 GIF。请安装 ffmpeg 或将其放入 tools/ffmpeg/ 目录。")

    start = max(0.0, float(start_s))
    end = float(end_s)
    if end <= start:
        raise HTTPException(status_code=400, detail="结束时间必须大于起始时间")
    if end - start > GIF_MAX_CLIP_SECONDS:
        raise HTTPException(status_code=400, detail=f"GIF 截取最长 {GIF_MAX_CLIP_SECONDS} 秒")
    fps_clamped = min(max(int(fps), GIF_FPS_RANGE[0]), GIF_FPS_RANGE[1])
    width_clamped = min(max(int(width), GIF_WIDTH_RANGE[0]), GIF_WIDTH_RANGE[1])
    quality_profile = GIF_QUALITY_PROFILES.get(quality) or GIF_QUALITY_PROFILES["balanced"]
    max_colors, dither = quality_profile

    tmp_dir = Path(tempfile.mkdtemp(prefix="video_gif_"))
    source = _save_upload(tmp_dir, file, VIDEO_INPUT_EXTS, "视频")
    base = _safe_base_name(source.name)
    out_path = _unique_output_path(f"{base}_{start:.1f}-{end:.1f}s", ".gif")
    duration = _probe_duration(ffmpeg, ffprobe, source)

    job_id = uuid.uuid4().hex[:12]
    with _jobs_lock:
        _jobs[job_id] = {
            "job_id": job_id, "kind": "video-gif", "status": "running",
            "progress": 5, "stage": "gif", "error": None, "outputs": [],
        }
    _prune_jobs()

    filter_complex = (
        f"fps={fps_clamped},"
        f"scale=w='min({width_clamped},iw)':h=-2:flags=lanczos,"
        f"split[a][b];[a]palettegen=max_colors={max_colors}:stats_mode=diff[p];"
        f"[b][p]paletteuse=dither={dither}:diff_mode=rectangle[out]"
    )
    args = [
        "-ss", f"{start:.3f}", "-t", f"{end - start:.3f}",
        "-i", str(source),
        "-filter_complex", filter_complex,
        "-map", "[out]", "-loop", "0",
        str(out_path),
    ]

    def worker() -> None:
        try:
            _run_ffmpeg_with_progress(ffmpeg, args, duration, job_id, "gif")
            if not out_path.exists() or out_path.stat().st_size == 0:
                raise RuntimeError("ffmpeg 未产出有效 GIF")
            _set_job(job_id, status="done", progress=100, stage="done",
                     outputs=[{"name": out_path.name, "dir": str(out_path.parent)}])
        except Exception as exc:  # noqa: BLE001
            _set_job(job_id, status="error", error=str(exc))
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    threading.Thread(target=worker, daemon=True).start()
    return {"job_id": job_id, "status": "running"}


# ---------------------------------------------------------------------------
# 语音转写
# ---------------------------------------------------------------------------

@router.post("/transcribe")
def transcribe(
    file: UploadFile = File(...),
    language: str = Form("auto"),  # auto | zh | en
    model_size: str = Form("base"),  # base | small | medium
) -> dict[str, Any]:
    if not _asr_engine_available():
        raise HTTPException(
            status_code=503,
            detail="语音转写引擎未安装：请在项目环境执行 pip install faster-whisper 后重启应用。",
        )
    language_normalized = language if language in ("auto", "zh", "en") else "auto"
    model_size_normalized = ASR_MODELS.get(model_size, "base")

    tmp_dir = Path(tempfile.mkdtemp(prefix="transcribe_"))
    source = _save_upload(tmp_dir, file, TRANSCRIBE_INPUT_EXTS, "音视频")
    base = _safe_base_name(source.name)

    job_id = uuid.uuid4().hex[:12]
    with _jobs_lock:
        _jobs[job_id] = {
            "job_id": job_id, "kind": "transcribe", "status": "running",
            "progress": 5, "stage": "loading-model", "error": None, "outputs": [],
        }
    _prune_jobs()

    def worker() -> None:
        try:
            model = _load_whisper_model(model_size_normalized)
            _set_job(job_id, progress=20, stage="transcribing")
            segments_iter, info = model.transcribe(
                str(source),
                language=None if language_normalized == "auto" else language_normalized,
                vad_filter=True,
            )
            segments = list(segments_iter)
            if not segments:
                raise RuntimeError("未识别到任何语音内容")

            txt_path = _unique_output_path(f"{base}_transcript", ".txt")
            srt_path = _unique_output_path(f"{base}_transcript", ".srt")

            def fmt_ts(seconds: float) -> str:
                ms = int(round(seconds * 1000))
                h, rem = divmod(ms, 3600_000)
                m, rem = divmod(rem, 60_000)
                s, ms = divmod(rem, 1000)
                return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

            txt_path.write_text("\n".join(seg.text.strip() for seg in segments) + "\n", encoding="utf-8")
            srt_lines: list[str] = []
            for index, seg in enumerate(segments, start=1):
                srt_lines.append(str(index))
                srt_lines.append(f"{fmt_ts(seg.start)} --> {fmt_ts(seg.end)}")
                srt_lines.append(seg.text.strip())
                srt_lines.append("")
            srt_path.write_text("\n".join(srt_lines), encoding="utf-8")

            detected = info.language if language_normalized == "auto" else language_normalized
            _set_job(
                job_id, status="done", progress=100, stage="done",
                detected_language=detected, duration=round(getattr(info, "duration", 0.0) or 0.0, 1),
                outputs=[
                    {"name": txt_path.name, "dir": str(txt_path.parent)},
                    {"name": srt_path.name, "dir": str(srt_path.parent)},
                ],
            )
        except Exception as exc:  # noqa: BLE001
            _set_job(job_id, status="error", error=str(exc))
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    threading.Thread(target=worker, daemon=True).start()
    return {"job_id": job_id, "status": "running"}


# ---------------------------------------------------------------------------
# 任务状态查询
# ---------------------------------------------------------------------------

@router.get("/status")
def media_status() -> dict[str, Any]:
    return probe_capabilities()


@router.get("/jobs/{job_id}")
def media_job(job_id: str) -> dict[str, Any]:
    job = _get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="任务不存在或已过期")
    job.pop("pid", None)
    return job
