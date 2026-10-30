"""Coverage for AI-generated defined terms and metadata - fills 100% gaps."""

import pytest
from unittest.mock import AsyncMock, patch
from app.agents.nodes import (
    DefinedTermsLLMResponse,
    DocumentMetadataLLMResponse,
    structural_indexer_node,
)
from app.agents.prompts import (
    build_defined_terms_user_prompt,
    build_document_metadata_user_prompt,
    get_defined_terms_system_prompt,
    get_document_metadata_system_prompt,
)
from app.services.chunker import (
    _is_heading_line,
    extract_defined_terms,
    extract_metadata,
)


def test_defined_terms_prompts_empty():
    assert "No contract text" in build_defined_terms_user_prompt("")
    assert "No contract text" in build_defined_terms_user_prompt("   ")
    assert "legal definition extractor" in get_defined_terms_system_prompt().lower()


def test_metadata_prompts_empty():
    assert "No contract text" in build_document_metadata_user_prompt("")
    assert "legal metadata extractor" in get_document_metadata_system_prompt().lower()


def test_defined_terms_prompts_with_text():
    prompt = build_defined_terms_user_prompt("Sample contract text here")
    assert "Sample contract" in prompt
    assert "defined_terms" in prompt


def test_metadata_prompt_with_text():
    prompt = build_document_metadata_user_prompt("Sample contract parties")
    assert "Sample contract" in prompt
    assert "parties" in prompt


def test_extract_defined_terms_always_empty():
    assert extract_defined_terms("any", []) == {}
    assert extract_defined_terms("", []) == {}


def test_extract_metadata_empty_parties():
    from app.services.chunker import detect_clauses

    text = "1. First\nContent"
    clauses = detect_clauses(text)
    meta = extract_metadata(text, clauses, {})
    assert meta.parties == []
    assert meta.effective_date is None
    assert meta.governing_law is None
    assert meta.total_clauses == len(clauses)
    assert meta.char_count == len(text)


def test_is_heading_line_branches():
    assert _is_heading_line("") is False
    assert _is_heading_line("   ") is False
    assert _is_heading_line("Normal sentence without heading") is False
    assert _is_heading_line("GOVERNING LAW") is True
    assert _is_heading_line("§ 4 Something") is True
    assert _is_heading_line("1. Definitions") is True
    assert _is_heading_line("ARTICLE V") is True
    assert _is_heading_line("Section 5.1 Terms") is True
    # all caps with hyphen allowed
    assert _is_heading_line("MASTER-SERVICES AGREEMENT") is True
    # all caps but with lowercase should fail upper check
    assert _is_heading_line("Governing Law") is False


@pytest.mark.asyncio
async def test_structural_indexer_empty_raw_text():
    state = {
        "raw_text": "   ",
        "document_id": "doc-001",
        "clauses": [],
        "defined_terms": {},
        "execution_trace": [],
    }
    result = await structural_indexer_node(state)
    assert "execution_trace" in result
    assert result["execution_trace"][-1]["status"] == "failed"


@pytest.mark.asyncio
async def test_structural_indexer_llm_enrichment_success():
    raw = "1. Definitions\nConfidential Information means secret.\n2. Payment\nPay."
    state = {
        "raw_text": raw,
        "document_id": "doc-001",
        "clauses": [],
        "defined_terms": {},
        "execution_trace": [],
    }
    dt_json = DefinedTermsLLMResponse(
        defined_terms={"Confidential Information": "secret"}
    ).model_dump_json()
    meta_json = DocumentMetadataLLMResponse(
        parties=["Alpha", "Beta"],
        effective_date="2024-01-15",
        governing_law="California",
        title="MSA",
    ).model_dump_json()
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.side_effect = [dt_json, meta_json]
        result = await structural_indexer_node(state)
        assert len(result["clauses"]) >= 2
        assert result["defined_terms"] == {"Confidential Information": "secret"}
        assert result["metadata"].parties == ["Alpha", "Beta"]
        assert result["metadata"].governing_law == "California"


@pytest.mark.asyncio
async def test_structural_indexer_llm_fallback_on_error():
    raw = "1. Definitions\nContent"
    state = {
        "raw_text": raw,
        "document_id": "doc-001",
        "clauses": [],
        "defined_terms": {},
        "execution_trace": [],
    }
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.side_effect = Exception("LLM down")
        result = await structural_indexer_node(state)
        # fallback to empty defined_terms, still succeeds
        assert len(result["clauses"]) >= 1
        assert result["defined_terms"] == {}
        assert result["metadata"].parties == []
