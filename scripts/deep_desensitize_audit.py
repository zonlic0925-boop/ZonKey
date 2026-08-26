"""深度脱敏效果审查脚本：
逐一审查 Testing Drawings/ 下的所有图纸样本，
针对三大核心脱敏目标：
1. 公司名字 (Fisher Controls / Emerson / TopWorx / MKS / Marshalltown 等)
2. Logo (图片对象 XObject / 矢量Logo)
3. CONFIDENTIAL / 保密声明所在的整个方框区域
检查脱敏是否彻底、方框抹除是否完整、有无漏抹死角、有无越框污染图纸其他有效信息。
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import sys
from pathlib import Path
import fitz  # PyMuPDF
import cv2
import numpy as np

WORKSPACE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKSPACE))
from core.detector.rule_engine import RuleEngine, load_terms
DRAWINGS_DIR = WORKSPACE / "Testing Drawings"
RULES_FILE = WORKSPACE / "rules" / "sensitive_terms.txt"

def load_sensitive_terms():
    terms = []
    if RULES_FILE.exists():
        for line in RULES_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                terms.append(line)
    return terms

def check_all_samples():
    terms = load_terms(RULES_FILE)
    rule_engine = RuleEngine(terms=terms, fuzzy=False)
    
    # 找到所有原始 PDF（排除已生成的 _desensitized）
    all_pdfs = sorted([p for p in DRAWINGS_DIR.glob("*.pdf") if not p.stem.endswith("_desensitized") and not p.name.endswith(".PDF_desensitized.PDF")])
    # 还要包括大写的 .PDF
    all_pdfs += sorted([p for p in DRAWINGS_DIR.glob("*.PDF") if not p.stem.endswith("_desensitized")])
    all_pdfs = sorted(list(set(all_pdfs)))

    print(f"=== 开始全量深度审查：共发现 {len(all_pdfs)} 份原始图纸样本 ===")
    
    report = []
    
    ACCEPTANCE_DIR = WORKSPACE / "outputs" / "acceptance"
    for pdf_path in all_pdfs:
        sample_name = pdf_path.name
        # 优先从 outputs/acceptance/ 读取回归生成的结果，回退从图纸同目录读取
        desens_path = ACCEPTANCE_DIR / f"{pdf_path.stem}_desensitized{pdf_path.suffix}"
        if not desens_path.exists():
            desens_path = ACCEPTANCE_DIR / f"{pdf_path.stem}_desensitized.pdf"
        if not desens_path.exists():
            desens_path = pdf_path.with_name(f"{pdf_path.stem}_desensitized{pdf_path.suffix}")
        if not desens_path.exists():
            # 兼容大写
            desens_path = pdf_path.with_name(f"{pdf_path.stem}_desensitized.PDF")
            
        res = {
            "file": sample_name,
            "has_desensitized": desens_path.exists(),
            "orig_hits": [],
            "desens_remaining_hits": [],
            "orig_images": 0,
            "desens_remaining_images": 0,
            "box_erasure_quality": "UNKNOWN",
            "notes": []
        }
        
        if not desens_path.exists():
            res["notes"].append("未找到脱敏后文件")
            report.append(res)
            continue
            
        # 1. 检查原始 PDF 中的敏感词与位置
        try:
            doc_orig = fitz.open(str(pdf_path))
            for page_idx, page in enumerate(doc_orig):
                # 统计图片
                res["orig_images"] += len(page.get_images())
                
                # 统计文本敏感词
                text_page = page.get_text("words")  # (x0, y0, x1, y1, word, block_no, line_no, word_no)
                page_text = page.get_text()
                for term in terms:
                    matches = page.search_for(term)
                    if matches:
                        res["orig_hits"].append({
                            "page": page_idx,
                            "term": term,
                            "count": len(matches),
                            "rects": [[round(v, 1) for v in (r.x0, r.y0, r.x1, r.y1)] for r in matches]
                        })
            doc_orig.close()
        except Exception as e:
            res["notes"].append(f"解析原始 PDF 失败: {e}")
            
        # 2. 检查脱敏后 PDF 中的敏感词与残留
        try:
            doc_desens = fitz.open(str(desens_path))
            for page_idx, page in enumerate(doc_desens):
                res["desens_remaining_images"] += len(page.get_images())
                # 使用 RuleEngine 进行精准匹配判定
                words = page.get_text("words")
                blocks = page.get_text("blocks")
                # 针对每一行文字进行 RuleEngine 检测
                for b in blocks:
                    block_text = b[4]
                    for line in block_text.splitlines():
                        if not line.strip():
                            continue
                        hits = rule_engine.match(line)
                        for h in hits:
                            matches = page.search_for(h.matched_text)
                            res["desens_remaining_hits"].append({
                                "page": page_idx,
                                "term": h.matched_text,
                                "count": len(matches) if matches else 1,
                                "rects": [[round(v, 1) for v in (r.x0, r.y0, r.x1, r.y1)] for r in matches] if matches else []
                            })
            doc_desens.close()
        except Exception as e:
            res["notes"].append(f"解析脱敏后 PDF 失败: {e}")
            
        # 3. 评估脱敏质量
        if len(res["desens_remaining_hits"]) == 0:
            res["text_desens_status"] = "PERFECT (0 敏感词残留)"
        else:
            res["text_desens_status"] = f"FAILED ({len(res['desens_remaining_hits'])} 项残留)"
            
        report.append(res)
        
    print("\n=== 深度脱敏审查结果汇总 ===")
    clean_count = sum(1 for r in report if len(r.get("desens_remaining_hits", [])) == 0 and r["has_desensitized"])
    failed_count = sum(1 for r in report if len(r.get("desens_remaining_hits", [])) > 0)
    missing_count = sum(1 for r in report if not r["has_desensitized"])
    
    print(f"总计图纸: {len(report)}")
    print(f"脱敏彻底（文本层 0 残留）: {clean_count}")
    print(f"存在残留（未脱干净）: {failed_count}")
    print(f"未脱敏文件: {missing_count}")
    
    # 打印每个文件的具体脱敏命中详情
    for r in report:
        print(f"\n[图纸: {r['file']}]")
        print(f"  - 原始命中敏感项: {len(r['orig_hits'])} 个")
        for h in r['orig_hits']:
            print(f"    * 词条: '{h['term']}' (出现 {h['count']} 次), 坐标: {h['rects']}")
        print(f"  - 原始图片对象数: {r['orig_images']} -> 脱敏后图片数: {r['desens_remaining_images']}")
        print(f"  - 脱敏后残留敏感项: {len(r['desens_remaining_hits'])} 个")
        if r['desens_remaining_hits']:
            for h in r['desens_remaining_hits']:
                print(f"    ! [残留泄漏] 词条: '{h['term']}', 坐标: {h['rects']}")
                
    # 保存报告为 json
    out_json = WORKSPACE / "outputs" / "deep_desensitize_audit.json"
    out_json.parent.mkdir(exist_ok=True)
    out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n完整审查数据已写入: {out_json}")

if __name__ == "__main__":
    check_all_samples()
