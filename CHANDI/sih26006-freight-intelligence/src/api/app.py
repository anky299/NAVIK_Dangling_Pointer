"""src/api/app.py — FastAPI application factory.

create_app() returns a fully configured FastAPI instance.
Import the module-level `app` for uvicorn / testing.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .logging_config import setup_logging
from .routers import health, history, forecast, optimize, scenarios, insights

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def _lifespan(app: FastAPI):
    logger.info("SAIL Freight Intelligence API started (v0.1.0)")
    yield
    logger.info("SAIL Freight Intelligence API shutting down")


def create_app() -> FastAPI:
    app = FastAPI(
        title="SAIL Freight Intelligence API",
        description=(
            "Maritime raw-material procurement optimiser for SAIL East Coast plants.\n\n"
            "**Data note**: demand, prices and capacities are synthetic placeholders "
            "calibrated from public SAIL annual reports and Argus/Platts proxy benchmarks."
        ),
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=_lifespan,
    )

    # ── Request logging middleware with timing to logs/api.log
    import time

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.perf_counter()
        try:
            response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            logger.info(
                "API Request: %s %s status=%d duration=%.2fms",
                request.method,
                request.url.path,
                response.status_code,
                duration_ms,
            )
            return response
        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            logger.error(
                "API Request Failed: %s %s duration=%.2fms error=%s",
                request.method,
                request.url.path,
                duration_ms,
                exc,
            )
            raise

    # ── Enable CORS for frontend development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Global error handler for unhandled exceptions
    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception at %s: %s", request.url, exc, exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {exc}"},
        )

    # ── Register routers (thin — no business logic here)
    app.include_router(health.router, tags=["Health"])
    app.include_router(history.router, tags=["Market Data"])
    app.include_router(forecast.router, tags=["Forecast"])
    app.include_router(optimize.router, tags=["Optimizer"])
    app.include_router(scenarios.router, tags=["Scenarios"])
    app.include_router(insights.router, tags=["Insights"])

    return app


# Module-level app used by uvicorn and TestClient
app = create_app()
