"""发布版本生成与导出工具：
自动生成一个没有任何内置特定公司名称、专有Logo或专有敏感词的公开发布版本。
功能、交互与核心能力与内部版本完全一致，支持用户自定义规则和零规则冷启动。
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path


def build_release(output_dir: Path | None = None) -> Path:
    project_root = Path(__file__).resolve().parent.parent
    if output_dir is None:
        release_root = project_root / "dist_release" / "DrawingDesensitizer_Release"
    else:
        release_root = Path(output_dir)

    print(f"[1/6] 准备发布版本目录: {release_root}")
    if release_root.exists():
        for item in release_root.iterdir():
            try:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
            except Exception as e:
                print(f"Warning cleaning {item}: {e}")
    release_root.mkdir(parents=True, exist_ok=True)

    # 1. 复制核心代码与资源结构
    print("[2/6] 复制 core / ui / 测试 / 配置文件...")
    shutil.copytree(
        project_root / "core",
        release_root / "core",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache"),
    )
    shutil.copytree(
        project_root / "ui",
        release_root / "ui",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".pytest_cache"),
    )

    # 复制顶层脚本与基础配置文件
    for fname in ["main.py", "main_ui.py", "pytest.ini", ".gitignore", "requirements.txt", "pyproject.toml"]:
        src = project_root / fname
        if src.exists():
            shutil.copy2(src, release_root / fname)

    # 如果 requirements.txt 不存在，则生成标准依赖文件
    req_file = release_root / "requirements.txt"
    if not req_file.exists():
        req_content = """PyQt5>=5.15.10
PyMuPDF>=1.24.0
opencv-python>=4.9.0
numpy>=1.26.0
rapidocr-onnxruntime>=1.3.0
pytest>=8.0.0
"""
        req_file.write_text(req_content, encoding="utf-8")

    # 2. 构建纯净的规则目录 (无内置专有规则)
    print("[3/6] 初始化纯净 rules/ 目录（无内置企业规则）...")
    rules_dir = release_root / "rules"
    rules_dir.mkdir(parents=True, exist_ok=True)
    logos_dir = rules_dir / "logos"
    logos_dir.mkdir(parents=True, exist_ok=True)

    # 纯净的敏感词表（仅含格式注释说明，不含任何预设特定公司名）
    clean_terms_content = """# ==============================================================================
# 工程图纸脱敏系统 - 自定义敏感词表
# ==============================================================================
# 使用说明：
# 1. 每行填写一个需要脱敏抹除的敏感词或企业/部门名称。
# 2. 忽略以 # 开头的注释行以及空白行。
# 3. 匹配机制：
#    - 默认大小写不敏感；
#    - 长度 >= 5 字符的词采用智能子串与模糊容错匹配；
#    - 长度 < 5 字符的短词（如 CORP, ABC）自动启用严格整词边界匹配，防止误伤。
# 4. 您也可以直接在图形界面（UI）右上方的「敏感词规则」面板中动态添加与修改。
# ==============================================================================

# --- 通用保密与受限图纸标记（如不需要可注释或删除） ---
CONFIDENTIAL
PROPRIETARY
RESTRICTED
DO NOT COPY
TOP SECRET
COMPANY CONFIDENTIAL
HELD IN STRICT CONFIDENCE
RETAINED IN CONFIDENCE

# --- 请在下方添加您的目标企业名称、商标词或专有代号（示例） ---
# ACME Corporation
# Example Engineering Ltd
# Global Controls Co.
"""
    (rules_dir / "sensitive_terms.txt").write_text(clean_terms_content, encoding="utf-8")

    # Logo 目录说明文件
    logos_readme = """# 自定义商标 / Logo 模板目录

本目录用于存放需要自动检测并脱敏抹除的企业商标或 Logo 图片。

### 使用方法：
1. 将需要脱敏的 Logo 裁剪为清晰的图片，放入本目录；
2. 支持格式：`.png`、`.jpg`、`.jpeg`、`.bmp`；
3. 命名建议：使用 Logo 对应的名称命名（如 `company_logo.png` 或 `brand.png`），系统将以文件名为识别标签；
4. 系统启动时会自动加载该目录下的所有图片并进行多尺度特征模板匹配。

