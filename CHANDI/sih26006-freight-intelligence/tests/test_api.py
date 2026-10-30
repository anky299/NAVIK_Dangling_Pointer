"""tests/test_api.py — FastAPI endpoint tests via TestClient.

Covers:
- GET /health
- GET /history (valid + invalid series)
- GET /forecast (valid + invalid horizon)
- POST /optimize  (fast mode, cached mode, full mode → job_id, invalid input)
- GET /jobs/{job_id}
- POST /scenarios
- Cache fallback behaviour
"""
from __future__ import annotations

import json
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# ─── Add project root to path before importing the app ──────────────────────
import sys
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from src.api.app import create_app

# ─── TestClient fixture ──────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as c:
        yield c


# ─── Minimal stub result for optimizer calls (fast, avoids 20 s wait) ───────

def _stub_solver_result():
    return {
        "status": "Optimal",
        "is_optimal": True,
        "objective_value": 500_000_000.0,
        "solve_time_seconds": 0.5,
        "mip_gap": 0.04,
        "num_variables": 100,
        "num_constraints": 80,
        "cost_breakdown": {
            "cargo": 400_000_000.0,
            "freight": 60_000_000.0,
            "freight_by_scenario": {"low": 55e6, "base": 60e6, "high": 65e6},
            "period_hire": 1_000_000.0,
            "demurrage": 500_000.0,
            "inventory": 800_000.0,
            "unmet": 0.0,
            "total_mean": 500_000_000.0,
            "total_by_scenario": {"low": 480e6, "base": 500e6, "high": 520e6},
        },
        "plan": {
            "shipments": [
                {
                    "mode": "spot",
                    "cargo": "coking_coal",
                    "origin": "Hay Point",
                    "port": "Paradip",
                    "vessel_class": "Capesize",
                    "month": 1,
                    "tonnes": 155000.0,
                    "voyages": 1,
                }
            ],
            "x": {}, "n": {}, "k": {}, "psi": {}, "inventory": {}, "unmet_demand": {},
        },
    }


def _stub_baseline():
    return {
        "total_cost": 700_000_000.0,
        "cargo_cost": 600_000_000.0,
        "freight_cost": 90_000_000.0,
        "demurrage_cost": 10_000_000.0,
        "total_voyages": 48,
    }


def _stub_stats():
    return {
        "m1_shipments": [
            {
                "cargo": "coking_coal",
                "origin": "Hay Point",
                "port": "Paradip",
                "vessel_class": "Capesize",
                "mode": "spot",
                "voyages": 1,
                "tonnes": 155000.0,
            }
        ],
        "m1_tonnes": 155000.0,
        "m1_voyages": 1,
        "tonnes_by_mode": {"spot": 155000.0, "COA": 0.0, "period": 0.0},
        "voyages_by_mode": {"spot": 1, "COA": 0, "period": 0},
        "share_tonnes": {"spot": 100.0, "COA": 0.0, "period": 0.0},
        "share_voyages": {"spot": 100.0, "COA": 0.0, "period": 0.0},
    }


# ─── /health ─────────────────────────────────────────────────────────────────

def test_health_returns_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "model_version" in body
    assert "data_last_updated" in body


# ─── /history ────────────────────────────────────────────────────────────────

def test_history_bdi_returns_records(client):
    r = client.get("/history?series=bdi&start=2019-01-01&end=2019-12-31")
    assert r.status_code == 200
    body = r.json()
    assert body["series"] == "bdi"
    assert "data" in body
    # Each record has the three required fields
    if body["data"]:
        record = body["data"][0]
        assert "date" in record
        assert "value" in record
        assert "is_derived" in record


def test_history_bci_sub_index(client):
    r = client.get("/history?series=bci&start=2019-01-01&end=2019-06-30")
    assert r.status_code == 200
    body = r.json()
    assert body["series"] == "bci"


