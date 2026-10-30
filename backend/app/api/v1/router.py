"""API v1 router."""

from fastapi import APIRouter

from .endpoints.analyze import router as analyze_router
from .endpoints.chat import router as chat_router
from .endpoints.health import router as health_router
from .endpoints.scrape import router as scrape_router
from .endpoints.translate import router as translate_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router, tags=["health"])
api_router.include_router(analyze_router, tags=["analyze"])
api_router.include_router(scrape_router, tags=["scrape"])
api_router.include_router(chat_router, tags=["chat"])
api_router.include_router(translate_router, tags=["translate"])
