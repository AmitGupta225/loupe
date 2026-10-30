"""Tests for API endpoints - Part 1."""

import io
import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from docx import Document
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from app.agents.nodes import (
    DefinedTermsLLMResponse,
    DocumentMetadataLLMResponse,
    TriageResponse,
)
from app.main import app
from app.schemas.analysis import ExecutivePosture, RiskFinding, Severity


def _dt_json():
    return DefinedTermsLLMResponse(
        defined_terms={"Confidential Information": "secret"}
    ).model_dump_json()


def _meta_json():
    return DocumentMetadataLLMResponse(
        parties=["Alpha", "Beta"],
        effective_date="2024-01-15",
        governing_law="California",
        title="Test",
    ).model_dump_json()


SAMPLE_RAW = '1. Definitions\n\n"Confidential Information" means secret.\n\n2. Indemnification\n\nProvider shall indemnify Client for all claims.'


def make_finding(
    quote="Provider shall indemnify Client for all claims", cid="clause-1"
):
    return RiskFinding(
        clause_id=cid,
        title="Risk",
        category="Indemnification",
        severity=Severity.HIGH,
        exact_quote=quote,
        char_start=0,
        char_end=len(quote),
        plain_english_explanation="exp",
        worst_case_scenario="worst",
        recommended_redline="redline",
    )


@pytest.fixture
def client():
    return TestClient(app)