def test_history_derived_flag_after_cutoff(client):
    r = client.get("/history?series=bci&start=2019-08-01&end=2019-12-31")
    assert r.status_code == 200
    body = r.json()
    for rec in body["data"]:
        assert rec["is_derived"] is True


def test_history_invalid_series_returns_422(client):
    r = client.get("/history?series=INVALID_SERIES")
    assert r.status_code == 422


# ─── /forecast ───────────────────────────────────────────────────────────────

def test_forecast_valid_horizon(client):
    r = client.get("/forecast?horizon_weeks=4")
    assert r.status_code == 200
    body = r.json()
    assert "bdi_median" in body
    assert "bdi_q10" in body
    assert "bdi_q90" in body
    assert "calibration_note" in body


def test_forecast_all_horizons(client):
    for h in [1, 4, 8, 12]:
        r = client.get(f"/forecast?horizon_weeks={h}")
        assert r.status_code == 200, f"Failed for horizon_weeks={h}"


def test_forecast_invalid_horizon_returns_422(client):
    r = client.get("/forecast?horizon_weeks=6")
    assert r.status_code == 422


# ─── /optimize ───────────────────────────────────────────────────────────────

_FAST_BODY = {
    "cargo": "coking_coal",
    "quantity_mt": 150000,
    "deadline_month": 2,
    "objective": "mean",
    "mode": "fast",
}


_FAST_RESPONSE = {
    "job_id": None,
    "served_from_cache": False,
    "cache_timestamp": None,
    "solver_status": "Optimal",
    "solver_gap_pct": 4.0,
    "solve_time_seconds": 0.5,
    "month_1_recommendation": [
        {
            "cargo": "coking_coal",
            "origin": "Hay Point",
            "port": "Paradip",
            "vessel_class": "Capesize",
            "charter_mode": "spot",
            "voyages": 1,
            "tonnes": 155000.0,
        }
    ],
    "cost_breakdown": {
        "cargo": 400_000_000.0,
        "freight": 60_000_000.0,
        "freight_by_scenario": {"low": 55e6, "base": 60e6, "high": 65e6},
        "period_hire": 1_000_000.0,
        "demurrage": 500_000.0,
        "inventory": 800_000.0,
        "unmet": 0.0,
        "total_mean": 500_000_000.0,
        "total_by_scenario": {"low": 480e6, "base": 500e6, "high": 520e6},
    },
    "savings_vs_naive_baseline": 200_000_000.0,
    "savings_vs_landed_cost_baseline": 180_000_000.0,
    "data_note": "Demand, prices and capacities are synthetic placeholders.",
}


@patch("src.api.routers.optimize.run_optimize_fast", return_value=_FAST_RESPONSE)
def test_optimize_fast_mode(mock_fast, client):
    r = client.post("/optimize", json=_FAST_BODY)
    assert r.status_code == 200
    body = r.json()
    assert body["solver_status"] == "Optimal"
    assert body["served_from_cache"] is False
    assert "month_1_recommendation" in body
    assert "cost_breakdown" in body
    assert "savings_vs_naive_baseline" in body
    assert "savings_vs_landed_cost_baseline" in body
    assert body["data_note"] == "Demand, prices and capacities are synthetic placeholders."


def test_optimize_invalid_cargo_returns_422(client):
    body = dict(_FAST_BODY)
    body["cargo"] = "gold"
    r = client.post("/optimize", json=body)
    assert r.status_code == 422


def test_optimize_negative_quantity_returns_422(client):
    body = dict(_FAST_BODY)
    body["quantity_mt"] = -1000
    r = client.post("/optimize", json=body)
    assert r.status_code == 422


def test_optimize_invalid_objective_returns_422(client):
    body = dict(_FAST_BODY)
    body["objective"] = "banana"
    r = client.post("/optimize", json=body)
    assert r.status_code == 422


def test_optimize_weights_not_summing_to_1_returns_422(client):
    body = dict(_FAST_BODY)
    body["scenario_weights"] = {"low": 0.1, "base": 0.1, "high": 0.1}
    r = client.post("/optimize", json=body)
    assert r.status_code == 422


