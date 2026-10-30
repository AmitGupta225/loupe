"""Hybrid clause retrieval and cross-reference resolver - without regex, LLM-centric."""

import math

from app.core.exceptions import RetrievalError
from app.schemas.contract import ClauseNode

# Keywords for cross-reference detection (case-insensitive)
_CROSS_REF_KEYWORDS = ["Section", "Article", "Clause", "Exhibit", "Schedule"]


def _is_cross_ref_keyword(word: str) -> bool:
    low = word.lower()
    return low in ("section", "article", "clause", "exhibit", "schedule")


def extract_cross_references(clause_text: str | None) -> list[str]:
    if not clause_text:
        return []
    results: list[str] = []
    # Split preserving original case for output: we need to find keyword occurrences
    # Simple scan: tokenise by whitespace and check each token
    # But to preserve exact "Section 4.2" string, we should scan raw string for keyword positions
    lower = clause_text.lower()
    idx = 0
    while idx < len(clause_text):
        found_kw = None
        found_pos = -1
        for kw in _CROSS_REF_KEYWORDS:
            pos = lower.find(kw.lower(), idx)
            if pos != -1 and (found_pos == -1 or pos < found_pos):
                found_pos = pos
                found_kw = clause_text[pos : pos + len(kw)]
                # preserve original case from clause_text
                # But kw may have different case in original; we use original slice
        if found_pos == -1:
            break
        # After keyword, skip spaces
        after = found_pos + len(found_kw)
        while after < len(clause_text) and clause_text[after].isspace():
            after += 1
        if after >= len(clause_text):
            idx = after
            continue
        # Capture identifier: digits/dots/parens/Roman/letter
        end = after
        # Roman numerals and single letters are alphanum, but we need to handle "V", "A"
        # For simplicity, capture token until whitespace or punctuation (comma, period, semicolon, parenthesis)
        while end < len(clause_text) and not clause_text[end].isspace() and clause_text[end] not in ",;:":
            # For handling cases like "4.2," we stop before comma, but comma already handled above
            # Include dot and parentheses as part of identifier
            end += 1
        identifier = clause_text[after:end].strip(" .,;:")
        if not identifier:
            idx = end
            continue
        # Reconstruct full reference like "Section 4.2"
        full_ref = f"{found_kw} {identifier}"
        # Clean identifier of trailing punctuation
        # Only keep if identifier looks like section number (contains digit or is Roman/letter)
        # Basic check: if identifier[0].isdigit() or identifier.isalpha()
        if identifier[0].isdigit() or identifier[0].isalpha():
            results.append(full_ref.strip())
        idx = end
    # Dedupe preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for r in results:
        if r not in seen:
            seen.add(r)
            deduped.append(r)
    return deduped


def resolve_defined_terms_in_clause(
    clause_text: str | None, defined_terms: dict[str, str] | None
) -> dict[str, str]:
    if not clause_text or not defined_terms:
        return {}
    found: dict[str, str] = {}
    lower_clause = clause_text.lower()
    for term, definition in defined_terms.items():
        if term in clause_text:
            found[term] = definition
        elif term.lower() in lower_clause:
            found[term] = definition
    return found


def _tokenize(text: str | None) -> list[str]:
    # Without regex: split on non-alphanumeric
    if not text:
        return []
    # Build tokens by scanning chars
    tokens: list[str] = []
    current = []
    for ch in text.lower():
        if ch.isalnum() or ch == "_":
            current.append(ch)
        else:
            if current:
                tokens.append("".join(current))
                current = []
    if current:
        tokens.append("".join(current))
    return tokens


def compute_tf_idf_scores(
    query: str | None, clauses: list[ClauseNode] | None
) -> list[tuple[ClauseNode, float]]:
    query_tokens = _tokenize(query)
    if not query_tokens:
        return []
    doc_count = len(clauses)
    if doc_count == 0:
        return []
    df: dict[str, int] = {}
    for clause in clauses:
        tokens = set(_tokenize(clause.content))
        for tok in tokens:
            df[tok] = df.get(tok, 0) + 1
    idf: dict[str, float] = {}
    for tok, freq in df.items():
        idf[tok] = math.log((doc_count + 1) / (freq + 1)) + 1
    scores: list[tuple[ClauseNode, float]] = []
    for clause in clauses:
        clause_text_tokens = _tokenize(clause.content)
        if not clause_text_tokens:
            scores.append((clause, 0.0))
            continue
        tf: dict[str, int] = {}
        for tok in clause_text_tokens:
            tf[tok] = tf.get(tok, 0) + 1
        score = 0.0
        for q_tok in query_tokens:
            if q_tok in tf:
                score += (tf[q_tok] / len(clause_text_tokens)) * idf.get(q_tok, 0)
        scores.append((clause, score))
    return scores


