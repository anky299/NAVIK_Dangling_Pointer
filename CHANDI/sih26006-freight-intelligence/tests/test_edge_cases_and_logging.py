"""tests/test_edge_cases_and_logging.py — Edge cases, robustness, and logging tests.

Covers:
1. Missing data in the latest weeks: API serves cached forecast and flags it.
2. Extreme hire values (10x and 0.1x of normal): does not produce negative rates or crashes.
3. Infeasible optimizer request: returns a readable error message.
4. Endpoint logging: every endpoint call is logged to logs/api.log with timing.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from unittest.mock import patch, MagicMock

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from src.api.app import create_app
from src.api.config import LOG_DIR
from src.api.services import get_forecast, _format_optimize_response, _build_forecast
from src.optimizer.inputs import (
    load_routes_config,
    build_full_optimizer_parameters,
    compute_trailing_hire_rate,
)
from src.backtest.run_backtest import compute_realised_spot_costs


@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as c:
        yield c


# ─────────────────────────────────────────────────────────────────────────────
# 1. Missing Data in the Latest Weeks
# ─────────────────────────────────────────────────────────────────────────────

class TestMissingDataFallback:
    def test_missing_latest_weeks_serves_cached_and_flags_it(self, client):
        """When latest week data is missing (NaN or incomplete), API serves cached forecast with warning flag."""
        # Pre-seed a known cached forecast
        cached_data = {
            "horizon_weeks": 4,
            "bdi_q10": 1100.0,
            "bdi_median": 1350.0,
            "bdi_q90": 1700.0,
            "route_id": None,
            "vessel_class": None,
            "per_tonne_rate_usd": None,
            "calibration_note": "Cached test forecast",
        }

        with patch("src.api.services._read_cache", return_value=cached_data.copy()), \
             patch("src.api.services._build_forecast", side_effect=ValueError("Missing data in latest weeks")):
            resp = client.get("/forecast?horizon_weeks=4")
            assert resp.status_code == 200
            data = resp.json()
            assert data["served_from_cache"] is True
            assert data["is_cached_fallback"] is True
            assert "Missing data in the latest weeks" in data.get("warning", "")
            assert data.get("data_flag") == "cached_fallback_missing_latest_data"
            assert data["bdi_median"] == 1350.0

    def test_corrupted_latest_nan_values_trigger_cache_fallback(self):
        """If latest row contains NaNs, get_forecast catches it and serves cached fallback."""
        cached_data = {
            "horizon_weeks": 8,
            "bdi_q10": 1000.0,
            "bdi_median": 1200.0,
            "bdi_q90": 1600.0,
            "route_id": None,
            "vessel_class": None,
            "per_tonne_rate_usd": None,
            "calibration_note": "Cached fallback",
        }

        # Mock _load_gbm to return a dataframe with NaN in latest row
        mock_df = pd.DataFrame([{
            "horizon_weeks": 8,
            "test_date": "2026-10-23",
            "predicted_q10_calib": float("nan"),
            "predicted_q50": float("nan"),
            "predicted_q90_calib": float("nan"),
        }])

        with patch("src.api.services._read_cache", return_value=cached_data.copy()), \
             patch("src.api.services._load_gbm", return_value=mock_df):
            result = get_forecast(horizon_weeks=8, route_id=None, vessel_class=None)
            assert result["served_from_cache"] is True
            assert result["is_cached_fallback"] is True
            assert "warning" in result
            assert result["bdi_median"] == 1200.0


# ─────────────────────────────────────────────────────────────────────────────
# 2. Extreme Hire Values (10x and 0.1x of Normal)
# ─────────────────────────────────────────────────────────────────────────────

class TestExtremeHireValues:
    def test_extreme_high_hire_10x_no_negative_or_crash(self):
        """10x hire level produces non-negative rates without crashing."""
        routes_cfg = load_routes_config()
        # Normal BDI ~1500, 10x is 15000
        spot_vc, hire_rates = compute_realised_spot_costs(routes_cfg, realised_bdi=15000.0, realised_brent=80.0)

        assert len(spot_vc) > 0
        for route_key, vc in spot_vc.items():
            assert vc > 0.0, f"Negative voyage cost for {route_key}: {vc}"
        for vessel, hr in hire_rates.items():
            assert hr > 0.0, f"Negative hire rate for {vessel}: {hr}"

    def test_extreme_low_hire_0_1x_no_negative_or_crash(self):
        """0.1x hire level produces non-negative rates without crashing."""
        routes_cfg = load_routes_config()
        # Normal BDI ~1500, 0.1x is 150
        spot_vc, hire_rates = compute_realised_spot_costs(routes_cfg, realised_bdi=150.0, realised_brent=80.0)

        assert len(spot_vc) > 0
        for route_key, vc in spot_vc.items():
            assert vc >= 0.0, f"Negative voyage cost for {route_key}: {vc}"
        for vessel, hr in hire_rates.items():
            assert hr >= 0.0, f"Negative hire rate for {vessel}: {hr}"

    def test_extreme_hire_in_build_forecast_per_tonne_rate(self):
        """_build_forecast per_tonne_rate is non-negative at 0.1x and 10x hire."""
        for factor in [0.1, 10.0]:
            mock_row = pd.Series({
                "predicted_q10_calib": 1000.0 * factor,
                "predicted_q50": 1400.0 * factor,
                "predicted_q90_calib": 1800.0 * factor,
            })
            mock_sub = pd.DataFrame([mock_row])
            with patch("src.api.services._load_gbm") as mock_load:
                mock_df = pd.DataFrame({
                    "horizon_weeks": [4],
                    "test_date": ["2026-10-23"],
                    "predicted_q10_calib": [1000.0 * factor],
                    "predicted_q50": [1400.0 * factor],
                    "predicted_q90_calib": [1800.0 * factor],
                })
                mock_load.return_value = mock_df
                res = _build_forecast(horizon_weeks=4, route_id="HAY_DHM", vessel_class="Capesize")
                assert res["bdi_median"] > 0
                assert res["per_tonne_rate_usd"] is not None
                assert res["per_tonne_rate_usd"] > 0.0

    def test_compute_trailing_hire_rate_non_negative_on_low_input(self):
        """Trailing hire rate must not be negative even with near-zero base forecast."""
        bdi_forecast = {1: 10.0, 2: 20.0, 3: 15.0}
        rate = compute_trailing_hire_rate("Capesize", 9.07, month=2, bdi_base_forecast=bdi_forecast)
        assert rate >= 0.0


# ─────────────────────────────────────────────────────────────────────────────
# 3. Infeasible Optimizer Request
# ─────────────────────────────────────────────────────────────────────────────

class TestInfeasibleOptimizerRequest:
    def test_infeasible_result_returns_readable_message(self):
        """An infeasible solver result produces a clear readable explanation in message field."""
        infeasible_solver_res = {
            "status": "Infeasible",
            "is_optimal": False,
            "objective_value": 0.0,
            "solve_time_seconds": 0.12,
            "mip_gap": 0.0,
            "cost_breakdown": {},
            "plan": {},
        }
        params = {"routes": [], "vessel_classes": []}

        resp = _format_optimize_response(
            res=infeasible_solver_res,
            params=params,
            served_from_cache=False,
            cache_timestamp=None,
        )

        assert resp["solver_status"] == "Infeasible"
        assert resp["message"] is not None
        assert "infeasible" in resp["message"].lower()
        assert "constraints" in resp["message"].lower()
        assert resp["cost_breakdown"] is None
        assert resp["month_1_recommendation"] == []

    def test_optimize_endpoint_with_infeasible_status(self, client):
        """POST /optimize handles an infeasible run and returns a 200 response with readable message."""
        infeasible_resp = {
            "job_id": None,
            "served_from_cache": False,
            "cache_timestamp": None,
            "solver_status": "Infeasible",
            "solver_gap_pct": 0.0,
            "solve_time_seconds": 0.05,
            "month_1_recommendation": [],
            "cost_breakdown": None,
            "savings_vs_naive_baseline": None,
            "savings_vs_landed_cost_baseline": None,
            "data_note": "Synthetic data note",
            "message": "Optimization request is infeasible: constraints cannot be satisfied with the given parameters.",
        }

        with patch("src.api.routers.optimize.run_optimize_fast", return_value=infeasible_resp):
            resp = client.post("/optimize", json={
                "cargo": "coking_coal",
                "quantity_mt": 10000000.0,
                "deadline_month": 1,
                "mode": "fast",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["solver_status"] == "Infeasible"
            assert "infeasible" in data["message"].lower()
            assert "constraints" in data["message"].lower()


# ─────────────────────────────────────────────────────────────────────────────
# 4. API Request Logging with Timing to logs/api.log
# ─────────────────────────────────────────────────────────────────────────────

class TestApiLogging:
    def test_endpoint_call_is_logged_to_file_with_timing(self, client):
        """Every endpoint call writes an entry with request method, path, and duration (ms) to logs/api.log."""
        log_file = LOG_DIR / "api.log"
        assert log_file.exists(), f"Log file does not exist: {log_file}"

        # Make a distinctive endpoint call
        call_time = time.time()
        resp = client.get("/health")
        assert resp.status_code == 200

        # Read last 50 lines from api.log
        log_content = log_file.read_text(encoding="utf-8")
        assert "/health" in log_content, "Expected /health call in api.log"
        assert "ms" in log_content, "Expected timing (ms) logged in api.log"
        assert "API Request:" in log_content

    def test_market_history_call_logged_with_timing(self, client):
        """GET /history logs timing properly."""
        log_file = LOG_DIR / "api.log"
        resp = client.get("/history?series=bdi&n_weeks=4")
        assert resp.status_code == 200

        log_content = log_file.read_text(encoding="utf-8")
        assert "/history" in log_content
        assert "duration=" in log_content or "ms" in log_content
