import fitz
from core.doc_pdf.pipeline import DocPdfPipeline
from core.detector.rule_engine import RuleEngine

def test_doc_pdf_pipeline(tmp_path):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((fitz.Point(50, 50)), "This is a SECRET document.")
    pdf_path = str(tmp_path / "test_input.pdf")
    out_path = str(tmp_path / "test_out.pdf")
    doc.save(pdf_path)
    doc.close()

    re = RuleEngine(["SECRET"])
    pl = DocPdfPipeline(rule_engine=re)
    res = pl.process_pdf(pdf_path, out_path)
    assert len(res.pages) == 1
    assert len(res.pages[0].hits) == 1
    assert res.pages[0].hits[0].text == "SECRET"
