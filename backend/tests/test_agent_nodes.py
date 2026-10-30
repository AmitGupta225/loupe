"""Tests for agent nodes - Part A."""

import time
from unittest.mock import AsyncMock, patch
import pytest
from app.agents.nodes import (
    TriageResponse,
    _make_trace,
    _now,
    clause_triage_node,
    cross_reference_resolver_node,
    find_quote_offsets,
    structural_indexer_node,
)
from app.agents.prompts import (
    build_executive_user_prompt,
    build_grounding_repair_user_prompt,
    build_inspector_user_prompt,
    build_triage_user_prompt,
    get_executive_system_prompt,
    get_grounding_repair_system_prompt,
    get_inspector_system_prompt,
    get_triage_system_prompt,
)
from app.schemas.analysis import (
    ExecutivePosture,
    GroundingStatus,
    RiskFinding,
    Severity,
)
from app.schemas.contract import ClauseNode

SAMPLE_TEXT = (
    'MASTER SERVICES AGREEMENT\n\n1. Definitions\n\n"Confidential Information" means secret data.\n\n'
    "2. Payment Terms\n\nClient shall pay fees within 30 days.\n\n"
    "3. Indemnification\n\nProvider shall indemnify Client for all claims. Subject to Section 4.2.\n\n"
    "4. Limitation of Liability\n\n4.1 General Cap\n\nLiability cap $100k.\n\n"
    "4.2 Data Breach Exception\n\nNotwithstanding anything, Sections 4.1 and 3 shall not apply to Data Breaches.\n"
)


def make_clause(id_val, title, content, char_start=0, section=""):
    return ClauseNode(
        id=id_val,
        title=title,
        content=content,
        char_start=char_start,
        char_end=char_start + len(content),
        level=1,
        section_number=section,
        clause_type="general",
    )


def test_now_and_make_trace():
    t = _now()
    assert isinstance(t, float)
    trace = _make_trace("test_node", t, "completed", "detail")
    assert trace["node"] == "test_node"
    assert trace["duration_ms"] >= 0


def test_find_quote_offsets_exact():
    raw = "Provider shall indemnify Client for all claims."
    assert find_quote_offsets("shall indemnify", raw) == (
        raw.find("shall indemnify"),
        raw.find("shall indemnify") + len("shall indemnify"),
    )


def test_find_quote_offsets_normalized():
    raw = "Provider shall  indemnify\nClient for all claims."
    assert find_quote_offsets("shall indemnify Client", raw) is not None


def test_find_quote_offsets_not_found():
    assert find_quote_offsets("nonexistent quote xyz", "Hello world") is None


def test_find_quote_offsets_empty():
    assert find_quote_offsets("", "raw") is None
    assert find_quote_offsets("quote", "") is None
    assert find_quote_offsets(None, "raw") is None


def test_get_triage_system_prompt():
    assert "Indemnification" in get_triage_system_prompt()


def test_build_triage_user_prompt():
    c1 = make_clause("clause-1", "1. Definitions", "content here", section="1")
    prompt = build_triage_user_prompt([c1])
    assert "clause-1" in prompt


def test_build_triage_user_prompt_empty():
    assert build_triage_user_prompt([]) == "No clauses to triage."


def test_get_inspector_system_prompt():
    assert "senior legal risk" in get_inspector_system_prompt().lower()


def test_build_inspector_user_prompt():
    c1 = make_clause("clause-1", "3. Indemnification", "Provider shall indemnify")
    assert "clause-1" in build_inspector_user_prompt(c1, "Resolved context")


def test_build_inspector_user_prompt_no_clause():
    assert build_inspector_user_prompt(None, "ctx") == "No clause provided."


def test_get_executive_system_prompt():
    assert "executive legal strategist" in get_executive_system_prompt().lower()


def test_build_executive_user_prompt():
    c1 = make_clause("c1", "T", "content")
    f = RiskFinding(
        clause_id="c1",
        title="Risk",
        category="Indemnification",
        severity=Severity.HIGH,
        exact_quote="quote",
        char_start=0,
        char_end=5,
        plain_english_explanation="exp",
        worst_case_scenario="worst",
        recommended_redline="redline",
    )
    prompt = build_executive_user_prompt([c1], [f])
    assert "HIGH" in prompt


def test_build_grounding_repair_user_prompt():
    assert "clause text" in build_grounding_repair_user_prompt(
        "clause text", "paraphrased"
    )


def test_build_grounding_repair_user_prompt_empty():
    assert (
        build_grounding_repair_user_prompt("", "quote")
        == "No clause or quote provided for repair."
    )
    assert (
        build_grounding_repair_user_prompt("text", "")
        == "No clause or quote provided for repair."
    )
    assert (
        build_grounding_repair_user_prompt(None, None)
        == "No clause or quote provided for repair."
    )


