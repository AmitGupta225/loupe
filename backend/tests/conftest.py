"""Global test fixtures and network guard."""

import socket

import pytest

_original_connect = socket.socket.connect


def _blocked_connect(self, address):
    host = address[0] if isinstance(address, tuple) and len(address) > 0 else ""
    if isinstance(host, str) and host not in ("127.0.0.1", "localhost", "::1", "", "0.0.0.0"):
        # Block any external network - Modal and all other hosts
        raise RuntimeError(f"Live network calls are forbidden in tests! Attempted to connect to {host}")
    return _original_connect(self, address)


@pytest.fixture(autouse=True)
def block_network(monkeypatch):
    """Block live Modal network calls."""
    monkeypatch.setattr(socket.socket, "connect", _blocked_connect)
    yield


@pytest.fixture
def sample_contract_text():
    return (
        "MASTER SERVICES AGREEMENT\n\n"
        "This Agreement is made between Alpha Corp and Beta LLC.\n\n"
        "Effective Date: January 15, 2024\n\n"
        "Governed by the laws of the State of California.\n\n"
        "1. Definitions\n\n"
        '"Confidential Information" means all non-public information disclosed by either party.\n\n'
        '"Deliverables" shall mean the software and documentation to be delivered.\n\n'
        "2. Payment Terms\n\n"
        "Client shall pay all fees within 30 days. Late payments incur 1.5% monthly penalty.\n\n"
        "3. Indemnification\n\n"
        "Provider shall indemnify Client for all claims. Subject to Section 4.2, Provider's liability shall not exceed fees paid.\n\n"
        "4. Limitation of Liability\n\n"
        "4.1 General Cap\n\n"
        "Liability shall not exceed fees paid in prior 12 months.\n\n"
        "4.2 Data Breach Exception\n\n"
        "Notwithstanding anything to the contrary, Sections 4.1 and 3 shall not apply to Data Breaches.\n\n"
        "5. Termination\n\n"
        "Either party may terminate for convenience with 30 days notice.\n"
    )


@pytest.fixture
def sample_think_fenced_json():
    return (
        "<think>Reasoning about Section 8.1 indemnification risks...</think>\n"
        "```json\n"
        '{"clause_id": "clause-1", "title": "Indemnification", "category": "Indemnification", '
        '"severity": "HIGH", "exact_quote": "Provider shall indemnify Client for all claims", '
        '"char_start": 0, "char_end": 44, "plain_english_explanation": "Uncapped obligation", '
        '"worst_case_scenario": "Unlimited liability", "referenced_terms_used": [], '
        '"recommended_redline": "Provider shall indemnify up to fees paid", '
        '"grounding_status": "VERIFIED_EXACT"}\n'
        "```"
    )


@pytest.fixture
def sample_raw_json_no_fence():
    return (
        '{"clause_id": "clause-2", "title": "Liability", "category": "Limitation of Liability", '
        '"severity": "HIGH", "exact_quote": "Liability shall not exceed fees", '
        '"char_start": 10, "char_end": 45, "plain_english_explanation": "Cap explanation", '
        '"worst_case_scenario": "Worst case", "referenced_terms_used": ["Confidential Information"], '
        '"recommended_redline": "Mutual cap", "grounding_status": "VERIFIED_EXACT"}'
    )


@pytest.fixture
def sample_malformed_json():
    return "```json\n{not valid json: ,}\n```"


@pytest.fixture
def sample_prose_wrapped_json():
    return (
        "Here is the analysis you requested:\n"
        '{"clause_id": "clause-3", "title": "Termination", "category": "Termination", '
        '"severity": "MEDIUM", "exact_quote": "Either party may terminate", '
        '"char_start": 5, "char_end": 30, "plain_english_explanation": "Explanation", '
        '"worst_case_scenario": "Scenario", "referenced_terms_used": [], '
        '"recommended_redline": "Redline", "grounding_status": "VERIFIED_EXACT"}'
        "\nHope this helps."
    )
