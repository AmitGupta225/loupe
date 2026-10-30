"""Document ingestion and normalization service."""

from io import BytesIO

from docx import Document
from pypdf import PdfReader

from app.core.exceptions import DocumentParsingError


def _collapse_blank_lines(text: str) -> str:
    """Collapse 3+ consecutive newlines to 2 without regex."""
    # Iterate and count consecutive newlines
    result_chars: list[str] = []
    consecutive = 0
    for ch in text:
        if ch == "\n":
            consecutive += 1
            if consecutive <= 2:
                result_chars.append(ch)
            # else skip extra newlines beyond 2
        else:
            consecutive = 0
            result_chars.append(ch)
    return "".join(result_chars)


def normalize_text(text: str) -> str:
    """Normalize line endings and whitespace while preserving paragraph boundaries."""
    if not isinstance(text, str):
        raise TypeError("normalize_text expects a string")
    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Trim trailing whitespace per line while preserving paragraph structure
    lines = text.split("\n")
    normalized_lines = [line.rstrip() for line in lines]
    result = "\n".join(normalized_lines)
    # Collapse excessive blank lines (3+ to 2) without regex
    result = _collapse_blank_lines(result)
    return result.strip()


def extract_from_txt(file_bytes: bytes) -> str:
    """Extract and normalize text from TXT file bytes."""
    if not file_bytes:
        raise DocumentParsingError("Empty file bytes provided for TXT extraction")
    try:
        text = file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        text = file_bytes.decode("latin-1")
    if not text.strip():
        raise DocumentParsingError("TXT file contains no extractable text")
    return normalize_text(text)


def extract_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF file bytes."""
    if not file_bytes:
        raise DocumentParsingError("Empty file bytes provided for PDF extraction")
    try:
        reader = PdfReader(BytesIO(file_bytes))
    except Exception as exc:
        raise DocumentParsingError(f"Failed to parse PDF file: {exc}") from exc
    if len(reader.pages) == 0:
        raise DocumentParsingError("PDF contains no pages")
    parts: list[str] = []
    for page in reader.pages:
        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""
        if page_text:
            parts.append(page_text)
    if not parts:
        raise DocumentParsingError("PDF contains no extractable text")
    combined = "\n\n".join(parts)
    normalized = normalize_text(combined)
    if not normalized:
        raise DocumentParsingError("PDF normalization resulted in empty text")
    return normalized


def extract_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX file bytes."""
    if not file_bytes:
        raise DocumentParsingError("Empty file bytes provided for DOCX extraction")
    try:
        doc = Document(BytesIO(file_bytes))
    except Exception as exc:
        raise DocumentParsingError(f"Failed to parse DOCX file: {exc}") from exc
    parts: list[str] = []
    for para in doc.paragraphs:
        parts.append(para.text if para.text is not None else "")
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text:
                    parts.append(cell.text)
    combined = "\n".join(parts)
    normalized = normalize_text(combined)
    if not normalized.strip():
        raise DocumentParsingError("DOCX contains no extractable text")
    return normalized


IMAGE_EXTENSIONS = {"png", "jpg", "jpeg"}


def is_image_file(filename: str) -> bool:
    """Check if filename is an image (PNG/JPEG) handled via vision OCR."""
    if not filename or "." not in filename:
        return False
    ext = filename.lower().rsplit(".", 1)[-1]
    return ext in IMAGE_EXTENSIONS


def parse_document(filename: str, file_bytes: bytes) -> str:
    """Dispatch extraction based on file extension (sync path for PDF/DOCX/TXT)."""
    if not filename or not isinstance(filename, str):
        raise DocumentParsingError("Filename must be a non-empty string")
    if file_bytes is None:
        raise DocumentParsingError("File bytes cannot be None")
    if "." not in filename:
        raise DocumentParsingError(
            f"Unsupported file format: .{filename}. Supported formats are PDF, DOCX, TXT, PNG, JPEG"
        )
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        return extract_from_pdf(file_bytes)
    if ext == "docx":
        return extract_from_docx(file_bytes)
    if ext in ("txt", "text", "md"):
        return extract_from_txt(file_bytes)
    if ext in IMAGE_EXTENSIONS:
        # Images require async vision OCR via app.core.llm.ocr_image_via_llm
        # This sync dispatcher exists for backward compat; callers should route images to async OCR.
        raise DocumentParsingError(
            f"Image file {filename} requires async OCR via vision model. Use async parse path."
        )
    raise DocumentParsingError(
        f"Unsupported file format: .{ext}. Supported formats are PDF, DOCX, TXT, PNG, JPEG"
    )
