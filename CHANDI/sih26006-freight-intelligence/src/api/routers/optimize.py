"""src/api/routers/optimize.py — POST /optimize and GET /jobs/{job_id}"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException
from ..schemas import OptimizeRequest, OptimizeResponse, JobStatusResponse
from ..services import (
    run_optimize_cached,
    run_optimize_fast,
    run_optimize_full_background,
    get_job_status,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/optimize", response_model=OptimizeResponse, summary="Run or retrieve procurement plan")
def optimize(body: OptimizeRequest):
    req = body.model_dump()
    try:
        if body.mode == "cached":
            result = run_optimize_cached(req)
        elif body.mode == "fast":
            result = run_optimize_fast(req)
        else:  # "full"
            job_id = run_optimize_full_background(req)
            return OptimizeResponse(
                job_id=job_id,
                served_from_cache=False,
                solver_status="pending",
                solver_gap_pct=0.0,
                solve_time_seconds=0.0,
                data_note="Full solve queued. Poll GET /jobs/{job_id} for status.",
                message=f"Background job started: {job_id}",
            )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("Optimize endpoint error: %s", exc, exc_info=True)
        raise HTTPException(status_code=503, detail=f"Solver failure: {exc}")

    return OptimizeResponse(**result)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse, summary="Poll background job status")
def job_status(job_id: str):
    job = get_job_status(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    result = None
    if job["status"] == "done" and job["result"]:
        try:
            result = OptimizeResponse(**job["result"])
        except Exception:
            result = None

    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        created_at=job["created_at"],
        completed_at=job.get("completed_at"),
        result=result,
        error=job.get("error"),
    )
