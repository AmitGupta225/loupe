"""Tests for LLM client with mocked transport."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.llm import (
    MODEL_ID,
    _execute_modal_call,
    _extract_json_block,
    _strip_think_blocks,
    build_chat_payload,
    call_llm,
    get_modal_client,
    get_image_mime,
    build_vision_payload,
    ocr_image_via_llm,
    _execute_vision_call,
    parse_and_validate_json,
)
from app.schemas.analysis import RiskFinding, Severity

class SampleSchema(BaseModel):
    name: str = Field(..., min_length=1)
    value: int = Field(..., ge=0)

def test_build_chat_payload_basic():
    payload = build_chat_payload("system text", "user text")
    assert payload["model"] == MODEL_ID
    assert payload["model"] == "meta-models/Muse-Spark-Open-816B-A42B"
    assert payload["temperature"] == 0.1
    assert payload["messages"][0]["role"] == "system"
    assert payload["messages"][0]["content"] == "system text"
    assert payload["messages"][1]["role"] == "user"
    assert payload["messages"][1]["content"] == "user text"
    assert "max_tokens" not in payload

def test_build_chat_payload_with_max_tokens():
    payload = build_chat_payload("sys", "usr", temperature=0.2, max_tokens=500)
    assert payload["max_tokens"] == 500
    assert payload["temperature"] == 0.2

def test_build_chat_payload_custom_temperature():
    payload = build_chat_payload("a", "b", temperature=0.7)
    assert payload["temperature"] == 0.7

def test_image_payload_helpers():
    assert get_image_mime("scan.PNG") == "image/png"
    assert get_image_mime("scan.jpg") == "image/jpeg"
    assert get_image_mime("scan.jpeg") == "image/jpeg"
    assert get_image_mime("scan.gif") == "image/png"
    payload = build_vision_payload("YWJj", "image/png")
    assert payload["model"] == MODEL_ID
    assert payload["messages"][1]["content"][1]["image_url"]["url"] == "data:image/png;base64,YWJj"

@pytest.mark.asyncio
async def test_ocr_image_success_and_empty_results():
    with patch("app.core.llm._execute_vision_call", new=AsyncMock(return_value="<think>reason</think> OCR text")):
        assert await ocr_image_via_llm(b"abc", "scan.png") == "OCR text"
    with pytest.raises(ValueError, match="Empty image"):
        await ocr_image_via_llm(b"", "scan.png")
    with patch("app.core.llm._execute_vision_call", new=AsyncMock(return_value="  ")):
        with pytest.raises(ValueError, match="empty text"):
            await ocr_image_via_llm(b"abc", "scan.png")

@pytest.mark.asyncio
async def test_execute_vision_call_none_content():
    response = MagicMock()
    response.choices = [MagicMock(message=MagicMock(content=None))]
    client = MagicMock()
    client.chat.completions.create = AsyncMock(return_value=response)
    with patch("app.core.llm.get_modal_client", return_value=client):
        assert await _execute_vision_call({"model": MODEL_ID}) == ""

def test_get_modal_client():
    client = get_modal_client()
    assert client is not None
    assert str(client.base_url).rstrip("/") == settings.MODAL_BASE_URL.rstrip("/")

def test_strip_think_blocks_no_think():
    assert _strip_think_blocks("normal output without think") == "normal output without think"

def test_strip_think_blocks_single():
    assert _strip_think_blocks("<think>reasoning here</think> actual output") == "actual output"

def test_strip_think_blocks_multiline():
    text = "<think>\nReasoning line 1\nReasoning line 2\n</think>\nFinal JSON"
    assert _strip_think_blocks(text) == "Final JSON"

def test_strip_think_blocks_case_insensitive():
    assert _strip_think_blocks("<THINK>upper case</THINK> result") == "result"

def test_strip_think_blocks_multiple_blocks():
    text = "<think>first</think> middle <think>second</think> end"
    result = _strip_think_blocks(text)
    assert "first" not in result
    assert "second" not in result
    assert "middle" in result

def test_strip_think_blocks_empty():
    assert _strip_think_blocks("") == ""
    assert _strip_think_blocks(None) is None

def test_extract_json_block_fenced_json():
    assert _extract_json_block('```json\n{"name": "test", "value": 42}\n```') == '{"name": "test", "value": 42}'

def test_extract_json_block_fenced_generic():
    assert _extract_json_block('```\n{"name": "test", "value": 42}\n```') == '{"name": "test", "value": 42}'

def test_extract_json_block_no_fence_direct():
    assert _extract_json_block('{"name": "test", "value": 42}') == '{"name": "test", "value": 42}'

def test_extract_json_block_prose_wrapped():
    assert _extract_json_block('Here: {"name": "test", "value": 42} hope') == '{"name": "test", "value": 42}'

def test_extract_json_block_empty():
    assert _extract_json_block("") == ""
    assert _extract_json_block(None) is None

def test_extract_json_block_no_json():
    assert _extract_json_block("just plain text") == "just plain text"

def test_parse_and_validate_json_clean():
    result = parse_and_validate_json('{"name": "hello", "value": 5}', SampleSchema)
    assert result.name == "hello"

def test_parse_and_validate_json_with_think():
    raw = '<think>reasoning</think>\n{"name": "hello", "value": 5}'
    result = parse_and_validate_json(raw, SampleSchema)
    assert result.name == "hello"

def test_parse_and_validate_json_with_fence():
    result = parse_and_validate_json('```json\n{"name": "hello", "value": 5}\n```', SampleSchema)
    assert result.name == "hello"

def test_parse_and_validate_json_think_and_fence(sample_think_fenced_json):
    result = parse_and_validate_json(sample_think_fenced_json, RiskFinding)
    assert result.clause_id == "clause-1"
    assert result.severity == Severity.HIGH

def test_parse_and_validate_json_prose_wrapped(sample_prose_wrapped_json):
    result = parse_and_validate_json(sample_prose_wrapped_json, RiskFinding)
    assert result.clause_id == "clause-3"

def test_parse_and_validate_json_empty_raises():
    with pytest.raises(ValueError, match="Empty LLM output"):
        parse_and_validate_json("", SampleSchema)
    with pytest.raises(ValueError, match="Empty LLM output"):
        parse_and_validate_json("   ", SampleSchema)

def test_parse_and_validate_json_only_think_raises():
    with pytest.raises(ValueError, match="empty after stripping"):
        parse_and_validate_json("<think>only thinking</think>", SampleSchema)

def test_parse_and_validate_json_invalid_json_raises():
    with pytest.raises(Exception):
        parse_and_validate_json('{"name": "test", "value": }', SampleSchema)

def test_parse_and_validate_json_validation_error():
    with pytest.raises(Exception):
        parse_and_validate_json('{"name": "test"}', SampleSchema)

@pytest.mark.asyncio
async def test_execute_modal_call_success():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="test content"))]
    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
    with patch("app.core.llm.get_modal_client", return_value=mock_client):
        result = await _execute_modal_call({"model": MODEL_ID, "messages": []})
        assert result == "test content"
        mock_client.chat.completions.create.assert_called_once()

@pytest.mark.asyncio
async def test_execute_modal_call_none_content():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content=None))]
    mock_client = MagicMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
    with patch("app.core.llm.get_modal_client", return_value=mock_client):
        result = await _execute_modal_call({"model": MODEL_ID, "messages": []})
        assert result == ""

@pytest.mark.asyncio
async def test_call_llm_success_first_try():
    payload_fixture = '{"name": "test", "value": 10}'
    with patch("app.core.llm._execute_modal_call", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = payload_fixture
        result = await call_llm("sys", "usr", SampleSchema, temperature=0.1)
        assert result.name == "test"
        assert result.value == 10
        mock_exec.assert_called_once()
        called_payload = mock_exec.call_args[0][0]
        assert called_payload["model"] == "meta-models/Muse-Spark-Open-816B-A42B"
        assert called_payload["temperature"] == 0.1
        assert called_payload["messages"][0]["content"] == "sys"

@pytest.mark.asyncio
async def test_call_llm_retry_on_validation_failure():
    valid = '{"name": "ok", "value": 5}'
    with patch("app.core.llm._execute_modal_call", new_callable=AsyncMock) as mock_exec:
        mock_exec.side_effect = ["{bad json", valid]
        result = await call_llm("sys", "usr", SampleSchema, max_retries=2)
        assert result.name == "ok"
        assert mock_exec.call_count == 2

@pytest.mark.asyncio
async def test_call_llm_retry_then_success_second_try():
    valid = '{"name": "retry", "value": 7}'
    with patch("app.core.llm._execute_modal_call", new_callable=AsyncMock) as mock_exec:
        mock_exec.side_effect = ['{"name": ""}', valid]
        result = await call_llm("sys", "usr", SampleSchema, max_retries=2)
        assert result.name == "retry"
        assert mock_exec.call_count == 2

@pytest.mark.asyncio
async def test_call_llm_exhaust_retries_raises():
    with patch("app.core.llm._execute_modal_call", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = "{invalid json}"
        with pytest.raises(Exception):
            await call_llm("sys", "usr", SampleSchema, max_retries=1)
        assert mock_exec.call_count == 2

@pytest.mark.asyncio
async def test_call_llm_with_max_tokens():
    valid = '{"name": "test", "value": 1}'
    with patch("app.core.llm._execute_modal_call", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = valid
        result = await call_llm("sys", "usr", SampleSchema, max_tokens=100)
        assert result.name == "test"
        payload = mock_exec.call_args[0][0]
        assert payload["max_tokens"] == 100

@pytest.mark.asyncio
async def test_call_llm_payload_correct_model_and_temp(sample_think_fenced_json):
    with patch("app.core.llm._execute_modal_call", new_callable=AsyncMock) as mock_exec:
        mock_exec.return_value = sample_think_fenced_json
        result = await call_llm("system prompt", "user prompt with Section 2", RiskFinding, temperature=0.1)
        assert result.clause_id == "clause-1"
        payload = mock_exec.call_args[0][0]
        assert payload["model"] == "meta-models/Muse-Spark-Open-816B-A42B"
        assert payload["temperature"] == 0.1
        assert payload["messages"][0]["content"] == "system prompt"

@pytest.mark.asyncio
async def test_call_llm_negative_max_retries():
    with pytest.raises(RuntimeError, match="retry loop exhausted"):
        await call_llm("sys", "usr", SampleSchema, max_retries=-1)

def test_parse_and_validate_json_empty_fence():
    # empty fenced block should trigger json.loads failure -> ValueError
    raw = "```json\n\n```"
    with pytest.raises(ValueError):
        parse_and_validate_json(raw, SampleSchema)

def test_extract_json_block_empty_fence_direct():
    # test _extract_json_block with empty fenced content
    assert _extract_json_block("```json\n\n```") == ""
    assert _extract_json_block("```\n   \n```") == ""

def test_call_llm_invalid_json_retry():
    # ensure json.JSONDecodeError branch handled via parse_and_validate_json
    with patch("app.core.llm._execute_modal_call", new_callable=AsyncMock) as mock_exec:
        mock_exec.side_effect = ['```json\n{not json}\n```', '{"name": "ok", "value": 1}']
        import asyncio
        result = asyncio.run(call_llm("s", "u", SampleSchema, max_retries=2))
        assert result.name == "ok"
