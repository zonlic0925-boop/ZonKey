import fitz, numpy as np, cv2
from PIL import Image
from core.converter import merge_images_to_pdf

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
    
    doc = fitz.open(out_pdf)
    assert len(doc) == 2
    assert doc[0].rect.width == 100
    assert doc[0].rect.height == 200
    doc.close()
