from __future__ import annotations
import os
import re
from pathlib import Path
from typing import Any, List, Optional, Tuple
import docx
from docx import Document
from core.model import WordMatch, WordReplaceRule
from core.detector.rule_engine import RuleEngine
from core.word.replacer import apply_range_to_runs, replace_paragraph_text

class WordPipeline:
    def __init__(self, rule_engine: Optional[RuleEngine] = None, rules: Optional[List[WordReplaceRule]] = None):
        self.rule_engine = rule_engine
        self.rules = list(rules) if rules else []

    def find_matches_in_text(self, text: str) -> List[WordMatch]:
        if not text:
            return []
        matches: List[WordMatch] = []
        # 1. Check custom WordReplaceRules
        for idx, rule in enumerate(self.rules):
            if not rule.enabled or not rule.find:
                continue
            if rule.mode == 'regex':
                try:
                    for m in re.finditer(rule.find, text, re.IGNORECASE):
                        matches.append(WordMatch(
                            start=m.start(),
                            end=m.end(),
                            text=m.group(0),
                            replacement=rule.replace,
                            mode='regex',
                            source='rule',
                            rule_index=idx
                        ))
                except Exception:
                    pass
            else:
                start = 0
                find_str = rule.find
                while True:
                    pos = text.find(find_str, start)
                    if pos == -1:
                        break
                    matches.append(WordMatch(
                        start=pos,
                        end=pos + len(find_str),
                        text=find_str,
                        replacement=rule.replace,
                        mode='exact',
                        source='rule',
                        rule_index=idx
                    ))
                    start = pos + max(1, len(find_str))

        # 2. Check rule_engine terms / PII
        if self.rule_engine:
            spans = self.rule_engine.find_spans(text)
            for s, e, term in spans:
                # avoid overlapping with existing custom rule matches
                if not any(not (e <= m.start or s >= m.end) for m in matches):
                    matches.append(WordMatch(
                        start=s,
                        end=e,
                        text=text[s:e],
                        replacement='[已脱敏]',
                        mode='engine',
                        source='engine',
                        rule_index=-1
                    ))

        # Sort and deduplicate overlapping matches (prefer longer match)
        matches.sort(key=lambda m: (m.start, -(m.end - m.start)))
        filtered = []
        last_end = -1
        for m in matches:
            if m.start >= last_end:
                filtered.append(m)
                last_end = m.end
        return filtered

    def process_document(self, input_path: str | Path, output_path: str | Path) -> dict[str, Any]:
        in_p = Path(input_path)
        out_p = Path(output_path)
        
        doc = Document(str(in_p))
        total_replacements = 0
        hit_records = []

        # Process body paragraphs
        for para in doc.paragraphs:
            matches = self.find_matches_in_text(para.text)
            if matches:
                hit_records.extend([m.text for m in matches])
                total_replacements += replace_paragraph_text(para, matches)

        # Process tables
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for para in cell.paragraphs:
                        matches = self.find_matches_in_text(para.text)
                        if matches:
                            hit_records.extend([m.text for m in matches])
                            total_replacements += replace_paragraph_text(para, matches)

        # Process headers and footers
        for section in doc.sections:
            if section.header:
                for para in section.header.paragraphs:
                    matches = self.find_matches_in_text(para.text)
                    if matches:
                        hit_records.extend([m.text for m in matches])
                        total_replacements += replace_paragraph_text(para, matches)
            if section.footer:
                for para in section.footer.paragraphs:
                    matches = self.find_matches_in_text(para.text)
                    if matches:
                        hit_records.extend([m.text for m in matches])
                        total_replacements += replace_paragraph_text(para, matches)

        out_p.parent.mkdir(parents=True, exist_ok=True)
        doc.save(str(out_p))
        return {
            'input_path': str(in_p),
            'output_path': str(out_p),
            'total_replacements': total_replacements,
            'hit_terms': list(set(hit_records))
        }
