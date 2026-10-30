"""Tests for agent nodes - Part B1."""

from unittest.mock import AsyncMock, patch
import pytest
from app.agents.nodes import deep_liability_inspector_node, grounding_verifier_node, should_retry_grounding
from app.agents.prompts import get_inspector_system_prompt
from app.schemas.analysis import GroundingStatus, RiskFinding, Severity
from app.schemas.contract import ClauseNode

def make_clause(id_val, title, content, char_start=0, section=""):
    return ClauseNode(id=id_val, title=title, content=content, char_start=char_start, char_end=char_start + len(content), level=1, section_number=section, clause_type="general")

def make_finding(clause_id, quote, severity=Severity.HIGH):
    return RiskFinding(clause_id=clause_id, title="Risk", category="Indemnification", severity=severity, exact_quote=quote, char_start=0, char_end=len(quote), plain_english_explanation="exp", worst_case_scenario="worst", recommended_redline="redline")

@pytest.mark.asyncio
async def test_deep_liability_inspector_success():
    from app.agents.nodes import InspectorBatchResponse

    c1 = make_clause("clause-1", "3. Indemnification", "Provider shall indemnify Client for all claims", section="3")
    state = {"flagged_clause_ids": ["clause-1"], "clauses": [c1], "resolved_contexts": {"clause-1": "Context with Section 4.2"}, "execution_trace": []}
    finding = make_finding("clause-1", "Provider shall indemnify Client for all claims")
    batch = InspectorBatchResponse(findings=[finding])
    raw_json = batch.model_dump_json()
    fenced = f"```json\n{raw_json}\n```"
    with patch("app.core.llm._execute_modal_call", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = fenced
        result = await deep_liability_inspector_node(state)
        assert len(result["raw_findings"]) == 1
        payload = mock_exec.call_args[0][0]
        assert payload["model"] == "meta-models/Muse-Spark-Open-816B-A42B"
        assert payload["messages"][0]["content"] == get_inspector_system_prompt()
        assert "clause-1" in payload["messages"][1]["content"]
        assert "Context with Section 4.2" in payload["messages"][1]["content"]

@pytest.mark.asyncio
async def test_deep_liability_inspector_no_flagged():
    state = {"flagged_clause_ids": [], "clauses": [], "execution_trace": []}
    result = await deep_liability_inspector_node(state)
    assert result["raw_findings"] == []

@pytest.mark.asyncio
async def test_deep_liability_inspector_missing_clause():
    c1 = make_clause("clause-1", "T", "content")
    state = {"flagged_clause_ids": ["clause-999"], "clauses": [c1], "resolved_contexts": {}, "execution_trace": []}
    result = await deep_liability_inspector_node(state)
    assert result["raw_findings"] == []

@pytest.mark.asyncio
async def test_deep_liability_inspector_llm_exception():
    c1 = make_clause("clause-1", "T", "content")
    state = {"flagged_clause_ids": ["clause-1"], "clauses": [c1], "resolved_contexts": {}, "execution_trace": []}
    with patch("app.core.llm._execute_modal_call", new_callable=AsyncMock) as mock_exec:
        mock_exec.side_effect = Exception("fail")
        result = await deep_liability_inspector_node(state)
        assert result["raw_findings"] == []

@pytest.mark.asyncio
async def test_grounding_verifier_verified():
    raw_text = "Provider shall indemnify Client for all claims. Payment terms apply."
    finding = make_finding("clause-1", "Provider shall indemnify Client for all claims")
    c1 = make_clause("clause-1", "T", "Provider shall indemnify Client for all claims", char_start=0)
    state = {"raw_text": raw_text, "raw_findings": [finding], "clauses": [c1], "retry_count": 0, "execution_trace": []}
    result = await grounding_verifier_node(state)
    assert result["verified_findings"][0].grounding_status == GroundingStatus.VERIFIED_EXACT
    assert len(result["unverified_findings"]) == 0

@pytest.mark.asyncio
async def test_grounding_verifier_unverified_then_anchored():
    raw_text = "Provider shall indemnify."
    finding = make_finding("clause-1", "paraphrased quote not in text xyz")
    c1 = make_clause("clause-1", "T", "Provider shall indemnify Client", char_start=5, section="3")
    state = {"raw_text": raw_text, "raw_findings": [finding], "clauses": [c1], "retry_count": 0, "execution_trace": []}
    result = await grounding_verifier_node(state)
    assert len(result["unverified_findings"]) == 1
    state2 = {"raw_text": raw_text, "raw_findings": [finding], "clauses": [c1], "retry_count": 1, "execution_trace": []}
    result2 = await grounding_verifier_node(state2)
    assert result2["verified_findings"][0].grounding_status == GroundingStatus.CLAUSE_ANCHORED
    assert result2["verified_findings"][0].char_start == c1.char_start

@pytest.mark.asyncio
async def test_grounding_verifier_anchored_no_parent():
    finding = make_finding("clause-999", "not found quote")
    state = {"raw_text": "Hello world", "raw_findings": [finding], "clauses": [], "retry_count": 1, "execution_trace": []}
    result = await grounding_verifier_node(state)
    assert result["verified_findings"][0].grounding_status == GroundingStatus.CLAUSE_ANCHORED

@pytest.mark.asyncio
async def test_grounding_verifier_no_findings():
    state = {"raw_text": "text", "raw_findings": [], "execution_trace": []}
    result = await grounding_verifier_node(state)
    assert result["execution_trace"][0]["status"] == "skipped"

def test_should_retry_grounding_true():
    f = make_finding("c1", "quote")
    assert should_retry_grounding({"unverified_findings": [f], "retry_count": 0}) == "retry"

def test_should_retry_grounding_false():
    f = make_finding("c1", "quote")
    assert should_retry_grounding({"unverified_findings": [], "retry_count": 0}) == "continue"
    assert should_retry_grounding({"unverified_findings": [f], "retry_count": 1}) == "continue"
    assert should_retry_grounding({}) == "continue"
