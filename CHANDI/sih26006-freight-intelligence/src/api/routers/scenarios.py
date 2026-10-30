"""src/api/routers/scenarios.py — POST /scenarios"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException
from ..schemas import ScenariosRequest, ScenariosResponse
from ..services import run_scenarios

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/scenarios", response_model=ScenariosResponse, summary="Compare low / base / high scenario plans")
def scenarios(body: ScenariosRequest):
    req = body.model_dump()
    try:
        result = run_scenarios(req)
        return ScenariosResponse(**result)
    except Exception as exc:
        logger.error("Scenarios endpoint error: %s", exc, exc_info=True)
        raise HTTPException(status_code=503, detail=f"Solver failure: {exc}")
