"""干净开源/通用版本导出与推送脚本：
1. 在临时目录创建全量源代码副本
2. 剥离并通用化公司名、特定Logo与客户敏感词表为通用演示规则
3. 在临时目录执行完整 pytest 测试验证（确保通用版核心功能100%正常）
4. 强制推送干净版本至远程 GitHub Private 仓库
5. 完全不修改、不影响本地开发环境与现有业务图纸规则
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def main():
    root = Path(__file__).resolve().parent.parent
    temp_dir = Path(tempfile.mkdtemp(prefix="desens_clean_release_"))
    print(f"Creating clean release workspace in {temp_dir}...")

    # 1. 复制所有必要源码目录与文件
    dirs_to_copy = ["core", "ui", "rules", "tests", "docs"]
    for d in dirs_to_copy:
        src_dir = root / d
        dst_dir = temp_dir / d
        if src_dir.exists():
            shutil.copytree(
                src_dir,
                dst_dir,
                ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache", "*.log"),
            )

    files_to_copy = ["main.py", "main_ui.py", "pytest.ini", ".gitignore", "AGENTS.md"]
    for f in files_to_copy:
        src = root / f
        dst = temp_dir / f
        if src.exists():
            shutil.copy2(src, dst)

    # 2. 清理 rules/sensitive_terms.txt 为通用敏感词模板
    generic_terms = """# 敏感词表模板（每行一个词，忽略空行与 # 注释行）
# 匹配方式：大小写不敏感子串匹配；长度 < 5 字符的词自动启用整词边界匹配
# 通用敏感标识与保密标记
Company Controls
Brand Process Management
Acme Corp
CONFIDENTIAL
PROPRIETARY
RESTRICTED
DO NOT COPY
SECRET
TOP SECRET
HELD IN STRICT CONFIDENCE
RETAINED IN CONFIDENCE
CONFIDENTIAL - THIS DOCUMENT
CONFIDENTIAL - THIS DRAWING
THIS DRAWING, INCLUDING THE INFORMATION
THIS DOCUMENT, INCLUDING THE CONTENT
COMPANY CONFIDENTIAL
# 用户自定义目标企业/商标词示例（请在本地使用时按需添加实际词汇）：
# Example Corp Intl.
# ACME Corporation
"""
    (temp_dir / "rules" / "sensitive_terms.txt").write_text(generic_terms, encoding="utf-8")

    # 3. 将测试用例与文档中对特定公司名的硬编码替换为通用的测试术语
    def sanitize_file_content(path: Path, text: str) -> str:
        # 文档通用化
        text = text.replace("Fisher Controls / Emerson / TopWorx / MKS 系列公司名、Logo、保密标记", "企业名称、商标Logo、保密标记")
        text = text.replace("Fisher Controls / Emerson / TopWorx / MKS", "目标企业/商标/Logo")
        text = text.replace("Fisher Controls、Emerson、TopWorx、MKS 系列及 CONFIDENTIAL 类标记", "目标企业词表及 CONFIDENTIAL 类标记")
        text = text.replace("Fisher Controls、Emerson、TopWorx、MKS", "目标企业名称、商标、Logo")
        text = text.replace("Fisher Controls Intl. LLC", "Company Controls Intl. LLC")
        text = text.replace("Fisher Controls International LLC", "Company Controls International LLC")
        text = text.replace("Fisher Controls", "Company Controls")
        text = text.replace("FISHER", "COMPANY")
        text = text.replace("Fisher", "Company")
        text = text.replace("Emerson Electric Co", "Brand Electric Co")
        text = text.replace("Emerson Process Management", "Brand Process Management")
        text = text.replace("Emerson Louisville, Kentucky, USA", "Brand Louisville, Kentucky, USA")
        text = text.replace("EMERSON", "BRAND")
        text = text.replace("Emerson", "Brand")
        text = text.replace("emerson", "brand")
        text = text.replace("TopWorx, Inc.", "Acme, Inc.")
        text = text.replace("TopWorx", "Acme")
        text = text.replace("TOPWORX", "ACME")
        text = text.replace("topworx", "acme")
        text = text.replace("MARSHALLTOWN", "SAMPLECITY")
        text = text.replace("marshalltown", "samplecity")
        text = text.replace("MKS", "CORP")
        text = text.replace("mks", "corp")
        return text

    for p in temp_dir.rglob("*"):
        if p.is_file() and p.suffix in [".py", ".md", ".txt", ".ini"]:
            try:
                content = p.read_text(encoding="utf-8")
                sanitized = sanitize_file_content(p, content)
                if sanitized != content:
                    p.write_text(sanitized, encoding="utf-8")
            except Exception as e:
                print(f"Skipping {p}: {e}")

    # 特殊调整 test_rule_engine.py 中断言的测试用例
    test_rule_p = temp_dir / "tests" / "test_rule_engine.py"
    if test_rule_p.exists():
        tr_text = """\"\"\"规则引擎单元测试：外部词表驱动匹配 + 编辑距离容错（通用测试版）。\"\"\"

from __future__ import annotations

import pytest

from core.detector.rule_engine import RuleEngine, SHORT_TERM_MAX_LEN, load_terms

TERMS = [
    "Company Controls",
    "Brand Process Management",
    "Acme",
    "CORP",
    "SAMPLECITY",
    "CONFIDENTIAL",
    "PROPRIETARY",
]


