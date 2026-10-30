"""Analyze endpoints."""

import asyncio
import json
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.agents.graph import run_analysis, run_analysis_stream
from app.core.exceptions import DocumentParsingError
from app.core.llm import ocr_image_via_llm
from app.schemas.analysis import ExecutivePosture, RiskFinding
from app.schemas.contract import ClauseNode
from app.services.parser import is_image_file, normalize_text, parse_document

router = APIRouter()

MAX_FILES = 50
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB per file


class AnalyzeRequest(BaseModel):
    raw_text: str = Field(..., min_length=1)
    document_id: str = Field(default="doc-001")
    title: str = Field(default="")


class AnalyzeResponse(BaseModel):
    document_id: str
    raw_text: str
    clauses: list[ClauseNode]
    defined_terms: dict[str, str]
    flagged_clause_ids: list[str]
    verified_findings: list[RiskFinding]
    executive_summary: Optional[ExecutivePosture] = None
    execution_trace: list[dict] = Field(default_factory=list)


async def _run_and_build_response(
    raw_text: str, document_id: str = "doc-001"
) -> AnalyzeResponse:
    if not raw_text or not raw_text.strip():
        raise HTTPException(status_code=400, detail="raw_text cannot be empty")
    result = await run_analysis(raw_text, document_id=document_id)
    failed_traces = [
        trace
        for trace in result.get("execution_trace", [])
        if trace.get("status") == "failed"
    ]
    if failed_traces:
        detail = failed_traces[-1].get("detail") or "Analysis provider request failed"
        raise HTTPException(
            status_code=502,
            detail=f"Contract analysis could not be completed: {detail}",
        )
    # Store for chat RAG
    try:
        from app.api.v1.endpoints.chat import store_document

        store_document(
            result.get("document_id", document_id),
            result.get("raw_text", raw_text),
            result.get("clauses", []),
            result.get("defined_terms", {}),
        )
    except Exception:
        pass
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


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_contract(request: AnalyzeRequest) -> AnalyzeResponse:
    """Analyze raw contract text."""
    return await _run_and_build_response(request.raw_text, request.document_id)


@router.post("/analyze/upload", response_model=AnalyzeResponse)
async def analyze_upload(files: list[UploadFile] | None = File(default=None), file: UploadFile | None = File(default=None)) -> AnalyzeResponse:  # type: ignore
    """Analyze uploaded files (multi-PDF support, 50 files × 50MB). Backward compat single file."""
    # Collect files: prefer files list, fallback to single file for legacy clients
    # Handle direct calls where FastAPI default sentinel is not None nor list
    upload_files: list[UploadFile] = []
    if files is not None and isinstance(files, list):
        if len(files) == 1 and isinstance(files[0], UploadFile):
            upload_files = [
                f for f in files if f is not None and getattr(f, "filename", None)
            ]
        elif files:
            # FastAPI may give a single UploadFile even when declared as list
            if isinstance(files, UploadFile):  # type: ignore
                upload_files = [files]  # type: ignore
            else:
                try:
                    upload_files = [
                        f
                        for f in files
                        if f is not None and getattr(f, "filename", None)
                    ]
                except TypeError:
                    pass
    elif files is not None and isinstance(files, UploadFile):  # type: ignore
        upload_files = [files]  # type: ignore
    # check legacy single file param
    if file is not None and getattr(file, "filename", None):
        # file param may be the fastapi sentinel - check if it has read method
        if hasattr(file, "read"):
            upload_files.append(file)
    # When FastAPI sends single file as list with one element, it arrives in files
    # Filter empty
    upload_files = [f for f in upload_files if f and getattr(f, "filename", None)]
    if not upload_files:
        raise HTTPException(status_code=400, detail="No file provided")
    if len(upload_files) > MAX_FILES:
        raise HTTPException(
            status_code=400, detail=f"Too many files. Maximum is {MAX_FILES}."
        )
    parsed_parts: list[str] = []
    doc_names: list[str] = []
    for uf in upload_files:
        try:
            content = await uf.read()
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail=f"Failed to read file {uf.filename}: {exc}"
            ) from exc
        if not content:
            raise HTTPException(
                status_code=400, detail=f"Uploaded file {uf.filename} is empty"
            )
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File {uf.filename} too large. Maximum size is 50 MB per file.",
            )
        try:
            fname = uf.filename or "doc.pdf"
            if is_image_file(fname):
                extracted = await ocr_image_via_llm(content, fname)
                raw_text = normalize_text(extracted)
                if not raw_text.strip():
                    raise DocumentParsingError(f"Image {fname} OCR returned empty text")
            else:
                raw_text = parse_document(fname, content)
        except DocumentParsingError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail=f"Failed to parse file {uf.filename}: {exc}"
            ) from exc
        # Keep filename header for traceability
        header = f"\n\n--- Document: {uf.filename} ---\n\n"
        parsed_parts.append(header + raw_text)
        name = (
            uf.filename.rsplit(".", 1)[0]
            if "." in (uf.filename or "")
            else (uf.filename or "doc")
        )
        doc_names.append(name)
    combined_raw = "".join(parsed_parts).strip()
    # document_id as comma-joined or first if single
    document_id = ", ".join(doc_names[:3]) + (
        f" +{len(doc_names)-3} more" if len(doc_names) > 3 else ""
    )
    if len(doc_names) == 1:
        document_id = doc_names[0]
    return await _run_and_build_response(combined_raw, document_id=document_id)


