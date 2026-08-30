import numpy as np
from PIL import Image
from core.converter import merge_images_to_pdf
from pdf_helpers import open_view

def test_merge_images_to_pdf(tmp_path):
    img1_p = tmp_path / "img1.png"
    img2_p = tmp_path / "img2.jpg"

    Image.new("RGB", (100, 200), color="red").save(img1_p)
    Image.new("RGB", (300, 400), color="blue").save(img2_p)

    out_pdf = tmp_path / "output.pdf"
    progress_track = []
    def cb(cur, tot):
        progress_track.append((cur, tot))

    res = merge_images_to_pdf([img1_p, img2_p], out_pdf, progress_callback=cb)
    assert out_pdf.exists()
    assert len(progress_track) == 2

    with open_view(out_pdf) as doc:
        assert doc.page_count == 2
        rect = doc.page(0).rect
        assert rect.width == 100
        assert rect.height == 200
