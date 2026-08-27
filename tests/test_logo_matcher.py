"""Logo 模板匹配器测试：验证自包含模板匹配与空目录安全冷启动。"""

from __future__ import annotations

import cv2
import numpy as np
import pytest

from core.detector.logo_matcher import LogoMatcher


def test_logo_matcher_empty_dir(tmp_path) -> None:
    matcher = LogoMatcher(logo_dir=str(tmp_path))
    assert matcher.templates == []
    dummy = np.zeros((100, 100), dtype=np.uint8)
    assert matcher.match(dummy) == []


def test_logo_matcher_with_synthetic_template(tmp_path) -> None:
    # 构造合成模板
    img = np.zeros((50, 50), dtype=np.uint8)
    img[10:40, 10:40] = 255
    tmpl_path = tmp_path / "customlogo_template.png"
    cv2.imwrite(str(tmpl_path), img)

    matcher = LogoMatcher(logo_dir=str(tmp_path))
    assert len(matcher.templates) == 1
    assert matcher.templates[0].term == "CUSTOMLOGO"

    # 在场景图中匹配
    scene = np.zeros((200, 200), dtype=np.uint8)
    scene[50:100, 50:100] = 255
    hits = matcher.match(scene)
    assert len(hits) == 1
    assert hits[0].term == "CUSTOMLOGO"
    assert hits[0].score > 0.95