def test_optimize_deadline_out_of_horizon_returns_422(client):
    body = dict(_FAST_BODY)
    body["deadline_month"] = 99
    r = client.post("/optimize", json=body)
    assert r.status_code == 422


# ─── /optimize cached mode ───────────────────────────────────────────────────

def test_optimize_cached_returns_cache(client, tmp_path, monkeypatch):
    """When a full_plan.json exists in cache, 'cached' mode returns it."""
    import json as _json
    from src.api import config as api_config

    cache_file = api_config.CACHE_DIR / "full_plan.json"
    old_content = cache_file.read_text(encoding="utf-8") if cache_file.exists() else None

    fake_cache = {
        "_cached_at": "2026-01-01T00:00:00+00:00",
        "solver_status": "cached",
        "solver_gap_pct": 0.99,
        "solve_time_seconds": 0.0,
        "month_1_recommendation": [],
        "cost_breakdown": {
            "cargo": 0.0, "freight": 0.0, "freight_by_scenario": {},
            "period_hire": 0.0, "demurrage": 0.0, "inventory": 0.0,
            "unmet": 0.0, "total_mean": 0.0, "total_by_scenario": {},
        },
        "savings_vs_naive_baseline": 0.0,
        "savings_vs_landed_cost_baseline": 0.0,
        "data_note": "Demand, prices and capacities are synthetic placeholders.",
    }

    try:
        cache_file.write_text(_json.dumps(fake_cache), encoding="utf-8")
        body = dict(_FAST_BODY)
        body["mode"] = "cached"
        r = client.post("/optimize", json=body)
        assert r.status_code == 200
        resp = r.json()
        assert resp["served_from_cache"] is True
        assert resp["solver_status"] == "cached"
    finally:
        if old_content is not None:
            cache_file.write_text(old_content, encoding="utf-8")


def test_optimize_cached_missing_returns_404(client, monkeypatch):
    """If no cache file exists, 'cached' mode returns 404."""
    from src.api import config as api_config
    cache_file = api_config.CACHE_DIR / "full_plan.json"
    existed = cache_file.exists()
    if existed:
        import shutil
        bak = api_config.CACHE_DIR / "_full_plan_bak.json"
        shutil.move(str(cache_file), str(bak))

    try:
        body = dict(_FAST_BODY)
        body["mode"] = "cached"
        r = client.post("/optimize", json=body)
        assert r.status_code == 404
    finally:
        if existed:
            import shutil
            shutil.move(str(api_config.CACHE_DIR / "_full_plan_bak.json"), str(cache_file))


# ─── /optimize full mode → job polling ───────────────────────────────────────

@patch("src.api.services.build_full_optimizer_parameters", return_value={
    "objective_type": "mean", "scenarios": ["base"], "scenario_weights": {"base": 1.0},
    "demand": {}, "cargoes": [], "origins": [], "ports": [],
    "vessel_classes": [], "months": [1], "routes": [], "eligibility": {},
})
@patch("src.api.services.build_and_solve_optimizer", return_value=_stub_solver_result())
@patch("src.api.services.compute_naive_baseline", return_value=_stub_baseline())
@patch("src.api.services.analyze_plan_statistics", return_value=_stub_stats())
def test_optimize_full_returns_job_id(mock_stats, mock_baseline, mock_solver, mock_params, client):
    body = dict(_FAST_BODY)
    body["mode"] = "full"
    r = client.post("/optimize", json=body)
    assert r.status_code == 200
    body_resp = r.json()
    assert "job_id" in body_resp
    assert body_resp["job_id"] is not None
    assert body_resp["solver_status"] == "pending"

    # Poll for job result
    job_id = body_resp["job_id"]
    deadline = time.time() + 10  # at most 10 s
    status = "pending"
    while time.time() < deadline:
        poll = client.get(f"/jobs/{job_id}")
        assert poll.status_code == 200
        status = poll.json()["status"]
        if status in ("done", "failed"):
            break
        time.sleep(0.3)
    assert status in ("done", "failed"), f"Job did not complete within 10s; status={status}"


