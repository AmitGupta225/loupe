"""Tests for structural chunker."""

import pytest

from app.core.exceptions import ClauseParsingError
from app.schemas.contract import ClauseNode
from app.services.chunker import (
    _compute_level,
    _extract_section_number,
    _is_heading_line,
    chunk_document,
    detect_clauses,
    extract_defined_terms,
    extract_metadata,
)

SAMPLE_CONTRACT = (
    "AGREEMENT BETWEEN ALPHA AND BETA\n\n"
    "Effective Date: January 15, 2024\n\n"
    "1. Definitions\n\n"
    '"Confidential Information" means all non-public information disclosed by either party. '
    '"Deliverables" shall mean the software and documentation.\n\n'
    "2. Payment Terms\n\n"
    "Client shall pay all fees within 30 days. Late payments incur penalty.\n\n"
    "3. Indemnification\n\n"
    "Provider shall indemnify Client for all claims. Subject to Section 4.2, liability limited.\n\n"
    "4. Limitation of Liability\n\n"
    "4.1 General Cap\n\n"
    "Liability shall not exceed fees paid.\n\n"
    "4.2 Data Breach Exception\n\n"
    "Notwithstanding anything to the contrary, Sections 4.1 and 3 shall not apply to Data Breaches.\n\n"
    "ARTICLE V\n\n"
    "Governing Law\n\n"
    "This agreement is governed by the laws of California.\n\n"
    "Section 5.1 Additional Terms\n\n"
    "Confidential Information means secret data that must be protected.\n"
)


def test_is_heading_line_numeric():
    assert _is_heading_line("1. Definitions") is True
    assert _is_heading_line("4.2 Data Breach Exception") is True
    assert _is_heading_line("2. Payment Terms") is True


def test_is_heading_line_article():
    assert _is_heading_line("ARTICLE V") is True
    assert _is_heading_line("Article 1 Introduction") is True


def test_is_heading_line_section():
    assert _is_heading_line("Section 5.1 Additional Terms") is True
    assert _is_heading_line("Section 4.2 Data Breach") is True


def test_is_heading_line_all_caps():
    assert _is_heading_line("GOVERNING LAW") is True
    assert _is_heading_line("CONFIDENTIAL INFORMATION PROTECTION") is True
    assert _is_heading_line("MASTER SERVICES AGREEMENT TERMS") is True


def test_is_heading_line_false():
    assert _is_heading_line("") is False
    assert _is_heading_line("   ") is False
    assert _is_heading_line("This is normal text.") is False
    assert _is_heading_line("LONG Header Title") is False


def test_is_heading_line_section_symbol():
    assert _is_heading_line("\u00a7 4 Indemnification") is True


def test_extract_section_number_numeric():
    assert _extract_section_number("1. Definitions") == "1"
    assert _extract_section_number("4.2 Data Breach") == "4.2"
    assert _extract_section_number("4.1 General Cap") == "4.1"


def test_extract_section_number_article():
    assert _extract_section_number("ARTICLE V") == "V"
    assert _extract_section_number("Article 1 Intro") == "1"


def test_extract_section_number_section():
    assert _extract_section_number("Section 5.1 Terms") == "5.1"


def test_extract_section_number_none():
    assert _extract_section_number("Preamble") == ""
    assert _extract_section_number("Governing Law") == ""
    assert _extract_section_number("ARTICLE") == ""
    assert _extract_section_number("SECTION") == ""


def test_compute_level():
    assert _compute_level("") == 1
    assert _compute_level("1") == 1
    assert _compute_level("4.1") == 2
    assert _compute_level("4.2.1") == 3
    assert _compute_level("4.2(a)") == 3
    assert _compute_level("1.2.3") == 3


def test_detect_clauses_basic(sample_contract_text):
    clauses = detect_clauses(sample_contract_text)
    assert len(clauses) >= 5
    for clause in clauses:
        assert clause.char_end >= clause.char_start
        assert clause.char_start >= 0


def test_detect_clauses_preamble():
    text = "This is intro preamble text.\n\n1. First Clause\nContent of first.\n\n2. Second Clause\nContent second."
    clauses = detect_clauses(text)
    assert clauses[0].title == "Preamble"
    assert "intro preamble" in clauses[0].content


def test_detect_clauses_no_heading():
    text = "This contract has no headings at all. Just plain text without structure."
    clauses = detect_clauses(text)
    assert len(clauses) == 1
    assert clauses[0].title == "Preamble"
    assert clauses[0].char_start == 0
    assert clauses[0].char_end == len(text)


def test_detect_clauses_exact_offsets():
    text = "1. First\nContent A\n\n2. Second\nContent B"
    clauses = detect_clauses(text)
    assert len(clauses) == 2
    assert text[clauses[0].char_start : clauses[0].char_end] == clauses[0].content
    assert text[clauses[1].char_start : clauses[1].char_end] == clauses[1].content


def test_detect_clauses_empty_raises():
    with pytest.raises(ClauseParsingError):
        detect_clauses("")
    with pytest.raises(ClauseParsingError):
        detect_clauses("   ")


def test_detect_clauses_char_end_clamping():
    text = "1. Clause One\nContent"
    clauses = detect_clauses(text)
    assert clauses[0].char_end <= len(text)


