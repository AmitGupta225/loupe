"""Strict prompt builders for each agent node."""

from app.schemas.contract import ClauseNode


def get_triage_system_prompt() -> str:
    """System prompt for clause triage - anti AI slop, calibrated severity."""
    return (
        "You are a legal contract analyst. Classify each clause by category "
        "and identify clauses requiring deep inspection. "
        "Categories: Indemnification, Limitation of Liability, IP Assignment, "
        "Termination, Non-Compete, Auto-Renewal, Payment/Penalties, Governing Law/Venue. "
        "Be thorough and balanced: flag clauses that pose material risk to the signing party — uncapped liability, "
        "one-sided indemnity, broad IP grab, harsh termination without cure, auto-renewal without notice, "
        "heavy penalties, or unusual non-compete. A typical agreement usually has 2-8 flagged clauses; "
        "do not be shy to flag them when the language is one-sided or unusually burdensome. "
        "Skip only genuinely low-risk boilerplate (mutual confidentiality, standard payment schedule, general governing law). "
        "If you see meaningful risk, flag it. Use only simple, everyday English. No fluff, no em dashes. "
        "Return ONLY JSON with flagged_clause_ids list. No explanations."
    )


def build_triage_user_prompt(clauses: list[ClauseNode]) -> str:
    """Build user prompt for triage."""
    if not clauses:
        return "No clauses to triage."
    parts: list[str] = ["Clauses for triage:"]
    for clause in clauses:
        parts.append(f"- {clause.id} [{clause.title}]: {clause.content[:500]}")
    parts.append(
        "Identify flagged_clause_ids for clauses needing deep liability inspection."
    )
    parts.append('Return JSON: {"flagged_clause_ids": ["clause-1", ...]}')
    return "\n".join(parts)


def get_inspector_system_prompt() -> str:
    """System prompt for deep liability inspector - anti AI slop, calibrated."""
    return (
        "You are a senior legal risk analyst. Analyse the flagged clause "
        "with its cross-referenced context and defined terms. "
        "CRITICAL LANGUAGE RULE: Use very simple, everyday English that anyone can understand. No legal jargon. "
        "Write like you are explaining to a friend. Short, simple sentences. Natural Indian English. "
        "SEVERITY CALIBRATION: Reserve HIGH for extreme, unusual risk only — uncapped liability, one-sided indemnity, "
        "broad IP transfer, harsh penalties without cure. Normal, expected clauses for the domain (standard governing law, "
        "routine payment, mutual confidentiality) must be LOW. If a clause is general and widely accepted, mark LOW. "
        "Do not inflate severity to look thorough. Accuracy over volume. "
        "QUOTE RULE: exact_quote must be the complete risky passage — include all sentences needed to capture the full "
        "obligation, condition, or exception. If the risk spans multiple sentences, include them all verbatim. "
        "Do NOT truncate to a single sentence when the clause continues. 10-60 words, must exist exactly in source. "
        "Keep each text field crisp: plain_english_explanation: 1-2 short simple sentences. "
        "worst_case_scenario: 1 simple sentence. "
        "recommended_redline: 1-2 simple sentences, no legal jargon. "
        "No em dashes, no bullet lists inside fields, no percentages. "
        "Produce a RiskFinding with: clause_id, title (4-7 simple words), category, severity "
        "(HIGH|MEDIUM|LOW), exact_quote (verbatim, multi-sentence allowed, must exist exactly in source), "
        "plain_english_explanation, worst_case_scenario, referenced_terms_used, "
        "recommended_redline. Ground every quote verbatim. Return ONLY JSON."
    )


def build_inspector_user_prompt(clause: ClauseNode, context: str) -> str:
    """Build user prompt for inspector."""
    if not clause:
        return "No clause provided."
    lines: list[str] = [
        f"Target Clause {clause.id} [{clause.title}]:",
        clause.content,
        "",
    ]
    if context and context.strip():
        lines.append("Resolved Context:")
        lines.append(context)
        lines.append("")
    lines.append("Analyze this clause and return a single RiskFinding JSON object.")
    return "\n".join(lines)


def build_inspector_batch_user_prompt(
    clauses_with_context: list[tuple[ClauseNode, str]],
) -> str:
    """Batched inspector prompt — 1 LLM call for all flagged clauses (10-20 s total)."""
    if not clauses_with_context:
        return "No clauses to inspect."
    lines: list[str] = [
        "Inspect each flagged clause below and return a JSON array of RiskFinding objects.",
        "",
    ]
    for clause, context in clauses_with_context:
        lines.append(f"--- Clause {clause.id} [{clause.title}] ---")
        lines.append(clause.content[:800])
        if context and context.strip():
            lines.append("Resolved Context: " + context[:500])
        lines.append("")
    lines.append(
        'Return JSON: {"findings": [{"clause_id": "clause-1", "title": "...", "category": "Indemnification", '
        '"severity": "HIGH", "exact_quote": "verbatim", "char_start": 0, "char_end": 10, '
        '"plain_english_explanation": "...", "worst_case_scenario": "...", "recommended_redline": "..."}]}'
    )
    return "\n".join(lines)


