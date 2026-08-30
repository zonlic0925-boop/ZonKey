# -*- coding: utf-8 -*-
"""Track A：后端 HTTP 逐功能最小验证（FastAPI TestClient，in-process）。

覆盖：状态/规则/审计/图纸脱敏/公文脱敏/Word 脱敏/PPT 转 PDF/转图/能力探测/
音视讯 ffmpeg 三件套/语音转写/导出设置/下载/系统工具 8 项。
每项一个最小断言。"""
import io
import sys
import time
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
import fitz  # noqa: E402

HERE = Path(__file__).parent
FIX = HERE / "fixtures"
OUT = HERE.parent / "output"

from fastapi.testclient import TestClient  # noqa: E402
import server_bridge  # noqa: E402

client = TestClient(server_bridge.app)
results = []


def check(name, cond, extra=""):
    results.append((name, bool(cond), extra))
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  [{extra}]"))


def poll_job(job_id, timeout=600):
    start = time.time()
    last = None
    while time.time() - start < timeout:
        r = client.get(f"/api/media/jobs/{job_id}")
        if r.status_code != 200:
            return {"status": "error", "error": f"job api {r.status_code}"}
        last = r.json()
        if last["status"] in ("done", "error"):
            return last
        time.sleep(1.5)
    return {"status": "error", "error": f"timeout {timeout}s, last={last}"}


# ---------- 1. 状态与健康 ----------
r = client.get("/api/health")
check("api health", r.status_code == 200)
r = client.get("/api/status")
check("api status", r.status_code == 200 and "active_rules_count" in r.json())

# ---------- 2. 规则中心 ----------
r = client.get("/api/rules")
check("rules get", r.status_code == 200 and "enterprise_terms" in r.json())
rules_snapshot = r.json()
r = client.post("/api/rules/save", json={
    "enterprise_terms": rules_snapshot.get("enterprise_terms", []),
    "pii_rules": rules_snapshot.get("pii_rules", []),
})
check("rules save (restore same)", r.status_code == 200)

# ---------- 3. 审计 ----------
r = client.get("/api/audit/logs")
check("audit logs", r.status_code == 200 and "logs" in r.json() and "total_redacted_items" in r.json())

# ---------- 4. 图纸脱敏（工程图纸 PDF 全链路） ----------
with open(FIX / "drawing.pdf", "rb") as fh:
    r = client.post("/api/pdf/upload-and-scan", files={"file": ("drawing.pdf", fh, "application/pdf")}, data={"mode": "drawing"})
check("drawing upload+scan", r.status_code == 200 and r.json().get("file_id"), r.text[:200])
drawing_file_id = r.json()["file_id"]
cands = r.json().get("candidates", [])
check("drawing candidates found", len(cands) > 0, f"n={len(cands)}")

r = client.post("/api/pdf/execute-redaction", json={
    "file_id": drawing_file_id,
    "selected_candidate_ids": [c["id"] for c in cands],
    "mode": "redact",
})
check("drawing execute redact", r.status_code == 200 and r.json().get("download_name"), r.text[:300])
drawing_out = r.json().get("download_name", "missing.pdf")
out_pdf = OUT / drawing_out
hits = 0
if out_pdf.exists():
    doc = fitz.open(out_pdf)
    for page in doc:
        hits += page.search_for("CONFIDENTIAL").__len__()
        hits += page.search_for("PROPRIETARY").__len__()
        hits += page.search_for("DO NOT COPY").__len__()
    doc.close()
check("drawing output zero sensitive hits", out_pdf.exists() and hits == 0, f"hits={hits}, file={drawing_out}")

# ---------- 5. 公文 PDF 脱敏 ----------
with open(FIX / "document.pdf", "rb") as fh:
    r = client.post("/api/pdf/upload-and-scan", files={"file": ("document.pdf", fh, "application/pdf")}, data={"mode": "document"})
check("docpdf upload+scan", r.status_code == 200 and r.json().get("file_id"), r.text[:200])
docpdf_id = r.json()["file_id"]
docpdf_cands = r.json().get("candidates", [])
check("docpdf candidates found", len(docpdf_cands) > 0, f"n={len(docpdf_cands)}")
r = client.post("/api/pdf/execute-redaction", json={
    "file_id": docpdf_id,
    "selected_candidate_ids": [c["id"] for c in docpdf_cands],
    "mode": "redact",
})
check("docpdf execute redact", r.status_code == 200 and r.json().get("download_name"), r.text[:200])
docpdf_out = OUT / r.json().get("download_name", "missing.pdf")
if docpdf_out.exists():
    d = fitz.open(docpdf_out)
    # 公文模式规则范围为 PII（手机号/邮箱）；企业词属工程图纸模式，不在检测范围
    hit = sum(len(p.search_for("13800138000")) + len(p.search_for("zhangsan@example.com")) for p in d)
    d.close()
else:
    hit = -1
check("docpdf output zero PII hits", hit == 0, f"hits={hit}")

