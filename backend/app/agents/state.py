"""Typed state definition for LangGraph workflow."""

from typing import Dict, List, Optional, TypedDict

from app.schemas.analysis import ExecutivePosture, RiskFinding
from app.schemas.contract import ClauseNode


class TraceEvent(TypedDict):
    """Telemetry event for node execution."""

    node: str
    started_at: float
    completed_at: float
    duration_ms: int
    status: str
    detail: str


class ContractAnalysisState(TypedDict, total=False):
    """State for Loupe contract analysis workflow."""

    raw_text: str
    clauses: List[ClauseNode]
    defined_terms: Dict[str, str]
    flagged_clause_ids: List[str]
    resolved_contexts: Dict[str, str]
    raw_findings: List[RiskFinding]
    verified_findings: List[RiskFinding]
    unverified_findings: List[RiskFinding]
    retry_count: int
    executive_summary: Optional[ExecutivePosture]
    execution_trace: List[TraceEvent]
    document_id: str
