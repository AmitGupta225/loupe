"""AI Chat with RAG over analyzed contracts."""

import json
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.llm import build_chat_payload, call_llm
from app.services.retriever import lexical_search

router = APIRouter()

# In-memory document store populated by analyze endpoints
DOCUMENT_STORE: dict[str, dict] = {}


class ChatMessage(BaseModel):
    role: str = Field(..., description="user or assistant")
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    document_id: str | None = None
    raw_text: str | None = None
    history: List[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer: str
    citations: List[str] = Field(default_factory=list)


def _get_document_context(
    document_id: str | None, raw_text: str | None
) -> tuple[str, list]:
    """Retrieve stored document or fallback to provided raw_text."""
    if document_id and document_id in DOCUMENT_STORE:
        stored = DOCUMENT_STORE[document_id]
        return stored.get("raw_text", ""), stored.get("clauses", [])
    if raw_text:
        return raw_text, []
    # Fallback to most recent document
    if DOCUMENT_STORE:
        # pick last inserted
        key = list(DOCUMENT_STORE.keys())[-1]
        stored = DOCUMENT_STORE[key]
        return stored.get("raw_text", ""), stored.get("clauses", [])
    return "", []


def store_document(
    document_id: str, raw_text: str, clauses: list, defined_terms: dict | None = None
):
    DOCUMENT_STORE[document_id] = {
        "raw_text": raw_text,
        "clauses": clauses,
        "defined_terms": defined_terms or {},
    }


def build_chat_system_prompt() -> str:
    return (
        "You are Loupe, a helpful legal contract assistant. Answer using ONLY the provided contract context. "
        "If the answer is not in the contract, say you cannot find it in the document. "
        "Use very simple, everyday English, natural Indian English tone, warm and concise. "
        "No jargon, no em dashes, no filler, no purple prose. "
        "Be honest and precise. Cite clause numbers when relevant in brackets like [Section 4.2]. "
        "Keep answers short: 3-5 sentences max unless user asks for detail."
    )


def build_chat_user_prompt(
    question: str,
    context: str,
    history: List[ChatMessage],
    defined_terms: dict | None = None,
) -> str:
    parts: list[str] = []
    if defined_terms:
        parts.append("Defined terms:")
        for k, v in list(defined_terms.items())[:20]:
            parts.append(f"- {k}: {v[:120]}")
        parts.append("")
    parts.append("Contract context (relevant excerpts):")
    parts.append(context[:8000] if context else "No context found.")
    parts.append("")
    if history:
        parts.append("Conversation history:")
        for h in history[-6:]:
            parts.append(f"{h.role}: {h.content}")
        parts.append("")
    parts.append(f"User question: {question}")
    parts.append("Answer in simple English, cite sources, do not hallucinate.")
    return "\n".join(parts)


@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest) -> ChatResponse:
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    raw_text, clauses = _get_document_context(req.document_id, req.raw_text)
    if not raw_text:
        raise HTTPException(
            status_code=400,
            detail="No document context available. Please analyze a contract first.",
        )

    # Retrieve relevant chunks via lexical_search if clauses exist, else slice raw_text
    context = ""
    citations: list[str] = []
    if clauses:
        try:
            # clauses are dicts or ClauseNode; normalize
            from app.schemas.contract import ClauseNode

            clause_objs = []
            for c in clauses:
                if isinstance(c, dict):
                    clause_objs.append(ClauseNode(**c))
                else:
                    clause_objs.append(c)
            top = lexical_search(req.question, clause_objs, top_k=4)
            if top:
                for cl in top:
                    context += f"[{cl.section_number} {cl.title}] {cl.content[:600]}\n"
                    citations.append(cl.id)
            else:
                context = raw_text[:4000]
        except Exception:
            context = raw_text[:4000]
    else:
        # No clauses, use raw_text window around keywords
        q_words = [w.lower() for w in req.question.split() if len(w) > 3]
        if q_words:
            lower = raw_text.lower()
            best_idx = -1
            for w in q_words:
                idx = lower.find(w)
                if idx != -1 and (best_idx == -1 or idx < best_idx):
                    best_idx = idx
            if best_idx != -1:
                start = max(0, best_idx - 1000)
                context = raw_text[start : start + 4000]
            else:
                context = raw_text[:4000]
        else:
            context = raw_text[:4000]

    defined_terms = None
    if req.document_id and req.document_id in DOCUMENT_STORE:
        defined_terms = DOCUMENT_STORE[req.document_id].get("defined_terms")

    system_prompt = build_chat_system_prompt()
    user_prompt = build_chat_user_prompt(
        req.question, context, req.history, defined_terms
    )
    payload = build_chat_payload(system_prompt, user_prompt, temperature=0.2)
    from app.core.llm import _execute_modal_call

    raw = await _execute_modal_call(payload)

    answer = raw.strip() if isinstance(raw, str) else str(raw)
    # Strip think blocks if present (simple)
    if "<think>" in answer.lower():
        low = answer.lower()
        while True:
            s = low.find("<think>")
            if s == -1:
                break
            e = low.find("</think>", s)
            if e == -1:
                break
            answer = answer[:s] + answer[e + 8 :]
            low = answer.lower()
        answer = answer.strip()

    return ChatResponse(answer=answer, citations=citations)
