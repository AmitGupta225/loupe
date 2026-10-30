"""Tests for config and exceptions and schemas."""

import os

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.exceptions import (
    ClauseParsingError,
    DocumentParsingError,
    LLMCallError,
    LoupeError,
    RetrievalError,
)
from app.schemas.analysis import (
    ExecutivePosture,
    GroundingStatus,
    RiskFinding,
    Severity,
)
from app.schemas.contract import (
    ClauseNode,
    DefinedTerm,
    DocumentMetadata,
    ParsedDocument,
)


def test_settings_defaults(monkeypatch):
    monkeypatch.setenv("MODAL_API_KEY", "test-key-placeholder")
    monkeypatch.setenv("MODAL_BASE_URL", "https://your-modal-shared-endpoint.modal.run/v1")
    monkeypatch.setenv("APP_NAME", "Loupe")
    monkeypatch.setenv("APP_ENV", "development")
    s = Settings(_env_file=None)
    assert s.MODEL_ID == "meta-models/Muse-Spark-Open-816B-A42B"
    assert s.MODAL_BASE_URL == "https://your-modal-shared-endpoint.modal.run/v1"
    assert s.APP_NAME == "Loupe"
    assert s.APP_ENV == "development"
    assert s.MODAL_API_KEY == "test-key-placeholder"


def test_settings_env_override(monkeypatch):
    monkeypatch.setenv("MODAL_API_KEY", "sk-test-override")
    monkeypatch.setenv("APP_ENV", "production")
    s = Settings()
    assert s.MODAL_API_KEY == "sk-test-override"
    assert s.APP_ENV == "production"


def test_settings_extra_ignored(monkeypatch):
    monkeypatch.setenv("UNKNOWN_VAR_XYZ", "should_be_ignored")
    s = Settings()
    assert not hasattr(s, "UNKNOWN_VAR_XYZ")


def test_loupe_error_base():
    err = LoupeError("base error", status_code=500)
    assert str(err) == "base error"
    assert err.message == "base error"
    assert err.status_code == 500
    d = err.to_dict()
    assert d["error"] == "LoupeError"
    assert d["message"] == "base error"
    assert d["status_code"] == 500


def test_document_parsing_error():
    err = DocumentParsingError("pdf failed")
    assert isinstance(err, LoupeError)
    assert err.status_code == 400
    assert str(err) == "pdf failed"
    assert err.to_dict()["error"] == "DocumentParsingError"


def test_clause_parsing_error():
    err = ClauseParsingError("chunk failed")
    assert isinstance(err, LoupeError)
    assert err.status_code == 422


def test_retrieval_error():
    err = RetrievalError("retrieve failed")
    assert isinstance(err, LoupeError)
    assert err.status_code == 500
    assert err.to_dict()["status_code"] == 500


def test_llm_call_error():
    err = LLMCallError("llm failed")
    assert isinstance(err, LoupeError)
    assert err.status_code == 502


def test_loupe_error_custom_status():
    err = LoupeError("custom", status_code=418)
    assert err.status_code == 418


def test_clause_node_valid():
    node = ClauseNode(
        id="clause-1",
        title="1. Definitions",
        content="1. Definitions\nContent here",
        char_start=0,
        char_end=20,
        level=1,
        section_number="1",
        clause_type="general",
    )
    assert node.id == "clause-1"
    assert node.char_end >= node.char_start


def test_clause_node_invalid_offsets():
    with pytest.raises(ValidationError):
        ClauseNode(
            id="clause-1",
            title="Test",
            content="content",
            char_start=10,
            char_end=5,
        )


def test_clause_node_equal_offsets():
    node = ClauseNode(
        id="c1",
        title="T",
        content="",
        char_start=5,
        char_end=5,
    )
    assert node.char_end == 5


def test_defined_term_valid():
    dt = DefinedTerm(
        term="Confidential Information",
        definition="means secret",
        clause_id="clause-1",
        char_start=0,
        char_end=10,
    )
    assert dt.term == "Confidential Information"


def test_document_metadata_defaults():
    meta = DocumentMetadata(document_id="doc-001")
    assert meta.document_id == "doc-001"
    assert meta.parties == []
    assert meta.total_clauses == 0
    assert meta.effective_date is None


def test_document_metadata_full():
    meta = DocumentMetadata(
        document_id="doc-123",
        title="MSA",
        parties=["Alpha", "Beta"],
        effective_date="Jan 1 2024",
        governing_law="California",
        total_clauses=5,
        total_defined_terms=2,
        char_count=1000,
        source_filename="test.pdf",
    )
    assert meta.parties == ["Alpha", "Beta"]
    assert meta.governing_law == "California"


def test_parsed_document_valid():
    meta = DocumentMetadata(document_id="doc-001")
    doc = ParsedDocument(
        raw_text="hello world", clauses=[], defined_terms={}, metadata=meta
    )
    assert doc.raw_text == "hello world"


def test_severity_enum():
    assert Severity.HIGH == "HIGH"
    assert Severity.HIGH.value == "HIGH"
    assert Severity.MEDIUM == "MEDIUM"
    assert Severity.LOW == "LOW"


def test_grounding_status_enum():
    assert GroundingStatus.VERIFIED_EXACT == "VERIFIED_EXACT"
    assert GroundingStatus.CLAUSE_ANCHORED == "CLAUSE_ANCHORED"


def test_risk_finding_valid():
    rf = RiskFinding(
        clause_id="clause-1",
        title="Indemnification Risk",
        category="Indemnification",
        severity=Severity.HIGH,
        exact_quote="Provider shall indemnify",
        char_start=0,
        char_end=25,
        plain_english_explanation="Explanation",
        worst_case_scenario="Worst case",
        referenced_terms_used=["Confidential Information"],
        recommended_redline="Suggested redline",
        grounding_status=GroundingStatus.VERIFIED_EXACT,
    )
    assert rf.severity == Severity.HIGH
    assert rf.grounding_status == GroundingStatus.VERIFIED_EXACT


def test_risk_finding_default_grounding():
    rf = RiskFinding(
        clause_id="c1",
        title="T",
        category="C",
        severity=Severity.LOW,
        exact_quote="quote",
        char_start=0,
        char_end=5,
        plain_english_explanation="exp",
        worst_case_scenario="worst",
        recommended_redline="redline",
    )
    assert rf.grounding_status == GroundingStatus.VERIFIED_EXACT
    assert rf.referenced_terms_used == []


def test_executive_posture_valid():
    ep = ExecutivePosture(
        risk_score=75,
        risk_distribution={"HIGH": 1},
        negotiation_priorities=["priority"],
        missing_protections=["protection"],
    )
    assert ep.risk_score == 75
    assert ep.risk_distribution["HIGH"] == 1


def test_executive_posture_defaults():
    ep = ExecutivePosture(risk_score=0)
    assert ep.risk_distribution == {}
    assert ep.negotiation_priorities == []
