import os
import pytest
from pathlib import Path

os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
from PyQt5.QtWidgets import QApplication
from ui.main_window import MainWindow

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