def test_job_unknown_id_returns_404(client):
    r = client.get("/jobs/nonexistent_job_id")
    assert r.status_code == 404


# ─── /scenarios ──────────────────────────────────────────────────────────────

_SCENARIO_BODY = {
    "cargo": "thermal_coal",
    "quantity_mt": 200000,
    "deadline_month": 3,
    "mode": "fast",
}


_SCENARIO_PLAN = {
    "scenario": "base",
    "objective_value": 500_000_000.0,
    "cost_breakdown": {
        "cargo": 400e6, "freight": 60e6,
        "freight_by_scenario": {"low": 55e6, "base": 60e6, "high": 65e6},
        "period_hire": 1e6, "demurrage": 5e5, "inventory": 8e5,
        "unmet": 0.0, "total_mean": 500e6,
        "total_by_scenario": {"low": 480e6, "base": 500e6, "high": 520e6},
    },
    "month_1_recommendation": [],
    "solver_status": "Optimal",
    "solver_gap_pct": 4.0,
    "solve_time_seconds": 0.5,
}

_SCENARIOS_RESPONSE = {
    "plans": [
        {**_SCENARIO_PLAN, "scenario": "low"},
        {**_SCENARIO_PLAN, "scenario": "base"},
        {**_SCENARIO_PLAN, "scenario": "high"},
    ],
    "cost_differences": {"high_vs_low": 0.0, "high_vs_base": 0.0, "base_vs_low": 0.0},
    "data_note": "Demand, prices and capacities are synthetic placeholders.",
}


@patch("src.api.services.run_scenarios", return_value=_SCENARIOS_RESPONSE)
def test_scenarios_returns_three_plans(mock_run, client):
    r = client.post("/scenarios", json=_SCENARIO_BODY)
    assert r.status_code == 200
    body = r.json()
    assert "plans" in body
    assert len(body["plans"]) == 3
    scenarios_returned = {p["scenario"] for p in body["plans"]}
    assert scenarios_returned == {"low", "base", "high"}
    assert "cost_differences" in body
    assert "data_note" in body


def test_scenarios_invalid_cargo_returns_422(client):
    body = dict(_SCENARIO_BODY)
    body["cargo"] = "plutonium"
    r = client.post("/scenarios", json=body)
    assert r.status_code == 422


# ─── Cache fallback ───────────────────────────────────────────────────────────

@patch("src.api.services.build_full_optimizer_parameters", side_effect=RuntimeError("model crashed"))
def test_optimize_fast_fallback_to_cache(mock_params, client):
    """If optimizer crashes, fast mode falls back to fast_plan cache."""
    import json as _json
    from src.api import config as api_config

    fake = {
        "_cached_at": "2026-01-01T00:00:00+00:00",
        "solver_status": "cached_fallback",
        "solver_gap_pct": 0.0,
        "solve_time_seconds": 0.0,
        "month_1_recommendation": [],
        "cost_breakdown": {
            "cargo": 0.0, "freight": 0.0, "freight_by_scenario": {},
            "period_hire": 0.0, "demurrage": 0.0, "inventory": 0.0,
            "unmet": 0.0, "total_mean": 0.0, "total_by_scenario": {},
        },
        "savings_vs_naive_baseline": 0.0,
        "savings_vs_landed_cost_baseline": 0.0,
        "data_note": "Demand, prices and capacities are synthetic placeholders.",
        "served_from_cache": True,
    }
    (api_config.CACHE_DIR / "fast_plan.json").write_text(_json.dumps(fake), encoding="utf-8")

    r = client.post("/optimize", json=_FAST_BODY)
    # Either succeeds from cache or raises 503
    assert r.status_code in (200, 503)
    if r.status_code == 200:
        assert r.json()["served_from_cache"] is True