（若本目录为空，系统将仅依据敏感词表和交互框选执行脱敏，不会发生报错）
"""
    (logos_dir / "README.md").write_text(logos_readme, encoding="utf-8")

    # 3. 复制通用测试套件（去除专有样本依赖）
    print("[4/6] 构建发布版本自动化测试套件...")
    tests_dst = release_root / "tests"
    tests_dst.mkdir(parents=True, exist_ok=True)
    tests_src = project_root / "tests"

    for tfile in tests_src.glob("test_*.py"):
        # 针对规则和Logo测试做通用化适配
        if tfile.name == "test_rule_engine.py":
            _write_generic_rule_engine_test(tests_dst / tfile.name)
        elif tfile.name == "test_logo_matcher.py":
            _write_generic_logo_matcher_test(tests_dst / tfile.name)
        else:
            shutil.copy2(tfile, tests_dst / tfile.name)

    # 4. 生成发布版说明文档与启动脚本
    print("[5/6] 生成发布版 README.md 与一键启动脚本...")
    _write_release_readme(release_root / "README.md")
    bat_content = """@echo off
chcp 65001 >nul
title 工程图纸脱敏系统
echo 正在启动工程图纸脱敏系统交互界面...
python main_ui.py
if %errorlevel% neq 0 (
    echo.
    echo 启动失败，请检查 Python 环境与依赖是否已安装：
    echo pip install -r requirements.txt
    pause
)
"""
    (release_root / "启动系统.bat").write_text(bat_content, encoding="utf-8")

    # 5. 校验与打包
    print("[6/6] 打包为便携 ZIP 发布归档...")
    zip_path = release_root.parent / f"{release_root.name}_v1.0.0.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in release_root.rglob("*"):
            if file.is_file():
                arcname = file.relative_to(release_root.parent)
                zf.write(file, arcname)

    print(f"\n[OK] 发布版本已成功生成！")
    print(f"  - 源码目录: {release_root}")
    print(f"  - 压缩归档: {zip_path}")
    return release_root


def _write_generic_rule_engine_test(dst: Path) -> None:
    content = """\"\"\"规则引擎单元测试（通用发布版）：外部词表驱动匹配 + 编辑距离容错。\"\"\"

from __future__ import annotations

import pytest

from core.detector.rule_engine import RuleEngine, SHORT_TERM_MAX_LEN, load_terms, _DISCRIMINATOR_STOPWORDS

SAMPLE_TERMS = [
    "ACME Corporation",
    "Global Controls Ltd",
    "CORP",
    "CONFIDENTIAL",
    "PROPRIETARY",
    "RESTRICTED",
]


@pytest.fixture
def engine() -> RuleEngine:
    return RuleEngine(SAMPLE_TERMS)


def test_exact_match_case_insensitive(engine: RuleEngine) -> None:
    hits = engine.match("Property of acme corporation all rights reserved")
    assert hits == ["ACME Corporation"]


def test_no_match_returns_empty(engine: RuleEngine) -> None:
    assert engine.match("Normal engineering drawing text without sensitive info") == []


def test_multiple_terms_in_one_text(engine: RuleEngine) -> None:
    hits = engine.match("ACME Corporation CONFIDENTIAL DRAWING")
    assert set(hits) == {"ACME Corporation", "CONFIDENTIAL"}


def test_short_term_word_boundary_negative(engine: RuleEngine) -> None:
    assert engine.match("CORP12345") == []


def test_short_term_word_boundary_positive(engine: RuleEngine) -> None:
    hits = engine.match("DRAWING NO CORP REV 01")
    assert hits == ["CORP"]


def test_discriminator_stopwords() -> None:
    assert "process" in _DISCRIMINATOR_STOPWORDS
    assert "controls" in _DISCRIMINATOR_STOPWORDS
    assert "inc" in _DISCRIMINATOR_STOPWORDS


def test_empty_terms_list() -> None:
    engine = RuleEngine([])
    assert engine.match("any text here") == []


def test_fuzzy_match_tolerates_typos(engine: RuleEngine) -> None:
    hits = engine.match("CONFDENTIAL")
    assert "CONFIDENTIAL" in hits


def test_load_terms_from_clean_wordlist(tmp_path: Path) -> None:
    p = tmp_path / "terms.txt"
    p.write_text("# Comment line\\n\\nACME CORP\\nCONFIDENTIAL\\n", encoding="utf-8")
    terms = load_terms(p)
    assert terms == ["ACME CORP", "CONFIDENTIAL"]


