import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def fake_stream(raw_text, document_id="doc-001"):
    yield {"event": "progress", "data": json.dumps({"node": "analysis", "status": "completed"})}
    yield {"event": "complete", "data": json.dumps({"document_id": document_id, "raw_text": raw_text})}


@pytest.mark.asyncio
async def test_analyze_stream_emits_events():
    with patch("app.api.v1.endpoints.analyze.run_analysis_stream", fake_stream):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/analyze/stream", json={"raw_text": "contract"})
    assert response.status_code == 200
    assert "analysis" in response.text


@pytest.mark.asyncio
async def test_analyze_stream_rejects_empty_text():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/analyze/stream", json={"raw_text": " "})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_analyze_reports_provider_failure_instead_of_low_risk_success():
    failed_result = {
        "document_id": "doc-001",
        "raw_text": "contract",
        "execution_trace": [
            {
                "node": "clause_triage",
                "status": "failed",
                "detail": "Error code: 402",
            }
        ],
    }
    with patch(
        "app.api.v1.endpoints.analyze.run_analysis",
        new=AsyncMock(return_value=failed_result),
    ):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.post(
                "/api/v1/analyze", json={"raw_text": "contract"}
            )
    assert response.status_code == 502
    assert "Error code: 402" in response.json()["detail"]


@pytest.mark.asyncio
async def test_upload_stream_emits_progress_and_analysis():
    with patch("app.api.v1.endpoints.analyze.run_analysis_stream", fake_stream), patch(
        "app.api.v1.endpoints.analyze.parse_document", return_value="parsed contract"
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/analyze/upload/stream",
                files={"files": ("contract.txt", b"contract", "text/plain")},
            )
    assert response.status_code == 200
    assert "Parsing document" in response.text
    assert "analysis" in response.text


@pytest.mark.asyncio
async def test_upload_stream_rejects_missing_and_empty_files():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        missing = await client.post("/api/v1/analyze/upload/stream")
        empty = await client.post(
            "/api/v1/analyze/upload/stream",
            files={"files": ("empty.txt", b"", "text/plain")},
        )
    assert missing.status_code == 400
    assert empty.status_code == 200
    assert "is empty" in empty.text


@pytest.mark.asyncio
async def test_upload_uses_ocr_and_maps_parse_errors():
    with patch(
        "app.api.v1.endpoints.analyze.ocr_image_via_llm",
        new=AsyncMock(return_value="OCR text"),
    ), patch(
        "app.api.v1.endpoints.analyze.run_analysis",
        new=AsyncMock(return_value={"document_id": "scan", "raw_text": "OCR text"}),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/analyze/upload",
                files={"file": ("scan.png", b"image", "image/png")},
            )
    assert response.status_code == 200
    assert response.json()["document_id"] == "scan"


@pytest.mark.asyncio
async def test_upload_stream_parse_and_size_errors():
    with patch(
        "app.api.v1.endpoints.analyze.parse_document",
        side_effect=ValueError("bad parse"),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/analyze/upload/stream",
                files={"files": ("bad.txt", b"content", "text/plain")},
            )
    assert response.status_code == 200
    assert "bad parse" in response.text

    class Large:
        def __len__(self):
            return 51 * 1024 * 1024

        def __bool__(self):
            return True

    from fastapi import UploadFile
    fake = MagicMock(spec=UploadFile)
    fake.filename = "large.txt"
    fake.read = AsyncMock(return_value=Large())
    from app.api.v1.endpoints.analyze import analyze_upload_stream
    response = await analyze_upload_stream(file=fake)
    events = [event async for event in response.body_iterator]
    assert any("too large" in str(event) for event in events)


@pytest.mark.asyncio
async def test_upload_stream_read_error():
    from fastapi import UploadFile
    from app.api.v1.endpoints.analyze import analyze_upload_stream
    fake = MagicMock(spec=UploadFile)
    fake.filename = "read.txt"
    fake.read = AsyncMock(side_effect=RuntimeError("read broke"))
    response = await analyze_upload_stream(file=fake)
    events = [event async for event in response.body_iterator]
    assert "read broke" in str(events)
