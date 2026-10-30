"""Translation orchestration using Google's free public API."""

import asyncio

from app.services.google_translate import translate_batch, translate_one

SUPPORTED_LANGUAGES = {"en", "hi", "bn"}
LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "bn": "Bengali"}


async def _translate_single(text: str, source_lang: str, target_lang: str) -> str:
    if not text or not text.strip() or source_lang == target_lang:
        return text

    translated = await translate_one(text, source_lang, target_lang)
    if translated and translated.strip():
        return translated
    return text


def _chunk_by_chars(texts: list[str]) -> list[list[str]]:
    """Split strings into small groups for safe provider requests."""
    groups: list[list[str]] = []
    current: list[str] = []
    current_length = 0
    for text in texts:
        if current and current_length + len(text) > 4000:
            groups.append(current)
            current = []
            current_length = 0
        current.append(text)
        current_length += len(text)
    if current:
        groups.append(current)
    return groups


async def translate_texts(
    texts: list[str], target_lang: str, source_lang: str = "en"
) -> list[str]:
    """Translate texts while preserving input order and fallback values."""
    if target_lang not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported target language: {target_lang}")
    if source_lang not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported source language: {source_lang}")
    if not texts or source_lang == target_lang:
        return list(texts)

    async def process_group(group: list[str]) -> list[str]:
        batch = await translate_batch(group, source_lang, target_lang)
        if batch is not None and len(batch) == len(group):
            return batch
        semaphore = asyncio.Semaphore(8)

        async def bounded(text: str) -> str:
            async with semaphore:
                try:
                    return await _translate_single(text, source_lang, target_lang)
                except Exception:
                    return text

        return list(await asyncio.gather(*(bounded(text) for text in group)))

    groups = _chunk_by_chars(texts)
    results = await asyncio.gather(*(process_group(group) for group in groups))
    return [item for group in results for item in group]


def get_supported_languages() -> dict[str, str]:
    return dict(LANGUAGE_NAMES)
