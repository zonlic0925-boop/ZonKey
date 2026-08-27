"""规则引擎单元测试：外部词表驱动匹配 + 编辑距离容错。"""

from __future__ import annotations

import pytest

from core.detector.rule_engine import RuleEngine, SHORT_TERM_MAX_LEN, load_terms

TERMS = [
    "ACME CORP",
    "GLOBAL INDUSTRIAL",
    "TOP SECRET",
    "MKS",
    "SAMPLECITY",
    "CONFIDENTIAL",
    "PROPRIETARY",
]


@pytest.fixture
def engine() -> RuleEngine:
    return RuleEngine(TERMS)


def test_exact_match_case_insensitive(engine: RuleEngine) -> None:
    assert "ACME CORP" in engine.match("ACME CORP INC.")
    assert "TOP SECRET" in engine.match("this is top secret info")


def test_substring_match_within_longer_text(engine: RuleEngine) -> None:
    assert "CONFIDENTIAL" in engine.match("THIS DOCUMENT IS CONFIDENTIAL")


def test_short_term_requires_word_boundary(engine: RuleEngine) -> None:
    assert "MKS" in engine.match("MKS-1000")
    assert "MKS" not in engine.match("XMKS")
    assert "MKS" not in engine.match("MKSX")


def test_fuzzy_edit_distance_within_tolerance(engine: RuleEngine) -> None:
    # CONFIDENTIAL: len 12 -> tolerance = max(1, 12//8) = 1
    assert "CONFIDENTIAL" in engine.match("CONFIDENTIA")
    assert "CONFIDENTIAL" in engine.match("CONFIDENTAL")
    # SAMPLECITY: len 10 -> tolerance = 1
    assert "SAMPLECITY" in engine.match("SAMPLECIT")


def test_fuzzy_beyond_tolerance_not_matched(engine: RuleEngine) -> None:
    assert "CONFIDENTIAL" not in engine.match("CONFIDENT")  # 距离 3 > 1
    assert "SAMPLECITY" not in engine.match("SAMPLEC")


def test_fuzzy_not_applied_to_short_terms(engine: RuleEngine) -> None:
    assert "MKS" not in engine.match("MKSX")  # 长度 3 <= 4，无容差，边界不命中


def test_fuzzy_not_applied_to_phrase_terms(engine: RuleEngine) -> None:
    assert "ACME CORP" not in engine.match("ACMEX")
    assert "ACME CORP" in engine.match("ACME CORP")


def test_phrase_match(engine: RuleEngine) -> None:
    assert "GLOBAL INDUSTRIAL" in engine.match("GLOBAL INDUSTRIAL MANAGEMENT")


def test_empty_text_returns_nothing(engine: RuleEngine) -> None:
    assert engine.match("") == []
    assert engine.match("   ") == []


def test_no_fuzzy_mode_disables_edit_distance() -> None:
    strict = RuleEngine(TERMS, fuzzy=False)
    assert strict.match("CONFIDENTIA") == []


def test_load_terms_from_file(tmp_path) -> None:
    f = tmp_path / "custom_terms.txt"
    f.write_text("# Comments\nCONFIDENTIAL\nPROPRIETARY\n", encoding="utf-8")
    terms = load_terms(str(f))
    assert len(terms) == 2
    assert "CONFIDENTIAL" in terms
    assert "PROPRIETARY" in terms


def test_load_terms_missing_file_raises() -> None:
    with pytest.raises(FileNotFoundError):
        load_terms("rules/no_such_terms.txt")


def test_short_term_constant() -> None:
    assert SHORT_TERM_MAX_LEN == 4


def test_discriminator_tokens_keep_brand_drop_stopwords() -> None:
    terms = [
        "ACME Industrial",
        "GLOBAL Process Management",
        "CONFIDENTIAL",
        "PROPRIETARY",
    ]
    d = RuleEngine(terms).discriminator_tokens()
    for tok in ("acme", "global", "confidential", "proprietary"):
        assert tok in d, tok
    for tok in ("process", "management", "industrial", "company", "inc", "ltd"):
        assert tok not in d, tok


def test_image_tokens_normalize_case_and_punct() -> None:
    tokens = RuleEngine.image_tokens("ACME CORP, Springfield — IL? 'USA'")
    assert tokens == {"acme", "corp", "springfield", "il", "usa"}


def test_match_image_hits_single_word_of_phrase() -> None:
    engine = RuleEngine(["ACME GLOBAL MANUFACTURING", "CONFIDENTIAL"])
    assert "acme" in engine.match_image("ACME SPRINGFIELD USA")
    assert "confidential" in engine.match_image("CONFIDENTIAL")


def test_match_image_ignores_normal_content() -> None:
    engine = RuleEngine(["ACME GLOBAL MANUFACTURING", "CONFIDENTIAL"])
    assert engine.match_image("PARTNUMBER ES-09708-1~17 QTY DESCRIPTION") == []


def test_match_image_empty_text() -> None:
    assert RuleEngine(["CONFIDENTIAL"]).match_image("") == []
