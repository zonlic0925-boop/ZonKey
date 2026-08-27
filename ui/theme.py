"""
Apple HIG 视觉引擎 — 工程图纸脱敏工具

设计原则（Apple Human Interface Guidelines）：
- 聚焦留白：每屏一个重点，不堆砌装饰
- 连续圆角：圆角与组件尺寸成比例
- 分层软阴影：悬浮层表达前后层级
- 高对比文字：SF Pro 体系，保证可读性
- 毛玻璃仅用于浮层，主内容区保持清晰实底
"""
from __future__ import annotations


class Theme:
    """Glassmorphism 玻璃拟态设计语言调色盘与高级样式体系"""

    LIGHT = {
        # Backdrop 渐变底色
        "bg_gradient_start": "#EDF2F7",
        "bg_gradient_mid": "#E2E8F0",
        "bg_gradient_end": "#F1F5F9",
        "background": "#F0F4F8",

        # 玻璃拟态卡片表面 (半透明 Tint + 微妙透光)
        "surface": "rgba(255, 255, 255, 0.78)",
        "surface_solid": "#FFFFFF",
        "surface_subtle": "rgba(248, 250, 252, 0.65)",
        "surface_elevated": "rgba(255, 255, 255, 0.88)",
        "surface_pill": "rgba(255, 255, 255, 0.90)",
        "surface_hover": "rgba(255, 255, 255, 0.92)",
        "surface_active": "rgba(238, 242, 255, 0.90)",

        # 品牌高光主色 (Frosted Glass Tech Blue)
        "primary": "#2563EB",
        "primary_hover": "#1D4ED8",
        "primary_pressed": "#1E40AF",
        "primary_light": "rgba(37, 99, 235, 0.12)",
        "primary_glow": "rgba(37, 99, 235, 0.30)",

        # 文本色彩 (高对比度保证极佳可读性)
        "text": "#0F172A",             # 深板岩黑
        "text_secondary": "#475569",   # 柔和次级深灰
        "text_muted": "#94A3B8",       # 弱化文本
        "secondary": "#64748B",

        # 边缘高光 Edge Light
        "border": "rgba(255, 255, 255, 0.85)",        # 顶部/内边缘高光白
        "border_subtle": "rgba(203, 213, 225, 0.70)", # 边界结构线
        "border_glass": "rgba(255, 255, 255, 0.60)",
        "border_focus": "#2563EB",

        # 状态指示色彩 (玻璃半透微光风格)
        "success": "#059669",
        "success_bg": "rgba(16, 185, 129, 0.14)",
        "success_border": "rgba(16, 185, 129, 0.35)",
        "danger": "#DC2626",
        "danger_bg": "rgba(239, 68, 68, 0.14)",
        "danger_border": "rgba(239, 68, 68, 0.35)",
        "warning": "#D97706",
        "warning_bg": "rgba(245, 158, 11, 0.14)",
        "warning_border": "rgba(245, 158, 11, 0.35)",

        # 阴影与微光
        "shadow_sm": "rgba(15, 23, 42, 0.04)",
        "shadow_md": "rgba(15, 23, 42, 0.08)",
        "shadow_lg": "rgba(15, 23, 42, 0.12)",
    }

    DARK = {
        # Backdrop 深邃渐变底色
        "bg_gradient_start": "#0F172A",
        "bg_gradient_mid": "#090D16",
        "bg_gradient_end": "#020617",
        "background": "#0B0F19",

        # 玻璃拟态卡片表面 (深色雾面玻璃)
        "surface": "rgba(30, 41, 59, 0.70)",
        "surface_solid": "#1E293B",
        "surface_subtle": "rgba(15, 23, 42, 0.60)",
        "surface_elevated": "rgba(51, 65, 85, 0.75)",
        "surface_pill": "rgba(30, 41, 59, 0.85)",
        "surface_hover": "rgba(51, 65, 85, 0.85)",
        "surface_active": "rgba(37, 99, 235, 0.25)",

        # 品牌高光主色
        "primary": "#3B82F6",
        "primary_hover": "#60A5FA",
        "primary_pressed": "#2563EB",
        "primary_light": "rgba(59, 130, 246, 0.20)",
        "primary_glow": "rgba(59, 130, 246, 0.40)",

        # 文本色彩
        "text": "#F8FAFC",
        "text_secondary": "#CBD5E1",
        "text_muted": "#64748B",
        "secondary": "#94A3B8",

        # 边缘高光 Edge Light (暗色下的冷光微边)
        "border": "rgba(255, 255, 255, 0.15)",
        "border_subtle": "rgba(255, 255, 255, 0.08)",
        "border_glass": "rgba(255, 255, 255, 0.12)",
        "border_focus": "#60A5FA",

        # 状态指示色彩
        "success": "#34D399",
        "success_bg": "rgba(16, 185, 129, 0.22)",
        "success_border": "rgba(52, 211, 153, 0.40)",
        "danger": "#F87171",
        "danger_bg": "rgba(239, 68, 68, 0.22)",
        "danger_border": "rgba(248, 113, 113, 0.40)",
        "warning": "#FBBF24",
        "warning_bg": "rgba(245, 158, 11, 0.22)",
        "warning_border": "rgba(251, 191, 36, 0.40)",

        # 阴影
        "shadow_sm": "rgba(0, 0, 0, 0.3)",
        "shadow_md": "rgba(0, 0, 0, 0.5)",
        "shadow_lg": "rgba(0, 0, 0, 0.7)",
    }

    BORDER_RADIUS = 16
    CARD_RADIUS = 14
    BUTTON_RADIUS = 10
    PILL_RADIUS = 22
    FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI Variable Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei UI', sans-serif"
    MONO_FONT = "'SF Mono', 'Cascadia Code', 'Fira Code', 'Menlo', 'Consolas', monospace"

    @staticmethod
    def get_theme(theme_name: str = "light") -> dict[str, str]:
        return Theme.LIGHT if theme_name == "light" else Theme.DARK

    @staticmethod
    def get_stylesheet(theme_name: str = "light") -> str:
        t = Theme.get_theme(theme_name)
        return f"""
        /* -------------------------------------------------------------
           1. 顶级主窗口与画布背景 (Rich Backdrop & Base Setup)
        ------------------------------------------------------------- */
        QMainWindow, QDialog {{
            background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                                        stop:0 {t['bg_gradient_start']},
                                        stop:0.5 {t['bg_gradient_mid']},
                                        stop:1 {t['bg_gradient_end']});
            color: {t['text']};
            font-family: {Theme.FONT_FAMILY};
            font-size: 13px;
        }}

        QWidget {{
            color: {t['text']};
            font-family: {Theme.FONT_FAMILY};
        }}

        /* -------------------------------------------------------------
           2. 顶部玻璃高光导航栏 (Glass Header Bar)
        ------------------------------------------------------------- */
        QFrame#brandHeaderFrame {{
            background-color: {t['surface_elevated']};
            border-bottom: 1px solid {t['border_subtle']};
            border-top: 1px solid {t['border']};
            padding: 10px 20px;
        }}

        /* -------------------------------------------------------------
           3. 核心玻璃拟态卡片 (Glass Cards with Edge Light)
        ------------------------------------------------------------- */
        QFrame.card, QFrame#cardFrame, QFrame#surfaceCard, QFrame.sidebarCard {{
            background-color: {t['surface']};
            border: 1px solid {t['border_subtle']};
            border-top: 1.5px solid {t['border']};
            border-radius: {Theme.CARD_RADIUS}px;
        }}

        /* 悬浮状态卡片微光 */
        QFrame.card:hover, QFrame#surfaceCard:hover {{
            background-color: {t['surface_hover']};
            border: 1px solid {t['border']};
        }}

        /* -------------------------------------------------------------
           4. 悬浮磨砂药丸控制器 (Floating Glass Pills)
        ------------------------------------------------------------- */
        QFrame#floatingPill, QFrame#pillBar {{
            background-color: {t['surface_pill']};
            border: 1px solid {t['border_subtle']};
            border-top: 1.5px solid {t['border']};
            border-radius: {Theme.PILL_RADIUS}px;
            padding: 5px 12px;
        }}

        /* -------------------------------------------------------------
           5. 分组框 (Glass Group Boxes)
        ------------------------------------------------------------- */
        QGroupBox {{
            background-color: {t['surface']};
            border: 1px solid {t['border_subtle']};
            border-top: 1.5px solid {t['border']};
            border-radius: {Theme.BORDER_RADIUS}px;
            margin-top: 16px;
            font-weight: 600;
            font-size: 12px;
            padding-top: 18px;
            padding-bottom: 10px;
            padding-left: 10px;
            padding-right: 10px;
        }}
        QGroupBox::title {{
            subcontrol-origin: margin;
            subcontrol-position: top left;
            left: 16px;
            padding: 1px 8px;
            color: {t['text']};
            font-weight: 600;
            background: transparent;
        }}

        /* -------------------------------------------------------------
           6. 玻璃拟态发光徽标 (Glowing Frosted Badges)
        ------------------------------------------------------------- */
        QLabel.badge, QLabel#statusBadge {{
            background-color: {t['primary_light']};
            color: {t['primary']};
            border: 1px solid {t['primary_glow']};
            border-radius: 6px;
            padding: 3px 9px;
            font-size: 11px;
            font-weight: 600;
        }}
        QLabel.badge-success {{
            background-color: {t['success_bg']};
            color: {t['success']};
            border: 1px solid {t['success_border']};
            border-radius: 6px;
            padding: 3px 9px;
            font-size: 11px;
            font-weight: 600;
        }}
        QLabel.badge-danger {{
            background-color: {t['danger_bg']};
            color: {t['danger']};
            border: 1px solid {t['danger_border']};
            border-radius: 6px;
            padding: 3px 9px;
            font-size: 11px;
            font-weight: 600;
        }}
        QLabel.badge-warning {{
            background-color: {t['warning_bg']};
            color: {t['warning']};
            border: 1px solid {t['warning_border']};
            border-radius: 6px;
            padding: 3px 9px;
            font-size: 11px;
            font-weight: 600;
        }}

        /* -------------------------------------------------------------
           7. 现代化交互按钮 (Interactive Frosted Buttons)
        ------------------------------------------------------------- */
        QPushButton {{
            background-color: {t['surface_solid']};
            color: {t['text']};
            border: 1px solid {t['border_subtle']};
            border-top: 1.2px solid {t['border']};
            border-radius: {Theme.BUTTON_RADIUS}px;
            padding: 7px 16px;
            font-size: 12px;
            font-weight: 500;
            outline: none;
        }}
        QPushButton:hover {{
            background-color: {t['surface_hover']};
            border-color: {t['primary']};
            color: {t['primary']};
        }}
        QPushButton:pressed {{
            background-color: {t['surface_active']};
        }}
        QPushButton:checked {{
            background-color: {t['primary_light']};
            border: 1.5px solid {t['primary']};
            color: {t['primary']};
            font-weight: 600;
        }}
        QPushButton:disabled {{
            background-color: rgba(226, 232, 240, 0.45);
            color: {t['text_muted']};
            border-color: {t['border_subtle']};
        }}

        /* 标志性高饱和玻璃主按钮 (One-Click Hero Button) */
        QPushButton.primary, QPushButton#btnPrimary, QPushButton#btnOneClick {{
            background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                        stop:0 {t['primary']},
                                        stop:1 {t['primary_hover']});
            color: #FFFFFF;
            border: 1px solid {t['primary_pressed']};
            border-top: 1.5px solid rgba(255, 255, 255, 0.4);
            font-weight: 600;
            font-size: 13px;
            padding: 10px 24px;
            border-radius: {Theme.BUTTON_RADIUS}px;
        }}
        QPushButton.primary:hover, QPushButton#btnPrimary:hover, QPushButton#btnOneClick:hover {{
            background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                                        stop:0 {t['primary_hover']},
                                        stop:1 {t['primary_pressed']});
            border-color: {t['primary_pressed']};
        }}
        QPushButton.primary:pressed, QPushButton#btnPrimary:pressed, QPushButton#btnOneClick:pressed {{
            background-color: {t['primary_pressed']};
        }}
        QPushButton.primary:disabled, QPushButton#btnOneClick:disabled {{
            background: rgba(148, 163, 184, 0.5);
            color: rgba(255, 255, 255, 0.8);
            border: none;
        }}

        /* 顶部 5 大功能导航按钮专属样式 (Glass Nav Tabs) */
        QPushButton#navTabBtn {{
            background-color: transparent;
            color: {t['text_secondary']};
            border: 1px solid transparent;
            border-radius: {Theme.PILL_RADIUS}px;
            padding: 8px 18px;
            font-size: 13px;
            font-weight: 600;
        }}
        QPushButton#navTabBtn:hover {{
            background-color: {t['surface_hover']};
            color: {t['primary']};
            border: 1px solid {t['border']};
        }}
        QPushButton#navTabBtn:checked {{
            background-color: {t['surface_solid']};
            color: {t['primary']};
            border: 1.5px solid {t['primary']};
            font-weight: 700;
        }}

        /* 次级轻量按钮 (Secondary / Ghost) */
        QPushButton.secondary {{
            background-color: {t['primary_light']};
            color: {t['primary']};
            border: 1px solid {t['primary_glow']};
            font-weight: 600;
        }}
        QPushButton.secondary:hover {{
            background-color: {t['primary_glow']};
        }}

        /* -------------------------------------------------------------
           8. 精致输入框与下拉组件 (Glass Inputs)
        ------------------------------------------------------------- */
        QLineEdit, QTextEdit, QPlainTextEdit, QSpinBox, QDoubleSpinBox, QComboBox {{
            background-color: {t['surface_solid']};
            color: {t['text']};
            border: 1px solid {t['border_subtle']};
            border-top: 1.2px solid {t['border']};
            border-radius: 6px;
            padding: 6px 10px;
            font-size: 12px;
            selection-background-color: {t['primary']};
            selection-color: #FFFFFF;
        }}
        QLineEdit:hover, QTextEdit:hover, QComboBox:hover {{
            border-color: #94A3B8;
        }}
        QLineEdit:focus, QTextEdit:focus, QComboBox:focus {{
            border: 1.5px solid {t['border_focus']};
            background-color: #FFFFFF;
        }}
        QLineEdit:read-only, QTextEdit:read-only {{
            background-color: {t['surface_subtle']};
            color: {t['text_secondary']};
        }}

        /* 下拉弹窗样式 */
        QComboBox::drop-down {{
            subcontrol-origin: padding;
            subcontrol-position: top right;
            width: 24px;
            border-left: none;
        }}
        QComboBox QAbstractItemView {{
            border: 1px solid {t['border_subtle']};
            border-radius: 8px;
            background-color: {t['surface_solid']};
            selection-background-color: {t['primary_light']};
            selection-color: {t['primary']};
            padding: 4px;
            outline: none;
        }}

        /* -------------------------------------------------------------
           9. 玻璃表格、列表与数据视口 (Glass Tables & Lists)
        ------------------------------------------------------------- */
        QTableWidget, QTreeWidget, QListWidget {{
            background-color: {t['surface_solid']};
            color: {t['text']};
            border: 1px solid {t['border_subtle']};
            border-radius: {Theme.CARD_RADIUS}px;
            gridline-color: transparent;
            selection-background-color: {t['primary_light']};
            selection-color: {t['primary']};
            padding: 4px;
            outline: none;
        }}
        QTableWidget::item, QListWidget::item {{
            padding: 8px 10px;
            border-radius: 6px;
            border-bottom: 1px solid rgba(226, 232, 240, 0.5);
        }}
        QTableWidget::item:selected, QListWidget::item:selected {{
            background-color: {t['primary_light']};
            color: {t['primary']};
            font-weight: 600;
        }}
        QHeaderView::section {{
            background-color: {t['surface_subtle']};
            color: {t['text_secondary']};
            padding: 8px 10px;
            border: none;
            border-bottom: 1px solid {t['border_subtle']};
            font-weight: 600;
            font-size: 11px;
        }}

        /* -------------------------------------------------------------
           10. 选项卡与分段控制器 (Segmented Tab Controls)
        ------------------------------------------------------------- */
        QTabWidget::pane {{
            border: none;
            background-color: transparent;
        }}
        QTabBar::tab {{
            background-color: transparent;
            color: {t['text_secondary']};
            padding: 8px 18px;
            border: none;
            border-radius: 6px;
            margin-right: 6px;
            font-weight: 600;
            font-size: 12px;
        }}
        QTabBar::tab:selected {{
            background-color: {t['surface_solid']};
            color: {t['primary']};
            border: 1px solid {t['border_subtle']};
            border-top: 1.5px solid {t['border']};
        }}
        QTabBar::tab:hover:!selected {{
            color: {t['text']};
            background-color: {t['surface_hover']};
        }}

        /* -------------------------------------------------------------
           11. 滚动条 (Minimalist Trackless Scrollbars)
        ------------------------------------------------------------- */
        QScrollBar:vertical {{
            border: none;
            background: transparent;
            width: 6px;
            margin: 0;
        }}
        QScrollBar::handle:vertical {{
            background: rgba(148, 163, 184, 0.4);
            min-height: 24px;
            border-radius: 3px;
        }}
        QScrollBar::handle:vertical:hover {{
            background: rgba(100, 116, 139, 0.7);
        }}
        QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
            height: 0px;
        }}

        /* -------------------------------------------------------------
           12. 底部状态栏 (Glass Status Bar)
        ------------------------------------------------------------- */
        QStatusBar {{
            background-color: {t['surface_elevated']};
            color: {t['text_secondary']};
            border-top: 1px solid {t['border_subtle']};
            padding: 4px 14px;
            font-size: 12px;
        }}
        """


# 全局默认导出 QSS 样式表
THEME_QSS = Theme.get_stylesheet("light")
