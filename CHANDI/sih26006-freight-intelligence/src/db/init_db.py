"""src/db/init_db.py — Database schema initialization and table creation."""
from __future__ import annotations

import logging
from .session import Base, engine
from . import models  # Ensures all models are registered with Base.metadata

logger = logging.getLogger(__name__)


def init_database() -> None:
    """Create all tables defined in Base metadata if they do not exist."""
    try:
        logger.info("Initializing database tables for NAVIK Chartering Operations...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified successfully.")
    except Exception as exc:
        logger.error("Failed to initialize database tables: %s", exc)
        raise


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    init_database()

