"""LangGraph workflow with conditional verification edges."""

import asyncio
import json
from typing import AsyncIterator, Callable

from langgraph.graph import END, StateGraph

from .nodes import (
    clause_triage_node,
    cross_reference_resolver_node,
    deep_liability_inspector_node,
    executive_posture_node,
    grounding_verifier_node,
    quote_repair_node,
    should_retry_grounding,
    structural_indexer_node,
)
from .state import ContractAnalysisState


def build_graph() -> StateGraph:
    """Build StateGraph with 6 nodes and verification loop."""
    graph = StateGraph(ContractAnalysisState)
    graph.add_node("structural_indexer", structural_indexer_node)
    graph.add_node("clause_triage", clause_triage_node)
    graph.add_node("cross_reference_resolver", cross_reference_resolver_node)
    graph.add_node("deep_liability_inspector", deep_liability_inspector_node)
    graph.add_node("grounding_verifier", grounding_verifier_node)
    graph.add_node("quote_repair", quote_repair_node)
    graph.add_node("executive_posture", executive_posture_node)

    graph.set_entry_point("structural_indexer")
    graph.add_edge("structural_indexer", "clause_triage")
    graph.add_edge("clause_triage", "cross_reference_resolver")
    graph.add_edge("cross_reference_resolver", "deep_liability_inspector")
    graph.add_edge("deep_liability_inspector", "grounding_verifier")
    graph.add_conditional_edges(
        "grounding_verifier",
        should_retry_grounding,
        {
            "retry": "quote_repair",
            "continue": "executive_posture",
        },
    )
    graph.add_edge("quote_repair", "executive_posture")
    graph.add_edge("executive_posture", END)
    return graph


def get_compiled_graph():
    """Return compiled graph."""
    graph = build_graph()
    return graph.compile()


async def run_analysis(
    raw_text: str,
    document_id: str = "doc-001",
    on_event: Callable[[str, dict], None] | None = None,
) -> ContractAnalysisState:
    """Run full analysis with optional telemetry callbacks."""
    compiled = get_compiled_graph()
    initial_state: ContractAnalysisState = {
        "raw_text": raw_text,
        "document_id": document_id,
        "clauses": [],
        "defined_terms": {},
        "flagged_clause_ids": [],
        "resolved_contexts": {},
        "raw_findings": [],
        "verified_findings": [],
        "unverified_findings": [],
        "retry_count": 0,
        "executive_summary": None,
        "execution_trace": [],
    }
    result = await compiled.ainvoke(initial_state)
    if on_event:
        for trace in result.get("execution_trace", []):
            on_event(trace["node"], trace)
    return result


# Step definitions for real progress: node -> label + progress range (1-100, nothing skipped)
_STREAM_STEPS = [
    ("structural_indexer", "Parsing document", 14),
    ("clause_triage", "Indexing clauses", 30),
    ("cross_reference_resolver", "Mapping cross-references", 46),
    ("deep_liability_inspector", "Inspecting liabilities", 68),
    ("grounding_verifier", "Verifying quotes", 84),
    ("quote_repair", "Repairing quotes", 92),
    ("executive_posture", "Generating summary", 100),
]

_STEP_LABEL = {name: label for name, label, _ in _STREAM_STEPS}
_STEP_PROGRESS = {name: prog for name, _, prog in _STREAM_STEPS}


