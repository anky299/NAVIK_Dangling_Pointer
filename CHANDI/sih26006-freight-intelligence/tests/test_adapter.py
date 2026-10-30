"""Tests for src.data.adapter (synthetic and SAIL CSV loading and validation)."""

import os
import sys
import tempfile
import numpy as np
import pandas as pd
import pytest

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.data.adapter import get_route_rates, TARGET_COLUMNS


def test_synthetic_path_loads():
    """Verify that source='synthetic' successfully loads the parquet dataset."""
    df = get_route_rates(source="synthetic")
    assert isinstance(df, pd.DataFrame)
    assert not df.empty
    assert (df["is_synthetic"] == True).all()
    assert df.columns.tolist() == TARGET_COLUMNS


def test_valid_sail_csv_passes():
    """Verify that a valid SAIL CSV loads successfully with is_synthetic=False."""
    df = get_route_rates(source="sail_csv")
    assert isinstance(df, pd.DataFrame)
    assert len(df) == 5
    assert (df["is_synthetic"] == False).all()
    assert (df["hire_is_derived"] == False).all()
    # Ensure unobserved columns in SAIL fixtures are explicitly NaN
    for col in ["hire_usd_per_day", "bunker_cost", "port_costs", "voyage_days"]:
        assert df[col].isna().all()


def test_missing_column_fails():
    """Verify that a SAIL CSV missing required columns raises ValueError."""
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as f:
        # Missing 'duration_days' and 'parcel_size_mt'
        f.write("contract_date,origin,destination,vessel_class,freight_rate_usd_per_mt\n")
        f.write("2023-01-01,Newcastle,Paradip,Capesize,14.50\n")
        temp_path = f.name

    try:
        with pytest.raises(ValueError, match="missing required columns"):
            get_route_rates(source="sail_csv", path=temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def test_negative_rate_fails():
    """Verify that non-positive or negative freight rate raises ValueError."""
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as f:
        f.write("contract_date,origin,destination,vessel_class,parcel_size_mt,freight_rate_usd_per_mt,duration_days\n")
        f.write("2023-01-01,Newcastle,Paradip,Capesize,160000,-5.00,35\n")
        temp_path = f.name

    try:
        with pytest.raises(ValueError, match="strictly positive"):
            get_route_rates(source="sail_csv", path=temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def test_bad_vessel_class_fails():
    """Verify that unknown vessel classes raise ValueError."""
    with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as f:
        f.write("contract_date,origin,destination,vessel_class,parcel_size_mt,freight_rate_usd_per_mt,duration_days\n")
        f.write("2023-01-01,Newcastle,Paradip,VeryLargeOreCarrier,250000,12.00,40\n")
        temp_path = f.name

    try:
        with pytest.raises(ValueError, match="Unknown vessel_class"):
            get_route_rates(source="sail_csv", path=temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def test_output_schema_matches_synthetic_schema():
    """Verify that the output schema and columns from SAIL CSV match synthetic schema exactly."""
    df_synth = get_route_rates(source="synthetic")
    df_sail = get_route_rates(source="sail_csv")

    assert df_synth.columns.tolist() == df_sail.columns.tolist()
    assert df_synth.columns.tolist() == TARGET_COLUMNS
    assert pd.api.types.is_datetime64_any_dtype(df_sail["date"])
    assert pd.api.types.is_float_dtype(df_sail["rate_usd_per_mt"])
    assert pd.api.types.is_bool_dtype(df_sail["is_synthetic"])


def test_unknown_source_fails():
    """Verify that passing an invalid source name raises ValueError."""
    with pytest.raises(ValueError, match="Unknown data source"):
        get_route_rates(source="invalid_source_name")