def test_build_executive_user_prompt_clauses_empty_findings():
    c1 = make_clause("c1", "T", "content")
    f = RiskFinding(
        clause_id="c1",
        title="Risk",
        category="Term",
        severity=Severity.LOW,
        exact_quote="q",
        char_start=0,
        char_end=1,
        plain_english_explanation="e",
        worst_case_scenario="w",
        recommended_redline="r",
    )
    prompt = build_executive_user_prompt([], [f])
    assert "Total clauses indexed: 0" in prompt
    assert "Total risk findings: 1" in prompt
    prompt2 = build_executive_user_prompt(None, [f])
    assert "Total clauses indexed: 0" in prompt2


@pytest.mark.asyncio
async def test_structural_indexer_node_success():
    state = {"raw_text": SAMPLE_TEXT, "document_id": "doc-001", "execution_trace": []}
    result = await structural_indexer_node(state)
    assert len(result["clauses"]) >= 5
    assert result["execution_trace"][0]["node"] == "structural_indexer"


@pytest.mark.asyncio
async def test_structural_indexer_node_empty():
    state = {"raw_text": "   ", "execution_trace": []}
    result = await structural_indexer_node(state)
    assert result["execution_trace"][0]["status"] == "failed"


@pytest.mark.asyncio
async def test_structural_indexer_node_missing_raw():
    state = {"execution_trace": []}
    result = await structural_indexer_node(state)
    assert result["execution_trace"][0]["status"] == "failed"


@pytest.mark.asyncio
async def test_clause_triage_node_success():
    c1 = make_clause(
        "clause-1", "3. Indemnification", "Provider shall indemnify", section="3"
    )
    c2 = make_clause("clause-2", "4.1 Cap", "Liability cap", section="4.1")
    state = {"clauses": [c1, c2], "execution_trace": []}
    raw_json = TriageResponse(flagged_clause_ids=["clause-1"]).model_dump_json()
    # include think block and markdown fence to test real post-processing
    fenced = f"<think> reasoning about triage </think>\n```json\n{raw_json}\n```"
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.return_value = fenced
        result = await clause_triage_node(state)
        assert result["flagged_clause_ids"] == ["clause-1"]
        payload = mock_exec.call_args[0][0]
        assert payload["model"] == "meta-models/Muse-Spark-Open-816B-A42B"
        assert payload["temperature"] == 0.1
        assert payload["messages"][0]["content"] == get_triage_system_prompt()
        assert "clause-1" in payload["messages"][1]["content"]
        assert "clause-2" in payload["messages"][1]["content"]


@pytest.mark.asyncio
async def test_clause_triage_node_filter_invalid_ids():
    c1 = make_clause("clause-1", "T", "content")
    state = {"clauses": [c1], "execution_trace": []}
    raw_json = TriageResponse(
        flagged_clause_ids=["clause-1", "clause-999"]
    ).model_dump_json()
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.return_value = raw_json
        result = await clause_triage_node(state)
        assert result["flagged_clause_ids"] == ["clause-1"]


@pytest.mark.asyncio
async def test_clause_triage_node_no_clauses():
    state = {"clauses": [], "execution_trace": []}
    result = await clause_triage_node(state)
    assert result["flagged_clause_ids"] == []
    assert result["execution_trace"][0]["status"] == "skipped"


@pytest.mark.asyncio
async def test_clause_triage_node_llm_failure():
    c1 = make_clause("clause-1", "T", "content")
    state = {"clauses": [c1], "execution_trace": []}
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.side_effect = Exception("LLM failed")
        result = await clause_triage_node(state)
        assert result["flagged_clause_ids"] == []
        assert result["execution_trace"][0]["status"] == "failed"


@pytest.mark.asyncio
async def test_cross_reference_resolver_node_success():
    c1 = make_clause(
        "clause-1",
        "3. Indemnification",
        "Subject to Section 4.2, indemnify",
        section="3",
    )
    c2 = make_clause(
        "clause-2",
        "4.2 Exception",
        "Notwithstanding Section 3, uncapped",
        section="4.2",
    )
    state = {
        "flagged_clause_ids": ["clause-1"],
        "clauses": [c1, c2],
        "defined_terms": {"Confidential Information": "secret"},
        "execution_trace": [],
    }
    result = await cross_reference_resolver_node(state)
    assert "clause-1" in result["resolved_contexts"]
    assert "TARGET CLAUSE" in result["resolved_contexts"]["clause-1"]


