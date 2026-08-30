"""图片合成 PDF（Phase M 去 AGPL：reportlab 实现，替代 fitz.open + insert_image）。"""

from __future__ import annotations

from pathlib import Path
from typing import Callable, List, Optional

from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def merge_images_to_pdf(
    image_paths: List[str | Path],
    output_path: str | Path,
    progress_callback: Optional[Callable[[int, int], None]] = None,
) -> str:
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(out_p))
    total = len(image_paths)
    try:
        for i, img_path in enumerate(image_paths):
            with Image.open(str(img_path)) as img:
                w, h = img.size
            c.setPageSize((w, h))
            c.drawImage(ImageReader(str(img_path)), 0, 0, width=w, height=h)
            c.showPage()
            if progress_callback:
                progress_callback(i + 1, total)
    finally:
        c.save()
    return str(out_p)
