"""Tests for document parser."""

import io

import pytest
from docx import Document

from app.core.exceptions import DocumentParsingError
from app.services.parser import (
    extract_from_docx,
    extract_from_pdf,
    extract_from_txt,
    normalize_text,
    parse_document,
)

def test_normalize_text_line_endings():
    text = "line1\r\nline2\rline3\nline3"
    result = normalize_text(text)
    assert "\r" not in result
    assert "line1\nline2\nline3" in result

def test_normalize_text_trailing_whitespace():
    text = "line1   \nline2\t\nline3  "
    result = normalize_text(text)
    assert result == "line1\nline2\nline3"

def test_normalize_text_collapse_blank_lines():
    assert normalize_text("a\n\n\n\nb") == "a\n\nb"

def test_normalize_text_strip_outer():
    assert normalize_text("  hello  \n  ") == "hello"

def test_normalize_text_non_string_raises():
    with pytest.raises(TypeError):
        normalize_text(None)
    with pytest.raises(TypeError):
        normalize_text(123)

def test_extract_from_txt_success():
    assert extract_from_txt(b"Hello world\nSecond line") == "Hello world\nSecond line"

def test_extract_from_txt_utf8():
    assert "café" in extract_from_txt("café".encode("utf-8"))

def test_extract_from_txt_latin1_fallback():
    latin_bytes = "café".encode("latin-1")
    result = extract_from_txt(latin_bytes)
    assert result is not None

def test_extract_from_txt_empty_bytes():
    with pytest.raises(DocumentParsingError, match="Empty file bytes"):
        extract_from_txt(b"")

def test_extract_from_txt_no_text():
    with pytest.raises(DocumentParsingError, match="no extractable text"):
        extract_from_txt(b"   \n   ")

def test_extract_from_pdf_empty_bytes():
    with pytest.raises(DocumentParsingError, match="Empty file bytes"):
        extract_from_pdf(b"")

def test_extract_from_pdf_invalid_bytes():
    with pytest.raises(DocumentParsingError, match="Failed to parse PDF"):
        extract_from_pdf(b"not a pdf")

def test_extract_from_pdf_no_pages():
    from unittest.mock import MagicMock, patch
    mock_reader = MagicMock()
    mock_reader.pages = []
    with patch("app.services.parser.PdfReader", return_value=mock_reader):
        with pytest.raises(DocumentParsingError, match="no pages"):
            extract_from_pdf(b"fake pdf bytes")

def test_extract_from_pdf_no_text():
    from unittest.mock import MagicMock, patch
    mock_page = MagicMock()
    mock_page.extract_text.return_value = ""
    mock_reader = MagicMock()
    mock_reader.pages = [mock_page]
    with patch("app.services.parser.PdfReader", return_value=mock_reader):
        with pytest.raises(DocumentParsingError, match="no extractable text"):
            extract_from_pdf(b"fake pdf bytes")

def test_extract_from_pdf_success():
    from unittest.mock import MagicMock, patch
    mock_page1 = MagicMock()
    mock_page1.extract_text.return_value = "Page 1 content"
    mock_page2 = MagicMock()
    mock_page2.extract_text.return_value = "Page 2 content"
    mock_reader = MagicMock()
    mock_reader.pages = [mock_page1, mock_page2]
    with patch("app.services.parser.PdfReader", return_value=mock_reader):
        result = extract_from_pdf(b"fake pdf bytes")
        assert "Page 1 content" in result
        assert "Page 2 content" in result

def test_extract_from_pdf_exception_during_extract():
    from unittest.mock import MagicMock, patch
    mock_page = MagicMock()
    mock_page.extract_text.side_effect = Exception("extract failed")
    mock_reader = MagicMock()
    mock_reader.pages = [mock_page]
    with patch("app.services.parser.PdfReader", return_value=mock_reader):
        with pytest.raises(DocumentParsingError, match="no extractable text"):
            extract_from_pdf(b"fake pdf bytes")

def test_extract_from_pdf_normalization_empty():
    from unittest.mock import MagicMock, patch
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "   \n   "
    mock_reader = MagicMock()
    mock_reader.pages = [mock_page]
    with patch("app.services.parser.PdfReader", return_value=mock_reader):
        with pytest.raises(DocumentParsingError, match="normalization resulted in empty"):
            extract_from_pdf(b"fake")

def test_extract_from_docx_success():
    doc = Document()
    doc.add_paragraph("Hello DOCX world")
    doc.add_paragraph("Second paragraph")
    buf = io.BytesIO()
    doc.save(buf)
    result = extract_from_docx(buf.getvalue())
    assert "Hello DOCX world" in result
    assert "Second paragraph" in result

def test_extract_from_docx_with_table():
    doc = Document()
    doc.add_paragraph("Intro")
    table = doc.add_table(rows=1, cols=2)
    table.cell(0, 0).text = "Cell A"
    table.cell(0, 1).text = "Cell B"
    buf = io.BytesIO()
    doc.save(buf)
    result = extract_from_docx(buf.getvalue())
    assert "Cell A" in result
    assert "Cell B" in result

def test_extract_from_docx_empty_bytes():
    with pytest.raises(DocumentParsingError, match="Empty file bytes"):
        extract_from_docx(b"")

def test_extract_from_docx_invalid_bytes():
    with pytest.raises(DocumentParsingError, match="Failed to parse DOCX"):
        extract_from_docx(b"not docx")

def test_extract_from_docx_no_text():
    doc = Document()
    buf = io.BytesIO()
    doc.save(buf)
    with pytest.raises(DocumentParsingError, match="no extractable text"):
        extract_from_docx(buf.getvalue())

def test_parse_document_txt():
    assert parse_document("test.txt", b"hello txt") == "hello txt"

def test_parse_document_text_ext():
    assert "hello" in parse_document("file.text", b"hello")

def test_parse_document_md():
    assert "Title" in parse_document("readme.md", b"# Title\ncontent")

def test_parse_document_pdf_dispatch():
    from unittest.mock import MagicMock, patch
    mock_page = MagicMock()
    mock_page.extract_text.return_value = "pdf content"
    mock_reader = MagicMock()
    mock_reader.pages = [mock_page]
    with patch("app.services.parser.PdfReader", return_value=mock_reader):
        result = parse_document("contract.pdf", b"fake pdf")
        assert "pdf content" in result

def test_parse_document_docx_dispatch():
    doc = Document()
    doc.add_paragraph("docx content")
    buf = io.BytesIO()
    doc.save(buf)
    assert "docx content" in parse_document("contract.docx", buf.getvalue())

def test_parse_document_uppercase_ext():
    assert "upper" in parse_document("FILE.TXT", b"upper")

def test_parse_document_unsupported():
    with pytest.raises(DocumentParsingError, match="Unsupported file format"):
        parse_document("file.exe", b"data")
    with pytest.raises(DocumentParsingError, match="requires async OCR"):
        parse_document("scan.png", b"bytes")

def test_parse_document_no_extension():
    with pytest.raises(DocumentParsingError, match="Unsupported file format"):
        parse_document("file", b"data")

def test_parse_document_empty_filename():
    with pytest.raises(DocumentParsingError, match="Filename must be a non-empty string"):
        parse_document("", b"data")
    with pytest.raises(DocumentParsingError):
        parse_document(None, b"data")

def test_parse_document_none_bytes():
    with pytest.raises(DocumentParsingError, match="File bytes cannot be None"):
        parse_document("test.txt", None)
