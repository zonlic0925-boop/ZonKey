"""Windows 原生对话框单元测试（非交互：仅验证 initial_dir 不崩溃）。"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from core.native_dialog import pick_folder


@pytest.mark.skipif(sys.platform != "win32", reason="Windows only")
def test_pick_folder_with_initial_dir_does_not_raise(tmp_path: Path) -> None:
    """回归：传入 initial_dir 时不得因 ctypes cast 崩溃（用户点浏览报 HTTP 500）。"""
    try:
        pick_folder(str(tmp_path))
    except TypeError as exc:
        pytest.fail(f"pick_folder raised TypeError: {exc}")
