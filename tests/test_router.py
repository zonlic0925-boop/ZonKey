from core.router import AppMode, TaskRouter
from pathlib import Path


def test_router_file_extensions():
    assert TaskRouter.detect_mode_for_file("doc1.docx") == AppMode.WORD
    assert TaskRouter.detect_mode_for_file("img1.png") == AppMode.IMAGE_MERGE
    assert TaskRouter.detect_mode_for_file("plan1.dat") == AppMode.DRAWING
    assert TaskRouter.detect_mode_for_file("doc.pdf", default_mode=AppMode.DOC_PDF) == AppMode.DOC_PDF
