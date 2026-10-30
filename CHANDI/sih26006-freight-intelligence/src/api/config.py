"""src/api/config.py — Startup validation and shared path constants.

Loaded once at import time; raises RuntimeError with a clear message if any
required config file is missing so the server refuses to start.
"""
from __future__ import annotations

import os
from pathlib import Path

# ── Resolve project root (two levels above this file: src/api/config.py → repo root)
_HERE = Path(__file__).resolve().parent
PROJECT_ROOT = _HERE.parent.parent

ROUTES_YAML      = PROJECT_ROOT / "config" / "routes.yaml"
OPTIMIZER_YAML   = PROJECT_ROOT / "config" / "optimizer_inputs.yaml"
DATA_PROCESSED   = PROJECT_ROOT / "data" / "processed"
DATA_RAW         = PROJECT_ROOT / "data" / "raw"
CACHE_DIR        = PROJECT_ROOT / "data" / "cache"
MODELS_DIR       = PROJECT_ROOT / "models"
LOG_DIR          = PROJECT_ROOT / "logs"

# Create directories that may not exist yet
CACHE_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

# ── Fail fast if config files are missing
_REQUIRED = {
    "config/routes.yaml": ROUTES_YAML,
    "config/optimizer_inputs.yaml": OPTIMIZER_YAML,
}
for _label, _path in _REQUIRED.items():
    if not _path.exists():
        raise RuntimeError(
            f"[startup] Required config file not found: {_path}\n"
            f"  Please create '{_label}' before starting the API server.\n"
        )

# ── Valid cargo codes (must match optimizer_inputs.yaml)
KNOWN_CARGOES = {"coking_coal", "thermal_coal"}

# ── Planning constants
DEFAULT_HORIZON_MONTHS = 6
DATA_NOTE = "Demand, prices and capacities are synthetic placeholders."
