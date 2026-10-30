"""Tests for LangGraph workflow - Part 1."""

from unittest.mock import AsyncMock, patch
import pytest
from app.agents.graph import build_graph, get_compiled_graph, run_analysis
from app.agents.nodes import (
    DefinedTermsLLMResponse,
    DocumentMetadataLLMResponse,
    InspectorBatchResponse,
    TriageResponse,
)
from app.schemas.analysis import (
    ExecutivePosture,
    GroundingStatus,
    RiskFinding,
    Severity,
)


def _defined_terms_json():
    return DefinedTermsLLMResponse(
        defined_terms={"Confidential Information": "secret data"}
    ).model_dump_json()


def _metadata_json():
    return DocumentMetadataLLMResponse(
        parties=["Alpha", "Beta"],
        effective_date="2024-01-15",
        governing_law="California",
        title="Test Agreement",
    ).model_dump_json()


SAMPLE_TEXT = (
    '1. Definitions\n\n"Confidential Information" means secret data.\n\n'
    "2. Payment Terms\n\nClient shall pay fees.\n\n"
    "3. Indemnification\n\nProvider shall indemnify Client for all claims.\n\n"
    "4. Limitation of Liability\n\nLiability cap $100k.\n"
)


def make_finding(quote, clause_id="clause-1"):
    return RiskFinding(
        clause_id=clause_id,
        title="Indemnification Risk",
        category="Indemnification",
        severity=Severity.HIGH,
        exact_quote=quote,
        char_start=0,
        char_end=len(quote),
        plain_english_explanation="exp",
        worst_case_scenario="worst",
        recommended_redline="redline",
    )


def test_build_graph_structure():
    graph = build_graph()
    assert graph is not None
    assert "structural_indexer" in graph.nodes
    assert "clause_triage" in graph.nodes
    assert "executive_posture" in graph.nodes


def test_get_compiled_graph():
    compiled = get_compiled_graph()
    assert compiled is not None
    assert hasattr(compiled, "ainvoke")


@pytest.mark.asyncio
async def test_run_analysis_full_flow():
    raw_text = SAMPLE_TEXT
    triage_resp = TriageResponse(flagged_clause_ids=["clause-3"])
    finding = make_finding(
        "Provider shall indemnify Client for all claims", clause_id="clause-3"
    )
    posture = ExecutivePosture(
        risk_score=20,
        risk_distribution={"HIGH": 1, "MEDIUM": 0, "LOW": 0},
        negotiation_priorities=["Indemnification"],
        missing_protections=["Missing cap"],
        verdict="Low risk",
        conclusion="Proceed with review",
        advice="Advice text here.",
    )
    triage_json = triage_resp.model_dump_json()
    batch = InspectorBatchResponse(findings=[finding])
    finding_json = batch.model_dump_json()
    posture_json = posture.model_dump_json()
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.side_effect = [
            _defined_terms_json(),
            _metadata_json(),
            triage_json,
            finding_json,
            posture_json,
        ]
        result = await run_analysis(raw_text, document_id="doc-test")
        assert "clauses" in result
        assert len(result["clauses"]) >= 3
        assert result["flagged_clause_ids"] == ["clause-3"]
        assert len(result["verified_findings"]) == 1
        assert (
            result["verified_findings"][0].grounding_status
            == GroundingStatus.VERIFIED_EXACT
        )
        assert result["executive_summary"].risk_score == 20
        assert len(result["execution_trace"]) >= 5
        nodes = [t["node"] for t in result["execution_trace"]]
        assert "structural_indexer" in nodes
        assert "executive_posture" in nodes
        assert mock_exec.call_count == 5
        # verify pre-call payload correctness (first call is defined terms, third is triage)
        # first two are defined_terms + metadata, so check triage payload at index 2
        triage_payload = mock_exec.call_args_list[2][0][0]
        assert triage_payload["model"] == "meta-models/Muse-Spark-Open-816B-A42B"
        assert triage_payload["temperature"] == 0.1


