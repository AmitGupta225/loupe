"""FastAPI application."""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.exceptions import LoupeError

app = FastAPI(
    title="Loupe API",
    version="1.0.0",
    description="Legal contract risk inspection platform",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(LoupeError)
async def loupe_exception_handler(request: Request, exc: LoupeError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "message": exc.message,
            "status_code": exc.status_code,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "message": str(exc),
            "status_code": 500,
        },
    )


app.include_router(api_router)


@app.get("/")
async def root() -> dict:
    return {"message": "Loupe API", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health_root() -> dict:
    return {"status": "ok"}
