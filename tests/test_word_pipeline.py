import os
from pathlib import Path
from docx import Document
from docx.shared import Pt, RGBColor
from core.model import WordReplaceRule
from core.word.pipeline import WordPipeline
from core.detector.rule_engine import RuleEngine

def test_word_pipeline_exact_replace(tmp_path):
    doc_path = tmp_path / 'test_sample.docx'
    out_path = tmp_path / 'test_sample_out.docx'
    
    doc = Document()
    p1 = doc.add_paragraph()
    r1 = p1.add_run('甲方：北京科技有限公司，')
    r1.bold = True
    r2 = p1.add_run('乙方：张三先生。')
    r2.font.color.rgb = RGBColor(255, 0, 0)
    
    table = doc.add_table(rows=1, cols=2)
    cell_p = table.cell(0, 0).paragraphs[0]
    cell_p.add_run('联系电话：13800138000')
    
    doc.save(str(doc_path))
    
    # Run WordPipeline with custom rule and PII regex
    rules = [
        WordReplaceRule(find='北京科技有限公司', replace='[公司A]', mode='exact'),
        WordReplaceRule(find='张三', replace='李四', mode='exact')
    ]
    re_engine = RuleEngine(terms=['13800138000'])
    pipeline = WordPipeline(rule_engine=re_engine, rules=rules)
    
    res = pipeline.process_document(doc_path, out_path)
    assert res['total_replacements'] >= 3
    
    # Verify resulting document
    doc_res = Document(str(out_path))
    full_text = doc_res.paragraphs[0].text
    assert '[公司A]' in full_text
    assert '李四' in full_text
    assert '北京科技有限公司' not in full_text
    assert '张三' not in full_text
    
    table_text = doc_res.tables[0].cell(0, 0).paragraphs[0].text
    assert '[已脱敏]' in table_text
    assert '13800138000' not in table_text
    
    # Verify format was preserved on inserted runs
    runs = doc_res.paragraphs[0].runs
    assert any(r.bold for r in runs if '[公司A]' in r.text)