def lexical_search(
    query: str | None, clauses: list[ClauseNode] | None, top_k: int = 3
) -> list[ClauseNode]:
    if not query or not query.strip() or not clauses:
        return []
    if top_k <= 0:
        return []
    scored = compute_tf_idf_scores(query, clauses)
    filtered = [(c, s) for c, s in scored if s > 0]
    if not filtered:
        return []
    filtered.sort(key=lambda x: x[1], reverse=True)
    return [c for c, _ in filtered[:top_k]]


def _extract_ref_number(ref: str) -> str:
    # Without regex: find first digit sequence or identifier after keyword
    # ref like "Section 4.2" or "Article V"
    # Find first digit, if found capture digits/dots/parens
    for i, ch in enumerate(ref):
        if ch.isdigit():
            start = i
            end = start
            while end < len(ref) and (ref[end].isdigit() or ref[end] in ".-()"):
                end += 1
            return ref[start:end]
        elif ch.isalpha():
            # For Roman numerals or Exhibit A, we might want the letter
            # But if we already handled keyword, the identifier may be single letter like "A"
            # Check if we are after keyword+space: capture single letter
            # Simpler: if no digit, return last word
            pass
    # Fallback: return last word
    parts = ref.strip().split()
    if parts:
        return parts[-1]
    return ref


def hybrid_retrieve(
    target_clause: ClauseNode | None,
    all_clauses: list[ClauseNode] | None,
    defined_terms: dict[str, str] | None,
    top_k: int = 3,
) -> list[ClauseNode]:
    if not target_clause or not all_clauses:
        return []
    cross_refs = extract_cross_references(target_clause.content)
    retrieved: list[ClauseNode] = []
    retrieved_ids: set[str] = set()
    for ref in cross_refs:
        ref_num = _extract_ref_number(ref)
        for clause in all_clauses:
            if clause.id == target_clause.id:
                continue
            if clause.section_number == ref_num or ref_num in clause.title or ref_num in clause.section_number:
                if clause.id not in retrieved_ids:
                    retrieved.append(clause)
                    retrieved_ids.add(clause.id)
    notwithstanding_clauses = [c for c in all_clauses if "notwithstanding" in c.content.lower() and c.id != target_clause.id]
    if notwithstanding_clauses:
        lex_results = lexical_search(target_clause.content, notwithstanding_clauses, top_k=top_k)
        for c in lex_results:
            if c.id not in retrieved_ids:
                retrieved.append(c)
                retrieved_ids.add(c.id)
        if not lex_results:
            lex_all = lexical_search(target_clause.content, all_clauses, top_k=top_k)
            for c in lex_all:
                if c.id != target_clause.id and c.id not in retrieved_ids and "notwithstanding" in c.content.lower():
                    retrieved.append(c)
                    retrieved_ids.add(c.id)
    else:
        lex_all = lexical_search(target_clause.content, all_clauses, top_k=top_k)
        for c in lex_all:
            if c.id != target_clause.id and c.id not in retrieved_ids:
                retrieved.append(c)
                retrieved_ids.add(c.id)
    return retrieved


def build_inspection_context(
    target_clause: ClauseNode | None,
    all_clauses: list[ClauseNode] | None,
    defined_terms: dict[str, str] | None,
) -> str:
    if not target_clause:
        raise RetrievalError("Target clause is required to build inspection context")
    if all_clauses is None:
        raise RetrievalError("All clauses list cannot be None")
    terms_in_clause = resolve_defined_terms_in_clause(target_clause.content, defined_terms or {})
    related = hybrid_retrieve(target_clause, all_clauses, defined_terms or {})
    parts: list[str] = []
    parts.append(f"TARGET CLAUSE {target_clause.id} [{target_clause.title}]:\n{target_clause.content}\n")
    if terms_in_clause:
        parts.append("DEFINED TERMS IN USE:")
        for term, defn in terms_in_clause.items():
            parts.append(f'- "{term}": {defn}')
        parts.append("")
    if related:
        parts.append("CROSS-REFERENCED / OVERRIDE CLAUSES:")
        for c in related:
            parts.append(f"- {c.id} [{c.title}] : {c.content[:300]}")
        parts.append("")
    if not terms_in_clause and not related:
        parts.append("No additional cross-references or defined terms detected for this clause.")
    return "\n".join(parts)
