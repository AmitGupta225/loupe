"""Health endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str
    model: str
    app_name: str


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Return service health and model info."""
    return HealthResponse(
        status="ok",
        version="1.0.0",
        model=settings.MODEL_ID,
        app_name=settings.APP_NAME,
    )
