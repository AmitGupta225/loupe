"""Honest coverage tests for previously hidden branches - no pragma cheating."""

import io

import pytest
from docx import Document

from app.agents.nodes import find_quote_offsets
from app.agents.prompts import (
    build_executive_user_prompt,
    build_grounding_repair_user_prompt,
    get_grounding_repair_system_prompt,
)
from app.schemas.contract import ClauseNode
from app.services.parser import extract_from_docx
from app.services.retriever import hybrid_retrieve


def make_clause(id_val, title, content, section=""):
    return ClauseNode(
        id=id_val,
        title=title,
        content=content,
        char_start=0,
        char_end=len(content),
        level=1,
        section_number=section,
        clause_type="general",
    )


def test_find_quote_offsets_whitespace_only_quote():
    # quote is whitespace-only -> normalized empty -> should return None via line 53
    result = find_quote_offsets("   \t\n  ", "hello world raw text")
    assert result is None
    # also test raw_text whitespace only -> norm_text empty
    result2 = find_quote_offsets("hello", "   \n\t  ")
    assert result2 is None
    # also test both whitespace but different lengths -> exact not found, normalized empty -> None
    assert find_quote_offsets("   ", "  ") is None
    assert find_quote_offsets(" ", "hello") is None


def test_find_quote_offsets_normalized_path():
    # trigger normalized path where exact not found but normalized found
    raw = "Provider shall  indemnify\nClient for all claims."
    quote = "Provider shall indemnify Client"
    # exact find fails due to double space, but normalized should succeed
    result = find_quote_offsets(quote, raw)
    assert result is not None
    assert result[0] >= 0


def test_build_executive_user_prompt_no_clauses_no_findings():
    # line 70: both empty -> early return
    result = build_executive_user_prompt([], [])
    assert result == "No clauses or findings to synthesize."


def test_build_executive_user_prompt_with_findings_dict():
    # test branch where findings are dict objects (coverage for getattr fallback)
    c1 = make_clause("clause-1", "T", "content")
    findings = [{"clause_id": "c1", "severity": "HIGH", "category": "Indemnification"}]
    result = build_executive_user_prompt([c1], findings)
    assert "Total clauses indexed: 1" in result
    assert "c1" in result


def test_get_grounding_repair_system_prompt():
    # line 88: ensure function is executed and returns expected content
    prompt = get_grounding_repair_system_prompt()
    assert "quote correction" in prompt.lower()
    assert "exact_quote" in prompt.lower() or "exact verbatim" in prompt.lower()


def test_build_grounding_repair_user_prompt_empty():
    # cover empty branch for repair prompt
    result = build_grounding_repair_user_prompt("", "some quote")
    assert result == "No clause or quote provided for repair."
    result2 = build_grounding_repair_user_prompt("clause text", "")
    assert result2 == "No clause or quote provided for repair."
    result3 = build_grounding_repair_user_prompt("clause", "quote")
    assert "Clause text" in result3


def test_parser_docx_empty_cell():
    # cover parser branch where cell.text is falsy (empty cell)
    doc = Document()
    doc.add_paragraph("Intro paragraph")
    table = doc.add_table(rows=1, cols=2)
    table.cell(0, 0).text = "Cell A"
    table.cell(0, 1).text = ""  # empty cell -> falsy branch
    buf = io.BytesIO()
    doc.save(buf)
    result = extract_from_docx(buf.getvalue())
    assert "Cell A" in result
    assert "Intro paragraph" in result
    # empty cell should not cause crash and not be added


def test_hybrid_retrieve_article_v_path():
    # cover retriever path for non-numeric ref like Article V (now via first if, after removing dead elif)
    c1 = make_clause("c1", "1. Main", "See Article V for details", section="1")
    c2 = make_clause("c2", "Article V Terms", "Content of Article V terms", section="")
    results = hybrid_retrieve(c1, [c1, c2], {}, top_k=2)
    assert any(r.id == "c2" for r in results)


def test_hybrid_retrieve_break_condition():
    # previously dead break removed - now test that hybrid retrieve still returns correct without break
    c1 = make_clause("c1", "1. Target", "See Section 2 and Section 3 liability indemnification risk", section="1")
    c2 = make_clause("c2", "Section 2 Clause", "Unrelated administrative text alpha", section="2")
    c3 = make_clause("c3", "Section 3 Clause", "Unrelated administrative text beta", section="3")
    clauses = [c1, c2, c3]
    for i in range(4, 10):
        clauses.append(
            make_clause(f"c{i}", f"Clause {i}", "liability indemnification risk content with payment terms", section=str(i))
        )
    results = hybrid_retrieve(c1, clauses, {}, top_k=2)
    assert len(results) >= 2
    ids = [r.id for r in results]
    assert "c2" in ids
    assert "c3" in ids


def test_hybrid_retrieve_elif_dedup():
    # cover dedup inside elif when same clause would be added twice
    c1 = make_clause("c1", "1. Main", "See Article V again", section="1")
    c2 = make_clause("c2", "Article V Dup", "Article V content", section="")
    # Add duplicate handling: ensure retrieved_ids prevents double add
    results = hybrid_retrieve(c1, [c1, c2, c2], {}, top_k=2)
    ids = [r.id for r in results]
    assert ids.count("c2") == 1
