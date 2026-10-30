"""src/api/routers/health.py — GET /health"""
from __future__ import annotations

from fastapi import APIRouter
from ..services import get_health

router = APIRouter()


@router.get("/health", summary="Server health, data freshness and model version")
def health():
    return get_health()
