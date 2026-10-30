"""Pydantic schemas for risk analysis output."""

from enum import Enum
from typing import Dict, List

from pydantic import BaseModel, ConfigDict, Field


class Severity(str, Enum):
    """Risk severity levels."""

    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class GroundingStatus(str, Enum):
    """Quote grounding verification status."""

    VERIFIED_EXACT = "VERIFIED_EXACT"
    CLAUSE_ANCHORED = "CLAUSE_ANCHORED"


class RiskFinding(BaseModel):
    """Structured risk finding anchored to exact source span."""

    model_config = ConfigDict(extra="forbid")

    clause_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    severity: Severity
    exact_quote: str = Field(..., min_length=1)
    char_start: int = Field(..., ge=0)
    char_end: int = Field(..., ge=0)
    plain_english_explanation: str = Field(..., min_length=1)
    worst_case_scenario: str = Field(..., min_length=1)
    referenced_terms_used: List[str] = Field(default_factory=list)
    recommended_redline: str = Field(..., min_length=1)
    grounding_status: GroundingStatus = GroundingStatus.VERIFIED_EXACT


class ExecutivePosture(BaseModel):
    """Overall contract risk posture summary - verdict/conclusion/advice are LLM-generated."""

    model_config = ConfigDict(extra="forbid")

    risk_score: int = Field(..., ge=0, le=100)
    risk_distribution: Dict[str, int] = Field(default_factory=dict)
    negotiation_priorities: List[str] = Field(default_factory=list)
    missing_protections: List[str] = Field(default_factory=list)
    verdict: str = Field(
        default="", description="LLM-generated risk label e.g. High risk"
    )
    conclusion: str = Field(
        default="", description="LLM-generated actionable conclusion e.g. Do not sign"
    )
    advice: str = Field(
        default="", description="LLM-generated detailed advice paragraph"
    )
