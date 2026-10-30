"""Tests for retriever."""

import pytest

from app.core.exceptions import RetrievalError
from app.schemas.contract import ClauseNode
from app.services.retriever import (
    _extract_ref_number,
    _is_cross_ref_keyword,
    _tokenize,
    build_inspection_context,
    compute_tf_idf_scores,
    extract_cross_references,
    hybrid_retrieve,
    lexical_search,
    resolve_defined_terms_in_clause,
)

def test_retriever_private_helpers_cover_fallbacks():
    assert _is_cross_ref_keyword("section")
    assert not _is_cross_ref_keyword("other")
    assert _extract_ref_number("") == ""
    assert _extract_ref_number("Article V") == "V"

def make_clause(id_val, title, content, section=""):
    return ClauseNode(
        id=id_val,
        title=title,
        content=content,
        char_start=0,
        char_end=len(content),
        level=1,
        section_number=section,
        clause_type="general",
    )

def test_extract_cross_references_basic():
    text = "Subject to Section 4.2 and Section 3, liability limited."
    refs = extract_cross_references(text)
    assert "Section 4.2" in refs
    assert "Section 3" in refs

def test_extract_cross_references_deduplicate():
    text = "See Section 4.1 and Section 4.1 again."
    refs = extract_cross_references(text)
    assert refs.count("Section 4.1") == 1

def test_extract_cross_references_multiple_types():
    text = "See Article V and Exhibit A and Schedule 1"
    refs = extract_cross_references(text)
    assert len(refs) >= 1

def test_extract_cross_references_empty():
    assert extract_cross_references("") == []
    assert extract_cross_references(None) == []

def test_resolve_defined_terms_exact_match():
    defined = {"Confidential Information": "secret", "Deliverables": "software"}
    clause_text = "The Confidential Information must be protected."
    found = resolve_defined_terms_in_clause(clause_text, defined)
    assert "Confidential Information" in found
    assert "Deliverables" not in found

def test_resolve_defined_terms_case_insensitive():
    defined = {"Confidential Information": "secret"}
    clause_text = "confidential information is lowercase"
    found = resolve_defined_terms_in_clause(clause_text, defined)
    assert "Confidential Information" in found

def test_resolve_defined_terms_empty():
    assert resolve_defined_terms_in_clause("", {"Term": "def"}) == {}
    assert resolve_defined_terms_in_clause("text", {}) == {}
    assert resolve_defined_terms_in_clause(None, {"Term": "def"}) == {}
    assert resolve_defined_terms_in_clause("text", None) == {}

def test_tokenize():
    assert _tokenize("Hello World 123") == ["hello", "world", "123"]
    assert _tokenize("") == []
    assert _tokenize("Notwithstanding anything") == ["notwithstanding", "anything"]

def test_compute_tf_idf_scores_basic():
    c1 = make_clause("clause-1", "1. First", "liability shall not exceed fees paid")
    c2 = make_clause("clause-2", "2. Second", "payment terms net 30 days")
    scores = compute_tf_idf_scores("liability fees", [c1, c2])
    assert len(scores) == 2
    assert scores[0][0].id == "clause-1"
    assert scores[0][1] > scores[1][1]

def test_compute_tf_idf_empty_query():
    c1 = make_clause("c1", "T", "content")
    assert compute_tf_idf_scores("", [c1]) == []
    assert compute_tf_idf_scores("   ", [c1]) == []

def test_compute_tf_idf_no_clauses():
    assert compute_tf_idf_scores("query", []) == []

def test_compute_tf_idf_empty_clause_content():
    c1 = make_clause("c1", "T", "")
    c1.content = ""
    scores = compute_tf_idf_scores("query", [c1])
    assert scores[0][1] == 0.0

def test_lexical_search_basic():
    c1 = make_clause("clause-1", "1. Liability", "liability shall not exceed fees paid")
    c2 = make_clause("clause-2", "2. Payment", "payment terms net 30 days")
    c3 = make_clause("clause-3", "3. Termination", "termination for convenience")
    results = lexical_search("liability fees", [c1, c2, c3], top_k=2)
    assert len(results) >= 1
    assert results[0].id == "clause-1"

def test_lexical_search_empty_query():
    c1 = make_clause("c1", "T", "content")
    assert lexical_search("", [c1]) == []
    assert lexical_search("   ", [c1]) == []
    assert lexical_search(None, [c1]) == []

def test_lexical_search_no_clauses():
    assert lexical_search("query", []) == []
    assert lexical_search("query", None) == []

def test_lexical_search_top_k_zero():
    c1 = make_clause("c1", "T", "content with query")
    assert lexical_search("query", [c1], top_k=0) == []
    assert lexical_search("query", [c1], top_k=-1) == []

