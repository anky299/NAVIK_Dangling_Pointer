"""src/db/session.py — Database connection, session management, and health checks.

Configured for SQLAlchemy 2.0. Supports PostgreSQL in production and
local persistent SQLite for zero-dependency development/testing.
"""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker, Session

logger = logging.getLogger(__name__)

# Determine project root and default sqlite database path
_HERE = Path(__file__).resolve().parent
PROJECT_ROOT = _HERE.parent.parent
DEFAULT_SQLITE_PATH = PROJECT_ROOT / "data" / "navik_chartering.db"

# Ensure data directory exists
DEFAULT_SQLITE_PATH.parent.mkdir(parents=True, exist_ok=True)

# Read DATABASE_URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    DATABASE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH.as_posix()}"
    logger.info("DATABASE_URL not set; using default local persistent database at %s", DATABASE_URL)
else:
    # Handle postgres:// vs postgresql:// standard compatibility
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
    elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

# Configure engine with appropriate options for the dialect
is_sqlite = DATABASE_URL.startswith("sqlite")

engine_kwargs = {
    "echo": os.getenv("SQL_DEBUG", "0").lower() in ("1", "true"),
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": int(os.getenv("DB_POOL_SIZE", "10")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "20")),
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", "1800")),
    })

try:
    engine = create_engine(DATABASE_URL, **engine_kwargs)
except Exception as exc:
    logger.error("Failed to create database engine for URL '%s': %s", DATABASE_URL, exc)
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_health() -> dict[str, str | float | bool]:
    """Inspect database connectivity and measure query latency.
    
    Safe for health check endpoint; never leaks credentials.
    """
    start = time.perf_counter()
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - start) * 1000.0, 2)
        dialect = engine.dialect.name
        return {
            "connected": True,
            "dialect": dialect,
            "latency_ms": latency_ms,
        }
    except Exception as exc:
        latency_ms = round((time.perf_counter() - start) * 1000.0, 2)
        logger.warning("Database health check ping failed: %s", exc)
        return {
            "connected": False,
            "dialect": engine.dialect.name if hasattr(engine, "dialect") else "unknown",
            "latency_ms": latency_ms,
            "error": "Connection probe failed",
        }

