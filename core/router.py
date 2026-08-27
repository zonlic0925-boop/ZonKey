from __future__ import annotations

from enum import Enum
from pathlib import Path

__all__ = ["AppMode", "TaskRouter"]


class AppMode(str, Enum):
    DRAWING = "drawing"
    DOC_PDF = "doc_pdf"
    WORD = "word"
    IMAGE_MERGE = "image_merge"


class TaskRouter:
    """Routes files and tasks to the corresponding handler pipeline."""

    @staticmethod
    def detect_mode_for_file(path: str | Path, default_mode: AppMode = AppMode.DRAWING) -> AppMode:
        ext = Path(path).suffix.lower()
        if ext in [".docx", ".doc"]:
            return AppMode.WORD
        if ext in [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"]:
            return AppMode.IMAGE_MERGE
        if ext == ".pdf":
            if default_mode in [AppMode.DRAWING, AppMode.DOC_PDF]:
                return default_mode
            return AppMode.DRAWING
        return default_mode
