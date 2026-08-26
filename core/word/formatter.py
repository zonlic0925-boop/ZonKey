from __future__ import annotations
import copy
from typing import Any
from docx.text.paragraph import Paragraph
from docx.text.run import Run

def copy_run_format(target_run: Run, source_run: Run) -> None:
    if not source_run or not target_run:
        return
    try:
        if source_run.font:
            if source_run.font.name:
                target_run.font.name = source_run.font.name
            if source_run.font.size:
                target_run.font.size = source_run.font.size
            if source_run.font.bold is not None:
                target_run.font.bold = source_run.font.bold
            if source_run.font.italic is not None:
                target_run.font.italic = source_run.font.italic
            if source_run.font.underline is not None:
                target_run.font.underline = source_run.font.underline
            if source_run.font.strike is not None:
                target_run.font.strike = source_run.font.strike
            if source_run.font.color and source_run.font.color.rgb:
                target_run.font.color.rgb = source_run.font.color.rgb
            if source_run.font.highlight_color:
                target_run.font.highlight_color = source_run.font.highlight_color
        if source_run.bold is not None:
            target_run.bold = source_run.bold
        if source_run.italic is not None:
            target_run.italic = source_run.italic
        if source_run.underline is not None:
            target_run.underline = source_run.underline
    except Exception:
        pass