async def run_analysis_stream(
    raw_text: str, document_id: str = "doc-001"
) -> AsyncIterator[dict]:
    """Stream progress events: yields SSE dicts with event/data for each node."""
    state: ContractAnalysisState = {
        "raw_text": raw_text,
        "document_id": document_id,
        "clauses": [],
        "defined_terms": {},
        "flagged_clause_ids": [],
        "resolved_contexts": {},
        "raw_findings": [],
        "verified_findings": [],
        "unverified_findings": [],
        "retry_count": 0,
        "executive_summary": None,
        "execution_trace": [],
    }
    node_map = {
        "structural_indexer": structural_indexer_node,
        "clause_triage": clause_triage_node,
        "cross_reference_resolver": cross_reference_resolver_node,
        "deep_liability_inspector": deep_liability_inspector_node,
        "grounding_verifier": grounding_verifier_node,
        "quote_repair": quote_repair_node,
        "executive_posture": executive_posture_node,
    }
    # Sequential execution respecting conditional edge grounding->repair
    order = [
        "structural_indexer",
        "clause_triage",
        "cross_reference_resolver",
        "deep_liability_inspector",
        "grounding_verifier",
    ]
    for node_name in order:
        label = _STEP_LABEL.get(node_name, node_name)
        prog = _STEP_PROGRESS.get(node_name, 50)
        # started
        yield {
            "event": "progress",
            "data": json.dumps(
                {
                    "node": node_name,
                    "status": "started",
                    "progress": prog - 6,
                    "label": label,
                }
            ),
        }
        try:
            update = await node_map[node_name](state)
            state.update(update)  # type: ignore
        except Exception as exc:
            yield {
                "event": "progress",
                "data": json.dumps(
                    {
                        "node": node_name,
                        "status": "error",
                        "progress": prog,
                        "label": label,
                        "error": str(exc),
                    }
                ),
            }
            raise
        failed_traces = [
            trace
            for trace in state.get("execution_trace", [])
            if trace.get("status") == "failed"
        ]
        if failed_traces:
            detail = failed_traces[-1].get("detail") or "Analysis provider request failed"
            yield {
                "event": "error",
                "data": json.dumps(
                    {
                        "node": node_name,
                        "status": "error",
                        "progress": prog,
                        "label": label,
                        "message": f"Contract analysis could not be completed: {detail}",
                    }
                ),
            }
            return
        yield {
            "event": "progress",
            "data": json.dumps(
                {
                    "node": node_name,
                    "status": "completed",
                    "progress": prog,
                    "label": label,
                }
            ),
        }
        # Small delay to allow UI to render before next LLM call
        await asyncio.sleep(0.16)
        if node_name == "grounding_verifier":
            # Check conditional
            try:
                decision = should_retry_grounding(state)
            except Exception:
                decision = "continue"
            if decision == "retry":
                rn = "quote_repair"
                label2 = _STEP_LABEL.get(rn, rn)
                prog2 = _STEP_PROGRESS.get(rn, 92)
                yield {
                    "event": "progress",
                    "data": json.dumps(
                        {
                            "node": rn,
                            "status": "started",
                            "progress": prog2 - 4,
                            "label": label2,
                        }
                    ),
                }
                update2 = await node_map[rn](state)
                state.update(update2)  # type: ignore
                yield {
                    "event": "progress",
                    "data": json.dumps(
                        {
                            "node": rn,
                            "status": "completed",
                            "progress": prog2,
                            "label": label2,
                        }
                    ),
                }
                await asyncio.sleep(0.16)
    # Final executive if not already via retry path (when we went through grounding->retry we still need executive)
    # Determine if executive already run: if we took retry branch we haven't run executive yet
    # Check state has executive_summary - if missing, run it
    if not state.get("executive_summary"):
        rn = "executive_posture"
        label2 = _STEP_LABEL.get(rn, rn)
        prog2 = _STEP_PROGRESS.get(rn, 100)
        yield {
            "event": "progress",
            "data": json.dumps(
                {
                    "node": rn,
                    "status": "started",
                    "progress": prog2 - 6,
                    "label": label2,
                }
            ),
        }
        update2 = await node_map[rn](state)
        state.update(update2)  # type: ignore
        yield {
            "event": "progress",
            "data": json.dumps(
                {"node": rn, "status": "completed", "progress": prog2, "label": label2}
            ),
        }

    # Build final payload mirroring AnalyzeResponse
    final_payload = {
        "document_id": state.get("document_id", document_id),
        "raw_text": state.get("raw_text", raw_text),
        "clauses": [
            c.model_dump() if hasattr(c, "model_dump") else c
            for c in state.get("clauses", [])
        ],
        "defined_terms": state.get("defined_terms", {}),
        "flagged_clause_ids": state.get("flagged_clause_ids", []),
        "verified_findings": [
            f.model_dump() if hasattr(f, "model_dump") else f
            for f in state.get("verified_findings", [])
        ],
        "executive_summary": (
            state.get("executive_summary").model_dump()
            if state.get("executive_summary")
            and hasattr(state.get("executive_summary"), "model_dump")
            else state.get("executive_summary")
        ),
        "execution_trace": state.get("execution_trace", []),
    }
    yield {"event": "complete", "data": json.dumps(final_payload)}