def test_lexical_search_no_match():
    c1 = make_clause("c1", "T", "unrelated content about apples")
    assert lexical_search("liability indemnification", [c1]) == []

def test_hybrid_retrieve_cross_ref():
    c1 = make_clause("clause-1", "3. Indemnification", "Subject to Section 4.2, indemnification applies", section="3")
    c2 = make_clause("clause-2", "4.2 Data Breach Exception", "Notwithstanding Section 3, data breaches are excluded", section="4.2")
    c3 = make_clause("clause-3", "4.1 General Cap", "Liability cap applies", section="4.1")
    all_clauses = [c1, c2, c3]
    results = hybrid_retrieve(c1, all_clauses, {}, top_k=2)
    ids = [c.id for c in results]
    assert "clause-2" in ids

def test_hybrid_retrieve_notwithstanding():
    c1 = make_clause("clause-1", "3. Indemnification", "Provider shall indemnify against claims", section="3")
    c2 = make_clause("clause-2", "4.1 Cap", "Liability cap $100k", section="4.1")
    c3 = make_clause("clause-3", "4.2 Override", "Notwithstanding Section 3, Provider shall indemnify unlimited for data breaches", section="4.2")
    all_clauses = [c1, c2, c3]
    results = hybrid_retrieve(c1, all_clauses, {}, top_k=2)
    assert len(results) >= 1

def test_hybrid_retrieve_no_cross_ref_fallback_lexical():
    c1 = make_clause("c1", "3. Clause", "liability indemnification unlimited risk")
    c2 = make_clause("c2", "4. Clause", "liability indemnification is limited to fees")
    c3 = make_clause("c3", "5. Clause", "unrelated termination terms")
    results = hybrid_retrieve(c1, [c1, c2, c3], {}, top_k=2)
    assert any(c.id != "c1" for c in results)

def test_hybrid_retrieve_empty():
    assert hybrid_retrieve(None, [], {}) == []
    c1 = make_clause("c1", "T", "content")
    assert hybrid_retrieve(c1, [], {}) == []
    assert hybrid_retrieve(None, [c1], {}) == []

def test_hybrid_retrieve_notwithstanding_no_lexical_match():
    c1 = make_clause("c1", "T", "Subject to Section 9.9, term applies", section="1")
    c2 = make_clause("c2", "Other", "Notwithstanding nothing relevant xyzabc", section="4.2")
    c3 = make_clause("c3", "Another", "unrelated content", section="4.1")
    results = hybrid_retrieve(c1, [c1, c2, c3], {}, top_k=2)
    assert isinstance(results, list)

def test_build_inspection_context_with_terms_and_cross_ref():
    c1 = make_clause("clause-1", "3. Indemnification", "Provider shall indemnify Client, subject to Section 4.2, for Confidential Information breach", section="3")
    c2 = make_clause("clause-2", "4.2 Exception", "Notwithstanding Section 3, data breach liability is uncapped", section="4.2")
    defined = {"Confidential Information": "secret data definition"}
    all_clauses = [c1, c2]
    context = build_inspection_context(c1, all_clauses, defined)
    assert "TARGET CLAUSE clause-1" in context
    assert "DEFINED TERMS IN USE" in context
    assert "Confidential Information" in context
    assert "CROSS-REFERENCED" in context

def test_build_inspection_context_no_terms_no_related():
    c1 = make_clause("c1", "1. Simple", "Simple clause with no refs", section="1")
    c2 = make_clause("c2", "2. Other", "Other content unrelated apples oranges", section="2")
    context = build_inspection_context(c1, [c1, c2], {})
    assert "TARGET CLAUSE c1" in context
    assert "No additional cross-references" in context

def test_build_inspection_context_none_defined_terms():
    c1 = make_clause("c1", "T", "content")
    c2 = make_clause("c2", "T2", "other")
    ctx = build_inspection_context(c1, [c1, c2], None)
    assert "TARGET CLAUSE" in ctx

def test_build_inspection_context_raises_on_none_clause():
    with pytest.raises(RetrievalError, match="Target clause is required"):
        build_inspection_context(None, [], {})

def test_build_inspection_context_raises_on_none_all_clauses():
    c1 = make_clause("c1", "T", "content")
    with pytest.raises(RetrievalError, match="All clauses list cannot be None"):
        build_inspection_context(c1, None, {})

def test_lexical_search_top_k_limit():
    clauses = [make_clause(f"c{i}", f"T{i}", f"liability content {i}") for i in range(5)]
    results = lexical_search("liability", clauses, top_k=2)
    assert len(results) == 2

