"""Data adapter for unified route freight rates access.

Supports switching between synthetic route rate simulations and genuine/internal
SAIL historical charter CSV files, producing an identical downstream schema:
  - date (datetime64[ns])
  - route_id (str)
  - vessel_class (str)
  - rate_usd_per_mt (float64)
  - hire_usd_per_day (float64)
  - bunker_cost (float64)
  - port_costs (float64)
  - voyage_days (float64)
  - is_synthetic (bool)
  - hire_is_derived (bool)
"""

import logging
import os
import sys
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.data.synthetic_routes import load_routes_config

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_SYNTHETIC_PATH = os.path.join(PROJECT_ROOT, "data", "processed", "synthetic_route_rates.parquet")
DEFAULT_SAIL_SAMPLE_PATH = os.path.join(PROJECT_ROOT, "data", "sample", "sail_template.csv")

ALLOWED_VESSEL_CLASSES = {"Handysize", "Supramax", "Panamax", "Capesize"}
REQUIRED_SAIL_COLUMNS = [
    "contract_date",
    "origin",
    "destination",
    "vessel_class",
    "parcel_size_mt",
    "freight_rate_usd_per_mt",
    "duration_days",
]

TARGET_COLUMNS = [
    "date",
    "route_id",
    "vessel_class",
    "rate_usd_per_mt",
    "hire_usd_per_day",
    "bunker_cost",
    "port_costs",
    "voyage_days",
    "is_synthetic",
    "hire_is_derived",
]


def _build_route_lookup(config_path: Optional[str] = None) -> Dict[str, str]:
    """Build a lookup mapping normalized (origin, destination) -> route_id."""
    cfg = load_routes_config(config_path)
    lookup: Dict[str, str] = {}
    for r in cfg.get("routes", []):
        r_id = r.get("route_id", "")
        orig = r.get("origin_port", "").strip().lower()
        dest = r.get("destination_port", "").strip().lower()
        if r_id:
            lookup[f"{orig}->{dest}"] = r_id
    return lookup