def get_executive_system_prompt() -> str:
    """System prompt for executive posture synthesis - anti AI slop, calibrated."""
    return (
        "You are an executive legal strategist writing for a busy Indian founder. "
        "Synthesize overall contract risk posture from the findings provided. "
        "CRITICAL LANGUAGE RULE: Use very simple, everyday English. No legal jargon, no complex words. "
        "Tone: Natural Indian English, calm, direct, human. Like a trusted friend explaining simply. "
        "CRITICAL: Your risk_score and risk_distribution MUST exactly match the severity counts in the findings. "
        "Count how many HIGH, MEDIUM, LOW findings exist and set risk_distribution = those exact counts. "
        "If there are zero findings, distribution is all zeros and risk_score is 0. "
        "Do NOT invent counts. Do NOT inflate. Use this scoring: HIGH*20 + MEDIUM*8 + LOW*3, capped at 100. "
        "If there are no findings at all, verdict is 'Low risk', conclusion 'Proceed with review', and say so clearly. "
        "Strict rules: "
        "1) verdict: exactly 2 words, one of: 'High risk' or 'Medium risk' or 'Low risk'. High only if there is real extreme risk. "
        "2) conclusion: exactly 3-5 words, one of: 'Do not sign' or 'Negotiate first' or 'Proceed with review'. Use 'Proceed with review' when risk is low. "
        "3) advice: exactly 3 short simple sentences in very simple everyday English (max 65 words total). "
        "Sentence 1: why risky naming problem areas in plain words. "
        "Sentence 2: what is missing or one-sided. "
        "Sentence 3: clear next step before signing. If no findings, say the contract looks standard. "
        "Do NOT use percentages, formulas, clause numbers. Never just say 'talk to a lawyer' without why. "
        "4) negotiation_priorities: list of 3-5 short simple phrases, each 3-6 words, very simple English. Empty if no findings. "
        "5) missing_protections: list of 2-4 short simple phrases, each 3-6 words, very simple English. Empty if no findings. "
        "No em dashes, no filler, no AI slop. Return ONLY ExecutivePosture JSON."
    )


def build_executive_user_prompt(clauses: list[ClauseNode], findings: list) -> str:
    """Build user prompt for executive posture."""
    if not clauses and not findings:
        return "No clauses or findings to synthesize."
    parts: list[str] = [f"Total clauses indexed: {len(clauses) if clauses else 0}"]
    if findings:
        parts.append(f"Total risk findings: {len(findings)}")
        for f in findings:
            fid = getattr(
                f,
                "clause_id",
                f.get("clause_id", "unknown") if isinstance(f, dict) else "unknown",
            )
            sev = getattr(
                f,
                "severity",
                f.get("severity", "unknown") if isinstance(f, dict) else "unknown",
            )
            cat = getattr(
                f,
                "category",
                f.get("category", "unknown") if isinstance(f, dict) else "unknown",
            )
            parts.append(f"- {fid} [{cat}] severity={sev}")
    else:
        parts.append("No findings.")
    parts.append("Synthesize executive risk posture.")
    parts.append(
        'Return JSON: {"risk_score": 75, "risk_distribution": {"HIGH":1}, "negotiation_priorities": [...], "missing_protections": [...], "verdict": "High risk", "conclusion": "Do not sign", "advice": "Detailed advice paragraph..."}'
    )
    return "\n".join(parts)


def get_defined_terms_system_prompt() -> str:
    """System prompt for AI-driven defined term extraction - anti AI slop."""
    return (
        "You are a legal definition extractor. Extract every defined term and its definition "
        "from the contract text. A defined term is any term that is explicitly defined in the document "
        "(quoted terms followed by 'means', capitalized phrases with definitions, etc.). "
        "CRITICAL: Use very simple, everyday English. No legal jargon, no complex words. Explain each term like you are telling a friend. "
        "Return ONLY JSON with defined_terms dict mapping term -> 1 short simple sentence in plain simple Indian English. "
        "Keep definitions short, 10-18 simple words each, no copying long clause text. No merging multiple terms together. "
        "No hardcoded word lists — derive everything strictly from the provided contract text."
    )


def build_defined_terms_user_prompt(raw_text: str) -> str:
    """Build user prompt for defined terms extraction."""
    if not raw_text or not raw_text.strip():
        return "No contract text provided."
    snippet = raw_text[:6000]
    return (
        "Extract defined terms from this contract:\n\n"
        + snippet
        + '\n\nReturn JSON: {"defined_terms": {"Term": "definition text", ...}}'
    )


def get_document_metadata_system_prompt() -> str:
    """System prompt for legal metadata extraction including document title."""
    return (
        "You are a legal metadata extractor and document title extractor. Read the contract and produce a short, "
        "natural title that describes what it is — for example 'Service Agreement ABC and XYZ' or 'NDA for Project Phoenix'. "
        "Use plain, simple words from the document itself. If parties are named, include them. "
        "Keep it under 10 words. Return ONLY JSON with parties list, effective_date, governing_law, title. "
        "No extra explanation. Infer solely from the document content."
    )


def build_document_metadata_user_prompt(raw_text: str) -> str:
    """Build user prompt for metadata extraction."""
    if not raw_text or not raw_text.strip():
        return "No contract text provided."
    snippet = raw_text[:4000]
    return (
        "Extract metadata from this contract:\n\n"
        + snippet
        + '\n\nReturn JSON: {"parties": ["Party A", "Party B"], "effective_date": "2024-01-15", "governing_law": "California", "title": "Agreement"}'
    )


def get_grounding_repair_system_prompt() -> str:
    """System prompt for quote repair."""
    return (
        "You are a quote correction assistant. Given a clause and a paraphrased quote, "
        "return the exact verbatim substring from the clause that best matches the intent. "
        "Use simple plain English only. No additions. "
        "Return ONLY JSON with exact_quote."
    )


def build_grounding_repair_user_prompt(clause_text: str, paraphrased_quote: str) -> str:
    """Build user prompt for quote repair."""
    if not clause_text or not paraphrased_quote:
        return "No clause or quote provided for repair."
    return (
        f"Clause text:\n{clause_text}\n\n"
        f"Paraphrased quote to repair:\n{paraphrased_quote}\n\n"
        "Return exact verbatim quote from clause."
    )