def test_hybrid_retrieve_duplicate_handling():
    c1 = make_clause("clause-1", "Section 4.2 Clause", "Subject to Section 4.2, content", section="3")
    c2 = make_clause("clause-2", "4.2 Target", "Target content with Section 4.2", section="4.2")
    # Both cross-ref logic paths could try to add same clause twice; ensure deduped
    results = hybrid_retrieve(c1, [c1, c2], {}, top_k=2)
    ids = [r.id for r in results]
    assert ids.count("clause-2") == 1

def test_extract_cross_references_with_article():
    text = "As per Article I and Section 2.1"
    refs = extract_cross_references(text)
    assert any("Article" in r or "Section" in r for r in refs)

def test_hybrid_retrieve_elif_branch():
    # Ref is Exhibit A, clause title contains Exhibit A but section_number not matching
    c1 = make_clause("clause-1", "1. Main", "See Exhibit A for details", section="1")
    c2 = make_clause("clause-2", "Exhibit A Details", "Exhibit content here", section="")
    # section_number for c2 is "" not "A", so first condition fails, second should succeed via ref in title
    results = hybrid_retrieve(c1, [c1, c2], {}, top_k=2)
    assert any(r.id == "clause-2" for r in results)

def test_hybrid_retrieve_duplicate_via_both_paths():
    # Create scenario where same clause would be added via both cross-ref and lexical, ensure deduped
    c1 = make_clause("c1", "1. Clause", "Content with Section 4.2 and liability", section="1")
    c2 = make_clause("c2", "4.2 Target", "Notwithstanding liability content relevant", section="4.2")
    # c2 matches cross-ref 4.2 and also lexical notwithstanding
    results = hybrid_retrieve(c1, [c1, c2], {}, top_k=2)
    ids = [r.id for r in results]
    assert ids.count("c2") == 1

def test_hybrid_retrieve_break_condition():
    # Test break when len(retrieved) >= top_k + len(cross_refs)
    c1 = make_clause("c1", "1. Target", "liability indemnification risk", section="1")
    clauses = [c1] + [make_clause(f"c{i}", f"T{i}", "liability indemnification risk content") for i in range(2, 7)]
    results = hybrid_retrieve(c1, clauses, {}, top_k=2)
    # lexical includes target, so after filtering we get 1 for top_k=2
    assert len(results) == 1
    # with top_k=3 we should get 2 after filtering target
    results2 = hybrid_retrieve(c1, clauses, {}, top_k=3)
    assert len(results2) == 2

def test_hybrid_retrieve_fallback_notwithstanding_path():
    # Mock lexical_search to test fallback path where first returns empty but second returns notwithstanding
    from unittest.mock import patch
    c1 = make_clause("c1", "1. Main", "Subject to Section 9.9, liability", section="1")
    c2 = make_clause("c2", "2. Notwith", "Notwithstanding content relevant liability", section="2")
    c3 = make_clause("c3", "3. Other", "Other liability content", section="3")
    all_clauses = [c1, c2, c3]
    # First call (notwithstanding subset) returns [], second call returns [c2]
    with patch("app.services.retriever.lexical_search") as mock_lex:
        mock_lex.side_effect = [[], [c2]]
        results = hybrid_retrieve(c1, all_clauses, {}, top_k=2)
        assert any(r.id == "c2" for r in results)
        assert mock_lex.call_count == 2

def test_hybrid_retrieve_fallback_notwithstanding_inner_filter():
    # Test inner filter where lex_all contains non-notwithstanding and we filter
    from unittest.mock import patch
    c1 = make_clause("c1", "1. Main", "See Section 9.9", section="1")
    c2 = make_clause("c2", "2. Other", "Other content liability", section="2")
    c3 = make_clause("c3", "3. Notwith", "Notwithstanding other content liability", section="3")
    all_clauses = [c1, c2, c3]
    with patch("app.services.retriever.lexical_search") as mock_lex:
        # first returns empty, second returns [c2, c3] where c2 is not notwithstanding, c3 is
        mock_lex.side_effect = [[], [c2, c3]]
        results = hybrid_retrieve(c1, all_clauses, {}, top_k=2)
        # should only add c3 because c2 is not notwithstanding
        assert all("notwithstanding" in r.content.lower() for r in results)
        assert any(r.id == "c3" for r in results)

def test_compute_tf_idf_branch_coverage():
    # Test branch where clause_text_tokens empty
    c_empty = make_clause("empty", "T", "")
    c_empty.content = ""
    c_normal = make_clause("normal", "T", "liability fees")
    scores = compute_tf_idf_scores("liability", [c_empty, c_normal])
    assert scores[0][1] == 0.0
    assert scores[1][1] > 0

def test_lexical_search_scores_filtered():
    c1 = make_clause("c1", "T", "unrelated apples")
    c2 = make_clause("c2", "T", "another unrelated")
    assert lexical_search("liability", [c1, c2]) == []
