import numpy as np
import cv2
from core.detector.seal_detector import SealDetector
from core.model import Channel

def test_seal_detector_empty():
    detector = SealDetector()
    assert detector.match(np.zeros((100, 100, 3), dtype=np.uint8)) == []

def test_seal_detector_synthetic_red_seal():
    detector = SealDetector(min_area=100)
    # Create image with a red circle stamp
    img = np.full((300, 300, 3), 255, dtype=np.uint8)
    cv2.circle(img, (150, 150), 50, (0, 0, 255), -1)  # Pure red in BGR
    hits = detector.match(img)
    assert len(hits) >= 1
    assert hits[0].channel == Channel.SEAL
    assert hits[0].text == '[SEAL:RED_STAMP]'