def test_short_term_constant() -> None:
    assert SHORT_TERM_MAX_LEN == 4
"""
    dst.write_text(content, encoding="utf-8")


def _write_generic_logo_matcher_test(dst: Path) -> None:
    content = """\"\"\"LogoMatcher 视觉模板匹配器测试（通用发布版）。\"\"\"

import pikepdf
import pytest
from core.detector.logo_matcher import LogoMatcher
from core.pdfio import PdfDocView


def test_logo_matcher_empty_dir_safe(tmp_path):
    \"\"\"当没有放置任何 Logo 模板时，匹配器安全无报错返回空。\"\"\"
    matcher = LogoMatcher(template_dir=tmp_path)
    assert len(matcher.templates) == 0

    blank = tmp_path / "blank.pdf"
    pdf = pikepdf.new()
    pdf.add_blank_page(page_size=(300, 300))
    pdf.save(str(blank))
    with PdfDocView(blank) as view:
        hits = list(matcher.detect(view.page(0), 0))
    assert hits == []
"""
    dst.write_text(content, encoding="utf-8")


def _write_release_readme(dst: Path) -> None:
    content = """# 工程图纸智能脱敏系统 (Drawing Desensitizer) - 发布版

本系统是一款专为工程图纸（PDF 格式）设计的**本地离线自动化与交互式脱敏工具**。支持矢量图纸直接解析、高清栅格图纸 OCR 识别、视觉 Logo 匹配、智能框线归位以及交互式即时框选脱敏。

---

## 核心特性

1. **三通道高精度检测**：
   - **矢量文字通道**：毫秒级解析原生 PDF 文本层与精确字符边界；
   - **OCR 栅格通道**：针对扫描图纸或位图注记，执行多尺度文字检测与文本定位；
   - **视觉 Logo 模板匹配**：自动识别标题栏及边框区域的企业商标。
2. **智能框线归位 (Box Finder)**：
   - 自动向上对齐并归位至最小封闭表格单元格，抹除不越框、不破坏框外正常工程尺寸与技术标注。
3. **即时脱敏与双向高亮交互 (GUI)**：
   - **手选框选即时脱敏**：鼠标在图纸上框选任意区域，右侧即时完成真脱敏并刷新；
   - **点击拾取与删除/恢复**：左右视图双向联动高亮，支持单选删除抹除框或一键撤销/重做；
   - **原位红框警示**：对无框可归位的文字提供自动收缩与警示。
4. **真删除物理级安全脱敏**：
   - 底层采用 PDF 物理对象移除（Redaction Annotation Apply），彻底抹除文本流与像素，杜绝二次提取。
5. **纯本地离线运行**：
   - 零网络请求，不上传任何图纸，保障企业数据绝对安全。

---

## 环境准备与快速开始

### 1. 安装 Python 运行环境
推荐使用 Python 3.10 或 3.11。

```bash
# 克隆或解压本项目后进入目录
cd DrawingDesensitizer_Release

# 安装依赖
pip install -r requirements.txt
```

### 2. 启动图形化客户端 (推荐)
```bash
python main_ui.py
```
- **添加文件**：支持拖拽或点击「添加文件/文件夹」加载 PDF 图纸；
- **脱敏规则**：在右上角表格中可即时添加、勾选、删除敏感词；
- **交互操作**：在图纸区域使用鼠标左键拖拽框选即可即时脱敏，选中已有抹除块可按 Delete 或点击工具栏进行删除与撤销。

### 3. 命令行批量处理 (CLI)
```bash
# 自动处理单张图纸或整个文件夹
python main.py input_drawing.pdf -o output_dir/
```

---

## 自定义敏感词与 Logo 配置

本发布版本**默认不包含任何特定企业名称与专有 Logo**，您可以按需灵活配置：

### 1. 配置敏感词表
编辑 `rules/sensitive_terms.txt`：
- 每行输入一个需要脱敏的企业名称、项目代号或敏感词汇；
- 系统支持大小写自动不敏感匹配及拼写容错。

### 2. 配置商标 / Logo 模板
将需要识别的企业 Logo 图片（`.png` / `.jpg`）放入 `rules/logos/` 目录中：
- 建议将图片命名为 `company_logo.png` 或 `brand.png`；
- 放置后系统将在分析图纸时自动启用模板匹配。

---

## 运行自动化测试
```bash
pytest
```
"""
    dst.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else None
    build_release(out)