def test_health_root(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_root(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Loupe API"


def test_api_health(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["model"] == "meta-models/Muse-Spark-Open-816B-A42B"


@pytest.mark.asyncio
async def test_analyze_success():
    from app.agents.nodes import InspectorBatchResponse

    triage = TriageResponse(flagged_clause_ids=["clause-1"])
    finding = make_finding()
    posture = ExecutivePosture(
        risk_score=75,
        risk_distribution={"HIGH": 1},
        negotiation_priorities=["Indemnification"],
        missing_protections=[],
    )
    triage_json = triage.model_dump_json()
    batch = InspectorBatchResponse(findings=[finding])
    finding_json = batch.model_dump_json()
    posture_json = posture.model_dump_json()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch(
            "app.core.llm._execute_modal_call", new_callable=AsyncMock
        ) as mock_exec:
            mock_exec.side_effect = [
                _dt_json(),
                _meta_json(),
                triage_json,
                finding_json,
                posture_json,
            ]
            resp = await ac.post(
                "/api/v1/analyze",
                json={"raw_text": SAMPLE_RAW, "document_id": "doc-001"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["document_id"] == "doc-001"
            assert len(data["verified_findings"]) == 1
            # verify pre-call payload was honest (model and prompt) - triage is at index 2 now
            first_payload = mock_exec.call_args_list[2][0][0]
            assert first_payload["model"] == "meta-models/Muse-Spark-Open-816B-A42B"


@pytest.mark.asyncio
async def test_analyze_empty_raw_text():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        resp = await ac.post("/api/v1/analyze", json={"raw_text": "   "})
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_analyze_missing_raw_text():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        resp = await ac.post("/api/v1/analyze", json={"document_id": "doc-001"})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_upload_txt():
    triage = TriageResponse(flagged_clause_ids=[])
    posture = ExecutivePosture(
        risk_score=10,
        risk_distribution={},
        negotiation_priorities=[],
        missing_protections=[],
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch(
            "app.core.llm._execute_modal_call", new_callable=AsyncMock
        ) as mock_exec:
            mock_exec.side_effect = [
                _dt_json(),
                _meta_json(),
                triage.model_dump_json(),
                posture.model_dump_json(),
            ]
            files = {"file": ("test.txt", b"Hello contract text", "text/plain")}
            resp = await ac.post("/api/v1/analyze/upload", files=files)
            assert resp.status_code == 200
            assert resp.json()["document_id"] == "test"


@pytest.mark.asyncio
async def test_analyze_upload_docx():
    doc = Document()
    doc.add_paragraph("Hello DOCX contract content for analysis")
    buf = io.BytesIO()
    doc.save(buf)
    triage = TriageResponse(flagged_clause_ids=[])
    posture = ExecutivePosture(
        risk_score=5,
        risk_distribution={},
        negotiation_priorities=[],
        missing_protections=[],
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch(
            "app.core.llm._execute_modal_call", new_callable=AsyncMock
        ) as mock_exec:
            mock_exec.side_effect = [
                _dt_json(),
                _meta_json(),
                triage.model_dump_json(),
                posture.model_dump_json(),
            ]
            files = {
                "file": (
                    "contract.docx",
                    buf.getvalue(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            }
            resp = await ac.post("/api/v1/analyze/upload", files=files)
            assert resp.status_code == 200


@pytest.mark.asyncio
async def test_analyze_upload_pdf_mocked():
    from unittest.mock import MagicMock

    mock_page = MagicMock()
    mock_page.extract_text.return_value = "PDF contract content"
    mock_reader = MagicMock()
    mock_reader.pages = [mock_page]
    triage = TriageResponse(flagged_clause_ids=[])
    posture = ExecutivePosture(
        risk_score=5,
        risk_distribution={},
        negotiation_priorities=[],
        missing_protections=[],
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch("app.services.parser.PdfReader", return_value=mock_reader):
            with patch(
                "app.core.llm._execute_modal_call", new_callable=AsyncMock
            ) as mock_exec:
                mock_exec.side_effect = [
                    _dt_json(),
                    _meta_json(),
                    triage.model_dump_json(),
                    posture.model_dump_json(),
                ]
                files = {"file": ("contract.pdf", b"fake pdf bytes", "application/pdf")}
                resp = await ac.post("/api/v1/analyze/upload", files=files)
                assert resp.status_code == 200


@pytest.mark.asyncio
async def test_analyze_upload_empty_file():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        files = {"file": ("empty.txt", b"", "text/plain")}
        resp = await ac.post("/api/v1/analyze/upload", files=files)
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_analyze_upload_no_filename():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        files = {"file": ("", b"content", "text/plain")}
        resp = await ac.post("/api/v1/analyze/upload", files=files)
        # FastAPI returns 422 for empty filename, our handler would also return 400 if reached
        assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_analyze_upload_unsupported_extension():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        files = {"file": ("file.exe", b"binary", "application/octet-stream")}
        resp = await ac.post("/api/v1/analyze/upload", files=files)
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_analyze_upload_no_extension():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        files = {"file": ("file", b"content", "text/plain")}
        resp = await ac.post("/api/v1/analyze/upload", files=files)
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_analyze_upload_read_failure():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch("app.api.v1.endpoints.analyze.parse_document") as mock_parse:
            mock_parse.side_effect = Exception("parse fail")
            files = {"file": ("test.txt", b"content", "text/plain")}
            resp = await ac.post("/api/v1/analyze/upload", files=files)
            assert resp.status_code == 400


@pytest.mark.asyncio
async def test_analyze_upload_parse_error():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch("app.api.v1.endpoints.analyze.parse_document") as mock_parse:
            from app.core.exceptions import DocumentParsingError

            mock_parse.side_effect = DocumentParsingError("bad pdf")
            files = {"file": ("test.pdf", b"content", "application/pdf")}
            resp = await ac.post("/api/v1/analyze/upload", files=files)
            assert resp.status_code == 400
            assert "bad pdf" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_analyze_upload_document_id_from_filename():
    triage = TriageResponse(flagged_clause_ids=[])
    posture = ExecutivePosture(
        risk_score=5,
        risk_distribution={},
        negotiation_priorities=[],
        missing_protections=[],
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch(
            "app.core.llm._execute_modal_call", new_callable=AsyncMock
        ) as mock_exec:
            mock_exec.side_effect = [
                _dt_json(),
                _meta_json(),
                triage.model_dump_json(),
                posture.model_dump_json(),
            ]
            files = {"file": ("my-contract.txt", b"Hello text", "text/plain")}
            resp = await ac.post("/api/v1/analyze/upload", files=files)
            assert resp.status_code == 200
            assert resp.json()["document_id"] == "my-contract"