@pytest.mark.asyncio
async def test_run_analysis_with_paraphrased_quote_retry():
    raw_text = SAMPLE_TEXT
    triage_resp = TriageResponse(flagged_clause_ids=["clause-3"])
    bad_finding = make_finding(
        "Provider will indemnify Client fully", clause_id="clause-3"
    )
    posture = ExecutivePosture(
        risk_score=50,
        risk_distribution={"HIGH": 1},
        negotiation_priorities=["p"],
        missing_protections=[],
    )
    triage_json = triage_resp.model_dump_json()
    batch_bad = InspectorBatchResponse(findings=[bad_finding])
    bad_json = batch_bad.model_dump_json()
    # wrap bad_finding in think + fence to test real parsing
    bad_fenced = f"<think> bad paraphrase </think>\n```json\n{bad_json}\n```"
    posture_json = posture.model_dump_json()
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.side_effect = [
            _defined_terms_json(),
            _metadata_json(),
            triage_json,
            bad_fenced,
            posture_json,
        ]
        result = await run_analysis(raw_text)
        assert len(result["verified_findings"]) == 1
        assert result["retry_count"] == 1
        nodes = [t["node"] for t in result["execution_trace"]]
        assert "quote_repair" in nodes
        assert result["verified_findings"][0].grounding_status in (
            GroundingStatus.CLAUSE_ANCHORED,
            GroundingStatus.VERIFIED_EXACT,
        )


@pytest.mark.asyncio
async def test_run_analysis_with_think_fenced_response():
    raw_text = SAMPLE_TEXT
    triage_resp = TriageResponse(flagged_clause_ids=["clause-3"])
    finding = make_finding(
        "Provider shall indemnify Client for all claims", clause_id="clause-3"
    )
    batch_with = InspectorBatchResponse(findings=[finding])
    finding_json_with_think = (
        "<think>reasoning</think>\n```json\n" + batch_with.model_dump_json() + "\n```"
    )
    posture = ExecutivePosture(
        risk_score=60,
        risk_distribution={},
        negotiation_priorities=[],
        missing_protections=[],
    )
    triage_json = triage_resp.model_dump_json()
    exec_json = posture.model_dump_json()
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.side_effect = [
            _defined_terms_json(),
            _metadata_json(),
            triage_json,
            finding_json_with_think,
            exec_json,
        ]
        result = await run_analysis(raw_text)
        assert len(result["verified_findings"]) == 1
        assert (
            result["verified_findings"][0].grounding_status
            == GroundingStatus.VERIFIED_EXACT
        )


@pytest.mark.asyncio
async def test_run_analysis_on_event_callback():
    raw_text = SAMPLE_TEXT
    triage_resp = TriageResponse(flagged_clause_ids=[])
    posture = ExecutivePosture(
        risk_score=10,
        risk_distribution={},
        negotiation_priorities=[],
        missing_protections=[],
    )
    events = []

    def on_event(node, trace):
        events.append((node, trace))

    triage_json = triage_resp.model_dump_json()
    posture_json = posture.model_dump_json()
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.side_effect = [
            _defined_terms_json(),
            _metadata_json(),
            triage_json,
            posture_json,
        ]
        result = await run_analysis(raw_text, on_event=on_event)
        assert len(events) == len(result["execution_trace"])
        assert events[0][0] == "structural_indexer"


@pytest.mark.asyncio
async def test_run_analysis_malformed_json_retry():
    raw_text = SAMPLE_TEXT
    posture = ExecutivePosture(
        risk_score=20,
        risk_distribution={},
        negotiation_priorities=[],
        missing_protections=[],
    )
    triage_good = TriageResponse(flagged_clause_ids=["clause-3"]).model_dump_json()
    finding_good = InspectorBatchResponse(
        findings=[
            make_finding(
                "Provider shall indemnify Client for all claims", clause_id="clause-3"
            )
        ]
    ).model_dump_json()
    exec_good = posture.model_dump_json()
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        # First triage attempt returns malformed, second succeeds
        mock_exec.side_effect = [
            _defined_terms_json(),
            _metadata_json(),
            "{bad json",
            triage_good,
            finding_good,
            exec_good,
        ]
        result = await run_analysis(raw_text)
        assert len(result["verified_findings"]) == 1
        assert mock_exec.call_count == 6
