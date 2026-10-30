"""src/api/logging_config.py — Shared structured logging setup.

Configures two handlers:
  - StreamHandler (INFO) for console
  - RotatingFileHandler (DEBUG) writing to logs/api.log

Import this module once from app.py; all loggers inherit the root config.
"""
from __future__ import annotations

import logging
import logging.handlers
from pathlib import Path

from .config import LOG_DIR

_API_LOG = LOG_DIR / "api.log"
_CONFIGURED = False


def setup_logging() -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return

    fmt = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    # Console
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    ch.setFormatter(fmt)
    root.addHandler(ch)

    # Rotating file — up to 10 MB, keep 3 backups
    fh = logging.handlers.RotatingFileHandler(
        _API_LOG, maxBytes=10 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    fh.setLevel(logging.DEBUG)
    fh.setFormatter(fmt)
    root.addHandler(fh)

    _CONFIGURED = True
