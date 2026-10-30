"""Scrape endpoints."""

import json

from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from fastapi import APIRouter, HTTPException

from app.agents.graph import run_analysis, run_analysis_stream
from app.api.v1.endpoints.analyze import AnalyzeResponse
from app.core.exceptions import LoupeError
from app.services.scraper import scrape_url

router = APIRouter()


class ScrapeRequest(BaseModel):
    url: str = Field(..., min_length=1, description="URL to scrape")


class ScrapeResponse(BaseModel):
    url: str
    title: str = ""
    extracted_text: str
    char_count: int


class AnalyzeUrlRequest(BaseModel):
    url: str = Field(..., min_length=1)
    document_id: str = Field(default="")


@router.post("/scrape", response_model=ScrapeResponse)
async def scrape_endpoint(request: ScrapeRequest) -> ScrapeResponse:
    """Scrape URL and return extracted text."""
    try:
        result = await scrape_url(request.url)
    except LoupeError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return ScrapeResponse(
        url=result["url"],
        title=result["title"],
        extracted_text=result["extracted_text"],
        char_count=result["char_count"],
    )


@router.post("/analyze/url", response_model=AnalyzeResponse)
async def analyze_url(request: AnalyzeUrlRequest) -> AnalyzeResponse:
    """Scrape URL and run contract analysis on extracted text."""
    try:
        scraped = await scrape_url(request.url)
    except LoupeError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    raw_text = scraped["extracted_text"]
    if not raw_text or not raw_text.strip():
        raise HTTPException(
            status_code=400, detail="Scraped page contains no extractable text"
        )
    document_id = request.document_id or scraped["title"] or request.url
    # Reuse analysis logic
    result = await run_analysis(raw_text, document_id=document_id)
    return AnalyzeResponse(
        document_id=result.get("document_id", document_id),
        raw_text=result.get("raw_text", raw_text),
        clauses=result.get("clauses", []),
        defined_terms=result.get("defined_terms", {}),
        flagged_clause_ids=result.get("flagged_clause_ids", []),
        verified_findings=result.get("verified_findings", []),
        executive_summary=result.get("executive_summary"),
        execution_trace=result.get("execution_trace", []),
    )


@router.post("/analyze/url/stream")
async def analyze_url_stream(request: AnalyzeUrlRequest):
    """SSE stream for URL: scrape then run streamed analysis."""
    try:
        # initial fetch phase
        scraped = await scrape_url(request.url)
    except LoupeError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    raw_text = scraped["extracted_text"]
    if not raw_text or not raw_text.strip():
        raise HTTPException(
            status_code=400, detail="Scraped page contains no extractable text"
        )
    document_id = request.document_id or scraped["title"] or request.url

    async def event_generator():
        # scraping completed -> emit fetching done
        yield {
            "event": "progress",
            "data": json.dumps(
                {
                    "node": "scrape",
                    "status": "completed",
                    "progress": 10,
                    "label": "Fetching document",
                }
            ),
        }
        async for ev in run_analysis_stream(raw_text, document_id=document_id):
            yield ev

    return EventSourceResponse(event_generator())
