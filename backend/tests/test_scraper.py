"""Tests for scraper service."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from app.core.exceptions import LoupeError
from app.services.scraper import (
    ScrapingError,
    extract_text_from_html,
    extract_title_from_html,
    fetch_html,
    normalize_scraped_text,
    scrape_url,
    validate_url,
)


def test_normalize_scraped_text_basic():
    assert normalize_scraped_text("hello  world") == "hello world"
    assert normalize_scraped_text("a\r\nb\r c") == "a\nb\nc"
    assert normalize_scraped_text("a\n\n\n\nb") == "a\n\nb"
    assert normalize_scraped_text("  hello  \n  ") == "hello"
    assert normalize_scraped_text("a  \t  b") == "a b"


def test_normalize_scraped_text_non_string():
    with pytest.raises(TypeError):
        normalize_scraped_text(None)
    with pytest.raises(TypeError):
        normalize_scraped_text(123)


def test_extract_text_from_html_success():
    html_content = "<html><head><title>Test</title></head><body><p>Hello <b>world</b></p></body></html>"
    result = extract_text_from_html(html_content)
    assert "Hello world" in result


def test_extract_text_from_html_removes_script():
    html_content = "<html><body><p>Keep</p><script>alert(1)</script><style>body{}</style></body></html>"
    result = extract_text_from_html(html_content)
    assert "Keep" in result
    assert "alert" not in result
    assert "body{}" not in result


def test_extract_text_from_html_not_string():
    with pytest.raises(ScrapingError, match="must be a string"):
        extract_text_from_html(None)
    with pytest.raises(ScrapingError, match="must be a string"):
        extract_text_from_html(123)


def test_extract_text_from_html_empty():
    with pytest.raises(ScrapingError, match="cannot be empty"):
        extract_text_from_html("")
    with pytest.raises(ScrapingError, match="cannot be empty"):
        extract_text_from_html("   ")


def test_extract_text_from_html_parse_failure():
    with patch("app.services.scraper.html.fromstring", side_effect=Exception("parse boom")):
        with pytest.raises(ScrapingError, match="Failed to parse HTML"):
            extract_text_from_html("<html></html>")


def test_extract_text_from_html_no_text():
    html_content = "<html><head></head><body><script>var a=1</script></body></html>"
    with pytest.raises(ScrapingError, match="No extractable text"):
        extract_text_from_html(html_content)


def test_extract_title_success():
    html_content = "<html><head><title> My Contract Title </title></head><body></body></html>"
    assert extract_title_from_html(html_content) == "My Contract Title"


def test_extract_title_truncates():
    long_title = "a" * 300
    html_content = f"<html><head><title>{long_title}</title></head></html>"
    result = extract_title_from_html(html_content)
    assert len(result) == 200


def test_extract_title_not_string():
    with pytest.raises(ScrapingError, match="must be a string"):
        extract_title_from_html(None)


def test_extract_title_empty():
    assert extract_title_from_html("") == ""
    assert extract_title_from_html("   ") == ""


def test_extract_title_parse_failure():
    with patch("app.services.scraper.html.fromstring", side_effect=Exception("fail")):
        assert extract_title_from_html("<html></html>") == ""


def test_extract_title_no_title_tag():
    html_content = "<html><head></head><body>hello</body></html>"
    assert extract_title_from_html(html_content) == ""


def test_validate_url_success():
    assert validate_url("https://example.com") == "https://example.com"
    assert validate_url("http://example.com/path?q=1") == "http://example.com/path?q=1"
    assert validate_url("  https://example.com  ") == "https://example.com"


def test_validate_url_not_string():
    with pytest.raises(ScrapingError, match="must be a string"):
        validate_url(None)
    with pytest.raises(ScrapingError, match="must be a string"):
        validate_url(123)


def test_validate_url_empty():
    with pytest.raises(ScrapingError, match="cannot be empty"):
        validate_url("")
    with pytest.raises(ScrapingError, match="cannot be empty"):
        validate_url("   ")


def test_validate_url_bad_scheme():
    with pytest.raises(ScrapingError, match="must start with http"):
        validate_url("ftp://example.com")
    with pytest.raises(ScrapingError, match="must start with http"):
        validate_url("example.com")
    with pytest.raises(ScrapingError, match="must start with http"):
        validate_url("ws://example.com")


def test_validate_url_no_host():
    with pytest.raises(ScrapingError, match="valid host"):
        validate_url("https://")
    with pytest.raises(ScrapingError, match="valid host"):
        validate_url("http:///path")


def test_validate_url_too_long():
    long_url = "https://example.com/" + "a" * 2040
    with pytest.raises(ScrapingError, match="too long"):
        validate_url(long_url)

@pytest.mark.asyncio
async def test_fetch_html_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "text/html"}
    mock_response.text = "<html><body>Hello</body></html>"
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    with patch("app.services.scraper.httpx.AsyncClient", return_value=mock_client):
        result = await fetch_html("https://example.com")
        assert result == "<html><body>Hello</body></html>"


@pytest.mark.asyncio
async def test_fetch_html_timeout():
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    with patch("app.services.scraper.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(ScrapingError, match="timed out"):
            await fetch_html("https://example.com")


@pytest.mark.asyncio
async def test_fetch_html_connect_error():
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=httpx.ConnectError("connect fail"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    with patch("app.services.scraper.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(ScrapingError, match="Failed to connect"):
            await fetch_html("https://example.com")


@pytest.mark.asyncio
async def test_fetch_html_request_error():
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=httpx.RequestError("generic"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    with patch("app.services.scraper.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(ScrapingError, match="Request failed"):
            await fetch_html("https://example.com")


@pytest.mark.asyncio
async def test_fetch_html_403():
    mock_response = MagicMock()
    mock_response.status_code = 403
    mock_response.headers = {}
    mock_response.text = "forbidden"
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    with patch("app.services.scraper.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(ScrapingError, match="Access denied") as exc:
            await fetch_html("https://example.com")
        assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_fetch_html_401():
    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_response.headers = {}
    mock_response.text = "unauth"
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    with patch("app.services.scraper.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(ScrapingError, match="Authentication required") as exc:
            await fetch_html("https://example.com")
        assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_fetch_html_429():
    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_response.headers = {}
    mock_response.text = "rate"
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    with patch("app.services.scraper.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(ScrapingError, match="Too many requests") as exc:
            await fetch_html("https://example.com")
        assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_fetch_html_500():
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.headers = {}
    mock_response.text = "server error"
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    with patch("app.services.scraper.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(ScrapingError, match="HTTP 500") as exc:
            await fetch_html("https://example.com")
        assert exc.value.status_code == 500


@pytest.mark.asyncio
async def test_fetch_html_non_html_content_type_blocked():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.text = '{"key": "value"}'
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    with patch("app.services.scraper.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(ScrapingError, match="did not return HTML"):
            await fetch_html("https://example.com")


@pytest.mark.asyncio
async def test_fetch_html_non_html_but_contains_html_ok():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.text = "<html><body>Hello</body></html>"
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    with patch("app.services.scraper.httpx.AsyncClient", return_value=mock_client):
        result = await fetch_html("https://example.com")
        assert "<html>" in result


@pytest.mark.asyncio
async def test_fetch_html_empty_body():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "text/html"}
    mock_response.text = "   "
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    with patch("app.services.scraper.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(ScrapingError, match="page is empty"):
            await fetch_html("https://example.com")


@pytest.mark.asyncio
async def test_fetch_html_no_content_type_header_still_ok():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {}
    mock_response.text = "<html>hello</html>"
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    with patch("app.services.scraper.httpx.AsyncClient", return_value=mock_client):
        result = await fetch_html("https://example.com")
        assert result == "<html>hello</html>"


@pytest.mark.asyncio
async def test_scrape_url_success():
    html_content = "<html><head><title>Test Title</title></head><body><p>Contract text here</p></body></html>"
    with patch("app.services.scraper.fetch_html", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = html_content
        result = await scrape_url("https://example.com")
        assert result["url"] == "https://example.com"
        assert result["title"] == "Test Title"
        assert "Contract text here" in result["extracted_text"]
        assert result["char_count"] == len(result["extracted_text"])
