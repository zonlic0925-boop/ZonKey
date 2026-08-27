"""项目统一错误模型：生产路径禁止裸异常。"""

from __future__ import annotations


class DesensError(Exception):
    def __init__(self, code: str, message: str, *, detail: str | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail


class FileOpenError(DesensError):
    def __init__(self, path: str, message: str):
        super().__init__("file_open", message, detail=f"path={path}")


class OcrUnavailableError(DesensError):
    def __init__(self, reason: str):
        super().__init__("ocr_unavailable", f"OCR 通道不可用: {reason}", detail=reason)


class RedactError(DesensError):
    def __init__(self, page_index: int, message: str):
        super().__init__("redact", message, detail=f"page={page_index}")