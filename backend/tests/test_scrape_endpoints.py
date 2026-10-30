"""Tests for scrape endpoints."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.agents.nodes import (
    DefinedTermsLLMResponse,
    DocumentMetadataLLMResponse,
    TriageResponse,
)
from app.schemas.analysis import ExecutivePosture, RiskFinding, Severity


def _dt_s():
    return DefinedTermsLLMResponse(
        defined_terms={"Confidential Information": "secret"}
    ).model_dump_json()


def _meta_s():
    return DocumentMetadataLLMResponse(parties=["A", "B"]).model_dump_json()


SAMPLE_HTML = "<html><head><title>Contract</title></head><body><p>1. Definitions Confidential Information means secret. 2. Indemnification Provider shall indemnify.</p></body></html>"


def make_finding(quote="Provider shall indemnify", cid="clause-1"):
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
async def test_scrape_success():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch(
            "app.api.v1.endpoints.scrape.scrape_url", new_callable=AsyncMock
        ) as mock_scrape:
            mock_scrape.return_value = {
                "url": "https://example.com",
                "title": "Contract",
                "extracted_text": "Some contract text",
                "char_count": 18,
            }
            resp = await ac.post("/api/v1/scrape", json={"url": "https://example.com"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["url"] == "https://example.com"
            assert data["extracted_text"] == "Some contract text"
            assert data["char_count"] == 18


@pytest.mark.asyncio
async def test_scrape_loupe_error():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch(
            "app.api.v1.endpoints.scrape.scrape_url", new_callable=AsyncMock
        ) as mock_scrape:
            from app.services.scraper import ScrapingError

            mock_scrape.side_effect = ScrapingError(
                "Access denied (403).", status_code=403
            )
            resp = await ac.post("/api/v1/scrape", json={"url": "https://example.com"})
            assert resp.status_code == 403
            assert "Access denied" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_scrape_validation_error():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        resp = await ac.post("/api/v1/scrape", json={"url": ""})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_analyze_url_success():
    from app.agents.nodes import InspectorBatchResponse

    triage = TriageResponse(flagged_clause_ids=["clause-1"])
    finding = make_finding()
    posture = ExecutivePosture(
        risk_score=75,
        risk_distribution={"HIGH": 1},
        negotiation_priorities=["Indemnification"],
        missing_protections=[],
    )
    batch = InspectorBatchResponse(findings=[finding])
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch(
            "app.api.v1.endpoints.scrape.scrape_url", new_callable=AsyncMock
        ) as mock_scrape:
            mock_scrape.return_value = {
                "url": "https://example.com",
                "title": "My Contract",
                "extracted_text": "1. Definitions Confidential Information means secret. 2. Indemnification Provider shall indemnify Client for all claims.",
                "char_count": 100,
            }
            with patch(
                "app.core.llm._execute_modal_call", new_callable=AsyncMock
            ) as mock_exec:
                mock_exec.side_effect = [
                    _dt_s(),
                    _meta_s(),
                    triage.model_dump_json(),
                    batch.model_dump_json(),
                    posture.model_dump_json(),
                ]
                resp = await ac.post(
                    "/api/v1/analyze/url",
                    json={"url": "https://example.com", "document_id": "custom-id"},
                )
                assert resp.status_code == 200
                data = resp.json()
                assert data["document_id"] == "custom-id"
                assert len(data["verified_findings"]) == 1
                first_payload = mock_exec.call_args_list[2][0][0]
                assert first_payload["model"] == "meta-models/Muse-Spark-Open-816B-A42B"


@pytest.mark.asyncio
async def test_analyze_url_uses_title_when_no_doc_id():
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
            "app.api.v1.endpoints.scrape.scrape_url", new_callable=AsyncMock
        ) as mock_scrape:
            mock_scrape.return_value = {
                "url": "https://example.com",
                "title": "Title From Page",
                "extracted_text": "Some text. Another clause here with enough content to parse.",
                "char_count": 60,
            }
            with patch(
                "app.core.llm._execute_modal_call", new_callable=AsyncMock
            ) as mock_exec:
                mock_exec.side_effect = [
                    _dt_s(),
                    _meta_s(),
                    triage.model_dump_json(),
                    posture.model_dump_json(),
                ]
                resp = await ac.post(
                    "/api/v1/analyze/url", json={"url": "https://example.com"}
                )
                assert resp.status_code == 200
                assert resp.json()["document_id"] == "Title From Page"


@pytest.mark.asyncio
async def test_analyze_url_fallback_to_url_when_no_title():
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
            "app.api.v1.endpoints.scrape.scrape_url", new_callable=AsyncMock
        ) as mock_scrape:
            mock_scrape.return_value = {
                "url": "https://example.com",
                "title": "",
                "extracted_text": "Some text content here with sections.",
                "char_count": 30,
            }
            with patch(
                "app.core.llm._execute_modal_call", new_callable=AsyncMock
            ) as mock_exec:
                mock_exec.side_effect = [
                    _dt_s(),
                    _meta_s(),
                    triage.model_dump_json(),
                    posture.model_dump_json(),
                ]
                resp = await ac.post(
                    "/api/v1/analyze/url", json={"url": "https://example.com"}
                )
                assert resp.status_code == 200
                assert resp.json()["document_id"] == "https://example.com"


@pytest.mark.asyncio
async def test_analyze_url_scrape_error():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch(
            "app.api.v1.endpoints.scrape.scrape_url", new_callable=AsyncMock
        ) as mock_scrape:
            from app.services.scraper import ScrapingError

            mock_scrape.side_effect = ScrapingError(
                "Failed to connect", status_code=400
            )
            resp = await ac.post(
                "/api/v1/analyze/url", json={"url": "https://example.com"}
            )
            assert resp.status_code == 400
            assert "Failed to connect" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_analyze_url_empty_text():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch(
            "app.api.v1.endpoints.scrape.scrape_url", new_callable=AsyncMock
        ) as mock_scrape:
            mock_scrape.return_value = {
                "url": "https://example.com",
                "title": "",
                "extracted_text": "   ",
                "char_count": 0,
            }
            resp = await ac.post(
                "/api/v1/analyze/url", json={"url": "https://example.com"}
            )
            assert resp.status_code == 400
            assert "no extractable text" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_analyze_url_empty_stripped():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        with patch(
            "app.api.v1.endpoints.scrape.scrape_url", new_callable=AsyncMock
        ) as mock_scrape:
            mock_scrape.return_value = {
                "url": "https://example.com",
                "title": "",
                "extracted_text": "",
                "char_count": 0,
            }
            resp = await ac.post(
                "/api/v1/analyze/url", json={"url": "https://example.com"}
            )
            assert resp.status_code == 400
