"""Low-level transport helpers for Google's free translation endpoint."""

import asyncio
import json
from typing import Optional

GOOGLE_URL = "https://translate.googleapis.com/translate_a/single"
BATCH_DELIM = " █ "
BATCH_MAX_CHARS = 4000
BATCH_MAX_ITEMS = 1


async def translate_one(text: str, source_lang: str, target_lang: str) -> Optional[str]:
    """Translate one string with Google's public endpoint."""
    base = f"{GOOGLE_URL}?client=gtx&sl={source_lang}&tl={target_lang}&dt=t"
    proc = await asyncio.create_subprocess_exec(
        "curl",
        "-s",
        "--get",
        base,
        "--data-urlencode",
        f"q={text}",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=8.0)
    except asyncio.TimeoutError:
        proc.kill()
        return None
    if proc.returncode != 0:
        return None
    try:
        data = json.loads(stdout.decode("utf-8").strip())
        if data and isinstance(data[0], list):
            parts = [segment[0] for segment in data[0] if segment and segment[0]]
            return "".join(parts) or None
    except (UnicodeDecodeError, json.JSONDecodeError, IndexError, TypeError):
        return None
    return None


async def translate_batch(
    texts: list[str], source_lang: str, target_lang: str
) -> Optional[list[str]]:
    """Translate a batch when the endpoint preserves the item delimiter."""
    if not texts:
        return []
    if any(BATCH_DELIM.strip() in text for text in texts):
        return None
    joined = BATCH_DELIM.join(texts)
    if len(joined) > BATCH_MAX_CHARS or len(texts) > BATCH_MAX_ITEMS:
        return None

    translated = await translate_one(joined, source_lang, target_lang)
    if not translated:
        return None
    parts = [part.strip() for part in translated.split(BATCH_DELIM)]
    if len(parts) != len(texts) or any(not part for part in parts):
        return None
    return parts
