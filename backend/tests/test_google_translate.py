import asyncio

import pytest

from app.services import google_translate


class FakeProcess:
    def __init__(self, stdout: bytes, returncode: int = 0):
        self._stdout = stdout
        self.returncode = returncode
        self.killed = False

    async def communicate(self):
        return self._stdout, b""

    def kill(self):
        self.killed = True


@pytest.mark.asyncio
async def test_translate_one_parses_google_segments(monkeypatch):
    process = FakeProcess(b'[[["Namaste","Hello",null]]]')

    async def create_process(*args, **kwargs):
        return process

    monkeypatch.setattr(asyncio, "create_subprocess_exec", create_process)
    assert await google_translate.translate_one("Hello", "en", "hi") == "Namaste"


@pytest.mark.asyncio
async def test_translate_one_returns_none_for_transport_and_payload_errors(monkeypatch):
    async def failed_process(*args, **kwargs):
        return FakeProcess(b"", returncode=1)

    monkeypatch.setattr(asyncio, "create_subprocess_exec", failed_process)
    assert await google_translate.translate_one("Hello", "en", "hi") is None

    async def invalid_process(*args, **kwargs):
        return FakeProcess(b"not-json")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", invalid_process)
    assert await google_translate.translate_one("Hello", "en", "hi") is None

    async def empty_process(*args, **kwargs):
        return FakeProcess(b"[]")

    monkeypatch.setattr(asyncio, "create_subprocess_exec", empty_process)
    assert await google_translate.translate_one("Hello", "en", "hi") is None


@pytest.mark.asyncio
async def test_translate_one_handles_timeout(monkeypatch):
    process = FakeProcess(b"")

    async def create_process(*args, **kwargs):
        return process

    async def timeout(awaitable, timeout):
        if hasattr(awaitable, "close"):
            awaitable.close()
        raise asyncio.TimeoutError

    monkeypatch.setattr(asyncio, "create_subprocess_exec", create_process)
    monkeypatch.setattr(asyncio, "wait_for", timeout)
    assert await google_translate.translate_one("Hello", "en", "hi") is None
    assert process.killed


@pytest.mark.asyncio
async def test_translate_batch_validates_input_and_uses_delimiter(monkeypatch):
    assert await google_translate.translate_batch([], "en", "hi") == []
    assert await google_translate.translate_batch(["a █ b"], "en", "hi") is None
    assert await google_translate.translate_batch(["a", "b"], "en", "hi") is None

    async def translated(*args):
        return "एक"

    monkeypatch.setattr(google_translate, "translate_one", translated)
    assert await google_translate.translate_batch(["a"], "en", "hi") == ["एक"]


@pytest.mark.asyncio
async def test_translate_batch_rejects_empty_or_misaligned_responses(monkeypatch):
    async def empty(*args):
        return None

    monkeypatch.setattr(google_translate, "translate_one", empty)
    assert await google_translate.translate_batch(["a"], "en", "hi") is None

    async def misaligned(*args):
        return "only one"

    monkeypatch.setattr(google_translate, "BATCH_MAX_ITEMS", 2)
    monkeypatch.setattr(google_translate, "translate_one", misaligned)
    assert await google_translate.translate_batch(["a", "b"], "en", "hi") is None
