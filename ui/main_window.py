"""PyQt5 主窗口：工程图纸脱敏工具（Apple HIG 风格）。

UI 只做展示与交互接线，不持有业务语义：
- 点击文件 = 纯预览（渲染源 PDF 页，不触发检测）；
- 检测 + 执行只发生在「一键脱敏」→ core.pipeline.Pipeline；
- 内置 Fisher / Emerson / TopWorx / MKS 词表与 Logo 模板（rules/ 真源）；
- 预览：脱敏前/脱敏后双视图，滚轮平移、Ctrl+滚轮/按钮缩放。
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import fitz
from PyQt5.QtCore import Qt, QThread, pyqtSignal
from PyQt5.QtGui import QColor, QFont, QKeySequence
from PyQt5.QtWidgets import (
    QApplication,
    QCheckBox,
    QDialog,
    QFileDialog,
    QFrame,
    QGroupBox,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QRadioButton,
    QShortcut,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)

from core.model import Box, RedactMode
from core.pipeline import Pipeline, PipelineConfig
from core.redact.executor import export_to_zip, output_path_for
from ui.preview import PreviewView, ZOOM_MAX, ZOOM_MIN
from ui.theme import THEME_QSS

logger = logging.getLogger(__name__)

COL_STATUS = 0
COL_PAGE = 1
COL_BOX = 2
COL_TERMS = 3
COL_CHANNELS = 4

BOX_ID_ROLE = Qt.UserRole

COLOR_AUTO = QColor(16, 185, 129)       # Apple Emerald — 自动执行
COLOR_MANUAL = QColor(239, 68, 68)     # Apple Coral — 待人工
COLOR_EXECUTED = QColor(0, 113, 227)   # Apple Tech Blue — 已执行

_APP_FONT = "SF Pro Display, SF Pro Text, PingFang SC, Segoe UI Variable Display, Segoe UI, Microsoft YaHei UI, sans-serif"

STATE_PENDING = "待处理"
STATE_RUNNING = "处理中"
STATE_DONE = "完成"
STATE_FAILED = "失败"


def get_default_output_dir() -> str:
    """获取安全的默认输出目录，避免系统目录写权限异常。"""
    candidates = []
    
    # 1. 优先使用当前模块所在项目的 output 目录
    try:
        proj_root = Path(__file__).resolve().parent.parent
        candidates.append(proj_root / "output")
    except Exception:
        pass
        
    # 2. 如果当前工作目录非系统敏感路径，使用 cwd / output
    try:
        cwd = Path.cwd()
        cwd_str = str(cwd).lower()
        if "system32" not in cwd_str and "windows" not in cwd_str:
            candidates.append(cwd / "output")
    except Exception:
        pass

    # 3. 回退至用户主目录下的输出路径
    try:
        candidates.append(Path.home() / "Documents" / "Desensitization_Output")
        candidates.append(Path.home() / "Desktop" / "Desensitization_Output")
        candidates.append(Path.home() / "Desensitization_Output")
    except Exception:
        pass

    for candidate in candidates:
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            test_file = candidate / ".write_test"
            test_file.touch()
            test_file.unlink()
            return str(candidate.resolve())
        except Exception:
            continue

    return str((Path.home() / "Desensitization_Output").resolve())


class OneClickWorker(QThread):
    """一键脱敏线程：串行检测+执行全部文件。

    一键模式 = 用户授权自动执行全部敏感命中（含待人工项）：
    confirm_box_ids 传全部 manual 框 id，核心 redact_result 语义不变。
    """

    file_done = pyqtSignal(str, object, str)
    all_done = pyqtSignal()

    def __init__(
        self,
        pipeline: Pipeline,
        files: list[str],
        mode: RedactMode,
        use_ocr: bool,
        output_dir: str | None = None,
    ):
        super().__init__()
        self._pipeline = pipeline
        self._files = list(files)
        self._mode = mode
        self._use_ocr = use_ocr
        self._output_dir = output_dir

    def run(self) -> None:
        for source in self._files:
            try:
                result = self._pipeline.process(source, with_ocr=self._use_ocr)
                manual_ids = {
                    rb.box_id
                    for rb in result.all_redact_boxes()
                    if rb.manual_required
                }
                out = output_path_for(source, out_dir=self._output_dir)
                audit = str(Path(out).with_name(f"{Path(out).stem}_audit.json"))
                self._pipeline.redact_result(
                    result, self._mode, output=out, audit_path=audit,
                    confirm_box_ids=manual_ids,
                )
                self.file_done.emit(source, result, "")
            except Exception as exc:  # noqa: BLE001
                self.file_done.emit(source, None, f"{type(exc).__name__}: {exc}")
        self.all_done.emit()


class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("工程图纸脱敏系统")
        self.resize(1480, 900)
        self._pipeline = Pipeline()
        self._result = None
        self._one_click: OneClickWorker | None = None
        self._batch_files: list[str] = []
        self._batch_status: dict[str, str] = {}
        self._results: dict[str, object] = {}
        self._selected_file: str | None = None
        self._preview_page_count = 0
        self._current_page = 0
        self._page_zoom = 1.0
        self._selected_box_id = None
        self._output_dir = get_default_output_dir()
        self._undo_stacks: dict[str, list[dict]] = {}
        self._redo_stacks: dict[str, list[dict]] = {}
        self._build_ui()

    # ---------- UI 构建 ----------

    def _build_ui(self) -> None:
        self.setStyleSheet(THEME_QSS)
        central = QWidget()
        root = QVBoxLayout(central)
        root.setContentsMargins(20, 16, 20, 16)
        root.setSpacing(14)

        root.addWidget(self._build_header())
        root.addLayout(self._build_toolbar())

        splitter = QSplitter(Qt.Horizontal)
        splitter.setHandleWidth(3)

        left_panel = QSplitter(Qt.Vertical)
        left_panel.setHandleWidth(3)
        left_panel.addWidget(self._wrap_card(self._build_file_panel(), "文件队列"))
        left_panel.addWidget(self._wrap_card(self._build_result_panel(), "处理结果"))
        left_panel.setSizes([320, 200])
        splitter.addWidget(left_panel)

        splitter.addWidget(self._wrap_card(self._build_view_panel(), "图纸预览"))
        splitter.addWidget(self._wrap_card(self._build_table_panel(), "敏感命中"))
        splitter.setSizes([280, 760, 400])
        root.addWidget(splitter, 1)

        root.addWidget(self._build_action_bar())
        self.setCentralWidget(central)
        self.statusBar().showMessage("引擎就绪 · 本地离线 · 内置 Fisher / Emerson / TopWorx / MKS 规则")

    def _wrap_card(self, inner: QWidget, title: str) -> QFrame:
        """Apple HIG 卡片容器：连续圆角 + 分层标题。"""
        card = QFrame()
        card.setObjectName("surfaceCard")
        card.setProperty("class", "card")
        layout = QVBoxLayout(card)
        layout.setContentsMargins(16, 14, 16, 14)
        layout.setSpacing(10)
        heading = QLabel(title)
        heading.setFont(QFont(_APP_FONT.split(",")[0], 13, QFont.DemiBold))
        heading.setStyleSheet("color: #0F172A; letter-spacing: -0.2px;")
        layout.addWidget(heading)
        layout.addWidget(inner, 1)
        return card

    def _build_header(self) -> QFrame:
        """顶部品牌区：大标题 + 聚焦留白。"""
        header = QFrame()
        header.setObjectName("brandHeaderFrame")
        row = QHBoxLayout(header)
        row.setContentsMargins(4, 4, 4, 8)
        row.setSpacing(16)

        title_col = QVBoxLayout()
        title_col.setSpacing(2)
        title = QLabel("工程图纸脱敏")
        title.setFont(QFont(_APP_FONT.split(",")[0], 22, QFont.Bold))
        title.setStyleSheet("color: #0F172A; letter-spacing: -0.6px;")
        subtitle = QLabel("本地离线 · Fisher · Emerson · TopWorx · MKS")
        subtitle.setFont(QFont(_APP_FONT.split(",")[1].strip(), 12))
        subtitle.setStyleSheet("color: #64748B;")
        title_col.addWidget(title)
        title_col.addWidget(subtitle)
        row.addLayout(title_col)
        row.addStretch(1)

        badge = QLabel("内置规则已启用")
        badge.setProperty("class", "badge-success")
        badge.setFont(QFont(_APP_FONT.split(",")[1].strip(), 11, QFont.DemiBold))
        row.addWidget(badge, alignment=Qt.AlignVCenter)
        return header

    def _build_toolbar(self) -> QHBoxLayout:
        bar = QHBoxLayout()
        bar.setSpacing(10)

        self._add_btn = QPushButton("添加 PDF")
        self._add_btn.setProperty("class", "secondary")
        self._add_btn.clicked.connect(self.on_add_files)
        bar.addWidget(self._add_btn)

        self._file_label = QLabel("未选择文件")
        self._file_label.setMinimumWidth(180)
        self._file_label.setStyleSheet("color: #475569; font-size: 12px;")
        bar.addWidget(self._file_label)
        bar.addSpacing(8)

        out_lbl = QLabel("输出")
        out_lbl.setStyleSheet("color: #64748B; font-size: 12px;")
        self._out_dir_label = QLabel(self._output_dir)
        self._out_dir_label.setStyleSheet("color: #0071E3; font-size: 12px;")
        self._out_dir_label.setToolTip(self._output_dir)
        self._out_dir_label.setMaximumWidth(240)
        self._choose_dir_btn = QPushButton("更改")
        self._choose_dir_btn.clicked.connect(self.on_choose_output_dir)
        bar.addWidget(out_lbl)
        bar.addWidget(self._out_dir_label)
        bar.addWidget(self._choose_dir_btn)
        bar.addSpacing(12)

        mode_box = QGroupBox("抹除模式")
        mode_layout = QHBoxLayout(mode_box)
        mode_layout.setContentsMargins(12, 6, 12, 6)
        self._mode_erase = QRadioButton("真删除")
        self._mode_cover = QRadioButton("黑块覆盖")
        self._mode_erase.setChecked(True)
        mode_layout.addWidget(self._mode_erase)
        mode_layout.addWidget(self._mode_cover)
        bar.addWidget(mode_box)

        self._ocr_check = QCheckBox("OCR 通道")
        self._ocr_check.setChecked(True)
        bar.addWidget(self._ocr_check)

        self._rules_btn = QPushButton("管理规则")
        self._rules_btn.setToolTip("查看、添加或修改敏感词表与 Logo 模板说明")
        self._rules_btn.clicked.connect(self.on_manage_rules)
        bar.addWidget(self._rules_btn)
        bar.addStretch(1)
        return bar

    def _build_file_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        hint = QLabel("点击文件即可预览，不触发检测")
        hint.setStyleSheet("color: #94A3B8; font-size: 11px;")
        layout.addWidget(hint)
        self._file_list = QListWidget()
        self._file_list.currentItemChanged.connect(self._on_file_selected)
        layout.addWidget(self._file_list, 1)
        return panel

    def _build_result_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        self._result_list = QListWidget()
        layout.addWidget(self._result_list, 1)
        return panel

    def _build_table_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        layout.setContentsMargins(0, 0, 0, 0)
        self._table = QTableWidget(0, 5)
        self._table.setHorizontalHeaderLabels(["状态", "页", "框坐标", "词条/证据", "通道"])
        self._table.horizontalHeader().setStretchLastSection(True)
        self._table.setSelectionBehavior(QTableWidget.SelectRows)
        self._table.setSelectionMode(QTableWidget.SingleSelection)
        self._table.itemSelectionChanged.connect(self._on_table_selection_changed)
        layout.addWidget(self._table, 1)

        ops = QHBoxLayout()
        ops.setSpacing(8)
        self._undo_btn = QPushButton("撤销")
        self._undo_btn.setToolTip("撤销上一步抹除框更改 (Ctrl+Z)")
        self._undo_btn.setEnabled(False)
        self._undo_btn.clicked.connect(self._on_undo)
        ops.addWidget(self._undo_btn)

        self._del_box_btn = QPushButton("取消选中")
        self._del_box_btn.setToolTip("移除选中的抹除框（Delete 键）")
        self._del_box_btn.setEnabled(False)
        self._del_box_btn.clicked.connect(self._on_delete_selected_box)
        ops.addWidget(self._del_box_btn)

        self._clear_all_btn = QPushButton("清空全部")
        self._clear_all_btn.setEnabled(False)
        self._clear_all_btn.clicked.connect(self._on_clear_all_boxes)
        ops.addWidget(self._clear_all_btn)

        self._apply_current_btn = QPushButton("立即脱敏当前")
        self._apply_current_btn.setProperty("class", "secondary")
        self._apply_current_btn.setEnabled(False)
        self._apply_current_btn.clicked.connect(self._on_apply_current_document)
        ops.addWidget(self._apply_current_btn)
        layout.addLayout(ops)
        return panel

    def _build_view_panel(self) -> QWidget:
        panel = QWidget()
        layout = QVBoxLayout(panel)
        nav = QHBoxLayout()
        self._prev_btn = QPushButton("上一页")
        self._next_btn = QPushButton("下一页")
        self._page_label = QLabel("页 0/0")
        self._prev_btn.setEnabled(False)
        self._next_btn.setEnabled(False)
        self._prev_btn.clicked.connect(lambda: self._goto_page(self._current_page - 1))
        self._next_btn.clicked.connect(lambda: self._goto_page(self._current_page + 1))
        nav.addWidget(self._prev_btn)
        nav.addWidget(self._page_label)
        nav.addWidget(self._next_btn)
        nav.addStretch(1)
        self._zoom_out_btn = QPushButton("缩小")
        self._zoom_fit_btn = QPushButton("适应窗口")
        self._zoom_in_btn = QPushButton("放大")
        self._zoom_out_btn.clicked.connect(lambda: self._on_zoom_requested(self._page_zoom / 1.25))
        self._zoom_fit_btn.clicked.connect(lambda: self._on_zoom_requested(1.0))
        self._zoom_in_btn.clicked.connect(lambda: self._on_zoom_requested(self._page_zoom * 1.25))
        nav.addWidget(self._zoom_out_btn)
        nav.addWidget(self._zoom_fit_btn)
        nav.addWidget(self._zoom_in_btn)
        self._zoom_label = QLabel("缩放 100%")
        nav.addWidget(self._zoom_label)

        nav.addSpacing(12)
        self._manual_draw_btn = QPushButton("手选抹除")
        self._manual_draw_btn.setCheckable(True)
        self._manual_draw_btn.setToolTip("在脱敏前图纸上拖拽画框，添加手动抹除区域")
        self._manual_draw_btn.toggled.connect(self._on_toggle_manual_draw)
        nav.addWidget(self._manual_draw_btn)
        layout.addLayout(nav)
        self._split_views = QSplitter(Qt.Horizontal)
        self._before_view = PreviewView("脱敏前")
        self._after_view = PreviewView("脱敏后")
        # 视口平移滚动条双向实时联动绑定
        self._before_view.horizontalScrollBar().valueChanged.connect(
            self._after_view.horizontalScrollBar().setValue
        )
        self._after_view.horizontalScrollBar().valueChanged.connect(
            self._before_view.horizontalScrollBar().setValue
        )
        self._before_view.verticalScrollBar().valueChanged.connect(
            self._after_view.verticalScrollBar().setValue
        )
        self._after_view.verticalScrollBar().valueChanged.connect(
            self._before_view.verticalScrollBar().setValue
        )
        self._split_views.addWidget(self._before_view)
        self._split_views.addWidget(self._after_view)
        self._split_views.setSizes([360, 360])
        layout.addWidget(self._split_views, 1)
        self._before_view.zoom_requested.connect(self._on_zoom_requested)
        self._after_view.zoom_requested.connect(self._on_zoom_requested)
        self._before_view.manual_rect_created.connect(self._on_manual_box_drawn)
        self._before_view.box_clicked.connect(self._on_view_box_clicked)
        self._after_view.box_clicked.connect(self._on_view_box_clicked)

        # 快捷键支持：Ctrl+Z 撤销，Delete 取消选中抹除框
        self._shortcut_undo = QShortcut(QKeySequence.Undo, self)
        self._shortcut_undo.activated.connect(self._on_undo)
        self._shortcut_del = QShortcut(QKeySequence.Delete, self)
        self._shortcut_del.activated.connect(self._on_delete_selected_box)

        return panel

    def _build_action_bar(self) -> QFrame:
        """底部主操作岛：聚焦一键脱敏。"""
        bar_frame = QFrame()
        bar_frame.setObjectName("floatingPill")
        bar = QHBoxLayout(bar_frame)
        bar.setContentsMargins(16, 10, 16, 10)
        bar.setSpacing(12)

        self._run_all_btn = QPushButton("一键脱敏")
        self._run_all_btn.setObjectName("btnOneClick")
        self._run_all_btn.setProperty("class", "primary")
        self._run_all_btn.setFont(QFont(_APP_FONT.split(",")[0], 14, QFont.Bold))
        self._run_all_btn.setMinimumHeight(44)
        self._run_all_btn.setEnabled(False)
        self._run_all_btn.clicked.connect(self.on_one_click)
        bar.addWidget(self._run_all_btn, 3)

        self._export_zip_btn = QPushButton("打包导出 ZIP")
        self._export_zip_btn.setEnabled(False)
        self._export_zip_btn.clicked.connect(self.on_export_zip)
        bar.addWidget(self._export_zip_btn, 1)
        return bar_frame

    # ---------- 文件队列与一键脱敏 ----------

    def on_manage_rules(self) -> None:
        terms_path = Path("rules/sensitive_terms.txt").resolve()
        generic_template = (
            "# 工程图纸脱敏 — 内置企业敏感词表\n"
            "# 每行一个敏感词/声明短语（不区分大小写，支持 # 注释）\n\n"
            "# --- Fisher Controls ---\n"
            "Fisher Controls Intl. LLC\n"
            "Fisher Controls International LLC\n"
            "Fisher Controls\n"
            "FISHER\n"
            "PROPERTY OF FISHER CONTROLS\n\n"
            "# --- Emerson ---\n"
            "Emerson Process Management\n"
            "Emerson Electric Co\n"
            "Emerson Louisville, Kentucky, USA\n"
            "EMERSON\n"
            "PROPERTY OF EMERSON\n\n"
            "# --- TopWorx ---\n"
            "TopWorx, Inc.\n"
            "TopWorx\n"
            "TOPWORX\n"
            "PROPERTY OF TOPWORX\n\n"
            "# --- MKS ---\n"
            "MKS\n\n"
            "# --- 通用保密标记 ---\n"
            "CONFIDENTIAL\n"
            "PROPRIETARY\n"
            "RESTRICTED\n"
            "DO NOT COPY\n"
            "SECRET\n"
            "HELD IN STRICT CONFIDENCE\n"
            "RETAINED IN CONFIDENCE\n"
        )
        initial_text = ""
        if terms_path.is_file():
            try:
                initial_text = terms_path.read_text(encoding="utf-8")
            except Exception as exc:
                logger.warning("读取规则文件失败: %s", exc)

        if not initial_text.strip():
            initial_text = generic_template

        dlg = QDialog(self)
        dlg.setWindowTitle("脱敏规则管理")
        dlg.resize(580, 480)
        dlg_layout = QVBoxLayout(dlg)

        tip_lbl = QLabel(
            "编辑敏感词表（每行一条，支持 # 注释）。\n"
            "Logo 模板位于 rules/logos/ 目录（Fisher / Emerson / TopWorx），保存后立即热重载。"
        )
        tip_lbl.setStyleSheet("color: #64748B; font-size: 12px; margin-bottom: 4px;")
        dlg_layout.addWidget(tip_lbl)

        text_edit = QTextEdit()
        text_edit.setPlainText(initial_text)
        dlg_layout.addWidget(text_edit, 1)

        btn_box = QHBoxLayout()
        reset_btn = QPushButton("恢复内置企业规则")
        reset_btn.setToolTip("恢复 Fisher / Emerson / TopWorx / MKS 及通用保密词")
        save_btn = QPushButton("💾 保存规则")
        cancel_btn = QPushButton("取消")
        save_btn.setFont(QFont("", 10, QFont.Bold))
        btn_box.addWidget(reset_btn)
        btn_box.addStretch(1)
        btn_box.addWidget(save_btn)
        btn_box.addWidget(cancel_btn)
        dlg_layout.addLayout(btn_box)

        def _do_reset():
            text_edit.setPlainText(generic_template)

        reset_btn.clicked.connect(_do_reset)

        def _do_save():
            content = text_edit.toPlainText().strip()
            if not content:
                QMessageBox.warning(dlg, "提示", "规则词表不能为空！")
                return
            try:
                # 确保上层目录存在，避免对已存在的目录重复 mkdir 触发 Windows WinError 5
                parent_dir = terms_path.parent
                if not parent_dir.exists():
                    parent_dir.mkdir(parents=True, exist_ok=True)
                terms_path.write_text(content, encoding="utf-8")
                # 重新加载规则引擎（热重载）
                self._pipeline = Pipeline()
                QMessageBox.information(dlg, "保存成功", "脱敏规则已保存并已实时热重载！")
                dlg.accept()
            except Exception as e:
                QMessageBox.critical(dlg, "错误", f"保存规则失败: {e}")

        save_btn.clicked.connect(_do_save)
        cancel_btn.clicked.connect(dlg.reject)
        dlg.exec_()

    def on_choose_output_dir(self) -> None:
        target = QFileDialog.getExistingDirectory(
            self, "选择脱敏图纸输出目录", self._output_dir
        )
        if not target:
            return
        self._output_dir = str(Path(target).resolve())
        self._out_dir_label.setText(self._output_dir)
        self._out_dir_label.setToolTip(self._output_dir)

    def on_add_files(self) -> None:
        paths, _ = QFileDialog.getOpenFileNames(
            self, "选择 PDF 图纸（可多选）", "", "PDF 文件 (*.pdf)"
        )
        if not paths:
            return
        for p in paths:
            self._add_file(p)

    def _add_file(self, path: str) -> None:
        resolved = str(Path(path).resolve())
        if resolved in self._batch_files:
            return
        self._batch_files.append(resolved)
        self._batch_status[resolved] = STATE_PENDING
        item = QListWidgetItem(f"{Path(resolved).name} — {STATE_PENDING}")
        item.setData(Qt.UserRole, resolved)
        self._file_list.addItem(item)
        self._run_all_btn.setEnabled(True)
        if len(self._batch_files) == 1:
            self._file_list.setCurrentRow(0)

    def on_one_click(self) -> None:
        pending = [p for p in self._batch_files
                   if self._batch_status.get(p) in (STATE_PENDING, STATE_FAILED)]
        if not pending:
            QMessageBox.information(self, "一键脱敏", "所有文件已处理完成")
            return
        mode = RedactMode.COVER if self._mode_cover.isChecked() else RedactMode.ERASE
        for p in pending:
            self._batch_status[p] = STATE_RUNNING
            self._refresh_file_item(p)
        self._set_busy(True, "正在一键脱敏…")
        self._one_click = OneClickWorker(
            self._pipeline,
            pending,
            mode,
            self._ocr_check.isChecked(),
            output_dir=self._output_dir,
        )
        self._one_click.file_done.connect(self._on_one_click_done)
        self._one_click.all_done.connect(self._on_one_click_all_done)
        self._one_click.start()

    def _on_one_click_done(self, path: str, result, error: str) -> None:
        if error:
            self._batch_status[path] = STATE_FAILED
            self._refresh_file_item(path)
            self._append_result_row(path, f"失败: {error}")
            return
        self._results[path] = result
        n = len(result.all_redact_boxes())
        self._batch_status[path] = STATE_DONE
        self._refresh_file_item(path)
        if result.output_path:
            self._append_result_row(path, f"输出: {Path(result.output_path).name}（敏感项 {n} 全部执行）")
        else:
            self._append_result_row(path, "无敏感命中，未生成输出文件")
        if path == self._selected_file:
            self._show_result(result)

    def _on_one_click_all_done(self) -> None:
        self._set_busy(False, "")
        n_ok = sum(1 for p in self._batch_files
                   if self._batch_status.get(p) == STATE_DONE)
        n_fail = sum(1 for p in self._batch_files
                     if self._batch_status.get(p) == STATE_FAILED)
        msg = f"一键脱敏完成：成功 {n_ok} 个，失败 {n_fail} 个"
        self.statusBar().showMessage(msg)
        if self._selected_file and self._selected_file in self._results:
            self._show_result(self._results[self._selected_file])
        has_outputs = any(
            bool(r.output_path)
            for r in self._results.values()
            if r is not None and r.output_path
        )
        self._export_zip_btn.setEnabled(has_outputs)
        QMessageBox.information(self, "一键脱敏", msg)
        if self._selected_file is None and self._batch_files:
            self._file_list.setCurrentRow(0)  # 自动展示第一个结果

    def on_export_zip(self) -> None:
        outputs = [
            r.output_path
            for r in self._results.values()
            if r is not None and r.output_path and Path(r.output_path).exists()
        ]
        if not outputs:
            QMessageBox.information(self, "打包导出", "当前没有可导出的脱敏文件")
            return
        default_zip = str(Path(self._output_dir) / "desensitized_drawings.zip")
        zip_path, _ = QFileDialog.getSaveFileName(
            self, "导出为 ZIP 压缩包", default_zip, "ZIP 压缩包 (*.zip)"
        )
        if not zip_path:
            return
        try:
            export_to_zip(outputs, zip_path)
            QMessageBox.information(
                self, "导出成功", f"已成功打包 {len(outputs)} 个文件至：\n{zip_path}"
            )
            self.statusBar().showMessage(f"已导出 ZIP 压缩包: {Path(zip_path).name}")
        except Exception as exc:  # noqa: BLE001
            QMessageBox.critical(self, "导出失败", f"打包 ZIP 发生错误：\n{exc}")

    def _append_result_row(self, path: str, text: str) -> None:
        item = QListWidgetItem(f"{Path(path).name}: {text}")
        self._result_list.addItem(item)
        self._result_list.scrollToBottom()

    def _on_file_selected(self, current: QListWidgetItem | None, _prev) -> None:
        if current is None:
            return
        path = current.data(Qt.UserRole)
        if path == self._selected_file:
            return
        self._selected_file = path
        self._file_label.setText(Path(path).name)
        if path in self._results:
            self._show_result(self._results[path])
        else:
            self._show_source_preview(path)

    def _show_source_preview(self, path: str) -> None:
        """点击文件：仅渲染源 PDF 预览，不触发检测（检测/执行只在「一键脱敏」）。"""
        self._result = None
        self._selected_box_id = None
        self._table.setRowCount(0)
        try:
            doc = fitz.open(path)
            self._preview_page_count = doc.page_count
            doc.close()
        except Exception as exc:  # noqa: BLE001
            self._preview_page_count = 0
            QMessageBox.critical(self, "预览失败", f"{type(exc).__name__}: {exc}")
            return
        self._current_page = 0
        self._goto_page(0)
        has_undo = bool(self._undo_stacks.get(path, []))
        has_redo = bool(self._redo_stacks.get(path, []))
        if hasattr(self, "_undo_btn"):
            self._undo_btn.setEnabled(has_undo)
        if hasattr(self, "_redo_btn"):
            self._redo_btn.setEnabled(has_redo)
        self.statusBar().showMessage("已预览：点击「一键脱敏」开始检测与执行")

    def _refresh_file_item(self, path: str) -> None:
        for i in range(self._file_list.count()):
            item = self._file_list.item(i)
            if item.data(Qt.UserRole) == path:
                item.setText(f"{Path(path).name} — {self._batch_status.get(path, STATE_PENDING)}")
                return

    # ---------- 结果展示 ----------

    def _show_result(self, result) -> None:
        """展示检测结果：清单填充 + 预览切换（保留按钮忙碌状态由调用方决定）。"""
        self._result = result
        self._selected_box_id = None
        self._current_page = 0
        self._fill_table()
        self._goto_page(0)
        n = len(result.all_redact_boxes())
        self.statusBar().showMessage(
            f"检测完成：敏感项 {n} 个（一键脱敏将全部执行）"
        )

    def _set_busy(self, busy: bool, msg: str) -> None:
        self._add_btn.setEnabled(not busy)
        self._run_all_btn.setEnabled(not busy and bool(self._batch_files))
        if busy:
            self.statusBar().showMessage(msg)

    # ---------- 清单与渲染 ----------

    def _fill_table(self) -> None:
        assert self._result is not None
        boxes = self._result.all_redact_boxes()
        self._table.setRowCount(len(boxes))
        for row, rb in enumerate(boxes):
            cells = [
                "已执行" if self._batch_status.get(self._result.source_path) == STATE_DONE
                else ("待人工(一键执行)" if rb.manual_required else "自动执行"),
                str(rb.page_index + 1),
                f"({rb.box.x0:.0f},{rb.box.y0:.0f})-({rb.box.x1:.0f},{rb.box.y1:.0f})",
                ", ".join(rb.terms) if rb.terms else "(图片/未命中词条)",
                ", ".join(rb.channel_labels),
            ]
            for col, text in enumerate(cells):
                item = QTableWidgetItem(text)
                item.setData(Qt.UserRole, rb.box_id)
                if rb.manual_required:
                    item.setForeground(COLOR_MANUAL)
                elif rb.boxed:
                    item.setForeground(COLOR_AUTO)
                self._table.setItem(row, col, item)
        # 更新操作按钮使能状态
        has_boxes = len(boxes) > 0
        if hasattr(self, "_clear_all_btn"):
            self._clear_all_btn.setEnabled(has_boxes)
        if hasattr(self, "_apply_current_btn"):
            self._apply_current_btn.setEnabled(True)

    def _on_table_selection_changed(self) -> None:
        selected_rows = self._table.selectionModel().selectedRows()
        if not selected_rows:
            self._selected_box_id = None
            if hasattr(self, "_del_box_btn"):
                self._del_box_btn.setEnabled(False)
            return
        row = selected_rows[0].row()
        item = self._table.item(row, 0)
        if item:
            self._selected_box_id = item.data(Qt.UserRole)
            if hasattr(self, "_del_box_btn"):
                self._del_box_btn.setEnabled(bool(self._selected_box_id))

    def _goto_page(self, page_index: int) -> None:
        if self._result is not None:
            count = len(self._result.pages)
        else:
            count = self._preview_page_count
        if not (0 <= page_index < count):
            return
        self._current_page = page_index
        self._prev_btn.setEnabled(page_index > 0)
        self._next_btn.setEnabled(page_index < count - 1)
        self._page_label.setText(f"页 {page_index + 1}/{count}")
        self._render_page(page_index)

    def _render_page(self, page_index: int) -> None:
        if self._result is not None:
            overlay = []
            for rb in self._result.pages[page_index].redact_boxes:
                if rb.manual_required:
                    color = COLOR_MANUAL
                elif rb.boxed:
                    color = COLOR_AUTO
                else:
                    color = COLOR_EXECUTED
                is_selected = bool(self._selected_box_id and rb.box_id == self._selected_box_id)
                overlay.append((rb.box, color, is_selected))
            self._before_view.set_content(
                self._result.source_path, page_index, self._page_zoom, overlay
            )
            # 右侧脱敏后视图：若已生成 output_path 则加载并显示叠加框；未生成则清空
            after_path = self._result.output_path
            self._after_view.set_content(
                after_path, page_index, self._page_zoom, overlay if after_path else None
            )
        elif self._selected_file:
            self._before_view.set_content(
                self._selected_file, page_index, self._page_zoom
            )
            self._after_view.set_content(None, 0, self._page_zoom)
        self._zoom_label.setText(f"缩放 {self._page_zoom:.0%}")

    def _on_zoom_requested(self, zoom: float) -> None:
        self._page_zoom = max(ZOOM_MIN, min(zoom, ZOOM_MAX))
        if self._result is not None or self._selected_file:
            self._render_page(self._current_page)

    def _on_toggle_manual_draw(self, checked: bool) -> None:
        self._before_view.set_manual_draw_mode(checked)
        if checked:
            self.statusBar().showMessage("已开启框选抹除：请在脱敏前图纸上按住鼠标左键拖拽画框")
        else:
            self.statusBar().showMessage("已关闭框选抹除")

    def _record_history_state(self) -> None:
        """记录当前图纸的抹除框快照，用于撤销/重做。"""
        if not self._selected_file or self._result is None:
            return
        # 序列化当前所有页的抹除框
        snapshot = {
            "output_path": self._result.output_path,
            "pages": [
                [
                    {
                        "box_id": rb.box_id,
                        "page_index": rb.page_index,
                        "x0": rb.box.x0,
                        "y0": rb.box.y0,
                        "x1": rb.box.x1,
                        "y1": rb.box.y1,
                        "boxed": rb.boxed,
                        "manual_required": rb.manual_required,
                        "channel_labels": list(rb.channel_labels),
                        "terms": list(rb.terms),
                        "redact_graphics": rb.redact_graphics,
                    }
                    for rb in page.redact_boxes
                ]
                for page in self._result.pages
            ]
        }
        stack = self._undo_stacks.setdefault(self._selected_file, [])
        stack.append(snapshot)
        if len(stack) > 50:
            stack.pop(0)
        # 产生新操作时清空 redo
        self._redo_stacks.setdefault(self._selected_file, []).clear()
        if hasattr(self, "_undo_btn"):
            self._undo_btn.setEnabled(True)

    def _apply_snapshot(self, snapshot: dict) -> None:
        """从快照恢复抹除框状态。"""
        if not self._selected_file or self._result is None:
            return
        from core.model import RedactBox
        self._result.output_path = snapshot.get("output_path")
        for p_idx, p_data in enumerate(snapshot.get("pages", [])):
            if p_idx < len(self._result.pages):
                boxes = []
                for b_dict in p_data:
                    rb = RedactBox(
                        box_id=b_dict["box_id"],
                        page_index=b_dict["page_index"],
                        box=Box(b_dict["x0"], b_dict["y0"], b_dict["x1"], b_dict["y1"]),
                        boxed=b_dict["boxed"],
                        manual_required=b_dict["manual_required"],
                        channel_labels=b_dict["channel_labels"],
                        terms=b_dict["terms"],
                        redact_graphics=b_dict.get("redact_graphics", True),
                    )
                    boxes.append(rb)
                self._result.pages[p_idx].redact_boxes = boxes
        self._selected_box_id = None
        if hasattr(self, "_del_box_btn"):
            self._del_box_btn.setEnabled(False)
        self._fill_table()
        self._auto_update_redaction_if_needed()
        self._render_page(self._current_page)

    def _on_undo(self) -> None:
        """撤销上一次框选/删除操作 (Ctrl+Z)。"""
        if not self._selected_file or self._result is None:
            return
        stack = self._undo_stacks.get(self._selected_file, [])
        if not stack:
            self.statusBar().showMessage("没有可撤销的操作")
            return
        # 记录当前状态到 redo 栈
        curr_snapshot = {
            "output_path": self._result.output_path,
            "pages": [
                [
                    {
                        "box_id": rb.box_id,
                        "page_index": rb.page_index,
                        "x0": rb.box.x0,
                        "y0": rb.box.y0,
                        "x1": rb.box.x1,
                        "y1": rb.box.y1,
                        "boxed": rb.boxed,
                        "manual_required": rb.manual_required,
                        "channel_labels": list(rb.channel_labels),
                        "terms": list(rb.terms),
                        "redact_graphics": rb.redact_graphics,
                    }
                    for rb in page.redact_boxes
                ]
                for page in self._result.pages
            ]
        }
        self._redo_stacks.setdefault(self._selected_file, []).append(curr_snapshot)
        if hasattr(self, "_redo_btn"):
            self._redo_btn.setEnabled(True)
        prev_snapshot = stack.pop()
        if not stack and hasattr(self, "_undo_btn"):
            self._undo_btn.setEnabled(False)
        self._apply_snapshot(prev_snapshot)
        self.statusBar().showMessage("已撤销上一次操作 (Ctrl+Z)")

    def _on_redo(self) -> None:
        """重做上一次撤销的操作 (Ctrl+Y / Ctrl+Shift+Z)。"""
        if not self._selected_file or self._result is None:
            return
        stack = self._redo_stacks.get(self._selected_file, [])
        if not stack:
            self.statusBar().showMessage("没有可重做的操作")
            return
        curr_snapshot = {
            "output_path": self._result.output_path,
            "pages": [
                [
                    {
                        "box_id": rb.box_id,
                        "page_index": rb.page_index,
                        "x0": rb.box.x0,
                        "y0": rb.box.y0,
                        "x1": rb.box.x1,
                        "y1": rb.box.y1,
                        "boxed": rb.boxed,
                        "manual_required": rb.manual_required,
                        "channel_labels": list(rb.channel_labels),
                        "terms": list(rb.terms),
                        "redact_graphics": rb.redact_graphics,
                    }
                    for rb in page.redact_boxes
                ]
                for page in self._result.pages
            ]
        }
        self._undo_stacks.setdefault(self._selected_file, []).append(curr_snapshot)
        if hasattr(self, "_undo_btn"):
            self._undo_btn.setEnabled(True)
        next_snapshot = stack.pop()
        if not stack and hasattr(self, "_redo_btn"):
            self._redo_btn.setEnabled(False)
        self._apply_snapshot(next_snapshot)
        self.statusBar().showMessage("已重做操作 (Ctrl+Y)")

    def _auto_update_redaction_if_needed(self) -> None:
        """自动执行增量更新并即时刷新脱敏图纸效果。"""
        if not self._selected_file or self._result is None:
            return
        target = self._result.output_path or output_path_for(self._selected_file, out_dir=self._output_dir)
        try:
            mode = RedactMode.COVER if self._mode_cover.isChecked() else RedactMode.ERASE
            confirm_ids = {b.box_id for b in self._result.all_redact_boxes()}
            self._pipeline.redact_result(
                self._result, mode=mode, output=target, confirm_box_ids=confirm_ids
            )
            self._batch_status[self._selected_file] = STATE_DONE
        except Exception as ex:
            logger.warning("自动增量更新脱敏图纸失败: %s", ex)

    def _on_manual_box_drawn(self, x0: float, y0: float, x1: float, y1: float) -> None:
        if not self._selected_file:
            QMessageBox.information(self, "提示", "请先选择图纸文件")
            return
        box = Box(x0=x0, y0=y0, x1=x1, y1=y1)
        if self._result is None:
            # Create a clean FileResult
            self._result = self._pipeline.create_manual_result(self._selected_file)
            self._results[self._selected_file] = self._result

        self._record_history_state()
        # Add box to current page
        self._pipeline.add_manual_box(self._result, self._current_page, box)
        self._manual_draw_btn.setChecked(False)
        self._before_view.set_manual_draw_mode(False)
        self._fill_table()
        # 确保只要存在抹除框，就自动执行脱敏图纸增量更新
        self._auto_update_redaction_if_needed()
        self._render_page(self._current_page)
        self.statusBar().showMessage(
            f"已添加手动抹除区域：({x0:.0f}, {y0:.0f})-({x1:.0f}, {y1:.0f})，效果已实时同步至脱敏图纸（支持 Ctrl+Z 撤销）"
        )

    def _sync_view_selection(self) -> None:
        self._render_page(self._current_page)

    def _on_view_box_clicked(self, x: float, y: float) -> None:
        if self._result is None:
            return
        page_boxes = self._result.pages[self._current_page].redact_boxes
        # 查找包含该点击坐标的最小抹除框
        matched_box = None
        matched_area = float("inf")
        for rb in page_boxes:
            b = rb.box
            if b.x0 <= x <= b.x1 and b.y0 <= y <= b.y1:
                area = (b.x1 - b.x0) * (b.y1 - b.y0)
                if area < matched_area:
                    matched_box = rb
                    matched_area = area
        if matched_box is not None:
            self._selected_box_id = matched_box.box_id
            if hasattr(self, "_del_box_btn"):
                self._del_box_btn.setEnabled(True)
            self._sync_view_selection()
            # 高亮表格中的对应行
            for row in range(self._table.rowCount()):
                item = self._table.item(row, 0)
                if item and item.data(Qt.UserRole) == matched_box.box_id:
                    self._table.selectRow(row)
                    break
            self.statusBar().showMessage(
                f"已选中抹除框 [{matched_box.box_id[:8]}]，按「取消选中抹除」或 Delete 键可删除"
            )

    def _on_delete_selected_box(self) -> None:
        if self._result is None or not self._selected_box_id:
            QMessageBox.information(self, "提示", "请先在敏感项列表或图纸上点击选中要取消/删除的区域")
            return
        self._record_history_state()
        removed = self._pipeline.remove_box(self._result, self._selected_box_id)
        if removed:
            self._selected_box_id = None
            if hasattr(self, "_del_box_btn"):
                self._del_box_btn.setEnabled(False)
            self._auto_update_redaction_if_needed()
            self._fill_table()
            self._render_page(self._current_page)
            self.statusBar().showMessage("已取消抹除该区域并实时更新脱敏图纸（支持 Ctrl+Z 撤销）")
        else:
            QMessageBox.warning(self, "提示", "未找到选中的区域")

    def _on_clear_all_boxes(self) -> None:
        if self._result is None:
            return
        total = len(self._result.all_redact_boxes())
        if total == 0:
            return
        reply = QMessageBox.question(
            self,
            "确认清空",
            f"确定要取消当前图纸全部 {total} 个抹除区域吗？",
            QMessageBox.Yes | QMessageBox.No,
            QMessageBox.No,
        )
        if reply == QMessageBox.Yes:
            self._record_history_state()
            self._pipeline.clear_boxes(self._result)
            self._selected_box_id = None
            if hasattr(self, "_del_box_btn"):
                self._del_box_btn.setEnabled(False)
            self._auto_update_redaction_if_needed()
            self._fill_table()
            self._render_page(self._current_page)
            self.statusBar().showMessage("已清空抹除区域并实时更新脱敏图纸（支持 Ctrl+Z 撤销）")

    def _on_apply_current_document(self) -> None:
        if self._result is None or not self._selected_file:
            QMessageBox.information(self, "提示", "请先选择并识别图纸")
            return
        out_dir = self._output_dir
        target = output_path_for(self._selected_file, out_dir=out_dir)
        try:
            self.statusBar().showMessage(f"正在生成当前脱敏图纸 -> {Path(target).name} ...")
            mode = RedactMode.COVER if self._mode_cover.isChecked() else RedactMode.ERASE
            self._pipeline.redact_result(self._result, mode=mode, output=target)
            self._batch_status[self._selected_file] = STATE_DONE
            self._fill_table()
            self._render_page(self._current_page)
            self.statusBar().showMessage(f"脱敏成功: 已输出至 {target}")
            QMessageBox.information(self, "脱敏成功", f"脱敏图纸已成功保存至:\n{target}")
        except Exception as ex:
            self.statusBar().showMessage(f"脱敏失败: {ex}")
            QMessageBox.critical(self, "脱敏失败", f"生成脱敏图纸失败:\n{ex}")

    def keyPressEvent(self, event) -> None:  # noqa: N802
        if event.matches(QKeySequence.Undo):
            self._on_undo()
            event.accept()
            return
        if event.matches(QKeySequence.Redo):
            self._on_redo()
            event.accept()
            return
        if event.key() == Qt.Key_Delete and self._selected_box_id:
            self._on_delete_selected_box()
            event.accept()
            return
        super().keyPressEvent(event)

    def closeEvent(self, event) -> None:  # noqa: N802
        self._before_view.shutdown()
        self._after_view.shutdown()
        super().closeEvent(event)


def run_app() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    app = QApplication(sys.argv)
    win = MainWindow()
    win.show()
    return app.exec_()


if __name__ == "__main__":
    sys.exit(run_app())