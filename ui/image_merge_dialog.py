from __future__ import annotations

import logging
from pathlib import Path
from PyQt5.QtCore import Qt
from PyQt5.QtWidgets import (
    QAbstractItemView,
    QDialog,
    QFileDialog,
    QHBoxLayout,
    QLabel,
    QListWidget,
    QListWidgetItem,
    QMessageBox,
    QProgressBar,
    QPushButton,
    QVBoxLayout,
    QWidget,
)

from core.converter import merge_images_to_pdf

logger = logging.getLogger(__name__)


class ImageMergeDialog(QDialog):
    """图片快速合并为 PDF 交互工具弹窗（支持多图添加、拖拽/按钮调整顺序与生成合并 PDF）。"""

    def __init__(self, parent: QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("图片合并为 PDF 工具")
        self.resize(620, 480)
        self._output_pdf: str | None = None
        self._build_ui()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)

        self.lbl_info = QLabel("请添加需要按顺序合并为单个 PDF 的图片文件（支持 JPG, PNG, BMP, TIFF, WebP）：")
        layout.addWidget(self.lbl_info)

        # 图片列表，支持拖拽调整排序
        self.list_widget = QListWidget()
        self.list_widget.setDragDropMode(QAbstractItemView.InternalMove)
        self.list_widget.setDefaultDropAction(Qt.MoveAction)
        layout.addWidget(self.list_widget, 1)

        # 列表操作按钮
        btn_list_layout = QHBoxLayout()
        self.btn_add = QPushButton("➕ 添加图片")
        self.btn_add.clicked.connect(self._on_add_images)
        self.btn_up = QPushButton("⬆️ 上移")
        self.btn_up.clicked.connect(self._on_move_up)
        self.btn_down = QPushButton("⬇️ 下移")
        self.btn_down.clicked.connect(self._on_move_down)
        self.btn_remove = QPushButton("➖ 移除选中")
        self.btn_remove.clicked.connect(self._on_remove_selected)
        self.btn_clear = QPushButton("🗑️ 清空列表")
        self.btn_clear.clicked.connect(self.list_widget.clear)

        btn_list_layout.addWidget(self.btn_add)
        btn_list_layout.addWidget(self.btn_up)
        btn_list_layout.addWidget(self.btn_down)
        btn_list_layout.addWidget(self.btn_remove)
        btn_list_layout.addWidget(self.btn_clear)
        layout.addLayout(btn_list_layout)

        # 进度条
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        layout.addWidget(self.progress_bar)

        # 底部执行按钮条
        bottom_bar = QHBoxLayout()
        bottom_bar.addStretch(1)
        self.btn_merge = QPushButton("🚀 开始合并并保存为 PDF")
        self.btn_merge.clicked.connect(self._on_merge)
        self.btn_close = QPushButton("关闭")
        self.btn_close.clicked.connect(self.reject)
        bottom_bar.addWidget(self.btn_merge)
        bottom_bar.addWidget(self.btn_close)
        layout.addLayout(bottom_bar)

    def _on_add_images(self) -> None:
        files, _ = QFileDialog.getOpenFileNames(
            self,
            "选择图片文件",
            "",
            "图片文件 (*.png *.jpg *.jpeg *.bmp *.tiff *.webp);;所有文件 (*.*)",
        )
        for f in files:
            self.list_widget.addItem(QListWidgetItem(f))

    def _on_move_up(self) -> None:
        row = self.list_widget.currentRow()
        if row > 0:
            item = self.list_widget.takeItem(row)
            self.list_widget.insertItem(row - 1, item)
            self.list_widget.setCurrentRow(row - 1)

    def _on_move_down(self) -> None:
        row = self.list_widget.currentRow()
        if row >= 0 and row < self.list_widget.count() - 1:
            item = self.list_widget.takeItem(row)
            self.list_widget.insertItem(row + 1, item)
            self.list_widget.setCurrentRow(row + 1)

    def _on_remove_selected(self) -> None:
        for item in self.list_widget.selectedItems():
            self.list_widget.takeItem(self.list_widget.row(item))

    def get_images(self) -> list[str]:
        return [self.list_widget.item(i).text() for i in range(self.list_widget.count())]

    def _on_merge(self) -> None:
        image_paths = self.get_images()
        if not image_paths:
            QMessageBox.warning(self, "提示", "请先添加至少一张图片！")
            return

        out_pdf, _ = QFileDialog.getSaveFileName(
            self, "保存生成的 PDF 文件", "merged_images.pdf", "PDF 文件 (*.pdf)"
        )
        if not out_pdf:
            return

        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.progress_bar.setMaximum(len(image_paths))
        self.btn_merge.setEnabled(False)

        def progress_cb(cur: int, tot: int) -> None:
            self.progress_bar.setValue(cur)

        try:
            merge_images_to_pdf(image_paths, out_pdf, progress_callback=progress_cb)
            self._output_pdf = out_pdf
            QMessageBox.information(self, "成功", f"图片已成功合并保存至:\n{out_pdf}")
            self.accept()
        except Exception as e:
            logger.exception("图片合并失败")
            QMessageBox.critical(self, "合并失败", f"合并图片时发生错误: {e}")
        finally:
            self.progress_bar.setVisible(False)
            self.btn_merge.setEnabled(True)


__all__ = ["ImageMergeDialog"]