"""app_paths 跨平台路径解析测试。"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from core import app_paths


def test_dev_mode_app_root_is_repo_root(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delattr(sys, "frozen", raising=False)
    root = app_paths.get_app_root()
    assert (root / "core" / "app_paths.py").is_file()


def test_frozen_macos_uses_application_support(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "platform", "darwin")
    monkeypatch.setattr(
        sys,
        "executable",
        "/Applications/ZonScale.app/Contents/MacOS/ZonScale",
    )
    fake_home = tmp_path / "home"
    fake_home.mkdir()
    monkeypatch.setattr(app_paths.Path, "home", staticmethod(lambda: fake_home))

    root = app_paths.get_app_root()
    assert root == fake_home / "Library" / "Application Support" / "ZonScale"
    assert root.is_dir()


def test_frozen_windows_uses_exe_dir(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "platform", "win32")
    exe = tmp_path / "ZonScale.exe"
    exe.write_text("", encoding="utf-8")
    monkeypatch.setattr(sys, "executable", str(exe))

    assert app_paths.get_app_root() == tmp_path.resolve()
