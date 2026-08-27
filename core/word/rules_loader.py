from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from core.model import WordReplaceRule
from core.redact.mask import DEFAULT_MASK_CHAR
from core.detector.rule_engine import load_pii_rules

from core.app_paths import get_app_root

_PROJECT_ROOT = get_app_root()

_MODE_ALIAS = {
    'exact': 'exact',
    'regex': 'regex',
    '精确': 'exact',
    '正则': 'regex',
}

_PII_REPLACEMENT_HINTS = (
    ('护照', DEFAULT_MASK_CHAR),
    ('身份证', DEFAULT_MASK_CHAR),
    ('手机', DEFAULT_MASK_CHAR),
    ('电话', DEFAULT_MASK_CHAR),
    ('座机', DEFAULT_MASK_CHAR),
    ('邮箱', DEFAULT_MASK_CHAR),
    ('银行卡', DEFAULT_MASK_CHAR),
    ('信用代码', DEFAULT_MASK_CHAR),
    ('税号', DEFAULT_MASK_CHAR),
    ('金额', DEFAULT_MASK_CHAR),
    ('港澳', DEFAULT_MASK_CHAR),
    ('国际', DEFAULT_MASK_CHAR),
)


def replacement_for_pii_name(name: str, fallback: str = DEFAULT_MASK_CHAR) -> str:
    label = str(name or '').strip()
    for hint, replacement in _PII_REPLACEMENT_HINTS:
        if hint in label:
            return replacement
    return fallback


def normalize_word_replace_rules(
    rules: Any,
    default_replacement: str = DEFAULT_MASK_CHAR,
) -> list[WordReplaceRule]:
    if not isinstance(rules, list):
        return []

    fallback = default_replacement or DEFAULT_MASK_CHAR
    normalized: list[WordReplaceRule] = []

    for item in rules:
        if not isinstance(item, dict):
            continue
        find_text = str(item.get('find', '')).strip()
        if not find_text:
            continue
        raw_mode = str(item.get('mode', 'exact')).strip().lower()
        mode = _MODE_ALIAS.get(raw_mode, 'exact')
        replace_text = item.get('replace')
        if replace_text is None or str(replace_text) == '':
            replace_text = fallback
        normalized.append(
            WordReplaceRule(
                find=find_text,
                replace=str(replace_text),
                mode=mode,
                enabled=bool(item.get('enabled', True)),
            )
        )
    return normalized


def load_word_replace_rules(path: str | Path | None = None) -> list[WordReplaceRule]:
    p = Path(path) if path is not None else _PROJECT_ROOT / 'rules' / 'pii_rules.json'
    if not p.is_absolute():
        p = _PROJECT_ROOT / p
    if not p.exists():
        return []
    try:
        data = json.loads(p.read_text(encoding='utf-8'))
    except Exception:
        return []
    if not isinstance(data, dict):
        return []
    return normalize_word_replace_rules(data.get('word_replace_rules', []))


def load_pii_as_word_replace_rules(path: str | Path | None = None) -> list[WordReplaceRule]:
    """将 PII 规则同步转为 Word 可执行的替换规则。"""
    p = Path(path) if path is not None else _PROJECT_ROOT / 'rules' / 'pii_rules.json'
    if not p.is_absolute():
        p = _PROJECT_ROOT / p

    converted: list[WordReplaceRule] = []
    for item in load_pii_rules(p):
        if not isinstance(item, dict) or not item.get('enabled', True):
            continue
        pattern = str(item.get('pattern', '')).strip()
        if not pattern:
            continue
        name = str(item.get('name', 'PII'))
        converted.append(
            WordReplaceRule(
                find=pattern,
                replace=replacement_for_pii_name(name),
                mode='regex',
                enabled=True,
            )
        )
    return converted


def load_all_word_detection_rules(
    path: str | Path | None = None,
    extra_rules: list[WordReplaceRule] | None = None,
) -> list[WordReplaceRule]:
    """Word 扫描/脱敏统一规则源：word_replace_rules + PII 规则 + 用户附加规则。"""
    config_path = path if path is not None else _PROJECT_ROOT / 'rules' / 'pii_rules.json'
    merged = merge_word_replace_rules(
        load_word_replace_rules(config_path),
        merge_word_replace_rules(
            load_pii_as_word_replace_rules(config_path),
            extra_rules,
        ),
    )
    return merged


def merge_word_replace_rules(
    config_rules: list[WordReplaceRule] | None = None,
    extra_rules: list[WordReplaceRule] | None = None,
) -> list[WordReplaceRule]:
    merged: list[WordReplaceRule] = []
    seen: set[tuple[str, str, str]] = set()
    for rule in (config_rules or []) + (extra_rules or []):
        if not rule.enabled or not rule.find:
            continue
        key = (rule.mode, rule.find, rule.replace)
        if key in seen:
            continue
        seen.add(key)
        merged.append(rule)
    return merged
