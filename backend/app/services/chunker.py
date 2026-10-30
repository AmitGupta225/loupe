"""Structural legal clause splitter with DefinedTerms extraction - simplified without regex."""

from app.core.exceptions import ClauseParsingError
from app.schemas.contract import ClauseNode, DocumentMetadata, ParsedDocument


def _is_heading_line(line: str) -> bool:
    if not line or not line.strip():
        return False
    stripped = line.strip()
    if stripped[0].isdigit():
        return True
    upper = stripped.upper()
    if (
        upper.startswith("ARTICLE ")
        or upper.startswith("SECTION ")
        or stripped.startswith("\u00a7")
    ):
        return True
    if len(stripped) >= 10 and stripped.isupper():
        # all chars must be uppercase, space or hyphen
        for c in stripped:
            if not (c.isupper() or c.isspace() or c == "-"):
                return False
        return True
    return False


def _extract_section_number(title: str) -> str:
    if not title or not title.strip():
        return ""
    stripped = title.strip()
    # Numeric prefix
    if stripped[0].isdigit():
        token = stripped.split()[0].strip(".:")
        if token and token[0].isdigit():
            return token
    upper = stripped.upper()
    if upper.startswith("ARTICLE "):
        rest = stripped[8:].strip()
        if rest:
            return rest.split()[0].strip(".,:")
    if stripped.lower().startswith("article "):
        rest = stripped[8:].strip()
        if rest:
            return rest.split()[0].strip(".,:")
    if stripped.lower().startswith("section "):
        rest = stripped[8:].strip()
        if rest:
            return rest.split()[0].strip(".,:")
    return ""


def _compute_level(section_number: str) -> int:
    if not section_number:
        return 1
    base = section_number.count(".") + 1
    if "(" in section_number:
        base += 1
    return max(1, base)


def detect_clauses(raw_text: str) -> list[ClauseNode]:
    if not raw_text or not raw_text.strip():
        raise ClauseParsingError("Cannot chunk empty document text")
    lines = raw_text.split("\n")
    offsets: list[int] = []
    current = 0
    for idx, line in enumerate(lines):
        offsets.append(current)
        current += len(line) + (1 if idx < len(lines) - 1 else 0)
    heading_indices: list[int] = []
    for idx, line in enumerate(lines):
        if _is_heading_line(line):
            heading_indices.append(idx)
    clauses: list[ClauseNode] = []
    if not heading_indices:
        clauses.append(
            ClauseNode(
                id="clause-1",
                title="Preamble",
                content=raw_text,
                char_start=0,
                char_end=len(raw_text),
                level=1,
                section_number="",
                clause_type="general",
            )
        )
        return clauses
    if heading_indices[0] != 0:
        preamble_end_idx = heading_indices[0] - 1
        while preamble_end_idx >= 0 and not lines[preamble_end_idx].strip():
            preamble_end_idx -= 1
        if preamble_end_idx >= 0:
            preamble_content = "\n".join(lines[0 : preamble_end_idx + 1])
            char_start = offsets[0]
            last_line_idx = preamble_end_idx
            char_end = offsets[last_line_idx] + len(lines[last_line_idx])
            clauses.append(
                ClauseNode(
                    id="clause-1",
                    title="Preamble",
                    content=preamble_content,
                    char_start=char_start,
                    char_end=char_end,
                    level=1,
                    section_number="",
                    clause_type="general",
                )
            )
    start_id = len(clauses) + 1
    for h_idx, heading_line_idx in enumerate(heading_indices):
        next_heading_line_idx = (
            heading_indices[h_idx + 1]
            if h_idx + 1 < len(heading_indices)
            else len(lines)
        )
        segment_lines = lines[heading_line_idx:next_heading_line_idx]
        while segment_lines and not segment_lines[-1].strip():
            segment_lines.pop()
        content = "\n".join(segment_lines)
        title = lines[heading_line_idx].strip()
        section_number = _extract_section_number(title)
        level = _compute_level(section_number)
        char_start = offsets[heading_line_idx]
        last_idx = heading_line_idx + len(segment_lines) - 1
        char_end = offsets[last_idx] + len(lines[last_idx])
        clause_id = f"clause-{start_id + h_idx}"
        clauses.append(
            ClauseNode(
                id=clause_id,
                title=title,
                content=content,
                char_start=char_start,
                char_end=char_end,
                level=level,
                section_number=section_number,
                clause_type="general",
            )
        )
    return clauses


def extract_defined_terms(raw_text: str, clauses: list[ClauseNode]) -> dict[str, str]:
    """Deprecated heuristic placeholder - now AI-generated via LLM.

    All defined term understanding is produced by the AI agent in structural_indexer_node
    via call_llm with get_defined_terms_system_prompt. This function is retained only for
    backward compatibility and returns empty to avoid any hardcoded word-search. No regex,
    no fixed keyword scan - pure AI generation. Fallback is empty dict.
    """
    _ = (raw_text, clauses)
    return {}


def extract_metadata(
    raw_text: str,
    clauses: list[ClauseNode],
    defined_terms: dict[str, str],
    document_id: str = "doc-001",
    title: str = "",
    source_filename: str | None = None,
) -> DocumentMetadata:
    """Minimal metadata - document understanding is AI-generated.

    Parties / dates / governing law are extracted by the LLM in structural_indexer_node
    via get_document_metadata_system_prompt. This function now only emits structural counts
    and char length to avoid any hardcoded word search. No regex, no keyword 'between'/'governed by' scan.
    """
    _ = defined_terms
    return DocumentMetadata(
        document_id=document_id,
        title=title,
        parties=[],
        effective_date=None,
        governing_law=None,
        total_clauses=len(clauses),
        total_defined_terms=len(defined_terms),
        char_count=len(raw_text),
        source_filename=source_filename,
    )


def chunk_document(
    raw_text: str,
    document_id: str = "doc-001",
    title: str = "",
    source_filename: str | None = None,
) -> ParsedDocument:
    if not raw_text or not raw_text.strip():
        raise ClauseParsingError("Cannot chunk empty document text")
    clauses = detect_clauses(raw_text)
    defined_terms = extract_defined_terms(raw_text, clauses)
    metadata = extract_metadata(
        raw_text, clauses, defined_terms, document_id, title, source_filename
    )
    return ParsedDocument(
        raw_text=raw_text,
        clauses=clauses,
        defined_terms=defined_terms,
        metadata=metadata,
    )
