import os
import pytest
from pathlib import Path

os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
from PyQt5.QtWidgets import QApplication
from ui.main_window import MainWindow, AppMode

_app = None
def _get_app():
    global _app
    if _app is None:
        _app = QApplication.instance() or QApplication([])
    return _app

def test_main_window_modes_and_components(tmp_path):
    app = _get_app()
    win = MainWindow()
    
    # 1. Check mode combo has all modes
    assert win._mode_combo.count() == 4
    
    # 2. Switch to Word mode and verify widget switching
    win._mode_combo.setCurrentIndex(2)
    assert win._view_stack.currentWidget() == win._word_view
    
    # 3. Switch back to Drawing mode
    win._mode_combo.setCurrentIndex(0)
    assert win._view_stack.currentWidget() == win._drawing_view_widget
    
    # 4. Check add files in word mode
    docx_file = tmp_path / 'test.docx'
    import docx
    d = docx.Document()
    d.add_paragraph('Hello Secret World')
    d.save(str(docx_file))
    
    win._add_file(str(docx_file))
    assert str(docx_file) in win._batch_files

    # 5. Check Tabs existence
    assert win._main_tabs.count() >= 3
    assert "图纸" in win._main_tabs.tabText(0) or "脱敏" in win._main_tabs.tabText(0)
    assert "清单" in win._main_tabs.tabText(1) or "审计" in win._main_tabs.tabText(1)
    assert "日志" in win._main_tabs.tabText(2)

    # 6. Test rule update without crash
    from core.detector.rule_engine import RuleEngine
    win._on_rule_applied(["CONFIDENTIAL", "TEST_TERM"])
    assert hasattr(win, '_system_log_view')

    # 8. Test one-key redact without crash on Drawing mode
    sample_pdf = Path("Testing Drawings/AA01_1K4168_A.pdf")
    if sample_pdf.exists():
        win._app_mode = AppMode.DRAWING
        win._selected_file = str(sample_pdf)
        win._cur_file_result = None
        # Should not throw or crash
        win._on_redact_clicked()
        assert win._file_list.count() >= 0


