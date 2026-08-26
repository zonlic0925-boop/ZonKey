from __future__ import annotations

import json
import logging
from pathlib import Path
from PyQt5.QtCore import Qt
from PyQt5.QtWidgets import (
    QCheckBox,
    QDialog,
    QHBoxLayout,
    QHeaderView,
    QLabel,
    QLineEdit,
    QMessageBox,
    QPushButton,
    QTableWidget,
    QTableWidgetItem,
    QTabWidget,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

logger = logging.getLogger(__name__)

TERMS_FILE = Path("rules/sensitive_terms.txt")
PII_FILE = Path("rules/pii_rules.json")


class UnifiedRuleDialog(QDialog):
    """统一脱敏规则与高级配置对话框 (支持敏感词表、PII 规则勾选/编辑、印章检测开关)。"""

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("统一脱敏规则与高级配置")
        self.resize(750, 560)
        self._pii_data: list[dict] = []
        self._build_ui()
        self._load_data()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)

        self.tabs = QTabWidget()

        # Tab 1: 敏感词表统一编辑 (工程/通用)
        tab_terms = QWidget()
        l_terms = QVBoxLayout(tab_terms)
        l_terms.addWidget(QLabel("敏感词表规则（每行一个敏感词或短语，支持以 # 开头的注释行）："))
        self.edit_terms = QTextEdit()
        self.edit_terms.setPlaceholderText("例如:\nCONFIDENTIAL\nPROPRIETARY\nRESTRICTED\nEmerson\nFisher Controls")
        l_terms.addWidget(self.edit_terms, 1)
        self.tabs.addTab(tab_terms, "🏭 敏感词表")

        # Tab 2: 隐私合规 (PII) 规则勾选与高级配置
        tab_pii = QWidget()
        l_pii = QVBoxLayout(tab_pii)

        # 顶部印章识别开关
        self.cb_seal = QCheckBox("🔴 启用红色印章视觉识别 (Seal Detection)")
        self.cb_seal.setChecked(True)
        self.cb_seal.setToolTip("自动定位图纸和通用文档中的公章、椭圆章并加入脱敏候选")
        l_pii.addWidget(self.cb_seal)

        l_pii.addWidget(QLabel("PII 规则识别项（支持快速勾选启用/禁用）："))
        self.table_pii = QTableWidget()
        self.table_pii.setColumnCount(4)
        self.table_pii.setHorizontalHeaderLabels(["启用", "规则名称", "正则表达式", "说明"])
        self.table_pii.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.table_pii.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeToContents)
        self.table_pii.horizontalHeader().setSectionResizeMode(2, QHeaderView.Stretch)
        self.table_pii.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
        l_pii.addWidget(self.table_pii, 1)

        # 高级源码编辑模式
        l_pii.addWidget(QLabel("PII 规则高级 JSON 配置定义："))
        self.edit_pii = QTextEdit()
        self.edit_pii.setMaximumHeight(140)
        l_pii.addWidget(self.edit_pii)

        self.tabs.addTab(tab_pii, "🛡️ 通用 PII 正则与印章")

        layout.addWidget(self.tabs)

        # 底部按钮条
        btn_bar = QHBoxLayout()
        btn_bar.addStretch(1)
        self.btn_save = QPushButton("💾 保存并应用配置")
        self.btn_save.clicked.connect(self._on_save)
        self.btn_cancel = QPushButton("取消")
        self.btn_cancel.clicked.connect(self.reject)
        btn_bar.addWidget(self.btn_save)
        btn_bar.addWidget(self.btn_cancel)
        layout.addLayout(btn_bar)

    def _load_data(self) -> None:
        if TERMS_FILE.is_file():
            try:
                self.edit_terms.setPlainText(TERMS_FILE.read_text(encoding="utf-8"))
            except Exception as e:
                logger.warning("读取 sensitive_terms.txt 失败: %s", e)

        if PII_FILE.is_file():
            try:
                raw_json = PII_FILE.read_text(encoding="utf-8")
                self.edit_pii.setPlainText(raw_json)
                self._pii_data = json.loads(raw_json)
                self._populate_pii_table()
            except Exception as e:
                logger.warning("读取 pii_rules.json 失败: %s", e)

    def _populate_pii_table(self) -> None:
        self.table_pii.setRowCount(len(self._pii_data))
        for row, rule in enumerate(self._pii_data):
            chk_item = QTableWidgetItem()
            chk_item.setFlags(Qt.ItemIsUserCheckable | Qt.ItemIsEnabled)
            chk_item.setCheckState(Qt.Checked if rule.get("enabled", True) else Qt.Unchecked)
            self.table_pii.setItem(row, 0, chk_item)

            name_item = QTableWidgetItem(str(rule.get("name", "")))
            self.table_pii.setItem(row, 1, name_item)

            pat_item = QTableWidgetItem(str(rule.get("pattern", "")))
            self.table_pii.setItem(row, 2, pat_item)

            desc_item = QTableWidgetItem(str(rule.get("description", "")))
            self.table_pii.setItem(row, 3, desc_item)

    def _sync_table_to_pii_data(self) -> None:
        new_data = []
        for row in range(self.table_pii.rowCount()):
            chk = self.table_pii.item(row, 0)
            name = self.table_pii.item(row, 1)
            pat = self.table_pii.item(row, 2)
            desc = self.table_pii.item(row, 3)
            is_enabled = chk.checkState() == Qt.Checked if chk else True
            new_data.append({
                "name": name.text() if name else "",
                "pattern": pat.text() if pat else "",
                "description": desc.text() if desc else "",
                "enabled": is_enabled,
            })
        self._pii_data = new_data
        self.edit_pii.setPlainText(json.dumps(new_data, ensure_ascii=False, indent=2))

    def _on_save(self) -> None:
        TERMS_FILE.parent.mkdir(parents=True, exist_ok=True)
        try:
            TERMS_FILE.write_text(self.edit_terms.toPlainText().strip(), encoding="utf-8")

            # 同步表格或高级编辑器的 PII json
            self._sync_table_to_pii_data()
            pii_content = self.edit_pii.toPlainText().strip()
            if pii_content:
                json.loads(pii_content)  # 验证合法性
                PII_FILE.write_text(pii_content, encoding="utf-8")

            QMessageBox.information(self, "成功", "规则配置已成功保存！")
            self.accept()
        except json.JSONDecodeError as err:
            QMessageBox.warning(self, "JSON 格式错误", f"PII 规则不是合法的 JSON 格式: {err}")
        except Exception as exc:
            QMessageBox.critical(self, "保存失败", f"保存配置时出错: {exc}")


RuleDialog = UnifiedRuleDialog
__all__ = ["UnifiedRuleDialog", "RuleDialog"]