"""Standardized exception hierarchy for Loupe."""

from typing import Any


class LoupeError(Exception):
    """Base exception for Loupe platform."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code

    def __str__(self) -> str:
        return self.message

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to API-friendly dict."""
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "status_code": self.status_code,
        }


class DocumentParsingError(LoupeError):
    """Raised when document extraction fails."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message, status_code)


class ClauseParsingError(LoupeError):
    """Raised when structural clause parsing fails."""

    def __init__(self, message: str, status_code: int = 422) -> None:
        super().__init__(message, status_code)


class RetrievalError(LoupeError):
    """Raised when retrieval or cross-reference resolution fails."""

    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message, status_code)


class LLMCallError(LoupeError):
    """Raised when the configured LLM endpoint fails."""

    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message, status_code)