def load_sail_csv(filepath: str, config_path: Optional[str] = None) -> pd.DataFrame:
    """Load and strictly validate a SAIL historical charter fixture CSV.

    Validates:
      - File existence and non-emptiness
      - Required columns presence
      - Date parseability
      - Numeric types for parcel size, freight rate, duration days
      - Strict positive values for rate and parcel size (rate > 0, parcel > 0)
      - Allowed vessel class categorization
    """
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"SAIL charter file not found at: '{filepath}'")

    df = pd.read_csv(filepath, comment="#")
    if df.empty:
        raise ValueError(f"SAIL charter file at '{filepath}' is empty.")

    # 1. Missing columns check
    missing_cols = [c for c in REQUIRED_SAIL_COLUMNS if c not in df.columns]
    if missing_cols:
        raise ValueError(f"SAIL CSV missing required columns: {missing_cols}")

    # 2. Date parsing check
    parsed_dates = pd.to_datetime(df["contract_date"], errors="coerce")
    invalid_dates_count = parsed_dates.isna().sum()
    if invalid_dates_count > 0:
        bad_examples = df.loc[parsed_dates.isna(), "contract_date"].head(3).tolist()
        raise ValueError(f"Found {invalid_dates_count} unparseable contract_date entries. Examples: {bad_examples}")

    # 3. Numeric conversion & positive value check
    for num_col in ["parcel_size_mt", "freight_rate_usd_per_mt", "duration_days"]:
        converted = pd.to_numeric(df[num_col], errors="coerce")
        if converted.isna().any():
            bad_vals = df.loc[converted.isna(), num_col].head(3).tolist()
            raise TypeError(f"Column '{num_col}' contains non-numeric values: {bad_vals}")
        df[num_col] = converted

    if (df["freight_rate_usd_per_mt"] <= 0).any():
        bad_rates = df.loc[df["freight_rate_usd_per_mt"] <= 0, "freight_rate_usd_per_mt"].tolist()
        raise ValueError(f"freight_rate_usd_per_mt must be strictly positive (>0). Found: {bad_rates}")

    if (df["parcel_size_mt"] <= 0).any():
        bad_parcels = df.loc[df["parcel_size_mt"] <= 0, "parcel_size_mt"].tolist()
        raise ValueError(f"parcel_size_mt must be strictly positive (>0). Found: {bad_parcels}")

    if (df["duration_days"] < 0).any():
        bad_days = df.loc[df["duration_days"] < 0, "duration_days"].tolist()
        raise ValueError(f"duration_days cannot be negative. Found: {bad_days}")

    # 4. Allowed vessel class check
    unknown_classes = set(df["vessel_class"].astype(str).str.strip()) - ALLOWED_VESSEL_CLASSES
    if unknown_classes:
        raise ValueError(f"Unknown vessel_class values found: {unknown_classes}. Allowed: {sorted(ALLOWED_VESSEL_CLASSES)}")

    # 5. Schema mapping to standard output
    route_lookup = _build_route_lookup(config_path)

    def resolve_route_id(row: pd.Series) -> str:
        orig_norm = str(row["origin"]).strip().lower()
        dest_norm = str(row["destination"]).strip().lower()
        key = f"{orig_norm}->{dest_norm}"
        if key in route_lookup:
            return route_lookup[key]
        # Alternative alias checks (e.g. Vizag -> Visakhapatnam)
        if "vizag" in dest_norm:
            dest_norm = "visakhapatnam"
        key_alias = f"{orig_norm}->{dest_norm}"
        if key_alias in route_lookup:
            return route_lookup[key_alias]
        # Return formatted label if not found in configuration
        return f"{row['origin']}_{row['destination']}".upper().replace(" ", "")

    out_df = pd.DataFrame()
    out_df["date"] = parsed_dates
    out_df["route_id"] = df.apply(resolve_route_id, axis=1)
    out_df["vessel_class"] = df["vessel_class"].astype(str).str.strip()
    out_df["rate_usd_per_mt"] = df["freight_rate_usd_per_mt"].astype(float)

    # Columns that do NOT exist in SAIL charter records are explicitly set to NaN (not invented)
    out_df["hire_usd_per_day"] = np.nan
    out_df["bunker_cost"] = np.nan
    out_df["port_costs"] = np.nan
    out_df["voyage_days"] = np.nan
    out_df["is_synthetic"] = False
    out_df["hire_is_derived"] = False

    return out_df[TARGET_COLUMNS].sort_values("date").reset_index(drop=True)


def get_route_rates(source: str = "synthetic", path: Optional[str] = None) -> pd.DataFrame:
    """Retrieve unified route freight rates from synthetic simulation or SAIL charter records.

    Parameters:
      source: 'synthetic' or 'sail_csv'
      path: Custom file path (optional)

    Returns:
      pd.DataFrame with standardized schema:
        ['date', 'route_id', 'vessel_class', 'rate_usd_per_mt', 'hire_usd_per_day',
         'bunker_cost', 'port_costs', 'voyage_days', 'is_synthetic', 'hire_is_derived']
    """
    if source == "synthetic":
        target_path = path or DEFAULT_SYNTHETIC_PATH
        if not os.path.exists(target_path):
            raise FileNotFoundError(f"Synthetic route rates parquet not found at: '{target_path}'")
        df = pd.read_parquet(target_path)
        # Ensure target column ordering and datetime format
        df["date"] = pd.to_datetime(df["date"])
        return df[TARGET_COLUMNS].reset_index(drop=True)

    elif source == "sail_csv":
        target_path = path or DEFAULT_SAIL_SAMPLE_PATH
        return load_sail_csv(target_path)

    else:
        raise ValueError(f"Unknown data source: '{source}'. Allowed sources: 'synthetic', 'sail_csv'.")
