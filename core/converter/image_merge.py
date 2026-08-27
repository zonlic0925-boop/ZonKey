from __future__ import annotations
import os
import fitz
from PIL import Image
from pathlib import Path
from typing import Callable, Iterable, List, Optional



def merge_images_to_pdf(
    image_paths: List[str | Path],
    output_path: str | Path,
    progress_callback: Optional[Callable[[int, int], None]] = None,
) -> str:
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    doc = fitz.open()
    total = len(image_paths)
    for i, img_path in enumerate(image_paths):
        img_p = Path(img_path)
        with Image.open(img_p) as img:
            w, h = img.size
        rect = fitz.Rect(0, 0, w, h)
        page = doc.new_page(width=w, height=h)
        page.insert_image(rect, filename=str(img_p))
        if progress_callback:
            progress_callback(i + 1, total)
    doc.save(str(out_p))
    doc.close()
    return str(out_p)
