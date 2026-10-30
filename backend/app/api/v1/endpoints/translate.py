"""Translation endpoint backed by Google's free public translation API."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.translator import (
    LANGUAGE_NAMES,
    SUPPORTED_LANGUAGES,
    translate_texts,
)

router = APIRouter()


class TranslateRequest(BaseModel):
    texts: list[str] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of English texts to translate",
    )
    target_lang: str = Field(..., description="Target language code: hi, bn, en")
    source_lang: str = Field(default="en", description="Source language code")


class TranslateResponse(BaseModel):
    translated: list[str]
    target_lang: str
    source_lang: str


class LanguagesResponse(BaseModel):
    languages: dict[str, str]
    default: str = "en"


@router.get("/languages", response_model=LanguagesResponse)
async def list_languages() -> LanguagesResponse:
    return LanguagesResponse(languages=dict(LANGUAGE_NAMES), default="en")


@router.post("/translate", response_model=TranslateResponse)
async def translate(req: TranslateRequest) -> TranslateResponse:
    if req.target_lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target_lang: {req.target_lang}. Supported: {sorted(SUPPORTED_LANGUAGES)}",
        )
    if req.source_lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400, detail=f"Unsupported source_lang: {req.source_lang}"
        )

    # Enforce per-item length guard to respect MyMemory limit (~500 chars per request, but we allow 5000 and truncate)
    # MyMemory officially 500 chars; we chunk safely by truncating or splitting – for now just pass through, API will handle
    try:
        translated = await translate_texts(req.texts, req.target_lang, req.source_lang)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Translation provider error: {e}")

    return TranslateResponse(
        translated=translated, target_lang=req.target_lang, source_lang=req.source_lang
    )
