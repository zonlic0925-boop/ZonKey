"""发布版验收（通用规则，不含特定企业内置词）。

验收范围：
1. 词表 / Logo 目录不含 FISHER / EMERSON 等特定企业出厂规则；
2. 合成样本 + 用户自定义企业词（ACME）全链路脱敏；
3. 通用保密标记（CONFIDENTIAL 等）属于发布版合法内置项，与特定企业无关；
4. 许可门禁（Phase M）：运行环境 / requirements / 打包产物中无 AGPL 组件
   （PyMuPDF 等），保证公开发布合规。

用法:
  python scripts/release_acceptance.py
  python scripts/release_acceptance.py --exe-dir dist/ZonKey
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from core.app_paths import get_app_root  # noqa: E402
from core.detector.rule_engine import RuleEngine, load_terms  # noqa: E402
from core.model import RedactMode  # noqa: E402
from core.pipeline import Pipeline, PipelineConfig  # noqa: E402
from core.redact.executor import redact_pdf  # noqa: E402

_BANNED_BUILTIN_TERMS = {
    "FISHER",
    "EMERSON",
    "TOPWORX",
    "MKS",
    "MARSHALLTOWN",
    "FISHER CONTROLS",
    "PROPERTY OF FISHER CONTROLS",
    "PROPERTY OF EMERSON",
    "PROPERTY OF TOPWORX",
}

# AGPL 组件（公开发布门禁，Phase M）：禁止出现在运行环境与打包产物中
_AGPL_PACKAGE_NAMES = {"pymupdf", "pymupdfb", "fitz", "pdf2docx"}

OUTPUT_DIR = ROOT / "outputs" / "release_acceptance"


def _check_rules_clean(rules_root: Path) -> dict:
    terms_path = rules_root / "sensitive_terms.txt"
    terms = [t.upper() for t in load_terms(terms_path)]
    leaked_vendor = [
        t for t in terms if t in _BANNED_BUILTIN_TERMS or any(b in t for b in _BANNED_BUILTIN_TERMS)
    ]
    logos = []
    logos_dir = rules_root / "logos"
    if logos_dir.is_dir():
        for ext in ("*.png", "*.jpg", "*.jpeg", "*.bmp"):
            logos.extend(logos_dir.glob(ext))
    generic_terms = [t for t in terms if t not in _BANNED_BUILTIN_TERMS]
    return {
        "terms_path": str(terms_path),
        "term_count": len(terms),
        "generic_terms_sample": generic_terms[:8],
        "vendor_leak": leaked_vendor,
        "logo_files": [p.name for p in logos],
        "pass": not leaked_vendor and not logos,
    }


def _check_no_agpl_components(exe_dir: Path | None) -> dict:
    """许可门禁：运行环境、requirements.txt 与打包产物均不得含 AGPL 组件。"""
    import importlib.metadata as md

    installed_bad: list[str] = []
    for dist in md.distributions():
        name = (dist.metadata.get("Name") or "").lower()
        if name in _AGPL_PACKAGE_NAMES:
            installed_bad.append(name)

    req_text = (ROOT / "requirements.txt").read_text(encoding="utf-8").lower()
    reqs_bad = [name for name in sorted(_AGPL_PACKAGE_NAMES) if name in req_text]

    importable = False
    try:  # noqa: SIM105
        import fitz  # noqa: F401

        importable = True
    except Exception:
        importable = False

    bundle_hits: list[str] = []
    if exe_dir is not None:
        for pattern in ("**/fitz*", "**/pymupdf*", "**/PyMuPDF*"):
            bundle_hits.extend(p.name for p in exe_dir.glob(pattern))

    return {
        "blocked_packages": sorted(_AGPL_PACKAGE_NAMES),
        "installed_bad": sorted(set(installed_bad)),
        "requirements_bad": reqs_bad,
        "fitz_importable": importable,
        "bundle_hits": sorted(set(bundle_hits)),
        "pass": not installed_bad and not reqs_bad and not importable and not bundle_hits,
    }


def _synthetic_drawing_test(out_dir: Path) -> dict:
    """合成图纸：用户自行添加 ACME + 通用 CONFIDENTIAL，验证抹除后零残留。"""
    custom_terms = ["ACME AEROSPACE", "CONFIDENTIAL"]
    src = out_dir / "synthetic_drawing.pdf"
    dst = out_dir / "synthetic_drawing_desensitized.pdf"

    from reportlab.pdfgen import canvas

    width, height = 420, 300
    c = canvas.Canvas(str(src), pagesize=(width, height))
    # 显示空间 (40,40)-(260,140) 的保密框（reportlab 用户空间 y-up）
    c.setLineWidth(1)
    c.rect(40, height - 140, 220, 100)
    c.setFont("Helvetica", 12)
    c.drawString(50, height - 70, "CONFIDENTIAL - ACME AEROSPACE")
    c.setFont("Helvetica", 10)
    c.drawString(50, height - 110, "PART NO: X-1001")
    c.showPage()
    c.save()

    cfg = PipelineConfig(terms=custom_terms, use_ocr=False)
    res = Pipeline(cfg).process(str(src))
    redact_pdf(str(src), res.all_redact_boxes(), RedactMode.ERASE, str(dst))

    import pdfplumber

    with pdfplumber.open(str(dst)) as doc:
        text = "\n".join(p.extract_text() or "" for p in doc.pages)

    leftovers = []
    for term in custom_terms:
        if term.lower() in text.lower():
            leftovers.append(term)
    protected_ok = "PART NO: X-1001" in text

    return {
        "input": str(src),
        "output": str(dst),
        "hits": len(res.all_hits()),
        "redact_boxes": len(res.all_redact_boxes()),
        "leftover_terms": leftovers,
        "protected_annotation_kept": protected_ok,
        "pass": not leftovers and protected_ok and bool(res.all_redact_boxes()),
    }


def _verify_output_pdf_terms(pdf_path: Path, terms: list[str]) -> list[str]:
    import pdfplumber

    leftovers: list[str] = []
    with pdfplumber.open(str(pdf_path)) as doc:
        text = "\n".join(p.extract_text() or "" for p in doc.pages).lower()
    for term in terms:
        if term.lower() in text:
            leftovers.append(term)
    return leftovers


def _check_cleanup_endpoints() -> dict:
    """P4：工作目录清理端点可用（GET status + POST cleanup 结构正确）。"""
    try:
        from fastapi.testclient import TestClient

        from server_bridge import app

        client = TestClient(app)
        status_r = client.get("/api/system/cleanup/status")
        if status_r.status_code != 200:
            return {"pass": False, "error": f"status HTTP {status_r.status_code}"}
        body = status_r.json()
        dirs = body.get("dirs") or {}
        ok_keys = {"temp_bridge_files", "output"}.issubset(dirs.keys())
        post_r = client.post("/api/system/cleanup")
        post_ok = post_r.status_code == 200 and post_r.json().get("status") == "success"
        return {
            "status_keys": sorted(dirs.keys()),
            "post_cleaned_files": post_r.json().get("cleaned_files") if post_ok else None,
            "pass": ok_keys and post_ok,
        }
    except Exception as exc:
        return {"pass": False, "error": str(exc)}


def _check_convert_capability_gate() -> dict:
    """P4：COM 缺失时转换能力门控仍应返回结构化 capability（禁止 500）。"""
    try:
        from fastapi.testclient import TestClient

        from server_bridge import app

        client = TestClient(app)
        r = client.get("/api/convert/capability")
        if r.status_code != 200:
            return {"pass": False, "error": f"HTTP {r.status_code}"}
        data = r.json()
        required = {"engines", "pywin32", "word_com", "excel_com", "rapidocr"}
        missing = required - set(data.keys())
        return {
            "keys": sorted(data.keys()),
            "pywin32": data.get("pywin32"),
            "pass": not missing,
            "missing": sorted(missing),
        }
    except Exception as exc:
        return {"pass": False, "error": str(exc)}


def run_acceptance(exe_dir: Path | None = None, app_dir: Path | None = None) -> dict:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rules_root = get_app_root() / "rules"
    report: dict = {
        "task": "release_acceptance",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "note": "CONFIDENTIAL/PROPRIETARY 等为国际通用图纸保密标记，非特定企业内置规则",
        "banned_vendor_terms": sorted(_BANNED_BUILTIN_TERMS),
        "checks": {},
    }

    report["checks"]["source_rules"] = _check_rules_clean(rules_root)

    if exe_dir:
        bundled_rules = exe_dir / "_internal" / "rules"
        if not bundled_rules.is_dir():
            bundled_rules = exe_dir / "rules"
        report["checks"]["exe_bundled_rules"] = _check_rules_clean(bundled_rules)
        report["checks"]["exe_exists"] = {
            "path": str(exe_dir / "ZonKey.exe"),
            "pass": (exe_dir / "ZonKey.exe").is_file(),
        }

    if app_dir:
        macos_root = app_dir / "Contents" / "MacOS"
        bundled_rules = macos_root / "rules"
        if not bundled_rules.is_dir():
            bundled_rules = app_dir / "Contents" / "Resources" / "rules"
        if bundled_rules.is_dir():
            report["checks"]["app_bundled_rules"] = _check_rules_clean(bundled_rules)
        mac_bin = macos_root / "ZonKey"
        report["checks"]["app_exists"] = {
            "path": str(mac_bin),
            "pass": mac_bin.is_file(),
        }

    report["checks"]["synthetic_pipeline"] = _synthetic_drawing_test(OUTPUT_DIR)
    report["checks"]["no_agpl_components"] = _check_no_agpl_components(exe_dir)
    report["checks"]["cleanup_endpoints"] = _check_cleanup_endpoints()
    report["checks"]["convert_capability_gate"] = _check_convert_capability_gate()

    generic_only = load_terms(rules_root / "sensitive_terms.txt")
    report["checks"]["generic_terms_in_rules"] = {
        "terms": generic_only,
        "pass": all(
            t.upper() not in _BANNED_BUILTIN_TERMS and not any(b in t.upper() for b in _BANNED_BUILTIN_TERMS)
            for t in generic_only
        ),
    }

    all_pass = all(
        c.get("pass") is True
        for c in report["checks"].values()
        if isinstance(c, dict) and "pass" in c
    )
    report["all_pass"] = all_pass

    out_json = OUTPUT_DIR / "release_acceptance_report.json"
    out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="发布版通用规则验收")
    parser.add_argument("--exe-dir", type=Path, default=None, help="Windows 构建目录 dist/ZonKey")
    parser.add_argument("--app-dir", type=Path, default=None, help="macOS 构建产物 dist/ZonKey.app")
    args = parser.parse_args()

    exe_dir = args.exe_dir if args.exe_dir and args.exe_dir.is_dir() else None
    app_dir = args.app_dir if args.app_dir and args.app_dir.is_dir() else None
    if exe_dir is None and app_dir is None:
        default_exe = ROOT / "dist" / "ZonKey"
        exe_dir = default_exe if default_exe.is_dir() else None
    report = run_acceptance(exe_dir, app_dir)

    print("=" * 60)
    print("发布版验收报告（通用规则，不含 FISHER/EMERSON 等企业出厂词）")
    print("=" * 60)
    for name, check in report["checks"].items():
        status = "PASS" if check.get("pass") else "FAIL"
        print(f"[{status}] {name}")
        if name == "synthetic_pipeline":
            print(f"       合成样本输出: {check.get('output')}")
            print(f"       残留敏感词: {check.get('leftover_terms') or '无'}")
        if name in ("source_rules", "exe_bundled_rules", "app_bundled_rules"):
            print(f"       词表条目数: {check.get('term_count')}")
            print(f"       通用词示例: {check.get('generic_terms_sample')}")
            if check.get("vendor_leak"):
                print(f"       非法企业词: {check['vendor_leak']}")
            if check.get("logo_files"):
                print(f"       非法 Logo: {check['logo_files']}")
        if name == "no_agpl_components":
            if check.get("installed_bad"):
                print(f"       环境已装 AGPL 组件: {check['installed_bad']}")
            if check.get("requirements_bad"):
                print(f"       requirements 含 AGPL 组件: {check['requirements_bad']}")
            if check.get("fitz_importable"):
                print("       fitz 仍可导入")
            if check.get("bundle_hits"):
                print(f"       打包产物含 AGPL 文件: {check['bundle_hits']}")
        if name == "cleanup_endpoints":
            print(f"       监控目录: {check.get('status_keys')}")
        if name == "convert_capability_gate":
            print(f"       capability 键: {check.get('keys')}")
            if check.get("missing"):
                print(f"       缺失键: {check['missing']}")

    print("-" * 60)
    print(f"报告文件: {OUTPUT_DIR / 'release_acceptance_report.json'}")
    if report["all_pass"]:
        print("结论: 全部通过")
        return 0
    print("结论: 存在失败项")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
