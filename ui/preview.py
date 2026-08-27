"""预览视图：QGraphicsView 渲染单 PDF 页，滚轮平移、Ctrl+滚轮缩放、可选框叠加。

交互约定（2026-08-17 用户实机要求）：
- 滚轮（无修饰键）= 平移图纸；Ctrl+滚轮 = 缩放；也可左键拖拽平移。
- 渲染在后台线程完成（不阻塞 UI 线程）；缩放先即时变换当前位图，
  目标分辨率与当前位图分辨率相差超过阈值才重渲染保清晰——消除卡死。
- 渲染分辨率上限 RENDER_MAX_PX（内存预算上限）。

UI 展示层，不持有业务语义：渲染与叠加只做显示，抹除决策全部来自 core。
"""

from __future__ import annotations

import threading
from pathlib import Path

import fitz
from PyQt5.QtCore import QPoint, QRect, QRectF, QSize, Qt, QThread, pyqtSignal
from PyQt5.QtGui import QColor, QImage, QPainter, QPen, QPixmap
from PyQt5.QtWidgets import (
    QGraphicsPixmapItem,
    QGraphicsScene,
    QGraphicsView,
    QRubberBand,
)

from core.model import Box

RENDER_MAX_PX = 4096  # 单次渲染最大边长（内存预算上限）

ZOOM_MIN = 0.2
ZOOM_MAX = 8.0

RERENDER_FACTOR = 1.5  # 目标显示分辨率与当前位图相差超过此倍数才重渲染


def render_page_image(pdf_path: str, page_index: int, zoom: float) -> tuple[QImage, float]:
    """渲染 PDF 页为 QImage，返回 (image, 实际渲染缩放)。

    在后台线程调用：只创建 QImage（线程安全）；QPixmap 必须回 GUI 线程转换。
    """
    doc = fitz.open(pdf_path)
    try:
        page = doc[page_index]
        cap = min(RENDER_MAX_PX / page.rect.width, RENDER_MAX_PX / page.rect.height)
        z = min(zoom, cap)
        pix = page.get_pixmap(matrix=fitz.Matrix(z, z), alpha=False)
        image = QImage(
            pix.samples, pix.width, pix.height, pix.stride, QImage.Format_RGB888
        )
    finally:
        doc.close()
    return image.copy(), z  # copy 脱离 pix.samples 缓冲区生命周期


class _RenderWorker(QThread):
    """后台渲染线程：串行执行最新请求（旧请求被覆盖丢弃）。"""

    rendered = pyqtSignal(int, object, int, object, float)  # token, pdf, page, image, z

    def __init__(self, parent=None):
        super().__init__(parent)
        self._lock = threading.Lock()
        self._cond = threading.Condition(self._lock)
        self._request: tuple[int, str, int, float] | None = None
        self._stop = False

    def request(self, token: int, pdf_path: str, page_index: int, zoom: float) -> None:
        with self._lock:
            self._request = (token, pdf_path, page_index, zoom)
            self._cond.notify()

    def stop(self) -> None:
        with self._lock:
            self._stop = True
            self._cond.notify()
        self.wait(5000)

    def run(self) -> None:  # noqa: D102
        while True:
            with self._lock:
                while not self._stop and self._request is None:
                    self._cond.wait()
                if self._stop:
                    return
                token, pdf_path, page_index, zoom = self._request
                self._request = None
            try:
                image, z = render_page_image(pdf_path, page_index, zoom)
            except Exception:  # noqa: BLE001
                continue
            self.rendered.emit(token, pdf_path, page_index, image, z)


