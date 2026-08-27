from __future__ import annotations

_LEGACY_MASK_PREFIX = '[已脱敏'
DEFAULT_MASK_CHAR = '*'


def uses_asterisk_mask(replacement: str | None) -> bool:
    """是否将命中内容替换为等长星号（DocumentRules 默认脱敏占位）。"""
    repl = (replacement or '').strip()
    if not repl or repl == DEFAULT_MASK_CHAR:
        return True
    if repl.startswith(_LEGACY_MASK_PREFIX):
        return True
    return False


def mask_placeholder(matched_text: str, configured_replacement: str = DEFAULT_MASK_CHAR) -> str:
    """脱敏占位：默认用与原文等长的 * 覆盖，保留版式宽度。"""
    if uses_asterisk_mask(configured_replacement):
        return DEFAULT_MASK_CHAR * max(1, len(matched_text or ''))
    return configured_replacement
