import pytest

from app.services import translator


@pytest.mark.asyncio
async def test_translate_single_handles_empty_same_language_and_provider_result(monkeypatch):
    assert await translator._translate_single("", "en", "hi") == ""
    assert await translator._translate_single("Hello", "en", "en") == "Hello"

    async def translated(*args):
        return "नमस्ते"

    monkeypatch.setattr(translator, "translate_one", translated)
    assert await translator._translate_single("Hello", "en", "hi") == "नमस्ते"

    async def missing(*args):
        return None

    monkeypatch.setattr(translator, "translate_one", missing)
    assert await translator._translate_single("Hello", "en", "hi") == "Hello"


def test_chunk_by_chars_splits_large_input():
    groups = translator._chunk_by_chars(["a" * 3000, "b" * 2000])
    assert groups == [["a" * 3000], ["b" * 2000]]


@pytest.mark.asyncio
async def test_translate_texts_validates_and_preserves_noop_inputs():
    with pytest.raises(ValueError):
        await translator.translate_texts(["x"], "fr")
    with pytest.raises(ValueError):
        await translator.translate_texts(["x"], "hi", "fr")
    assert await translator.translate_texts([], "hi") == []
    assert await translator.translate_texts(["Hello"], "en", "en") == ["Hello"]
    assert translator.get_supported_languages() == {"en": "English", "hi": "Hindi", "bn": "Bengali"}


@pytest.mark.asyncio
async def test_translate_texts_uses_batch_results(monkeypatch):
    async def batch(group, source, target):
        return [f"{item}-translated" for item in group]

    monkeypatch.setattr(translator, "translate_batch", batch)
    assert await translator.translate_texts(["one", "two"], "hi") == ["one-translated", "two-translated"]


@pytest.mark.asyncio
async def test_translate_texts_falls_back_to_ordered_single_results(monkeypatch):
    async def batch(group, source, target):
        return None

    async def single(text, source, target):
        if text == "bad":
            raise RuntimeError("provider failure")
        return f"{text}-translated"

    monkeypatch.setattr(translator, "translate_batch", batch)
    monkeypatch.setattr(translator, "_translate_single", single)
    assert await translator.translate_texts(["one", "bad"], "hi") == ["one-translated", "bad"]