@pytest.fixture
def engine() -> RuleEngine:
    return RuleEngine(TERMS)


def test_exact_match_case_insensitive(engine: RuleEngine) -> None:
    hits = engine.match("This is COMPANY CONTROLS property")
    assert hits == ["Company Controls"]


def test_no_match_returns_empty(engine: RuleEngine) -> None:
    assert engine.match("Normal engineering drawing text") == []


def test_multiple_terms_in_one_text(engine: RuleEngine) -> None:
    hits = engine.match("Company Controls CONFIDENTIAL")
    assert set(hits) == {"Company Controls", "CONFIDENTIAL"}


def test_short_term_word_boundary_negative(engine: RuleEngine) -> None:
    assert engine.match("CORP12345") == []
    assert engine.match("ACORP") == []


def test_short_term_word_boundary_positive(engine: RuleEngine) -> None:
    hits = engine.match("PART NO CORP REV A")
    assert hits == ["CORP"]


def test_long_term_substring(engine: RuleEngine) -> None:
    hits = engine.match("Brand Process Management Co.")
    assert hits == ["Brand Process Management"]


def test_whitelist_protection() -> None:
    engine = RuleEngine(["SIZE", "CONFIDENTIAL"], whitelist=["SIZE"])
    hits = engine.match("SIZE A4 CONFIDENTIAL")
    assert hits == ["CONFIDENTIAL"]


def test_empty_terms_list() -> None:
    engine = RuleEngine([])
    assert engine.match("anything") == []


def test_fuzzy_match_tolerates_typos(engine: RuleEngine) -> None:
    hits = engine.match("CONFDENTIAL")
    assert "CONFIDENTIAL" in hits


def test_fuzzy_disabled_when_flag_false() -> None:
    strict = RuleEngine(TERMS, fuzzy=False)
    assert strict.match("CONFDENTIAL") == []


def test_load_terms_from_real_wordlist() -> None:
    terms = load_terms("rules/sensitive_terms.txt")
    assert len(terms) >= 5
    assert "CONFIDENTIAL" in terms


def test_load_terms_missing_file_raises() -> None:
    with pytest.raises(FileNotFoundError):
        load_terms("rules/no_such_terms.txt")


def test_short_term_constant() -> None:
    assert SHORT_TERM_MAX_LEN == 4


TERMS_REAL = load_terms("rules/sensitive_terms.txt")


def test_discriminator_tokens_keep_brand_drop_stopwords() -> None:
    d = RuleEngine(TERMS_REAL).discriminator_tokens()
    for tok in ("confidential", "proprietary", "restricted", "secret"):
        assert tok in d, tok


def test_image_tokens_normalize_case_and_punct() -> None:
    tokens = RuleEngine.image_tokens("BRAND, Louisville — KY? 'USA'")
    assert tokens == {"brand", "louisville", "ky", "usa"}


def test_match_image_hits_single_word_of_phrase() -> None:
    engine = RuleEngine(["Brand Process Management", "CONFIDENTIAL"])
    assert "Brand Process Management" in engine.match_image("BRAND PROCESS MANAGEMENT")
    assert "CONFIDENTIAL" in engine.match_image("CONFIDENTIAL")
"""
        test_rule_p.write_text(tr_text, encoding="utf-8")

    # 4. 在临时目录运行 pytest 确保通用版 100% 测试通过
    print("Running pytest on generic clean release in temp dir...")
    res = subprocess.run(["pytest"], cwd=str(temp_dir), capture_output=True, text=True)
    print(res.stdout[-350:] if res.stdout else "No stdout")
    if res.returncode != 0:
        print("Test failed! Full output:")
        print(res.stdout)
        print(res.stderr)
        print("Aborting push.")
        return

    # 5. 初始化 git 并强制覆盖推送到 GitHub 远程仓库
    print("Initializing clean git repository...")
    subprocess.run(["git", "init"], cwd=str(temp_dir), check=True)
    subprocess.run(["git", "config", "user.name", "zonlic0925-boop"], cwd=str(temp_dir), check=True)
    subprocess.run(["git", "config", "user.email", "zonlic0925-boop@users.noreply.github.com"], cwd=str(temp_dir), check=True)
    subprocess.run(["git", "add", "."], cwd=str(temp_dir), check=True)
    subprocess.run(["git", "commit", "-m", "feat: initial clean generic release of drawing desensitization tool"], cwd=str(temp_dir), check=True)
    subprocess.run(["git", "branch", "-M", "master"], cwd=str(temp_dir), check=True)
    subprocess.run(["git", "remote", "add", "origin", "https://github.com/zonlic0925-boop/Desensitization.git"], cwd=str(temp_dir), check=True)
    
    print("Force pushing clean generic release to GitHub master branch...")
    push_res = subprocess.run(["git", "push", "-f", "origin", "master"], cwd=str(temp_dir), capture_output=True, text=True)
    print(push_res.stdout)
    print(push_res.stderr)
    if push_res.returncode == 0:
        print("Successfully updated GitHub repository with clean generic version!")
    else:
        print(f"Push failed with returncode {push_res.returncode}")

    # 清理临时目录
    try:
        shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception:
        pass


if __name__ == "__main__":
    main()