# ---------- 6. Word 脱敏 ----------
with open(FIX / "sample.docx", "rb") as fh:
    r = client.post("/api/word/upload-and-scan", files={"file": ("sample.docx", fh, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
check("word upload+scan", r.status_code == 200 and r.json().get("file_id"), r.text[:200])
word_id = r.json()["file_id"]
r = client.post("/api/word/execute-redaction", json={
    "file_id": word_id,
    "custom_rules": [{"find": "CONFIDENTIAL", "replace": "███████████", "mode": "exact"}],
})
check("word execute redact", r.status_code == 200 and r.json().get("download_name"), r.text[:200])
word_out = OUT / r.json().get("download_name", "missing.docx")
if word_out.exists():
    from docx import Document as Docx
    text = "\n".join(p.text for p in Docx(word_out).paragraphs)
    ok = "CONFIDENTIAL" not in text
else:
    ok = False
check("word output zero sensitive hits", ok, f"file={word_out.name if word_out.exists() else 'missing'}")

# ---------- 7. PPT 工坊（后端渲染） ----------
r = client.get("/api/ppt/render/capability")
check("ppt capability", r.status_code == 200 and isinstance(r.json(), dict), r.text[:100])

with open(FIX / "draft.pptx", "rb") as fh:
    r = client.post("/api/ppt/render", files={"file": ("draft.pptx", fh, "application/vnd.openxmlformats-officedocument.presentationml.presentation")}, data={"target": "pdf"})
check("ppt to pdf (COM/LO)", r.status_code == 200 and (OUT / r.json().get("download_name", "")).exists(), r.text[:200])

with open(FIX / "draft.pptx", "rb") as fh:
    r = client.post("/api/ppt/render", files={"file": ("draft.pptx", fh, "application/vnd.openxmlformats-officedocument.presentationml.presentation")}, data={"target": "images", "image_format": "png"})
img_zip = OUT / r.json().get("download_name", "") if r.status_code == 200 else None
zip_ok = False
if img_zip and img_zip.exists():
    with zipfile.ZipFile(img_zip) as zf:
        names = zf.namelist()
        zip_ok = len(names) >= 1
check("ppt to images zip", zip_ok, r.text[:150])

# ---------- 8. 音视讯中心（ffmpeg 后端） ----------
r = client.get("/api/media/status")
check("media status ffmpeg+asr", r.status_code == 200 and r.json().get("ffmpeg") and r.json().get("asr_engine"), r.text[:120])

with open(FIX / "clip.mp4", "rb") as fh:
    r = client.post("/api/media/video/convert", files={"file": ("clip.mp4", fh, "video/mp4")}, data={"target": "webm"})
check("video convert job started", r.status_code == 200 and r.json().get("job_id"), r.text[:150])
job = poll_job(r.json()["job_id"], timeout=300)
conv_out = OUT / job["outputs"][0]["name"] if job.get("outputs") else None
check("video convert done", job["status"] == "done" and conv_out and conv_out.exists() and conv_out.stat().st_size > 1000, str(job)[:200])

with open(FIX / "clip.mp4", "rb") as fh:
    r = client.post("/api/media/video/gif", files={"file": ("clip.mp4", fh, "video/mp4")}, data={"start_s": 0, "end_s": 1.5, "fps": 10, "width": 320, "quality": "balanced"})
check("video gif job started", r.status_code == 200 and r.json().get("job_id"), r.text[:150])
job = poll_job(r.json()["job_id"], timeout=300)
gif_out = OUT / job["outputs"][0]["name"] if job.get("outputs") else None
gif_ok = False
if gif_out and gif_out.exists():
    with open(gif_out, "rb") as gf:
        gif_ok = gf.read(6) in (b"GIF89a", b"GIF87a")
check("video gif done (GIF header)", job["status"] == "done" and gif_ok, str(job)[:200])

# ---------- 9. 语音转写（faster-whisper，首次运行下载 base 模型） ----------
print("  ... transcription starting (model download on first use) ...")
with open(FIX / "speech.wav", "rb") as fh:
    r = client.post("/api/media/transcribe", files={"file": ("speech.wav", fh, "audio/wav")}, data={"language": "en", "model_size": "base"})
check("transcribe job started", r.status_code == 200 and r.json().get("job_id"), r.text[:200])
t0 = time.time()
job = poll_job(r.json()["job_id"], timeout=1800)
print(f"  ... transcription finished in {time.time()-t0:.0f}s: {job.get('status')} {job.get('error') or ''}")
txt_out = None
if job["status"] == "done":
    for o in job["outputs"]:
        if o["name"].endswith(".txt"):
            txt_out = OUT / o["name"]
txt_ok = False
if txt_out and txt_out.exists():
    content = txt_out.read_text(encoding="utf-8").lower()
    txt_ok = ("hello" in content) or ("transcription" in content) or ("test" in content)
check("transcribe done + text recognized", job["status"] == "done" and txt_ok, str(job)[:250])

# ---------- 10. 导出设置与下载 ----------
r = client.get("/api/export/settings")
check("export settings get", r.status_code == 200 and "output_dir" in r.json())
target = conv_out or gif_out
if target:
    r = client.get(f"/api/download/{target.name}")
    check("download endpoint", r.status_code == 200 and len(r.content) > 0, f"{r.status_code}")

# ---------- 11. 系统工具（8 项） ----------
for path, name in [
    ("/api/system/hardware/overview", "system hardware overview"),
    ("/api/system/hardware/cpu-memory", "system cpu-memory"),
    ("/api/system/hardware/gpu-display", "system gpu-display"),
    ("/api/system/hardware/mainboard", "system mainboard"),
    ("/api/system/hardware/storage", "system storage"),
    ("/api/system/hardware/network", "system network"),
]:
    r = client.get(path)
    check(name, r.status_code == 200, f"{r.status_code} {r.text[:80]}")

r = client.get("/api/system/cleanup/scan")
check("system cleanup scan", r.status_code == 200, f"{r.status_code} {r.text[:80]}")
r = client.post("/api/system/cleanup/large-files", json={"path": str(HERE.parent / "output"), "min_size_mb": 0})
check("system large-file scan (read-only)", r.status_code == 200, f"{r.status_code} {r.text[:80]}")

# ---------- 汇总 ----------
failed = [x for x in results if not x[1]]
print(f"\nTRACK A: {len(results) - len(failed)}/{len(results)} PASS")
for name, _, extra in failed:
    print(f"  FAILED: {name}  [{extra}]")
sys.exit(0 if not failed else 1)
