from __future__ import annotations
import json
import re
from pathlib import Path
from typing import Any

SHORT_TERM_MAX_LEN = 4

_DISCRIMINATOR_STOPWORDS = {
    'a', 'an', 'the', 'of', 'for', 'to', 'and', 'or', 'in', 'on', 'at',
    'inc', 'llc', 'co', 'corp', 'ltd', 'do', 'not', 'copy',
    'process', 'management', 'controls', 'company', 'usa', 'kentucky', 'industrial',
}

from core.app_paths import get_app_root

_PROJECT_ROOT = get_app_root()

def load_pii_rules(path: str | Path) -> list[dict[str, Any]]:
    p = Path(path)
    if not p.is_absolute():
        p = _PROJECT_ROOT / p
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding='utf-8'))
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            pii = data.get("pii_rules", {})
            if isinstance(pii, list):
                return pii
            if isinstance(pii, dict):
                rules_list = []
                for k, v in pii.items():
                    if isinstance(v, dict):
                        item = dict(v)
                        item.setdefault("key", k)
                        rules_list.append(item)
                return rules_list
        return []
    except Exception:
        return []

def load_terms(path: str | Path) -> list[str]:
    p = Path(path)
    if not p.is_absolute():
        p = _PROJECT_ROOT / p
    if not p.exists():
        raise FileNotFoundError(f'Terms file not found: {p}')
    terms = []
    for raw in p.read_text(encoding='utf-8').splitlines():
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        terms.append(line)
    return terms

def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    if abs(len(a) - len(b)) > 8:
        return 99
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]

