"""URL scraping and HTML text extraction for Loupe."""

from urllib.parse import urlparse

import httpx
from lxml import html

from app.core.exceptions import LoupeError


class ScrapingError(LoupeError):
    """Raised when URL fetching or HTML parsing fails."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message, status_code)


def _collapse_spaces(text: str) -> str:
    """Collapse 2+ spaces/tabs to single space without regex."""
    res: list[str] = []
    in_space = False
    for ch in text:
        if ch == " " or ch == "\t":
            if not in_space:
                res.append(" ")
                in_space = True
        else:
            res.append(ch)
            in_space = False
    return "".join(res)


def _collapse_newlines(text: str) -> str:
    res: list[str] = []
    consec = 0
    for ch in text:
        if ch == "\n":
            consec += 1
            if consec <= 2:
                res.append(ch)
        else:
            consec = 0
            res.append(ch)
    return "".join(res)


def normalize_scraped_text(text: str) -> str:
    """Normalize scraped text while preserving paragraph boundaries."""
    if not isinstance(text, str):
        raise TypeError("normalize_scraped_text expects a string")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = text.split("\n")
    normalized_lines = [line.strip() for line in lines]
    result = "\n".join(normalized_lines)
    result = _collapse_newlines(result)
    result = _collapse_spaces(result)
    return result.strip()


def extract_text_from_html(html_content: str) -> str:
    """Extract visible text from HTML string."""
    if not isinstance(html_content, str):
        raise ScrapingError("HTML content must be a string")
    if not html_content.strip():
        raise ScrapingError("HTML content cannot be empty")
    try:
        tree = html.fromstring(html_content)
    except Exception as exc:
        raise ScrapingError(f"Failed to parse HTML: {exc}") from exc
    # Remove non-visible elements
    for elem in tree.xpath(
        "//script | //style | //noscript | //iframe | //svg | //canvas"
    ):
        elem.drop_tree()
    # Extract title separately but we return only text; title handled elsewhere
    text = tree.text_content()
    normalized = normalize_scraped_text(text)
    if not normalized.strip():
        raise ScrapingError("No extractable text found in HTML")
    return normalized


def extract_title_from_html(html_content: str) -> str:
    """Extract page title from HTML."""
    if not isinstance(html_content, str):
        raise ScrapingError("HTML content must be a string")
    if not html_content.strip():
        return ""
    try:
        tree = html.fromstring(html_content)
    except Exception:
        return ""
    titles = tree.xpath("//title/text()")
    if titles:
        return normalize_scraped_text(titles[0])[:200]
    return ""


def validate_url(url: str) -> str:
    """Validate URL and ensure http/https scheme."""
    if not isinstance(url, str):
        raise ScrapingError("URL must be a string")
    if not url or not url.strip():
        raise ScrapingError("URL cannot be empty")
    url = url.strip()
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ScrapingError("URL must start with http:// or https://")
    if not parsed.netloc:
        raise ScrapingError("URL must include a valid host")
    if len(url) > 2048:
        raise ScrapingError("URL is too long")
    return url


async def fetch_html(url: str, timeout: int = 15) -> str:
    """Fetch HTML content from URL."""
    validated = validate_url(url)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    try:
        async with httpx.AsyncClient(
            timeout=timeout, follow_redirects=True, headers=headers
        ) as client:
            response = await client.get(validated)
    except httpx.TimeoutException as exc:
        raise ScrapingError(f"Request timed out after {timeout}s: {exc}") from exc
    except httpx.ConnectError as exc:
        raise ScrapingError(f"Failed to connect to {validated}: {exc}") from exc
    except httpx.RequestError as exc:
        raise ScrapingError(f"Request failed for {validated}: {exc}") from exc
    if response.status_code == 403:
        raise ScrapingError(
            "Access denied (403). The website is blocking automated requests.",
            status_code=403,
        )
    if response.status_code == 401:
        raise ScrapingError(
            "Authentication required (401). The page requires login.", status_code=401
        )
    if response.status_code == 429:
        raise ScrapingError(
            "Too many requests (429). The site is rate limiting scraping.",
            status_code=429,
        )
    if response.status_code >= 400:
        raise ScrapingError(
            f"Failed to fetch URL: HTTP {response.status_code}",
            status_code=response.status_code,
        )
    content_type = response.headers.get("content-type", "")
    if (
        content_type
        and "text/html" not in content_type
        and "text/plain" not in content_type
        and "application/xhtml" not in content_type
    ):
        # Still try to extract if body looks like HTML, but warn if not
        body_text = response.text
        if "<html" not in body_text.lower() and "<body" not in body_text.lower():
            raise ScrapingError(f"URL did not return HTML content (got {content_type})")
    html_text = response.text
    if not html_text or not html_text.strip():
        raise ScrapingError("Fetched page is empty")
    return html_text


async def scrape_url(url: str) -> dict:
    """Fetch URL and extract title and text."""
    html_content = await fetch_html(url)
    text = extract_text_from_html(html_content)
    title = extract_title_from_html(html_content)
    return {
        "url": validate_url(url),
        "title": title,
        "extracted_text": text,
        "char_count": len(text),
    }
