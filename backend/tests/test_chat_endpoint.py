from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.v1.endpoints.chat import ChatMessage, DOCUMENT_STORE, build_chat_user_prompt, store_document
from app.main import app
from app.schemas.contract import ClauseNode


@pytest.fixture(autouse=True)
def clear_documents():
    DOCUMENT_STORE.clear()
    yield
    DOCUMENT_STORE.clear()


def test_chat_prompt_and_document_fallbacks():
    history = [ChatMessage(role="user", content="Earlier")]
    prompt = build_chat_user_prompt("What?", "context", history, {"Term": "definition"})
    assert "Defined terms:" in prompt
    assert "Conversation history:" in prompt
    assert "User question: What?" in prompt
    store_document("doc", "stored text", [], {"Term": "definition"})


@pytest.mark.asyncio
async def test_chat_rejects_empty_or_missing_context():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        empty = await client.post("/api/v1/chat", json={"question": " "})
        missing = await client.post("/api/v1/chat", json={"question": "What?"})
    assert empty.status_code == 400
    assert missing.status_code == 400


@pytest.mark.asyncio
async def test_chat_uses_raw_text_and_strips_think_block():
    with patch("app.core.llm._execute_modal_call", new=AsyncMock(return_value="<think>hidden</think>Answer")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/chat",
                json={"question": "What is payment?", "raw_text": "Payment is due in 30 days."},
            )
    assert response.status_code == 200
    assert response.json() == {"answer": "Answer", "citations": []}


@pytest.mark.asyncio
async def test_chat_uses_clause_retrieval_and_stored_defined_terms():
    clause = ClauseNode(
        id="clause-1",
        title="Payment",
        content="Payment is due in 30 days.",
        char_start=0,
        char_end=28,
        level=1,
        section_number="2",
        clause_type="payment",
    )
    store_document("doc", "full contract", [clause], {"Payment Terms": "due in 30 days"})
    with patch("app.core.llm._execute_modal_call", new=AsyncMock(return_value="Answer")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/chat",
                json={
                    "question": "When is payment due?",
                    "document_id": "doc",
                    "history": [{"role": "user", "content": "Hi"}],
                },
            )
    assert response.status_code == 200
    assert response.json()["citations"] == ["clause-1"]


@pytest.mark.asyncio
async def test_chat_handles_empty_search_and_fallback_context():
    clause = ClauseNode(
        id="clause-1", title="Other", content="Other text", char_start=0,
        char_end=10, level=1, section_number="1", clause_type="general"
    )
    store_document("doc", "full contract", [clause])
    with patch("app.api.v1.endpoints.chat.lexical_search", return_value=[]), patch(
        "app.core.llm._execute_modal_call", new=AsyncMock(return_value="Answer")
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post("/api/v1/chat", json={"question": "missing", "document_id": "doc"})
    assert response.status_code == 200
    assert response.json()["citations"] == []