class RuleEngine:
    def __init__(
        self,
        terms: list[str] | None = None,
        fuzzy: bool = True,
        regex_rules: list[dict[str, Any]] | None = None,
    ):
        self._terms = list(terms) if terms is not None else []
        self._fuzzy = fuzzy
        self._patterns: list[tuple[str, re.Pattern]] = []
        for term in self._terms:
            pat = re.escape(term)
            if len(term) <= SHORT_TERM_MAX_LEN:
                pat = rf'\b{pat}\b'
            self._patterns.append((term, re.compile(pat, re.IGNORECASE)))
        self._regex_rules = list(regex_rules) if regex_rules is not None else []
        self._compiled_regex: list[tuple[str, re.Pattern]] = []
        for rule in self._regex_rules:
            if isinstance(rule, dict) and rule.get('enabled', True):
                name = rule.get('name', 'PII')
                pattern = rule.get('pattern', '')
                if pattern:
                    try:
                        self._compiled_regex.append((name, re.compile(pattern, re.IGNORECASE)))
                    except Exception:
                        pass

    @property
    def terms(self) -> list[str]:
        return list(self._terms)

    def discriminator_tokens(self) -> set[str]:
        out: set[str] = set()
        for term in self._terms:
            for token in re.split(r'[^a-zA-Z0-9]+', term.lower()):
                if token and token not in _DISCRIMINATOR_STOPWORDS:
                    out.add(token)
        return out

    @staticmethod
    def image_tokens(aggregated_text: str) -> set[str]:
        return {t for t in re.split(r'[^a-zA-Z0-9]+', aggregated_text.lower()) if t}

    def match_image(self, aggregated_text: str) -> list[str]:
        if not aggregated_text:
            return []
        tokens = self.image_tokens(aggregated_text)
        discriminators = self.discriminator_tokens()
        return sorted(tokens & discriminators)

    @staticmethod
    def expand_match_in_text(page_text: str, matched: str) -> str:
        """Extend regex hit with adjacent form suffixes, e.g. F764486 -> F764486(4)."""
        if not matched or not page_text:
            return matched
        best = matched
        for m in re.finditer(re.escape(matched), page_text):
            start, end = m.start(), m.end()
            if end < len(page_text) and page_text[end] == "(":
                j = end + 1
                while j < len(page_text) and page_text[j].isdigit():
                    j += 1
                if j < len(page_text) and page_text[j] == ")":
                    end = j + 1
            candidate = page_text[start:end]
            if len(candidate) > len(best):
                best = candidate
        return best

    def extract_match_values(self, text: str) -> tuple[list[str], str]:
        """Return (matched_substrings, display_label) for OCR / preview labels."""
        if not text:
            return [], ""
        values: list[str] = []
        labels: list[str] = []
        for term, pat in self._patterns:
            if pat.search(text):
                values.append(term)
                labels.append(term)
        for _start, _end, matched, name in self._iter_regex_spans(text):
            expanded = self.expand_match_in_text(text, matched)
            values.append(expanded)
            labels.append(f"[{name}]")
        if not values and self._fuzzy:
            fuzzy = self._match_fuzzy(text)
            values.extend(fuzzy)
            labels.extend(fuzzy)
        seen: set[str] = set()
        uniq_values: list[str] = []
        for v in values:
            if v not in seen:
                seen.add(v)
                uniq_values.append(v)
        if not uniq_values:
            return [], ""
        display = labels[0] if len(labels) == 1 else " / ".join(labels[:3])
        return uniq_values, display

    def match(self, text: str) -> list[str]:
        if not text:
            return []
        found = set()
        for term, pat in self._patterns:
            if pat.search(text):
                found.add(term)
        for _start, _end, _matched, name in self._iter_regex_spans(text):
            found.add(f'[{name}]')
        if not found and self._fuzzy:
            found.update(self._match_fuzzy(text))
        return sorted(found)

    def find_spans(self, text: str) -> list[tuple[int, int, str]]:
        if not text:
            return []
        spans: list[tuple[int, int, str]] = []
        for term, pat in self._patterns:
            for m in pat.finditer(text):
                spans.append((m.start(), m.end(), term))
        for start, end, _matched, name in self._iter_regex_spans(text):
            spans.append((start, end, f'[{name}]'))
        return spans

    def iter_regex_matches(self, text: str) -> list[tuple[str, str]]:
        """Return unique (matched_substring, rule_name) pairs from enabled regex rules.

        Longer matches win over overlapping shorter ones, so broad patterns
        (landline/passport fragments) cannot shadow a full ID card number.
        """
        return [(matched, name) for _s, _e, matched, name in self._iter_regex_spans(text)]

    def _iter_regex_spans(self, text: str) -> list[tuple[int, int, str, str]]:
        if not text:
            return []
        candidates: list[tuple[int, int, str, str]] = []
        for rule in self._regex_rules:
            if not isinstance(rule, dict) or not rule.get('enabled', True):
                continue
            pattern = rule.get('pattern', '')
            name = str(rule.get('name', 'PII'))
            if not pattern:
                continue
            try:
                for match in re.finditer(pattern, text, re.IGNORECASE):
                    found = match.group(0)
                    if found:
                        candidates.append((match.start(), match.end(), found, name))
            except re.error:
                continue

        # Longer first, then leftmost — drop any overlap with an already kept span.
        candidates.sort(key=lambda item: (-(item[1] - item[0]), item[0]))
        kept: list[tuple[int, int, str, str]] = []
        occupied: list[tuple[int, int]] = []
        for start, end, found, name in candidates:
            if any(not (end <= a or start >= b) for a, b in occupied):
                continue
            occupied.append((start, end))
            kept.append((start, end, found, name))
        kept.sort(key=lambda item: item[0])
        return kept

    @classmethod
    def load_default(cls) -> RuleEngine:
        terms_path = _PROJECT_ROOT / "rules" / "sensitive_terms.txt"
        pii_path = _PROJECT_ROOT / "rules" / "pii_rules.json"
        terms = load_terms(terms_path) if terms_path.exists() else []
        pii_rules = load_pii_rules(pii_path) if pii_path.exists() else []
        return cls(terms=terms, regex_rules=pii_rules)

    @classmethod
    def load_drawing(cls) -> RuleEngine:
        """工程图纸专用：仅 sensitive_terms.txt，不含 PII 正则。"""
        terms_path = _PROJECT_ROOT / "rules" / "sensitive_terms.txt"
        terms = load_terms(terms_path) if terms_path.exists() else []
        return cls(terms=terms, regex_rules=[])

    @classmethod
    def load_document(cls) -> RuleEngine:
        """行政公文专用：仅 PII 正则，不含工程图纸企业词表。"""
        pii_path = _PROJECT_ROOT / "rules" / "pii_rules.json"
        pii_rules = load_pii_rules(pii_path) if pii_path.exists() else []
        return cls(terms=[], regex_rules=pii_rules)

    def _match_fuzzy(self, text: str) -> list[str]:
        text_lower = text.lower()
        found: set[str] = set()
        words = [w for w in re.split(r'[^a-zA-Z0-9]+', text_lower) if w]
        for term in self._terms:
            if len(term) <= SHORT_TERM_MAX_LEN:
                continue
            term_lower = term.lower()
            term_words = [w for w in re.split(r'[^a-zA-Z0-9]+', term_lower) if w]
            if len(term_words) == 1:
                target = term_words[0]
                max_dist = 1 if len(target) <= 6 else 2
                for w in words:
                    if abs(len(w) - len(target)) <= max_dist:
                        if _levenshtein(w, target) <= max_dist:
                            found.add(term)
                            break
            elif len(term_words) > 1:
                k = len(term_words)
                for i in range(len(words) - k + 1):
                    window = ' '.join(words[i:i + k])
                    target = ' '.join(term_words)
                    max_dist = 2 if len(target) <= 12 else 3
                    if abs(len(window) - len(target)) <= max_dist:
                        if _levenshtein(window, target) <= max_dist:
                            found.add(term)
                            break
        return list(found)
