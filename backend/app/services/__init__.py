"""Document services for Loupe."""
from app.services.chunker import chunk_document, extract_defined_terms, extract_metadata
from app.services.parser import (
    extract_from_docx,
    extract_from_pdf,
    extract_from_txt,
    normalize_text,
    parse_document,
)
from app.services.retriever import (
    build_inspection_context,
    extract_cross_references,
    hybrid_retrieve,
    lexical_search,
    resolve_defined_terms_in_clause,
)

__all__ = [
    "normalize_text",
    "extract_from_txt",
    "extract_from_pdf",
    "extract_from_docx",
    "parse_document",
    "chunk_document",
    "extract_defined_terms",
    "extract_metadata",
    "extract_cross_references",
    "resolve_defined_terms_in_clause",
    "lexical_search",
    "hybrid_retrieve",
    "build_inspection_context",
]
