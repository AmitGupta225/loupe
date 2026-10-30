from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_translation_languages_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/languages")
    assert response.status_code == 200
    assert response.json() == {
        "languages": {"en": "English", "hi": "Hindi", "bn": "Bengali"},
        "default": "en",
    }


@pytest.mark.asyncio
async def test_translation_endpoint_validates_languages():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        target = await client.post("/api/v1/translate", json={"texts": ["Hello"], "target_lang": "fr"})
        source = await client.post(
            "/api/v1/translate",
            json={"texts": ["Hello"], "target_lang": "hi", "source_lang": "fr"},
        )
    assert target.status_code == 400
    assert source.status_code == 400


@pytest.mark.asyncio
async def test_translation_endpoint_returns_translated_text():
    with patch(
        "app.api.v1.endpoints.translate.translate_texts",
        new=AsyncMock(return_value=["नमस्ते"]),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/translate",
                json={"texts": ["Hello"], "target_lang": "hi"},
            )
    assert response.status_code == 200
    assert response.json()["translated"] == ["नमस्ते"]


@pytest.mark.asyncio
async def test_translation_endpoint_maps_provider_errors():
    with patch(
        "app.api.v1.endpoints.translate.translate_texts",
        new=AsyncMock(side_effect=RuntimeError("provider unavailable")),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/translate",
                json={"texts": ["Hello"], "target_lang": "hi"},
            )
    assert response.status_code == 502
    assert "provider unavailable" in response.json()["detail"]