@router.post("/analyze/stream")
async def analyze_stream(request: AnalyzeRequest):
    """SSE stream for real progress: emits progress events per node then complete."""
    if not request.raw_text or not request.raw_text.strip():
        raise HTTPException(status_code=400, detail="raw_text cannot be empty")

    async def event_generator():
        async for event in run_analysis_stream(
            request.raw_text, document_id=request.document_id
        ):
            # event is dict with event/data keys already
            yield event

    return EventSourceResponse(event_generator())


@router.post("/analyze/upload/stream")
async def analyze_upload_stream(files: list[UploadFile] | None = File(default=None), file: UploadFile | None = File(default=None)):  # type: ignore
    """SSE stream for multi-file upload with per-file progress."""
    upload_files: list[UploadFile] = []
    if files is not None and isinstance(files, list):
        try:
            upload_files = [
                f for f in files if f is not None and getattr(f, "filename", None)
            ]
        except TypeError:
            pass
        if len(upload_files) == 1 and isinstance(upload_files[0], UploadFile):
            pass
    elif files is not None and isinstance(files, UploadFile):  # type: ignore
        upload_files = [files]  # type: ignore
    if file is not None and getattr(file, "filename", None) and hasattr(file, "read"):
        upload_files.append(file)
    upload_files = [f for f in upload_files if f and getattr(f, "filename", None)]
    if not upload_files:
        raise HTTPException(status_code=400, detail="No file provided")
    if len(upload_files) > MAX_FILES:
        raise HTTPException(
            status_code=400, detail=f"Too many files. Maximum is {MAX_FILES}."
        )

    async def event_generator():
        parsed_parts: list[str] = []
        doc_names: list[str] = []
        total = len(upload_files)
        for idx, uf in enumerate(upload_files):
            # Emit file parsing progress
            yield {
                "event": "progress",
                "data": json.dumps(
                    {
                        "node": "parsing",
                        "status": "started",
                        "progress": int((idx / total) * 10),
                        "label": "Parsing document",
                        "current_file": uf.filename,
                        "current_file_index": idx + 1,
                        "total_files": total,
                    }
                ),
            }
            try:
                content = await uf.read()
            except Exception as exc:
                yield {"event": "error", "data": json.dumps({"message": str(exc)})}
                return
            if not content:
                yield {
                    "event": "error",
                    "data": json.dumps({"message": f"File {uf.filename} is empty"}),
                }
                return
            if len(content) > MAX_FILE_SIZE:
                yield {
                    "event": "error",
                    "data": json.dumps(
                        {"message": f"File {uf.filename} too large. Max 50 MB"}
                    ),
                }
                return
            try:
                fname2 = uf.filename or "doc.pdf"
                if is_image_file(fname2):
                    extracted2 = await ocr_image_via_llm(content, fname2)
                    raw_text = normalize_text(extracted2)
                    if not raw_text.strip():
                        raise DocumentParsingError(
                            f"Image {fname2} OCR returned empty text"
                        )
                else:
                    raw_text = parse_document(fname2, content)
            except Exception as exc:
                yield {"event": "error", "data": json.dumps({"message": str(exc)})}
                return
            parsed_parts.append(f"\n\n--- Document: {uf.filename} ---\n\n" + raw_text)
            doc_names.append(
                uf.filename.rsplit(".", 1)[0]
                if "." in (uf.filename or "")
                else (uf.filename or "doc")
            )
            yield {
                "event": "progress",
                "data": json.dumps(
                    {
                        "node": "parsing",
                        "status": "completed",
                        "progress": int(((idx + 1) / total) * 10),
                        "label": "Parsing document",
                        "current_file": uf.filename,
                        "current_file_index": idx + 1,
                        "total_files": total,
                    }
                ),
            }
            # small yield to allow UI update
            await asyncio.sleep(0.02)

        combined_raw = "".join(parsed_parts).strip()
        document_id = ", ".join(doc_names[:3]) + (
            f" +{len(doc_names)-3} more" if len(doc_names) > 3 else ""
        )
        if len(doc_names) == 1:
            document_id = doc_names[0]

        async for ev in run_analysis_stream(combined_raw, document_id=document_id):
            # Inject file context into progress events
            if ev.get("event") == "progress":
                try:
                    data = json.loads(ev["data"])
                    data["current_file"] = doc_names[-1] if doc_names else None
                    data["current_file_index"] = total
                    data["total_files"] = total
                    ev["data"] = json.dumps(data)
                except Exception:
                    pass
            yield ev

    return EventSourceResponse(event_generator())
