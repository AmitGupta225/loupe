"""Modal shared-endpoint LLM client with 3-layer testable architecture."""

import base64
import json
from typing import Type, TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError

from app.core.config import settings

MODEL_ID = settings.MODEL_ID

IMAGE_MIME_TYPES: dict[str, str] = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
}


def get_image_mime(filename: str) -> str:
    """Resolve mime type from filename extension."""
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    return IMAGE_MIME_TYPES.get(ext, "image/png")


T = TypeVar("T", bound=BaseModel)


def get_modal_client() -> AsyncOpenAI:
    """Create an AsyncOpenAI client configured for the Modal endpoint."""
    return AsyncOpenAI(
        api_key=settings.MODAL_API_KEY,
        base_url=settings.MODAL_BASE_URL,
        timeout=60.0,
        max_retries=2,
    )


def build_chat_payload(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.1,
    max_tokens: int | None = None,
) -> dict:
    """Pre-call layer: construct chat completion payload."""
    payload: dict = {
        "model": MODEL_ID,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    return payload


async def _execute_modal_call(payload: dict) -> str:
    """Thin network boundary: only place that hits the Modal endpoint."""
    client = get_modal_client()
    response = await client.chat.completions.create(**payload)
    content = response.choices[0].message.content
    if content is None:
        return ""
    return content


def build_vision_payload(
    image_b64: str,
    mime_type: str,
    system_prompt: str = "You are an expert OCR engine. Extract all visible text verbatim, preserving paragraphs and line breaks. Return only the extracted text, no commentary.",
    user_prompt: str = "Extract the text from this image exactly as written.",
    temperature: float = 0.1,
) -> dict:
    """Pre-call layer: construct vision OCR payload (text + image_url)."""
    data_url = f"data:{mime_type};base64,{image_b64}"
    return {
        "model": MODEL_ID,
        "messages": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ],
        "temperature": temperature,
    }


async def _execute_vision_call(payload: dict) -> str:
    """Thin network boundary for vision OCR on the Modal endpoint."""
    client = get_modal_client()
    response = await client.chat.completions.create(**payload)
    content = response.choices[0].message.content
    if content is None:
        return ""
    return content


async def ocr_image_via_llm(file_bytes: bytes, filename: str) -> str:
    """OCR an image file via the Modal-served vision model."""
    if not file_bytes:
        raise ValueError("Empty image bytes for OCR")
    mime_type = get_image_mime(filename)
    image_b64 = base64.b64encode(file_bytes).decode("utf-8")
    payload = build_vision_payload(image_b64, mime_type)
    raw = await _execute_vision_call(payload)
    # Vision OCR returns plain text; still strip think blocks if present
    cleaned = _strip_think_blocks(raw) if raw else ""
    if not cleaned or not cleaned.strip():
        raise ValueError("Vision OCR returned empty text")
    # Reuse text normalizer logic without importing parser (avoid circular)
    # Simple normalize: collapse excessive blank lines via shared helper if needed
    return cleaned.strip()


def _strip_think_blocks(text: str) -> str:
    """Remove <think>...</think> reasoning blocks without regex.

    This is post-processing for LLM output cleaning, not document understanding.
    Uses case-insensitive string search instead of regex.
    """
    if not text:
        return text
    lower = text.lower()
    result = text
    # loop to remove all think blocks case-insensitively
    while True:
        low_lower = result.lower()
        start = low_lower.find("<think>")
        if start == -1:
            break
        end = low_lower.find("</think>", start + 7)
        if end == -1:
            break
        # remove from start to end+8
        result = result[:start] + result[end + 8 :]
    return result.strip()


def _extract_json_block(text: str) -> str:
    """Extract JSON from markdown fences or surrounding prose without regex."""
    if not text:
        return text
    stripped = text.strip()
    # handle markdown fences via string search (no regex)
    if "```" in stripped:
        # find first fence
        first = stripped.find("```")
        if first != -1:
            rest = stripped[first + 3 :]
            # skip optional json label (case-insensitive)
            rest_stripped = rest.lstrip()
            if rest_stripped[:4].lower() == "json":
                rest = rest_stripped[4:]
            # find closing fence
            closing = rest.find("```")
            if closing != -1:
                return rest[:closing].strip()
    if "{" in stripped and "}" in stripped:
        start = stripped.find("{")
        end = stripped.rfind("}") + 1
        return stripped[start:end].strip()
    return stripped


def parse_and_validate_json(raw_output: str, schema: Type[T]) -> T:
    """Post-call sanitizer and validator."""
    if not raw_output or not raw_output.strip():
        raise ValueError("Empty LLM output cannot be parsed")
    cleaned = _strip_think_blocks(raw_output)
    if not cleaned:
        raise ValueError("LLM output empty after stripping think blocks")
    json_str = _extract_json_block(cleaned)
    if not json_str:
        raise ValueError("No JSON content extracted from LLM output")
    try:
        json.loads(json_str)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON extracted: {exc}") from exc
    return schema.model_validate_json(json_str)


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    response_schema: Type[T],
    temperature: float = 0.1,
    max_tokens: int | None = None,
    max_retries: int = 2,
) -> T:
    """High-level helper with retry on validation failure."""
    payload = build_chat_payload(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    for attempt in range(max_retries + 1):
        raw = await _execute_modal_call(payload)
        try:
            return parse_and_validate_json(raw, response_schema)
        except (ValidationError, ValueError, json.JSONDecodeError) as exc:
            if attempt >= max_retries:
                raise
            continue
    raise RuntimeError("call_llm retry loop exhausted without result")
