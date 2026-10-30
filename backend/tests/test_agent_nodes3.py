"""Tests for agent nodes - Part B2."""

from unittest.mock import AsyncMock, patch
import pytest
from app.agents.nodes import quote_repair_node, executive_posture_node
from app.schemas.analysis import (
    ExecutivePosture,
    GroundingStatus,
    RiskFinding,
    Severity,
)
from app.schemas.contract import ClauseNode


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


def make_finding(clause_id, quote, severity=Severity.HIGH):
    return RiskFinding(
        clause_id=clause_id,
        title="Risk",
        category="Indemnification",
        severity=severity,
        exact_quote=quote,
        char_start=0,
        char_end=len(quote),
        plain_english_explanation="exp",
        worst_case_scenario="worst",
        recommended_redline="redline",
    )


@pytest.mark.asyncio
async def test_quote_repair_node_success():
    raw_text = "Provider shall indemnify Client for all claims. Extra content."
    c1 = make_clause(
        "clause-1",
        "T",
        "Provider shall indemnify Client for all claims. Extra",
        char_start=0,
    )
    finding = make_finding("clause-1", "bad quote")
    state = {
        "unverified_findings": [finding],
        "clauses": [c1],
        "raw_text": raw_text,
        "verified_findings": [],
        "retry_count": 0,
        "execution_trace": [],
    }
    result = await quote_repair_node(state)
    assert len(result["verified_findings"]) == 1
    assert result["retry_count"] == 1


@pytest.mark.asyncio
async def test_quote_repair_node_anchored():
    raw_text = "Some other text."
    c1 = make_clause(
        "clause-1",
        "T",
        "Unrelated clause content that is not in raw_text",
        char_start=10,
    )
    finding = make_finding("clause-1", "bad")
    state = {
        "unverified_findings": [finding],
        "clauses": [c1],
        "raw_text": raw_text,
        "verified_findings": [],
        "retry_count": 0,
        "execution_trace": [],
    }
    result = await quote_repair_node(state)
    assert (
        result["verified_findings"][0].grounding_status
        == GroundingStatus.CLAUSE_ANCHORED
    )


@pytest.mark.asyncio
async def test_quote_repair_node_no_parent():
    finding = make_finding("clause-999", "bad")
    state = {
        "unverified_findings": [finding],
        "clauses": [],
        "raw_text": "text",
        "verified_findings": [],
        "retry_count": 0,
        "execution_trace": [],
    }
    result = await quote_repair_node(state)
    assert (
        result["verified_findings"][0].grounding_status
        == GroundingStatus.CLAUSE_ANCHORED
    )


@pytest.mark.asyncio
async def test_quote_repair_node_no_unverified():
    state = {"unverified_findings": [], "execution_trace": []}
    result = await quote_repair_node(state)
    assert result["execution_trace"][0]["status"] == "skipped"


@pytest.mark.asyncio
async def test_quote_repair_node_candidate_off_none():
    raw_text = "Raw text without candidate."
    c1 = make_clause(
        "clause-1", "T", "Candidate that is not in raw_text at all xyz", char_start=0
    )
    finding = make_finding("clause-1", "bad")
    state = {
        "unverified_findings": [finding],
        "clauses": [c1],
        "raw_text": raw_text,
        "verified_findings": [],
        "retry_count": 0,
        "execution_trace": [],
    }
    result = await quote_repair_node(state)
    assert (
        result["verified_findings"][0].grounding_status
        == GroundingStatus.CLAUSE_ANCHORED
    )


@pytest.mark.asyncio
async def test_executive_posture_node_success():
    c1 = make_clause("clause-1", "T", "content")
    f = make_finding("clause-1", "quote", severity=Severity.HIGH)
    posture = ExecutivePosture(
        risk_score=20,
        risk_distribution={"HIGH": 1, "MEDIUM": 0, "LOW": 0},
        negotiation_priorities=["priority"],
        missing_protections=["protection"],
        verdict="Low risk",
        conclusion="Proceed with review",
        advice="Fine.",
    )
    state = {"clauses": [c1], "verified_findings": [f], "execution_trace": []}
    raw_json = posture.model_dump_json()
    fenced = f"<think>exec reasoning</think>\n```json\n{raw_json}\n```"
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.return_value = fenced
        result = await executive_posture_node(state)
        assert result["executive_summary"].risk_score == 20
        assert result["executive_summary"].verdict == "Low risk"
        assert result["executive_summary"].conclusion == "Proceed with review"
        payload = mock_exec.call_args[0][0]
        assert payload["model"] == "meta-models/Muse-Spark-Open-816B-A42B"


async def test_executive_posture_node_enforces_consistency():
    c1 = make_clause("clause-1", "T", "content")
    f = make_finding("clause-1", "quote", severity=Severity.LOW)
    # LLM hallucinates High risk / Do not sign with wrong score for LOW finding (should be 3 Low risk)
    posture = ExecutivePosture(
        risk_score=90,
        risk_distribution={"HIGH": 1, "MEDIUM": 0, "LOW": 0},
        negotiation_priorities=["priority"],
        missing_protections=["protection"],
        verdict="High risk",
        conclusion="Do not sign",
        advice="Talk to lawyer.",
    )
    state = {"clauses": [c1], "verified_findings": [f], "execution_trace": []}
    raw_json = posture.model_dump_json()
    fenced = f"```json\n{raw_json}\n```"
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.return_value = fenced
        result = await executive_posture_node(state)
        # Should be corrected to LOW distribution and low score/verdict
        assert result["executive_summary"].risk_distribution == {
            "HIGH": 0,
            "MEDIUM": 0,
            "LOW": 1,
        }
        assert result["executive_summary"].risk_score == 3
        assert result["executive_summary"].verdict == "Low risk"
        assert result["executive_summary"].conclusion == "Proceed with review"


@pytest.mark.asyncio
async def test_executive_posture_node_fallback():
    c1 = make_clause("c1", "T", "content")
    f = make_finding("c1", "quote", severity=Severity.HIGH)
    state = {"clauses": [c1], "verified_findings": [f], "execution_trace": []}
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.side_effect = Exception("LLM failed")
        result = await executive_posture_node(state)
        assert result["executive_summary"].risk_score > 0


@pytest.mark.asyncio
async def test_executive_posture_node_fallback_critical():
    c1 = make_clause("c1", "T", "content")
    f = make_finding("c1", "quote", severity=Severity.HIGH)
    state = {"clauses": [c1], "verified_findings": [f], "execution_trace": []}
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.side_effect = Exception("fail")
        result = await executive_posture_node(state)
        assert (
            "Missing mutual liability cap"
            in result["executive_summary"].missing_protections
        )


@pytest.mark.asyncio
async def test_executive_posture_node_no_data():
    state = {"clauses": [], "verified_findings": [], "execution_trace": []}
    result = await executive_posture_node(state)
    assert result["execution_trace"][0]["status"] == "skipped"


@pytest.mark.asyncio
async def test_executive_posture_node_fallback_low():
    c1 = make_clause("c1", "T", "content")
    f = make_finding("c1", "quote", severity=Severity.LOW)
    state = {"clauses": [c1], "verified_findings": [f], "execution_trace": []}
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.side_effect = Exception("fail")
        result = await executive_posture_node(state)
        assert result["executive_summary"].risk_score == 3
