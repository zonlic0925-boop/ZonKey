"""图纸脱敏工具入口。用法:

python main.py <输入.pdf> [--mode erase|cover] [--output 输出.pdf] [--no-ocr]
"""

from __future__ import annotations

import argparse
import json
import logging
import time
from pathlib import Path

from core.model import RedactMode
from core.pipeline import Pipeline, to_audit_dict

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def summarize(result) -> dict:
    return to_audit_dict(result)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="输入 PDF 路径")
    parser.add_argument(
        "--mode", choices=[m.value for m in RedactMode], default=RedactMode.ERASE.value
    )
    parser.add_argument("--output", default=None)
    parser.add_argument("--no-ocr", action="store_true", help="禁用 OCR 通道")
    parser.add_argument("--audit", default=None, help="审计 JSON 输出路径")
    args = parser.parse_args()

    pipeline = Pipeline()
    t0 = time.perf_counter()
    result = pipeline.process_and_redact(args.input, RedactMode(args.mode), args.output)
    elapsed = time.perf_counter() - t0

    n_hits = len(result.all_hits())
    n_manual = sum(
        1 for p in result.pages for rb in p.redact_boxes if rb.manual_required
    )
    print(f"用时 {elapsed:.1f}s | 命中 {n_hits} | 抹除框 {len(result.all_redact_boxes())} | 待人工 {n_manual}")
    for page in result.pages:
        if page.warnings:
            print(f"  页 {page.page_index} 警告: {page.warnings}")
        for rb in page.redact_boxes:
            flag = "待人工" if rb.manual_required else "已归位"
            tag = rb.boxed and "CELL" or "FALLBACK"
            print(
                f"  页 {rb.page_index} [{tag}/{flag}] {rb.terms} "
                f"@{tuple(round(v, 1) for v in rb.box.as_tuple())} 通道={rb.channel_labels}"
            )
        for m in page.hits:
            if m.page_index not in {rb.page_index for rb in page.redact_boxes}:
                print(f"  (未生成抹除框的命中) {m.text[:60]!r}")

    if args.audit:
        Path(args.audit).write_text(
            json.dumps(summarize(result), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(f"审计 JSON -> {args.audit}")
    if result.output_path:
        print(f"输出 -> {result.output_path}")


if __name__ == "__main__":
    main()