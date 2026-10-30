import json

import pytest

from app.agents import graph


@pytest.mark.asyncio
async def test_run_analysis_stream_emits_progress_and_complete(monkeypatch):
    async def node(state):
        return {"execution_trace": state.get("execution_trace", [])}

    for name in (
        "structural_indexer_node",
        "clause_triage_node",
        "cross_reference_resolver_node",
        "deep_liability_inspector_node",
        "grounding_verifier_node",
        "quote_repair_node",
        "executive_posture_node",
    ):
        monkeypatch.setattr(graph, name, node)
    monkeypatch.setattr(graph, "should_retry_grounding", lambda state: "continue")

    events = [event async for event in graph.run_analysis_stream("contract")]
    assert events[0]["event"] == "progress"
    assert json.loads(events[-1]["data"])["document_id"] == "doc-001"
    assert json.loads(events[-1]["data"])["raw_text"] == "contract"
    assert events[-1]["event"] == "complete"


@pytest.mark.asyncio
async def test_run_analysis_stream_reports_node_errors(monkeypatch):
    async def failing_node(state):
        raise RuntimeError("node failed")

    monkeypatch.setattr(graph, "structural_indexer_node", failing_node)
    events = []
    with pytest.raises(RuntimeError, match="node failed"):
        async for event in graph.run_analysis_stream("contract"):
            events.append(event)
    assert events[1]["data"]
    assert json.loads(events[1]["data"])["status"] == "error"


@pytest.mark.asyncio
async def test_run_analysis_stream_reports_node_failure_trace(monkeypatch):
    async def failed_node(state):
        return {
            "execution_trace": [
                {
                    "node": "structural_indexer",
                    "status": "failed",
                    "detail": "provider unavailable",
                }
            ]
        }

    monkeypatch.setattr(graph, "structural_indexer_node", failed_node)
    events = [event async for event in graph.run_analysis_stream("contract")]
    assert events[-1]["event"] == "error"
    payload = json.loads(events[-1]["data"])
    assert payload["status"] == "error"
    assert "provider unavailable" in payload["message"]
