"""src/api/routers/history.py — GET /history"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..services import get_history

router = APIRouter()

VALID_SERIES = {"bdi", "bci", "bpi", "bsi", "bhsi", "brent", "usdinr"}


@router.get("/history", summary="Historical market data for a named series")
def history(
    series: str = Query(..., description="One of: bdi, bci, bpi, bsi, bhsi, brent, usdinr"),
    start: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
    end: Optional[str] = Query(None, description="ISO date YYYY-MM-DD"),
):
    if series.lower() not in VALID_SERIES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid series '{series}'. Valid: {sorted(VALID_SERIES)}",
        )
    records = get_history(series.lower(), start, end)
    return {"series": series.lower(), "count": len(records), "data": records}
