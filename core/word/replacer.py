from __future__ import annotations
import copy
from typing import Any, List, Tuple
from docx.text.paragraph import Paragraph
from docx.text.run import Run
from docx.document import Document
from core.model import WordMatch, WordReplaceRule
from core.word.formatter import copy_run_format

def apply_range_to_runs(paragraph: Paragraph, start: int, end: int, replacement: str) -> None:
    if not paragraph.runs or start >= end:
        return
    runs = list(paragraph.runs)
    run_spans = []
    curr = 0
    for r in runs:
        text = r.text or ''
        run_spans.append((curr, curr + len(text), r))
        curr += len(text)
    
    match_runs = [r for s, e, r in run_spans if not (e <= start or s >= end)]
    if not match_runs:
        return
    
    first_run = match_runs[0]
    first_idx = runs.index(first_run)
    
    for r in match_runs:
        s, e, _ = [(s, e, rr) for s, e, rr in run_spans if rr is r][0]
        overlap_s = max(s, start)
        overlap_e = min(e, end)
        rel_s = overlap_s - s
        rel_e = overlap_e - s
        
        orig_text = r.text or ''
        left_text = orig_text[:rel_s]
        right_text = orig_text[rel_e:]
        
        r.text = left_text + right_text
    
    insert_run = paragraph.add_run(replacement)
    copy_run_format(insert_run, first_run)
    
    try:
        p_elm = paragraph._p
        first_elm = first_run._r
        insert_elm = insert_run._r
        first_elm.addprevious(insert_elm)
    except Exception:
        pass

def replace_paragraph_text(paragraph: Paragraph, matches: List[WordMatch]) -> int:
    if not matches or not paragraph.text:
        return 0
    sorted_matches = sorted(matches, key=lambda m: m.start, reverse=True)
    count = 0
    for m in sorted_matches:
        apply_range_to_runs(paragraph, m.start, m.end, m.replacement)
        count += 1
    return count
