"""Tests for API endpoints - Part 2."""

import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from app.agents.nodes import (
    DefinedTermsLLMResponse,
    DocumentMetadataLLMResponse,
    TriageResponse,
)
from app.main import app
from app.schemas.analysis import ExecutivePosture, RiskFinding, Severity


def _dt2():
    return DefinedTermsLLMResponse(defined_terms={"X": "y"}).model_dump_json()


def _meta2():
    return DocumentMetadataLLMResponse(parties=["A", "B"]).model_dump_json()


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


@pytest.mark.asyncio
async def test_analyze_stream_error_handling():
    # stream endpoint now exists; verify empty raw_text returns 400
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        resp = await ac.post(
            "/api/v1/analyze/stream",
            json={"raw_text": "   ", "document_id": "doc-001"},
        )
        assert resp.status_code == 400


def test_loupe_error_handler():
    # Test via direct handler instead of API to avoid async mock issues
    import asyncio
    from app.main import generic_exception_handler
    from fastapi import Request
    from unittest.mock import MagicMock

    req = MagicMock(spec=Request)
    resp = asyncio.run(generic_exception_handler(req, Exception("generic failure")))
    assert resp.status_code == 500
    assert b"generic failure" in resp.body


@pytest.mark.asyncio
async def test_loupe_error_handler_via_api():
    from app.api.v1.endpoints.analyze import analyze_contract, AnalyzeRequest
    from app.main import generic_exception_handler
    from fastapi import Request
    from unittest.mock import MagicMock

    with patch(
        "app.api.v1.endpoints.analyze.run_analysis", new_callable=AsyncMock
    ) as mock_run:
        mock_run.side_effect = Exception("generic failure")
        req = AnalyzeRequest(raw_text="1. Definitions\n\ncontent")
        try:
            await analyze_contract(req)
            assert False, "should have raised"
        except Exception as e:
            assert str(e) == "generic failure"
            resp = await generic_exception_handler(MagicMock(spec=Request), e)
            assert resp.status_code == 500


@pytest.mark.asyncio
async def test_analyze_upload_file_no_file_direct():
    # Directly test analyze_upload with file=None to cover line 62
    from app.api.v1.endpoints.analyze import analyze_upload
    from fastapi import HTTPException
    import pytest as pt

    with pt.raises(HTTPException) as exc:
        await analyze_upload(file=None)
    assert exc.value.status_code == 400
    assert "No file provided" in exc.value.detail


@pytest.mark.asyncio
async def test_analyze_upload_file_read_exception_direct():
    from app.api.v1.endpoints.analyze import analyze_upload
    from fastapi import UploadFile
    from fastapi import HTTPException
    import pytest as pt

    fake_file = MagicMock(spec=UploadFile)
    fake_file.filename = "test.txt"
    fake_file.read = AsyncMock(side_effect=Exception("read failed"))
    with pt.raises(HTTPException) as exc:
        await analyze_upload(file=fake_file)
    assert exc.value.status_code == 400
    assert "Failed to read file" in exc.value.detail


def test_exception_handlers_direct():
    import asyncio
    from app.main import loupe_exception_handler, generic_exception_handler
    from app.core.exceptions import DocumentParsingError
    from fastapi import Request
    from unittest.mock import MagicMock

    req = MagicMock(spec=Request)
    # Test LoupeError handler
    exc = DocumentParsingError("bad doc")
    resp = asyncio.run(loupe_exception_handler(req, exc))
    assert resp.status_code == 400
    assert b"DocumentParsingError" in resp.body
    # Test generic handler
    resp2 = asyncio.run(generic_exception_handler(req, Exception("generic")))
    assert resp2.status_code == 500
    assert b"InternalServerError" in resp2.body


def test_cors_headers():
    client = TestClient(app)
    resp = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.status_code in (200, 204)


def test_analyze_with_document_id_default():
    triage = TriageResponse(flagged_clause_ids=[])
    posture = ExecutivePosture(
        risk_score=5,
        risk_distribution={},
        negotiation_priorities=[],
        missing_protections=[],
    )
    client = TestClient(app)
    with patch(
        "app.core.llm._execute_modal_call", new_callable=AsyncMock
    ) as mock_exec:
        mock_exec.side_effect = [
            _dt2(),
            _meta2(),
            triage.model_dump_json(),
            posture.model_dump_json(),
        ]
        resp = client.post(
            "/api/v1/analyze", json={"raw_text": "1. Definitions\n\ncontent"}
        )
        assert resp.status_code == 200
        assert resp.json()["document_id"] == "doc-001"


@pytest.mark.asyncio
async def test_analyze_upload_file_read_exception():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch(
            "app.api.v1.endpoints.analyze.parse_document",
            side_effect=Exception("unexpected"),
        ):
            files = {"file": ("test.txt", b"content", "text/plain")}
            resp = await ac.post("/api/v1/analyze/upload", files=files)
            assert resp.status_code == 400


def test_main_exception_handlers():
    from app.main import app as test_app

    assert test_app.title == "Loupe API"
    routes = [getattr(r, "path", "") for r in test_app.routes]
    assert any("/health" in r for r in routes)


@pytest.mark.asyncio
async def test_analyze_upload_too_large():
    from app.api.v1.endpoints.analyze import analyze_upload
    from fastapi import HTTPException

    class LargeContent:
        def __len__(self):
            return 101 * 1024 * 1024

        def __bool__(self):
            return True

    fake_file = MagicMock()
    fake_file.filename = "big.pdf"
    fake_file.read = AsyncMock(return_value=LargeContent())
    with pytest.raises(HTTPException) as exc:
        await analyze_upload(file=fake_file)
    assert exc.value.status_code == 400
    assert "50 MB" in exc.value.detail