def test_extract_defined_terms_quoted():
    # Now AI-generated via LLM in structural_indexer_node; heuristic returns empty (no hardcoded search)
    text = '1. Definitions\n"Confidential Information" means secret data.\n"Deliverables" shall mean software.'
    clauses = detect_clauses(text)
    terms = extract_defined_terms(text, clauses)
    assert terms == {}  # AI path tested via nodes, not heuristic


def test_extract_defined_terms_capital_means():
    text = (
        "1. Definitions\nConfidential Information means secret data that is protected."
    )
    clauses = detect_clauses(text)
    terms = extract_defined_terms(text, clauses)
    assert terms == {}


def test_extract_defined_terms_no_clauses():
    assert extract_defined_terms("text", []) == {}


def test_extract_defined_terms_empty_definition():
    text = '1. Definitions\n"EmptyTerm" means '
    clauses = detect_clauses(text)
    terms = extract_defined_terms(text, clauses)
    assert terms == {}


def test_extract_defined_terms_duplicate_handling():
    text = '1. Clause\n"Term" means first definition.\n\n2. Clause2\n"Term" means second definition.'
    clauses = detect_clauses(text)
    terms = extract_defined_terms(text, clauses)
    assert terms == {}


def test_extract_metadata_parties(sample_contract_text):
    # AI-generated metadata via LLM; heuristic now returns empty parties
    clauses = detect_clauses(sample_contract_text)
    terms = extract_defined_terms(sample_contract_text, clauses)
    meta = extract_metadata(
        sample_contract_text,
        clauses,
        terms,
        document_id="test-doc",
        title="Test",
        source_filename="test.pdf",
    )
    assert meta.document_id == "test-doc"
    assert meta.total_clauses == len(clauses)
    assert meta.char_count == len(sample_contract_text)
    assert meta.parties == []


def test_extract_metadata_no_parties():
    text = "1. Clause\nContent without parties."
    clauses = detect_clauses(text)
    terms = extract_defined_terms(text, clauses)
    meta = extract_metadata(text, clauses, terms)
    assert meta.parties == []
    assert meta.effective_date is None
    assert meta.governing_law is None


def test_extract_metadata_effective_date():
    text = "Effective Date: January 15, 2024\n\n1. Clause\nContent"
    clauses = detect_clauses(text)
    meta = extract_metadata(text, clauses, {})
    assert meta.effective_date is None


def test_extract_metadata_governing_law():
    text = "This agreement is governed by the laws of California.\n\n1. Clause\nContent"
    clauses = detect_clauses(text)
    meta = extract_metadata(text, clauses, {})
    assert meta.governing_law is None


def test_chunk_document_success(sample_contract_text):
    doc = chunk_document(
        sample_contract_text,
        document_id="doc-001",
        title="MSA",
        source_filename="msa.pdf",
    )
    assert doc.raw_text == sample_contract_text
    assert len(doc.clauses) >= 5
    assert doc.metadata.document_id == "doc-001"
    assert doc.metadata.source_filename == "msa.pdf"
    assert isinstance(
        doc.defined_terms, dict
    )  # AI-generated via LLM in node, heuristic empty here
    for clause in doc.clauses:
        assert (
            doc.raw_text[clause.char_start : clause.char_end].strip() != ""
            or clause.content.strip() != ""
        )


def test_chunk_document_empty_raises():
    with pytest.raises(ClauseParsingError):
        chunk_document("")
    with pytest.raises(ClauseParsingError):
        chunk_document("   ")


def test_chunk_document_sample_contract():
    doc = chunk_document(SAMPLE_CONTRACT)
    assert len(doc.clauses) >= 6
    assert isinstance(doc.defined_terms, dict)
    for c in doc.clauses:
        assert c.char_start >= 0
        assert c.char_end <= len(SAMPLE_CONTRACT)


def test_chunk_document_article_detection():
    text = "ARTICLE I\nContent of article one\n\nARTICLE II\nContent two"
    doc = chunk_document(text)
    assert len(doc.clauses) == 2
    assert doc.clauses[0].section_number == "I"


def test_extract_defined_terms_capital_no_period():
    text = "1. Definitions\nConfidential Information means secret data without period"
    clauses = detect_clauses(text)
    terms = extract_defined_terms(text, clauses)
    assert terms == {}


def test_extract_defined_terms_capital_empty_snippet():
    text = "1. Definitions\nConfidential Information means "
    clauses = detect_clauses(text)
    terms = extract_defined_terms(text, clauses)
    assert terms == {}


def test_extract_defined_terms_quoted_no_period():
    text = '1. Definitions\n"TestTerm" means some definition without period'
    clauses = detect_clauses(text)
    terms = extract_defined_terms(text, clauses)
    assert terms == {}


def test_detect_clauses_preamble_empty_lines():
    text = "\n\n1. First Clause\nContent of first.\n\n2. Second Clause\nContent second."
    clauses = detect_clauses(text)
    # should not create extra preamble, just clauses for headings
    assert len(clauses) == 2
    assert clauses[0].title == "1. First Clause"


def test_is_heading_line_section_symbol_false():
    assert _is_heading_line("Not a heading: 123") is False


def test_compute_level_with_parens():
    assert _compute_level("4.2(a)") == 3
    assert _compute_level("1(a)") == 2
