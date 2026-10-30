"""src/api/routers/forecast.py — GET /forecast"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from ..services import get_forecast

router = APIRouter()

VALID_HORIZONS = {1, 4, 8, 12}


@router.get("/forecast", summary="BDI quantile forecast and per-tonne route rates")
def forecast(
    horizon_weeks: int = Query(..., description="Forecast horizon: 1, 4, 8, or 12 weeks"),
    route_id: Optional[str] = Query(None, description="Optional route identifier from routes.yaml"),
    vessel_class: Optional[str] = Query(None, description="Optional vessel class (e.g. Capesize)"),
):
    if horizon_weeks not in VALID_HORIZONS:
        raise HTTPException(
            status_code=422,
            detail=f"horizon_weeks must be one of {sorted(VALID_HORIZONS)}, got {horizon_weeks}",
        )
    try:
        return get_forecast(horizon_weeks, route_id, vessel_class)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
