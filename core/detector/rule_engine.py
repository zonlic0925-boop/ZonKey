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

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

def load_pii_rules(path: str | Path) -> list[dict[str, Any]]:
    p = Path(path)
    if not p.is_absolute():
        p = _PROJECT_ROOT / p
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text(encoding='utf-8'))
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

    def match(self, text: str) -> list[str]:
        if not text:
            return []
        found = set()
        for term, pat in self._patterns:
            if pat.search(text):
                found.add(term)
        for name, rx in self._compiled_regex:
            if rx.search(text):
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
        for name, rx in self._compiled_regex:
            for m in rx.finditer(text):
                spans.append((m.start(), m.end(), f'[{name}]'))
        return spans

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
