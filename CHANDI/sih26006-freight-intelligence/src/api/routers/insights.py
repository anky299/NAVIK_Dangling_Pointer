"""src/api/routers/insights.py — GET /insights"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException
from ..schemas import InsightsResponse
from ..services import get_insights

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/insights",
    response_model=InsightsResponse,
    summary="Savings breakdown, feature importance, and risk alerts",
)
def insights():
    try:
        result = get_insights()
        return InsightsResponse(**result)
    except Exception as exc:
        logger.error("Insights endpoint error: %s", exc, exc_info=True)
        raise HTTPException(status_code=503, detail=f"Insights unavailable: {exc}")
