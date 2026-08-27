"""
DocumentRules 现代化统一规则管理控制台
集成企业敏感词、通用 PII 正则库、印章/图章特征、Word 智能替换与高级脱敏配置。
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QFont, QIcon
from PyQt5.QtWidgets import (
    QAbstractItemView,
    QCheckBox,
    QComboBox,
    QDialog,
    QDoubleSpinBox,
    QFormLayout,
    QFrame,
    QGroupBox,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QSplitter,
    QStackedWidget,
    QTableWidget,
    QTableWidgetItem,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)


class RuleDialog(QDialog):
    """现代化脱敏规则与全局策略配置对话框"""
    rules_updated = pyqtSignal()

    def __init__(
        self,
        parent: QWidget | None = None,
        terms_path: str | Path = "rules/sensitive_terms.txt",
        pii_path: str | Path = "rules/pii_rules.json",
    ):
        super().__init__(parent)
        self.setWindowTitle("脱敏规则与预设中心 - DocumentRules")
        self.resize(920, 640)
        self.setMinimumSize(800, 520)

        self._project_root = Path(__file__).resolve().parent.parent
        self._terms_path = Path(terms_path)
        if not self._terms_path.is_absolute():
            self._terms_path = self._project_root / self._terms_path

        self._pii_path = Path(pii_path)
        if not self._pii_path.is_absolute():
            self._pii_path = self._project_root / self._pii_path

        self._full_config: dict[str, Any] = {}
        self._init_ui()
        self._load_data()

    def _init_ui(self) -> None:
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(20, 20, 20, 20)
        main_layout.setSpacing(16)

        # 顶部 Header 标题栏
        header_widget = QWidget()
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(0, 0, 0, 0)

        title_vbox = QVBoxLayout()
        title_label = QLabel("🛡️ 脱敏规则与策略配置中心")
        title_label.setFont(QFont("-apple-system, Segoe UI, Microsoft YaHei", 16, QFont.Bold))
        title_label.setObjectName("brandTitle")

        desc_label = QLabel("管理企业敏感词、通用个人隐私(PII)、印章图章视觉检测与 Word 替换规则。")
        desc_label.setObjectName("tipLabel")

        title_vbox.addWidget(title_label)
        title_vbox.addWidget(desc_label)
        header_layout.addLayout(title_vbox)
        header_layout.addStretch()

        main_layout.addWidget(header_widget)

        # 主体左右分割布局
        splitter = QSplitter(Qt.Horizontal)
        splitter.setChildrenCollapsible(False)

        # 左侧导航分类
        self.nav_list = QListWidget()
        self.nav_list.setObjectName("categoryList")
        self.nav_list.setFixedWidth(200)

        nav_items = [
            ("🏢 企业敏感词", "图纸公司名/保密标记"),
            ("🔤 通用 PII 正则", "身份证/手机/银行卡/邮箱"),
            ("💮 印章与图章", "红色公章/财务章视觉识别"),
            ("📝 Word 替换占位", "Office 文档脱敏映射"),
            ("⚙️ 引擎运行参数", "置信度/抹除模式与性能"),
        ]

        for title, sub in nav_items:
            item = QListWidgetItem(title)
            item.setToolTip(sub)
            self.nav_list.addItem(item)

        splitter.addWidget(self.nav_list)

        # 右侧内容堆叠窗口
        self.stack = QStackedWidget()
        self.stack.addWidget(self._create_enterprise_page())
        self.stack.addWidget(self._create_pii_page())
        self.stack.addWidget(self._create_seal_page())
        self.stack.addWidget(self._create_word_replace_page())
        self.stack.addWidget(self._create_settings_page())

        splitter.addWidget(self.stack)
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)

        main_layout.addWidget(splitter, 1)

        # 底部操作栏
        footer_layout = QHBoxLayout()
        footer_layout.setContentsMargins(0, 8, 0, 0)

        self.btn_reset = QPushButton("恢复默认规则")
        self.btn_reset.clicked.connect(self._reset_to_defaults)
        footer_layout.addWidget(self.btn_reset)

        footer_layout.addStretch()

        self.btn_cancel = QPushButton("取消")
        self.btn_cancel.clicked.connect(self.reject)
        footer_layout.addWidget(self.btn_cancel)

        self.btn_save = QPushButton("保存并应用规则")
        self.btn_save.setObjectName("primaryBtn")
        self.btn_save.clicked.connect(self._save_and_apply)
        footer_layout.addWidget(self.btn_save)

        main_layout.addLayout(footer_layout)

        self.nav_list.currentRowChanged.connect(self.stack.setCurrentIndex)
        self.nav_list.setCurrentRow(0)

    # ---------------- 页面 1: 企业敏感词 ----------------
    def _create_enterprise_page(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(12, 0, 0, 0)

        group = QGroupBox("企业敏感词汇列表 (每行一个)")
        g_layout = QVBoxLayout(group)

        tip_label = QLabel(
            "提示：图纸脱敏引擎会在 PDF 文本层、OCR 识别流及矢量图形中检索这些关键词，并进行精准方框归位抹除。"
        )
        tip_label.setStyleSheet("color: #64748b; font-size: 12px; margin-bottom: 6px;")
        g_layout.addWidget(tip_label)

        self.terms_edit = QTextEdit()
        self.terms_edit.setPlaceholderText("例如：\nCONFIDENTIAL\nPROPRIETARY\nRESTRICTED\nSECRET")
        g_layout.addWidget(self.terms_edit)

        layout.addWidget(group)
        return page

    # ---------------- 页面 2: 通用 PII 正则 ----------------
    def _create_pii_page(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(12, 0, 0, 0)

        group = QGroupBox("通用个人隐私 (PII) 规则库")
        g_layout = QVBoxLayout(group)

        tip_label = QLabel("已内置银行、电信与身份识别高精度正则，勾选启用后将自动应用于图纸与文档脱敏。")
        tip_label.setStyleSheet("color: #64748b; font-size: 12px; margin-bottom: 6px;")
        g_layout.addWidget(tip_label)

        self.pii_table = QTableWidget()
        self._pii_table = self.pii_table  # 兼容旧属性名
        self.pii_table.setColumnCount(4)
        self.pii_table.setHorizontalHeaderLabels(["启用", "规则名称", "类别", "匹配正则表达式 (Regex)"])
        self.pii_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.pii_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.pii_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.pii_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Stretch)
        self.pii_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        g_layout.addWidget(self.pii_table)

        btn_box = QHBoxLayout()
        self.btn_add_pii = QPushButton("+ 添加自定义 PII 规则")
        self.btn_add_pii.clicked.connect(self._add_pii_row)
        self.btn_del_pii = QPushButton("- 删除选中规则")
        self.btn_del_pii.clicked.connect(self._delete_pii_row)

        btn_box.addWidget(self.btn_add_pii)
        btn_box.addWidget(self.btn_del_pii)
        btn_box.addStretch()
        g_layout.addLayout(btn_box)

        layout.addWidget(group)
        return page

    # ---------------- 页面 3: 印章图章检测 ----------------
    def _create_seal_page(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(12, 0, 0, 0)

        group = QGroupBox("视觉公章与图章识别特征 (CV / HSV 阈值)")
        g_layout = QVBoxLayout(group)

        tip_label = QLabel("配置图像/工程图纸中的红色、彩色圆形与椭圆形图章检测边界条件。")
        tip_label.setStyleSheet("color: #64748b; font-size: 12px; margin-bottom: 12px;")
        g_layout.addWidget(tip_label)

        form_layout = QFormLayout()
        form_layout.setSpacing(14)

        self.chk_seal_enabled = QCheckBox("开启公章/图章自动检测与抹除")
        self.chk_seal_enabled.setChecked(True)
        form_layout.addRow("功能开关:", self.chk_seal_enabled)

        self.spin_min_area = QSpinBox()
        self.spin_min_area.setRange(100, 100000)
        self.spin_min_area.setSingleStep(200)
        self.spin_min_area.setValue(1200)
        form_layout.addRow("最小图章面积 (像素):", self.spin_min_area)

        self.spin_max_area = QSpinBox()
        self.spin_max_area.setRange(1000, 10000000)
        self.spin_max_area.setSingleStep(5000)
        self.spin_max_area.setValue(350000)
        form_layout.addRow("最大图章面积 (像素):", self.spin_max_area)

        self.spin_circularity = QDoubleSpinBox()
        self.spin_circularity.setRange(0.1, 1.0)
        self.spin_circularity.setSingleStep(0.05)
        self.spin_circularity.setValue(0.45)
        form_layout.addRow("圆度/紧凑度阈值 (0-1):", self.spin_circularity)

        g_layout.addLayout(form_layout)
        g_layout.addStretch()

        layout.addWidget(group)
        return page

    # ---------------- 页面 4: Word 替换规则 ----------------
    def _create_word_replace_page(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(12, 0, 0, 0)

        group = QGroupBox("Word 文档智能替换规则表")
        g_layout = QVBoxLayout(group)

        tip_label = QLabel("配置 Word (.docx / .doc) 批量处理时的文本脱敏模式与自定义替换文本。")
        tip_label.setStyleSheet("color: #64748b; font-size: 12px; margin-bottom: 6px;")
        g_layout.addWidget(tip_label)

        self.word_table = QTableWidget()
        self.word_table.setColumnCount(4)
        self.word_table.setHorizontalHeaderLabels(["启用", "规则名称", "查找目标 / Regex", "替换为"])
        self.word_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.word_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.word_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        self.word_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Stretch)
        self.word_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        g_layout.addWidget(self.word_table)

        btn_box = QHBoxLayout()
        self.btn_add_word = QPushButton("+ 添加 Word 替换项")
        self.btn_add_word.clicked.connect(self._add_word_row)
        self.btn_del_word = QPushButton("- 删除选中项")
        self.btn_del_word.clicked.connect(self._delete_word_row)

        btn_box.addWidget(self.btn_add_word)
        btn_box.addWidget(self.btn_del_word)
        btn_box.addStretch()
        g_layout.addLayout(btn_box)

        layout.addWidget(group)
        return page

    # ---------------- 页面 5: 引擎高级参数 ----------------
    def _create_settings_page(self) -> QWidget:
        page = QWidget()
        layout = QVBoxLayout(page)
        layout.setContentsMargins(12, 0, 0, 0)

        group = QGroupBox("全局引擎与脱敏策略")
        g_layout = QVBoxLayout(group)

        form_layout = QFormLayout()
        form_layout.setSpacing(14)

        self.combo_redact_mode = QComboBox()
        self.combo_redact_mode.addItem("彻底抹除 (真删除矢量/文本层 - 推荐)", "erase")
        self.combo_redact_mode.addItem("黑块覆盖 (绘制实体黑色矩形)", "black")
        self.combo_redact_mode.addItem("白块覆盖 (绘制实体白色背景矩形)", "white")
        form_layout.addRow("默认脱敏渲染模式:", self.combo_redact_mode)

        self.spin_confidence = QDoubleSpinBox()
        self.spin_confidence.setRange(0.1, 1.0)
        self.spin_confidence.setSingleStep(0.05)
        self.spin_confidence.setValue(0.8)
        form_layout.addRow("OCR / 匹配置信度门限:", self.spin_confidence)

        self.chk_enable_pii = QCheckBox("在工程图纸中默认启用 PII 规则检测")
        self.chk_enable_pii.setChecked(True)
        form_layout.addRow("PII 检测联动:", self.chk_enable_pii)

        g_layout.addLayout(form_layout)
        g_layout.addStretch()

        layout.addWidget(group)
        return page

    # ---------------- 数据加载与保存 ----------------
    def _load_data(self) -> None:
        # 1. 载入企业敏感词
        terms = []
        if self._terms_path.exists():
            try:
                for line in self._terms_path.read_text(encoding="utf-8").splitlines():
                    t = line.strip()
                    if t and not t.startswith("#"):
                        terms.append(t)
            except Exception:
                pass
        self.terms_edit.setPlainText("\n".join(terms))

        # 2. 载入完整 PII 配置
        self._full_config = {}
        if self._pii_path.exists():
            try:
                self._full_config = json.loads(self._pii_path.read_text(encoding="utf-8"))
            except Exception:
                self._full_config = {}

        if not isinstance(self._full_config, dict):
            self._full_config = {}

        # 载入 PII Rules
        pii_dict = self._full_config.get("pii_rules", {})
        self.pii_table.setRowCount(0)
        if isinstance(pii_dict, dict):
            for key, val in pii_dict.items():
                if isinstance(val, dict):
                    self._insert_pii_row(
                        enabled=val.get("enabled", True),
                        name=val.get("name", key),
                        category=val.get("category", "默认"),
                        pattern=val.get("pattern", ""),
                    )
        elif isinstance(pii_dict, list):
            for val in pii_dict:
                if isinstance(val, dict):
                    self._insert_pii_row(
                        enabled=val.get("enabled", True),
                        name=val.get("name", "自定义规则"),
                        category=val.get("category", "默认"),
                        pattern=val.get("pattern", ""),
                    )

        # 载入印章规则
        seal_rules = self._full_config.get("seal_rules", {})
        if isinstance(seal_rules, dict):
            red_seal = seal_rules.get("red_seal", {})
            self.chk_seal_enabled.setChecked(red_seal.get("enabled", True))
            self.spin_min_area.setValue(red_seal.get("min_area", 1200))
            self.spin_max_area.setValue(red_seal.get("max_area", 350000))
            self.spin_circularity.setValue(red_seal.get("circularity_thresh", 0.45))

        # 载入 Word 规则
        word_rules = self._full_config.get("word_replace_rules", [])
        self.word_table.setRowCount(0)
        if isinstance(word_rules, list):
            for item in word_rules:
                if isinstance(item, dict):
                    self._insert_word_row(
                        enabled=item.get("enabled", True),
                        name=item.get("name", "替换项"),
                        find=item.get("find", ""),
                        replace=item.get("replace", "[已脱敏]"),
                    )

        # 载入高级设置
        settings = self._full_config.get("settings", {})
        if isinstance(settings, dict):
            mode = settings.get("redact_mode", "erase")
            idx = self.combo_redact_mode.findData(mode)
            if idx >= 0:
                self.combo_redact_mode.setCurrentIndex(idx)
            self.spin_confidence.setValue(settings.get("confidence_threshold", 0.8))
            self.chk_enable_pii.setChecked(settings.get("enable_pii_detection", True))

    def _insert_pii_row(self, enabled: bool, name: str, category: str, pattern: str) -> None:
        row = self.pii_table.rowCount()
        self.pii_table.insertRow(row)

        chk = QCheckBox()
        chk.setChecked(enabled)
        chk_widget = QWidget()
        chk_layout = QHBoxLayout(chk_widget)
        chk_layout.addWidget(chk)
        chk_layout.setAlignment(Qt.AlignCenter)
        chk_layout.setContentsMargins(0, 0, 0, 0)
        self.pii_table.setCellWidget(row, 0, chk_widget)

        self.pii_table.setItem(row, 1, QTableWidgetItem(name))
        self.pii_table.setItem(row, 2, QTableWidgetItem(category))
        self.pii_table.setItem(row, 3, QTableWidgetItem(pattern))

    def _add_pii_row(self) -> None:
        self._insert_pii_row(True, "新自定义规则", "自定义", r"")
        self.pii_table.scrollToBottom()

    def _delete_pii_row(self) -> None:
        row = self.pii_table.currentRow()
        if row >= 0:
            self.pii_table.removeRow(row)

    def _insert_word_row(self, enabled: bool, name: str, find: str, replace: str) -> None:
        row = self.word_table.rowCount()
        self.word_table.insertRow(row)

        chk = QCheckBox()
        chk.setChecked(enabled)
        chk_widget = QWidget()
        chk_layout = QHBoxLayout(chk_widget)
        chk_layout.addWidget(chk)
        chk_layout.setAlignment(Qt.AlignCenter)
        chk_layout.setContentsMargins(0, 0, 0, 0)
        self.word_table.setCellWidget(row, 0, chk_widget)

        self.word_table.setItem(row, 1, QTableWidgetItem(name))
        self.word_table.setItem(row, 2, QTableWidgetItem(find))
        self.word_table.setItem(row, 3, QTableWidgetItem(replace))

    def _add_word_row(self) -> None:
        self._insert_word_row(True, "自定义替换", r"", "[已脱敏]")
        self.word_table.scrollToBottom()

    def _delete_word_row(self) -> None:
        row = self.word_table.currentRow()
        if row >= 0:
            self.word_table.removeRow(row)

    def _reset_to_defaults(self) -> None:
        reply = QMessageBox.question(
            self,
            "确认恢复默认",
            "是否恢复为系统内置的推荐脱敏规则与参数？",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply != QMessageBox.Yes:
            return

        # 默认词汇：仅通用图纸保密标记，不含企业公司名
        default_terms = [
            "CONFIDENTIAL",
            "PROPRIETARY",
            "RESTRICTED",
            "DO NOT COPY",
            "SECRET",
            "TOP SECRET",
            "COMPANY CONFIDENTIAL",
            "HELD IN STRICT CONFIDENCE",
            "RETAINED IN CONFIDENCE",
            "CONFIDENTIAL - THIS DOCUMENT",
            "CONFIDENTIAL - THIS DRAWING",
            "THIS DRAWING, INCLUDING THE INFORMATION",
            "THIS DOCUMENT, INCLUDING THE CONTENT",
        ]
        self.terms_edit.setPlainText("\n".join(default_terms))

        # 默认 PII
        self.pii_table.setRowCount(0)
        self._insert_pii_row(
            True,
            "身份证号 (18位/15位)",
            "个人隐私",
            r"(?<!\d)(?:[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]|[1-9]\d{14})(?!\d)",
        )
        self._insert_pii_row(True, "手机号码 (11位)", "个人隐私", r"(?<!\d)1[3-9]\d{9}(?!\d)")
        self._insert_pii_row(True, "固定电话/座机", "个人隐私", r"(?<!\d)0\d{2,3}-?\d{7,8}(?:-\d{1,4})?(?!\d)")
        self._insert_pii_row(True, "电子邮箱", "个人隐私", r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
        self._insert_pii_row(True, "银行卡号 (16-19位)", "财务敏感", r"(?<!\d)[1-9]\d{15,18}(?!\d)")
        self._insert_pii_row(
            True,
            "统一社会信用代码/税号",
            "企业敏感",
            r"(?<![0-9A-Za-z])[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}(?![0-9A-Za-z])",
        )

        # 默认印章
        self.chk_seal_enabled.setChecked(True)
        self.spin_min_area.setValue(1200)
        self.spin_max_area.setValue(350000)
        self.spin_circularity.setValue(0.45)

        # 默认设置
        self.combo_redact_mode.setCurrentIndex(0)
        self.spin_confidence.setValue(0.8)
        self.chk_enable_pii.setChecked(True)

    def _save_and_apply(self) -> None:
        self._save_rules()

    def _save_rules(self) -> None:
        try:
            # 1. 保存企业敏感词
            terms_text = self.terms_edit.toPlainText().strip()
            terms_lines = [line.strip() for line in terms_text.splitlines() if line.strip()]
            self._terms_path.parent.mkdir(parents=True, exist_ok=True)
            self._terms_path.write_text("\n".join(terms_lines), encoding="utf-8")

            # 2. 构造 PII 字典
            pii_rules: dict[str, Any] = {}
            for row in range(self.pii_table.rowCount()):
                chk_widget = self.pii_table.cellWidget(row, 0)
                enabled = True
                if chk_widget:
                    chk = chk_widget.findChild(QCheckBox)
                    if chk:
                        enabled = chk.isChecked()
                name = self.pii_table.item(row, 1).text().strip() if self.pii_table.item(row, 1) else f"rule_{row}"
                category = self.pii_table.item(row, 2).text().strip() if self.pii_table.item(row, 2) else "默认"
                pattern = self.pii_table.item(row, 3).text().strip() if self.pii_table.item(row, 3) else ""

                rule_key = f"rule_{row+1}"
                pii_rules[rule_key] = {
                    "name": name,
                    "category": category,
                    "pattern": pattern,
                    "enabled": enabled,
                }

            # 3. 构造印章规则
            seal_rules = {
                "red_seal": {
                    "name": "红色公章/印章检测 (HSV颜色模型)",
                    "enabled": self.chk_seal_enabled.isChecked(),
                    "min_area": self.spin_min_area.value(),
                    "max_area": self.spin_max_area.value(),
                    "circularity_thresh": self.spin_circularity.value(),
                }
            }

            # 4. 构造 Word 规则
            word_replace_rules = []
            for row in range(self.word_table.rowCount()):
                chk_widget = self.word_table.cellWidget(row, 0)
                enabled = True
                if chk_widget:
                    chk = chk_widget.findChild(QCheckBox)
                    if chk:
                        enabled = chk.isChecked()
                name = self.word_table.item(row, 1).text().strip() if self.word_table.item(row, 1) else f"word_{row}"
                find_str = self.word_table.item(row, 2).text().strip() if self.word_table.item(row, 2) else ""
                replace_str = self.word_table.item(row, 3).text() if self.word_table.item(row, 3) else ""
                word_replace_rules.append({
                    "name": name,
                    "find": find_str,
                    "replace": replace_str,
                    "mode": "regex",
                    "enabled": enabled,
                })

            # 5. 全局设置
            settings = {
                "redact_mode": self.combo_redact_mode.currentData(),
                "confidence_threshold": self.spin_confidence.value(),
                "enable_pii_detection": self.chk_enable_pii.isChecked(),
                "enable_seal_detection": self.chk_seal_enabled.isChecked(),
            }

            self._full_config = {
                "enterprise_terms": terms_lines,
                "pii_rules": pii_rules,
                "seal_rules": seal_rules,
                "word_replace_rules": word_replace_rules,
                "settings": settings,
            }

            self._pii_path.parent.mkdir(parents=True, exist_ok=True)
            self._pii_path.write_text(json.dumps(self._full_config, ensure_ascii=False, indent=2), encoding="utf-8")

            self.rules_updated.emit()
            self.accept()
        except Exception as e:
            QMessageBox.critical(self, "保存失败", f"无法写入规则配置文件:\n{e}")


# 保持与旧版导入别名兼容
UnifiedRuleDialog = RuleDialog