@pytest.mark.asyncio
async def test_cross_reference_resolver_node_no_flagged():
    state = {
        "flagged_clause_ids": [],
        "clauses": [make_clause("c1", "T", "content")],
        "execution_trace": [],
    }
    result = await cross_reference_resolver_node(state)
    assert result["resolved_contexts"] == {}


@pytest.mark.asyncio
async def test_cross_reference_resolver_node_missing_clause():
    c1 = make_clause("clause-1", "T", "content")
    state = {
        "flagged_clause_ids": ["clause-999"],
        "clauses": [c1],
        "defined_terms": {},
        "execution_trace": [],
    }
    result = await cross_reference_resolver_node(state)
    assert result["resolved_contexts"] == {}


@pytest.mark.asyncio
async def test_cross_reference_resolver_node_no_clauses():
    state = {"flagged_clause_ids": ["clause-1"], "clauses": [], "execution_trace": []}
    result = await cross_reference_resolver_node(state)
    assert result["resolved_contexts"] == {}


@pytest.mark.asyncio
async def test_clause_triage_caps_large_docs():
    clauses = [
        make_clause(f"clause-{i}", f"{i}. Title", f"content {i}") for i in range(45)
    ]
    state = {"clauses": clauses, "execution_trace": []}
    raw_json = TriageResponse(flagged_clause_ids=["clause-1"]).model_dump_json()
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.return_value = raw_json
        result = await clause_triage_node(state)
        assert result["flagged_clause_ids"] == ["clause-1"]
        # Verify no hardcoded cap - all 45 clauses are sent to LLM
        payload = mock_exec.call_args[0][0]
        content = payload["messages"][1]["content"]
        assert "clause-39" in content
        assert "clause-44" in content


@pytest.mark.asyncio
async def test_deep_inspector_caps_flagged():
    from app.agents.nodes import deep_liability_inspector_node

    clauses = [make_clause(f"clause-{i}", f"T {i}", f"content {i}") for i in range(12)]
    flagged = [f"clause-{i}" for i in range(12)]
    state = {
        "flagged_clause_ids": flagged,
        "clauses": clauses,
        "resolved_contexts": {},
        "execution_trace": [],
    }
    # Mock to return a valid finding for each call
    from app.schemas.analysis import RiskFinding, Severity

    def make_f(i):
        return RiskFinding(
            clause_id=f"clause-{i}",
            title=f"Risk {i}",
            category="Indemnification",
            severity=Severity.HIGH,
            exact_quote=f"content {i}",
            char_start=0,
            char_end=9,
            plain_english_explanation="exp",
            worst_case_scenario="worst",
            referenced_terms_used=[],
            recommended_redline="fix",
            grounding_status="VERIFIED_EXACT",
        ).model_dump_json()

    from app.agents.nodes import InspectorBatchResponse

    batch_findings = [
        RiskFinding(
            clause_id=f"clause-{i}",
            title=f"Risk {i}",
            category="Indemnification",
            severity=Severity.HIGH,
            exact_quote=f"content {i}",
            char_start=0,
            char_end=9,
            plain_english_explanation="exp",
            worst_case_scenario="worst",
            referenced_terms_used=[],
            recommended_redline="fix",
            grounding_status="VERIFIED_EXACT",
        )
        for i in range(10)
    ]
    batch_json = InspectorBatchResponse(findings=batch_findings).model_dump_json()
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.return_value = batch_json
        result = await deep_liability_inspector_node(state)
        # No hardcoded cap - all 12 flagged are inspected (but mock returns 10 findings)
        assert len(result["raw_findings"]) == 10
        assert mock_exec.call_count == 1


def test_build_inspector_batch_empty():
    from app.agents.prompts import build_inspector_batch_user_prompt

    assert build_inspector_batch_user_prompt([]) == "No clauses to inspect."


def test_build_inspector_batch_with_and_without_context():
    from app.agents.prompts import build_inspector_batch_user_prompt

    c1 = make_clause("clause-1", "T", "content with context")
    c2 = make_clause("clause-2", "T2", "content without")
    prompt = build_inspector_batch_user_prompt([(c1, "ctx text"), (c2, "")])
    assert "clause-1" in prompt
    assert "ctx text" in prompt
    assert "clause-2" in prompt
    prompt2 = build_inspector_batch_user_prompt([(c1, "   ")])
    assert "Resolved Context" not in prompt2


def test_build_inspector_prompt_whitespace_context():
    from app.agents.prompts import build_inspector_user_prompt

    c1 = make_clause("clause-1", "T", "content")
    p1 = build_inspector_user_prompt(c1, "   ")
    assert "Resolved Context" not in p1
    p2 = build_inspector_user_prompt(c1, "valid ctx")
    assert "valid ctx" in p2
