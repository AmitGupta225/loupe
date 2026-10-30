"""Core utilities for Loupe backend."""
from app.core.config import settings
from app.core.exceptions import (
    ClauseParsingError,
    DocumentParsingError,
    LLMCallError,
    LoupeError,
    RetrievalError,
)
from app.core.llm import (
    MODEL_ID,
    build_chat_payload,
    call_llm,
    get_modal_client,
    parse_and_validate_json,
)

__all__ = [
    "settings",
    "LoupeError",
    "DocumentParsingError",
    "ClauseParsingError",
    "RetrievalError",
    "LLMCallError",
    "MODEL_ID",
    "get_modal_client",
    "build_chat_payload",
    "parse_and_validate_json",
    "call_llm",
]