class PreviewView(QGraphicsView):
    """单 PDF 页渲染视图：平移拖拽、滚轮缩放、可选脱敏框叠加、手动拉框/点击拾取。"""

    zoom_requested = pyqtSignal(float)
    manual_rect_created = pyqtSignal(float, float, float, float)  # pt 坐标 x0, y0, x1, y1
    box_clicked = pyqtSignal(float, float)  # pt 坐标 x, y

    def __init__(self, title: str, parent=None):
        super().__init__(parent)
        self._title = title
        self._zoom = 1.0  # 显示缩放倍率（1.0 = 适应窗口）
        self._scene = QGraphicsScene(self)
        self._item = QGraphicsPixmapItem()
        self._scene.addItem(self._item)
        self.setScene(self._scene)
        self.setBackgroundBrush(QColor(215, 215, 215))
        self.setDragMode(QGraphicsView.ScrollHandDrag)
        self.setTransformationAnchor(QGraphicsView.AnchorUnderMouse)
        self.setResizeAnchor(QGraphicsView.AnchorUnderMouse)
        self.setRenderHint(QPainter.Antialiasing)
        self._page_key: tuple[str, int] | None = None
        self._page_size_pt = (0.0, 0.0)
        self._pix_scale = 0.0  # 当前位图渲染分辨率（px/pt）
        self._base_pm = QPixmap()  # 无叠加的原始位图
        self._overlay: list[tuple[Box, QColor, bool]] = []
        self._token = 0
        self._worker = _RenderWorker()
        self._worker.rendered.connect(self._on_rendered)
        self._worker.start()

        # 手动标注/拉框交互状态
        self._manual_draw_mode = False
        self._draw_start_pos: QPoint | None = None
        self._rubber_rect: tuple[int, int, int, int] | None = None  # (x, y, w, h)
        self._last_mouse_press_pos: QPoint | None = None

    # ---------- 内容 ----------

    def set_content(
        self,
        pdf_path: str | None,
        page_index: int,
        zoom: float,
        overlay: list[tuple[Box, QColor, bool]] | None = None,
        force_reload: bool = False,
    ) -> None:
        """加载页面；pdf_path 为 None 时显示空（如输出未生成）。"""
        self._zoom = max(ZOOM_MIN, min(zoom, ZOOM_MAX))
        if pdf_path is None or not Path(pdf_path).exists():
            self._page_key = None
            self._pix_scale = 0.0
            self._base_pm = QPixmap()
            self._overlay = []
            self._item.setPixmap(QPixmap())
            self._scene.setSceneRect(QRectF())
            return
        mtime = 0.0
        try:
            mtime = Path(pdf_path).stat().st_mtime
        except Exception:
            pass
        key = (str(Path(pdf_path).resolve()), page_index, mtime if force_reload else 0.0)
        if key != self._page_key:
            try:
                doc = fitz.open(pdf_path)
                page = doc[page_index]
                self._page_size_pt = (page.rect.width, page.rect.height)
                doc.close()
            except Exception:  # noqa: BLE001
                self._page_size_pt = (0.0, 0.0)
        display_scale = self._fit_scale() * self._zoom
        normalized_overlay: list[tuple[Box, QColor, bool]] = []
        if overlay:
            for item in overlay:
                if len(item) == 2:
                    normalized_overlay.append((item[0], item[1], False))
                elif len(item) >= 3:
                    normalized_overlay.append((item[0], item[1], bool(item[2])))

        if (
            force_reload
            or self._page_key != key
            or self._pix_scale <= 0
            or display_scale > self._pix_scale * RERENDER_FACTOR
            or display_scale < self._pix_scale / RERENDER_FACTOR
        ):
            self._page_key = key
            self._overlay = normalized_overlay
            self._token += 1
            self._worker.request(self._token, key[0], page_index, display_scale)
        elif overlay is not None:
            self._overlay = normalized_overlay
            self._redraw_overlay()
        self._apply_display()

    def has_content(self) -> bool:
        return not self._item.pixmap().isNull()

    def shutdown(self) -> None:
        self._worker.stop()

    # ---------- 显示变换 ----------

    def _fit_scale(self) -> float:
        w, h = self._page_size_pt
        if w <= 0 or h <= 0:
            return 1.0
        vp = self.viewport().size()
        return min(vp.width() / w, vp.height() / h)

    def _apply_display(self) -> None:
        """把当前位图变换到目标显示缩放（即时，不重渲染）。"""
        if self._pix_scale <= 0:
            return
        target = self._fit_scale() * self._zoom
        self.resetTransform()
        self.scale(target / self._pix_scale, target / self._pix_scale)

    def _redraw_overlay(self) -> None:
        if self._base_pm.isNull():
            return
        pm = QPixmap(self._base_pm)
        painter = QPainter(pm)
        painter.setRenderHint(QPainter.Antialiasing)
        z = self._pix_scale
        for box, color, selected in self._overlay:
            if selected:
                # 选中的框：半透明亮黄/橙底色填充 + 亮黄边框 + 加粗线宽
                painter.fillRect(
                    QRectF(
                        box.x0 * z, box.y0 * z,
                        (box.x1 - box.x0) * z, (box.y1 - box.y0) * z,
                    ),
                    QColor(255, 235, 59, 90),
                )
                painter.setPen(QPen(QColor(255, 193, 7), 3.5, Qt.SolidLine))
            else:
                # 未选中的普通框：半透明轻微底色 + 对应状态边框
                painter.fillRect(
                    QRectF(
                        box.x0 * z, box.y0 * z,
                        (box.x1 - box.x0) * z, (box.y1 - box.y0) * z,
                    ),
                    QColor(color.red(), color.green(), color.blue(), 25),
                )
                painter.setPen(QPen(color, 2, Qt.SolidLine))
            painter.drawRect(
                QRectF(
                    box.x0 * z, box.y0 * z,
                    (box.x1 - box.x0) * z, (box.y1 - box.y0) * z,
                )
            )
        painter.end()
        self._item.setPixmap(pm)
        self._scene.setSceneRect(QRectF(pm.rect()))

    def _on_rendered(
        self, token: int, pdf_path: str, page_index: int, image, z: float
    ) -> None:
        if token != self._token:
            return  # 过期结果丢弃
        self._pix_scale = z
        self._base_pm = QPixmap.fromImage(image)
        self._redraw_overlay()
        self._apply_display()

    # ---------- 交互与模式控制 ----------

    def set_manual_draw_mode(self, enabled: bool) -> None:
        """设置是否处于手动拉框抹除模式。"""
        self._manual_draw_mode = enabled
        if enabled:
            self.setDragMode(QGraphicsView.NoDrag)
            self.setCursor(Qt.CrossCursor)
        else:
            self.setDragMode(QGraphicsView.ScrollHandDrag)
            self.setCursor(Qt.ArrowCursor)

    def is_manual_draw_mode(self) -> bool:
        return self._manual_draw_mode

    def _viewport_to_pt(self, vp_pos: QPoint) -> tuple[float, float] | None:
        """将视图视口坐标转换为 PDF 页面 pt 坐标。"""
        if self._pix_scale <= 0:
            return None
        scene_pos = self.mapToScene(vp_pos)
        pt_x = scene_pos.x() / self._pix_scale
        pt_y = scene_pos.y() / self._pix_scale
        return pt_x, pt_y

    def mousePressEvent(self, event) -> None:  # noqa: N802
        if event.button() == Qt.LeftButton:
            self._last_mouse_press_pos = event.pos()
            if self._manual_draw_mode:
                self._draw_start_pos = event.pos()
                self._rubber_rect = (event.pos().x(), event.pos().y(), 0, 0)
                self.viewport().update()
                event.accept()
                return
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event) -> None:  # noqa: N802
        if self._manual_draw_mode and self._draw_start_pos is not None:
            rect = QRect(self._draw_start_pos, event.pos()).normalized()
            self._rubber_rect = (rect.x(), rect.y(), rect.width(), rect.height())
            self.viewport().update()
            event.accept()
            return
        super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event) -> None:  # noqa: N802
        if event.button() == Qt.LeftButton:
            if self._manual_draw_mode and self._draw_start_pos is not None:
                end_pos = event.pos()
                rect = QRect(self._draw_start_pos, end_pos).normalized()
                self._draw_start_pos = None
                self._rubber_rect = None
                self.viewport().update()
                if rect.width() >= 4 and rect.height() >= 4:
                    pt_p1 = self._viewport_to_pt(rect.topLeft())
                    pt_p2 = self._viewport_to_pt(rect.bottomRight())
                    if pt_p1 and pt_p2:
                        x0 = min(pt_p1[0], pt_p2[0])
                        y0 = min(pt_p1[1], pt_p2[1])
                        x1 = max(pt_p1[0], pt_p2[0])
                        y1 = max(pt_p1[1], pt_p2[1])
                        self.manual_rect_created.emit(x0, y0, x1, y1)
                event.accept()
                return
            elif self._last_mouse_press_pos is not None:
                # 检查是否为微小点击（非拖拽平移）
                diff = (event.pos() - self._last_mouse_press_pos).manhattanLength()
                if diff <= 4:
                    pt = self._viewport_to_pt(event.pos())
                    if pt:
                        self.box_clicked.emit(pt[0], pt[1])
        super().mouseReleaseEvent(event)

    def paintEvent(self, event) -> None:  # noqa: N802
        super().paintEvent(event)
        # 空态提示渲染 (Apple Minimalist Empty State)
        if not self.has_content():
            painter = QPainter(self.viewport())
            painter.setRenderHint(QPainter.Antialiasing, True)
            rect = self.viewport().rect()

            # 居中空态提示框
            w = min(rect.width() - 40, 320)
            h = min(rect.height() - 40, 160)
            if w > 80 and h > 60:
                cx = rect.center().x() - w / 2
                cy = rect.center().y() - h / 2
                card_rect = QRectF(cx, cy, w, h)
                
                # 绘制半透明圆角卡片
                painter.setPen(QPen(QColor("#CBD5E1"), 1.5, Qt.DashLine))
                painter.setBrush(QColor(255, 255, 255, 140))
                painter.drawRoundedRect(card_rect, 12, 12)

                # 绘制标题与副标题
                painter.setPen(QColor("#475569"))
                font_title = painter.font()
                font_title.setPointSize(11)
                font_title.setBold(True)
                painter.setFont(font_title)
                painter.drawText(
                    QRectF(cx, cy + 30, w, 26),
                    Qt.AlignCenter,
                    self._title,
                )

                painter.setPen(QColor("#94A3B8"))
                font_sub = painter.font()
                font_sub.setPointSize(9)
                font_sub.setBold(False)
                painter.setFont(font_sub)
                painter.drawText(
                    QRectF(cx, cy + 60, w, 40),
                    Qt.AlignCenter,
                    "请在左侧添加文件\n或直接拖拽图纸进入",
                )
            painter.end()

        if self._rubber_rect is not None:
            x, y, w, h = self._rubber_rect
            if w > 0 and h > 0:
                painter = QPainter(self.viewport())
                painter.setRenderHint(QPainter.Antialiasing, False)
                # 绘制半透明填充与高对比度虚线边框
                painter.fillRect(QRect(x, y, w, h), QColor(255, 0, 0, 45))
                pen = QPen(QColor(220, 20, 20), 1.5, Qt.DashLine)
                painter.setPen(pen)
                painter.drawRect(QRect(x, y, w, h))
                painter.end()

    def wheelEvent(self, event) -> None:  # noqa: N802
        delta = event.angleDelta().y()
        if delta == 0:
            return
        factor = 1.25 ** (delta / 120)
        new_zoom = max(ZOOM_MIN, min(self._zoom * factor, ZOOM_MAX))
        if abs(new_zoom - self._zoom) > 1e-9:
            self.zoom_requested.emit(new_zoom)

    def keyPressEvent(self, event) -> None:  # noqa: N802
        if event.key() == Qt.Key_Escape and self._manual_draw_mode:
            self._manual_draw_mode = False
            self._draw_start_pos = None
            self._rubber_rect = None
            self.setDragMode(QGraphicsView.ScrollHandDrag)
            self.setCursor(Qt.ArrowCursor)
            self.viewport().update()
            event.accept()
            return
        super().keyPressEvent(event)

    def resizeEvent(self, event) -> None:  # noqa: N802
        super().resizeEvent(event)
        if self._page_key is None:
            return
        display_scale = self._fit_scale() * self._zoom
        if self._pix_scale <= 0 or display_scale > self._pix_scale * RERENDER_FACTOR:
            self._token += 1
            self._worker.request(
                self._token, self._page_key[0], self._page_key[1], display_scale
            )
        self._apply_display()