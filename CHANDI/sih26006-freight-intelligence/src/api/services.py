"""src/api/services.py — Business logic layer.

All heavy lifting (data loading, forecast, optimisation, cache I/O) lives here.
Routers call these functions and return the result directly.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from .config import (
    CACHE_DIR,
    DATA_PROCESSED,
    DATA_RAW,
    DATA_NOTE,
    DEFAULT_HORIZON_MONTHS,
    MODELS_DIR,
    PROJECT_ROOT,
)

# Ensure project root is on path so src.* imports work
_root = str(PROJECT_ROOT)
if _root not in sys.path:
    sys.path.insert(0, _root)

from src.data.loaders import (
    load_bdi_daily,
    load_baltic_subindices,
    load_brent_daily,
    load_usdinr_daily,
)
from src.optimizer.inputs import build_full_optimizer_parameters
from src.optimizer.model import build_and_solve_optimizer
from scripts.run_optimizer import compute_naive_baseline, analyze_plan_statistics

logger = logging.getLogger(__name__)

# ─────────────────────────── In-memory job store ───────────────────────────
_JOBS: Dict[str, Dict[str, Any]] = {}

# ─────────────────────────── Cache helpers ─────────────────────────────────

def _cache_path(key: str) -> Path:
    return CACHE_DIR / f"{key}.json"


def _write_cache(key: str, payload: Dict[str, Any]) -> None:
    payload["_cached_at"] = datetime.now(timezone.utc).isoformat()
    try:
        _cache_path(key).write_text(json.dumps(payload, default=str), encoding="utf-8")
        logger.debug("Cache written: %s", key)
    except Exception as exc:
        logger.warning("Failed to write cache '%s': %s", key, exc)


def _read_cache(key: str) -> Optional[Dict[str, Any]]:
    p = _cache_path(key)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Failed to read cache '%s': %s", key, exc)
        return None


def _cache_age_seconds(key: str) -> Optional[float]:
    p = _cache_path(key)
    if not p.exists():
        return None
    return time.time() - p.stat().st_mtime


def latest_cache_timestamp() -> Optional[str]:
    """Return ISO timestamp of the most-recently-written cache file."""
    files = list(CACHE_DIR.glob("*.json"))
    if not files:
        return None
    latest = max(files, key=lambda f: f.stat().st_mtime)
    ts = datetime.fromtimestamp(latest.stat().st_mtime, tz=timezone.utc)
    return ts.isoformat()

# ─────────────────────────── /health ───────────────────────────────────────

def get_health() -> Dict[str, Any]:
    # Data last-updated: latest parquet mtime
    data_last_updated: Optional[str] = None
    parquets = list(DATA_PROCESSED.glob("*.parquet"))
    if parquets:
        latest_parquet = max(parquets, key=lambda f: f.stat().st_mtime)
        data_last_updated = datetime.fromtimestamp(
            latest_parquet.stat().st_mtime, tz=timezone.utc
        ).isoformat()

    # Model version: count of saved .txt model files
    model_files = list(MODELS_DIR.glob("gbm_bdi_*.txt"))
    model_version = f"gbm_v{len(model_files)}_horizons_1_4_8_12"

    cache_age = _cache_age_seconds("full_plan") or _cache_age_seconds("fast_plan")

    return {
        "status": "ok",
        "data_last_updated": data_last_updated,
        "model_version": model_version,
        "cache_age_seconds": round(cache_age, 1) if cache_age is not None else None,
    }

# ─────────────────────────── /history ──────────────────────────────────────

_SERIES_LOADERS = {
    "bdi": lambda: load_bdi_daily(str(DATA_RAW / "bdi_daily.csv")),
    "brent": lambda: load_brent_daily(str(DATA_RAW / "brent_daily.csv")),
    "usdinr": lambda: load_usdinr_daily(str(DATA_RAW / "usdinr_daily.csv")),
}

def _load_subindices():
    return load_baltic_subindices(str(DATA_RAW / "baltic_subindices_2012_2019.csv"))

def get_history(
    series: str,
    start: Optional[str],
    end: Optional[str],
) -> List[Dict[str, Any]]:
    col = series.lower()

    # Baltic sub-indices share one file
    if col in {"bci", "bpi", "bsi", "bhsi"}:
        df = _load_subindices()
        if df is None or col not in df.columns:
            return []
        df = df[["date", col]].rename(columns={col: "value"})
        df["is_derived"] = df["date"] > pd.Timestamp("2019-07-31")
    elif col in _SERIES_LOADERS:
        df = _SERIES_LOADERS[col]()
        if df is None:
            return []
        value_col = col  # bdi, brent, usdinr
        df = df[["date", value_col]].rename(columns={value_col: "value"})
        df["is_derived"] = False
    else:
        return []

    df = df.dropna(subset=["value"])
    if start:
        df = df[df["date"] >= pd.Timestamp(start)]
    if end:
        df = df[df["date"] <= pd.Timestamp(end)]

    return [
        {
            "date": row["date"].strftime("%Y-%m-%d"),
            "value": float(row["value"]),
            "is_derived": bool(row["is_derived"]),
        }
        for _, row in df.iterrows()
    ]

# ─────────────────────────── /forecast ─────────────────────────────────────

# GBM result cache (already parquet on disk)
_MASTER_DF: Optional[pd.DataFrame] = None
_GBM_DF: Optional[pd.DataFrame] = None


def _load_master() -> Optional[pd.DataFrame]:
    global _MASTER_DF
    if _MASTER_DF is None:
        p = DATA_PROCESSED / "master.parquet"
        if p.exists():
            _MASTER_DF = pd.read_parquet(p)
    return _MASTER_DF


def _load_gbm() -> Optional[pd.DataFrame]:
    global _GBM_DF
    if _GBM_DF is None:
        p = DATA_PROCESSED / "gbm_results.parquet"
        if p.exists():
            _GBM_DF = pd.read_parquet(p)
    return _GBM_DF


def get_forecast(
    horizon_weeks: int,
    route_id: Optional[str],
    vessel_class: Optional[str],
) -> Dict[str, Any]:
    cache_key = f"forecast_h{horizon_weeks}_{route_id or 'all'}_{vessel_class or 'all'}"
    cached = _read_cache(cache_key)

    try:
        result = _build_forecast(horizon_weeks, route_id, vessel_class)
        # Check for missing data in latest weeks
        if any(result.get(k) is None or pd.isna(result.get(k)) for k in ["bdi_q10", "bdi_median", "bdi_q90"]):
            raise ValueError("Missing data in latest weeks for forecast quantiles")

        _write_cache(cache_key, result)
        result["served_from_cache"] = False
        result["is_cached_fallback"] = False
        result["data_flag"] = "live"
        return result
    except Exception as exc:
        logger.warning("Forecast live build failed (%s); serving cached forecast fallback", exc)
        if cached:
            cached["served_from_cache"] = True
            cached["is_cached_fallback"] = True
            cached["data_flag"] = "cached_fallback_missing_latest_data"
            cached["warning"] = "Missing data in the latest weeks; serving cached forecast."
            cached["data_note"] = "Serving cached forecast due to missing or incomplete data in recent weeks."
            return cached
        # Fallback to any available cached forecast for this horizon
        fallback_files = list(CACHE_DIR.glob(f"forecast_h{horizon_weeks}_*.json"))
        if fallback_files:
            try:
                any_cached = json.loads(fallback_files[0].read_text(encoding="utf-8"))
                any_cached["served_from_cache"] = True
                any_cached["is_cached_fallback"] = True
                any_cached["data_flag"] = "cached_fallback_missing_latest_data"
                any_cached["warning"] = "Missing data in the latest weeks; serving cached forecast."
                any_cached["data_note"] = "Serving cached forecast due to missing or incomplete data in recent weeks."
                return any_cached
            except Exception:
                pass
        raise


def _build_forecast(
    horizon_weeks: int,
    route_id: Optional[str],
    vessel_class: Optional[str],
) -> Dict[str, Any]:
    import yaml

    gbm_df = _load_gbm()
    if gbm_df is None:
        raise RuntimeError("GBM results parquet not found")

    sub = gbm_df[gbm_df["horizon_weeks"] == horizon_weeks].sort_values("test_date")
    if sub.empty:
        raise ValueError(f"No GBM results for horizon_weeks={horizon_weeks}")

    latest = sub.iloc[-1]
    # Check if latest record has valid numbers
    raw_q10 = latest.get("predicted_q10_calib", latest.get("q10_calibrated", latest.get("predicted_q10", None)))
    raw_q50 = latest.get("predicted_q50", latest.get("q50_calibrated", latest.get("predicted_q50", None)))
    raw_q90 = latest.get("predicted_q90_calib", latest.get("q90_calibrated", latest.get("predicted_q90", None)))

    if raw_q10 is None or raw_q50 is None or raw_q90 is None or pd.isna(raw_q50):
        raise ValueError("Missing data in latest weeks: forecast values contain NaN or None")

    q10 = max(0.0, float(raw_q10))
    q50 = max(0.0, float(raw_q50))
    q90 = max(q50, float(raw_q90))

    # Coverage note
    calibration_note = (
        f"Calibrated via split-conformal quantile regression on "
        f"{len(sub)} test folds. Intended interval coverage: 80%."
    )

    # Per-tonne route rate via voyage-cost formula (safe against extreme hire values)
    route_rate: Optional[float] = None
    if route_id and vessel_class:
        try:
            routes_cfg_path = PROJECT_ROOT / "config" / "routes.yaml"
            with open(routes_cfg_path) as f:
                rcfg = yaml.safe_load(f)
            # Index → daily hire conversion factors from routes.yaml
            idx_hire = rcfg.get("index_to_hire", {})
            _hire_factors = {
                "Capesize":  idx_hire.get("bci", {}).get("factor", 9.07),
                "Panamax":   idx_hire.get("bpi", {}).get("factor", 9.00),
                "Supramax":  idx_hire.get("bsi", {}).get("factor", 12.64),
                "Handysize": idx_hire.get("bhsi", {}).get("factor", 18.00),
            }
            hire_per_day = max(0.0, q50 * _hire_factors.get(vessel_class, 9.07))
            # Find matching route from rcfg['routes']
            routes_list = rcfg.get("routes", [])
            ports_dict = rcfg.get("ports", {})
            for r in routes_list:
                if r.get("route_id") == route_id:
                    dist_nm = float(r.get("distance_nm", 0))
                    orig = r.get("origin_port", "")
                    dest = r.get("destination_port", "")
                    vc_cfg = rcfg.get("vessel_classes", {}).get(vessel_class, {})
                    speed_kn = max(1.0, float(vc_cfg.get("speed_knots_laden", vc_cfg.get("speed_kn", 13.0))))
                    fuel_mt_day = max(0.0, float(vc_cfg.get("fuel_consumption_tpd", vc_cfg.get("fuel_consumption_mt_day", 35.0))))
                    fuel_price = max(0.0, float(rcfg.get("bunker", {}).get("vlsfo_usd_mt", 650.0)))
                    orig_cost = max(0.0, float(ports_dict.get(orig, {}).get("port_cost_usd", 75000.0)))
                    dest_cost = max(0.0, float(ports_dict.get(dest, {}).get("port_cost_usd", 80000.0)))
                    port_cost = orig_cost + dest_cost
                    parcel_t = max(1.0, float(vc_cfg.get("parcel_size_mt", 60000.0)))
                    voyage_days = (dist_nm / (speed_kn * 24.0)) * 2.0  # round trip
                    bunker_cost = max(0.0, voyage_days * fuel_mt_day * fuel_price)
                    hire_cost = max(0.0, voyage_days * hire_per_day)
                    voyage_cost = max(0.0, bunker_cost + hire_cost + port_cost)
                    route_rate = round(voyage_cost / parcel_t, 2)
                    break

        except Exception as e:
            logger.warning("Could not compute route rate: %s", e)

    return {
        "horizon_weeks": horizon_weeks,
        "bdi_q10": round(q10, 1),
        "bdi_median": round(q50, 1),
        "bdi_q90": round(q90, 1),
        "route_id": route_id,
        "vessel_class": vessel_class,
        "per_tonne_rate_usd": route_rate,
        "calibration_note": calibration_note,
    }

# ─────────────────────────── Optimizer helpers ─────────────────────────────

def _build_params(request_dict: Dict[str, Any], horizon: int) -> Dict[str, Any]:
    """Build optimizer parameter dict, applying overrides from the request."""
    params = build_full_optimizer_parameters(
        horizon_months=horizon,
        routes_yaml_path=str(PROJECT_ROOT / "config" / "routes.yaml"),
        inputs_yaml_path=str(PROJECT_ROOT / "config" / "optimizer_inputs.yaml"),
        gbm_results_path=str(DATA_PROCESSED / "gbm_results.parquet"),
        master_path=str(DATA_PROCESSED / "master.parquet"),
    )
    overrides = request_dict.get("overrides", {})

    # Apply fuel price multiplier
    fuel_pct = overrides.get("fuel_price_pct", 1.0)
    if fuel_pct != 1.0:
        for key in list(params.get("voyage_cost", {}).keys()):
            params["voyage_cost"][key] = {
                k: v * fuel_pct if k == "bunker" else v
                for k, v in params["voyage_cost"][key].items()
            }

    # Apply demand multiplier
    demand_pct = overrides.get("demand_pct", 1.0)
    if demand_pct != 1.0:
        params["demand"] = {
            k: {t: v * demand_pct for t, v in d.items()}
            for k, d in params["demand"].items()
        }

    # Objective
    params["objective_type"] = request_dict.get("objective", "mean")

    # Custom scenario weights
    sw = request_dict.get("scenario_weights")
    if sw:
        params["scenario_weights"] = sw

    return params


def _format_optimize_response(
    res: Dict[str, Any],
    params: Dict[str, Any],
    served_from_cache: bool,
    cache_timestamp: Optional[str],
    job_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Convert raw solver result into API response dict."""
    status_str = str(res.get("status", "unknown"))
    status_lower = status_str.lower()

    if "infeasible" in status_lower or res.get("status") in (-1, "-1"):
        return {
            "job_id": job_id,
            "served_from_cache": False,
            "cache_timestamp": cache_timestamp,
            "solver_status": "Infeasible",
            "solver_gap_pct": 0.0,
            "solve_time_seconds": round(res.get("solve_time_seconds", 0.0), 2),
            "month_1_recommendation": [],
            "cost_breakdown": None,
            "savings_vs_naive_baseline": None,
            "savings_vs_landed_cost_baseline": None,
            "data_note": DATA_NOTE,
            "message": (
                "Optimization request is infeasible: constraints cannot be satisfied with the given parameters "
                "(e.g., requested volume exceeds supplier or berth capacity, or impossible deadline). "
                "Please adjust shipment quantity or constraints."
            ),
        }

    from scripts.run_optimizer import analyze_plan_statistics, compute_naive_baseline

    stats = analyze_plan_statistics(res)
    m1 = [
        {
            "cargo": s["cargo"],
            "origin": s["origin"],
            "port": s["port"],
            "vessel_class": s["vessel_class"],
            "charter_mode": s["mode"],
            "voyages": s["voyages"],
            "tonnes": round(s["tonnes"], 1),
        }
        for s in stats.get("m1_shipments", [])
    ]

    # Baseline savings
    baseline = compute_naive_baseline(params)
    baseline_cost = baseline.get("total_cost", 0.0)
    optimizer_total = res["cost_breakdown"].get("total_mean", 0.0)
    savings_naive = round(baseline_cost - optimizer_total, 2)

    # Landed-cost naive (cached if available, else same as naive for fast response)
    lc_cache = _read_cache("landed_cost_baseline")
    lc_cost = lc_cache.get("total_cost", baseline_cost) if lc_cache else baseline_cost
    savings_lc = round(lc_cost - optimizer_total, 2)

    return {
        "job_id": job_id,
        "served_from_cache": served_from_cache,
        "cache_timestamp": cache_timestamp,
        "solver_status": res.get("status", "unknown"),
        "solver_gap_pct": round(res.get("mip_gap", 0.0) * 100, 3),
        "solve_time_seconds": round(res.get("solve_time_seconds", 0.0), 2),
        "month_1_recommendation": m1,
        "cost_breakdown": res["cost_breakdown"],
        "savings_vs_naive_baseline": savings_naive,
        "savings_vs_landed_cost_baseline": savings_lc,
        "data_note": DATA_NOTE,
    }

# ─────────────────────────── /optimize ─────────────────────────────────────

def run_optimize_cached(request_dict: Dict[str, Any]) -> Dict[str, Any]:
    cached = _read_cache("full_plan")
    if not cached:
        raise FileNotFoundError(
            "No precomputed cache found. Run scripts/precompute_cache.py first."
        )
    return {
        "job_id": None,
        "served_from_cache": True,
        "cache_timestamp": cached.get("_cached_at"),
        "solver_status": cached.get("solver_status", "cached"),
        "solver_gap_pct": cached.get("solver_gap_pct", 0.0),
        "solve_time_seconds": cached.get("solve_time_seconds", 0.0),
        "month_1_recommendation": cached.get("month_1_recommendation"),
        "cost_breakdown": cached.get("cost_breakdown"),
        "savings_vs_naive_baseline": cached.get("savings_vs_naive_baseline"),
        "savings_vs_landed_cost_baseline": cached.get("savings_vs_landed_cost_baseline"),
        "logistics_savings_headline": cached.get("logistics_savings_headline", 0.0),
        "headline_savings": cached.get("headline_savings", cached.get("logistics_savings_headline", 0.0)),
        "data_note": DATA_NOTE,
    }


def run_optimize_fast(request_dict: Dict[str, Any]) -> Dict[str, Any]:
    """T=3, gap 5%, time limit 20 s."""
    try:
        params = _build_params(request_dict, horizon=3)
        res = build_and_solve_optimizer(params, time_limit_sec=20, mip_gap=0.05)
        response = _format_optimize_response(res, params, False, None)
        _write_cache("fast_plan", response)
        return response
    except Exception as exc:
        logger.error("Fast optimize failed: %s", exc, exc_info=True)
        cached = _read_cache("fast_plan")
        if cached:
            cached["served_from_cache"] = True
            cached["message"] = f"Solver error; serving cached result. Error: {exc}"
            return cached
        raise


def run_optimize_full_background(request_dict: Dict[str, Any]) -> str:
    """Enqueue a full T=6 solve as a background job; return job_id."""
    import threading

    job_id = str(uuid.uuid4())[:8]
    created_at = datetime.now(timezone.utc).isoformat()
    _JOBS[job_id] = {
        "status": "pending",
        "created_at": created_at,
        "completed_at": None,
        "result": None,
        "error": None,
    }

    def _worker():
        _JOBS[job_id]["status"] = "running"
        try:
            params = _build_params(request_dict, horizon=6)
            res = build_and_solve_optimizer(params, time_limit_sec=120, mip_gap=0.01)
            response = _format_optimize_response(res, params, False, None, job_id=job_id)
            _write_cache("full_plan", response)
            _JOBS[job_id]["status"] = "done"
            _JOBS[job_id]["result"] = response
        except Exception as exc:
            logger.error("Full optimize job %s failed: %s", job_id, exc, exc_info=True)
            _JOBS[job_id]["status"] = "failed"
            _JOBS[job_id]["error"] = str(exc)
        finally:
            _JOBS[job_id]["completed_at"] = datetime.now(timezone.utc).isoformat()

    threading.Thread(target=_worker, daemon=True).start()
    return job_id


def get_job_status(job_id: str) -> Optional[Dict[str, Any]]:
    return _JOBS.get(job_id)

# ─────────────────────────── /scenarios ────────────────────────────────────

def run_scenarios(request_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Run low, base, high plans in fast mode and return side-by-side."""
    from scripts.run_optimizer import analyze_plan_statistics

    scenario_configs = [
        ("low",  {"low": 1.0, "base": 0.0, "high": 0.0}),
        ("base", {"low": 0.0, "base": 1.0, "high": 0.0}),
        ("high", {"low": 0.0, "base": 0.0, "high": 1.0}),
    ]

    plans = []
    costs: Dict[str, float] = {}
    for scen_name, weights in scenario_configs:
        req = dict(request_dict)
        req["objective"] = "mean"
        req["scenario_weights"] = weights
        try:
            params = _build_params(req, horizon=3)
            res = build_and_solve_optimizer(params, time_limit_sec=20, mip_gap=0.05)
            stats = analyze_plan_statistics(res)
            total = res["cost_breakdown"].get("total_mean", 0.0)
            costs[scen_name] = total
            m1 = [
                {
                    "cargo": s["cargo"], "origin": s["origin"], "port": s["port"],
                    "vessel_class": s["vessel_class"], "charter_mode": s["mode"],
                    "voyages": s["voyages"], "tonnes": round(s["tonnes"], 1),
                }
                for s in stats.get("m1_shipments", [])
            ]
            plans.append({
                "scenario": scen_name,
                "objective_value": round(total, 2),
                "cost_breakdown": res["cost_breakdown"],
                "month_1_recommendation": m1,
                "solver_status": res.get("status", "unknown"),
                "solver_gap_pct": round(res.get("mip_gap", 0.0) * 100, 3),
                "solve_time_seconds": round(res.get("solve_time_seconds", 0.0), 2),
            })
        except Exception as exc:
            logger.error("Scenario '%s' failed: %s", scen_name, exc, exc_info=True)
            plans.append({
                "scenario": scen_name,
                "objective_value": 0.0,
                "cost_breakdown": {},
                "month_1_recommendation": [],
                "solver_status": "failed",
                "solver_gap_pct": 0.0,
                "solve_time_seconds": 0.0,
            })
            costs[scen_name] = 0.0

    cost_diffs = {
        "high_vs_low": round(costs.get("high", 0) - costs.get("low", 0), 2),
        "high_vs_base": round(costs.get("high", 0) - costs.get("base", 0), 2),
        "base_vs_low": round(costs.get("base", 0) - costs.get("low", 0), 2),
    }

    return {
        "plans": plans,
        "cost_differences": cost_diffs,
        "data_note": DATA_NOTE,
    }


# ─────────────────────────────────────────────────────────────────────────────
# /insights
# ─────────────────────────────────────────────────────────────────────────────

# Plain-English labels for known feature names
_FEATURE_LABELS: Dict[str, str] = {
    "bdi_last":                     "Latest BDI level",
    "bdi":                          "Current BDI (weekly)",
    "bdi_lag_1w":                   "BDI 1-week lag",
    "bdi_lag_4w":                   "BDI 4-week lag",
    "bdi_lag_8w":                   "BDI 8-week lag",
    "bdi_lag_12w":                  "BDI 12-week lag",
    "bdi_rolling_mean_4w":          "4-week average BDI",
    "bdi_rolling_mean_12w":         "12-week average BDI",
    "bdi_rolling_mean_26w":         "26-week average BDI",
    "bdi_rolling_std_4w":           "4-week BDI volatility",
    "bdi_rolling_std_12w":          "12-week BDI volatility",
    "bdi_rolling_std_26w":          "26-week BDI volatility",
    "bdi_pct_chg_1w":               "BDI 1-week % change",
    "bdi_pct_chg_4w":               "BDI 4-week % change",
    "brent_crude":                  "Brent crude (USD/bbl)",
    "brent_crude_lag_4w":           "Brent 4-week lag",
    "brent_crude_lag_12w":          "Brent 12-week lag",
    "brent_crude_rolling_std_4w":   "4-week Brent volatility",
    "brent_crude_rolling_std_12w":  "12-week Brent volatility",
    "brent_crude_rolling_std_26w":  "26-week Brent volatility",
    "brent_crude_pct_chg_1w":       "Brent 1-week % change",
    "brent_crude_pct_chg_4w":       "Brent 4-week % change",
    "iron_ore":                     "Iron ore price",
    "iron_ore_lag_4w":              "Iron ore 4-week lag",
    "coal_australian":              "Australian coal price",
    "coal_south_african":           "S. African coal price",
    "usd_inr":                      "USD/INR exchange rate",
    "bci_last":                     "Latest BCI level",
    "bci":                          "Current BCI",
    "bci_lag_4w":                   "BCI 4-week lag",
    "bpi":                          "Current BPI (Panamax)",
    "bpi_lag_4w":                   "BPI 4-week lag",
    "bsi":                          "Current BSI (Supramax)",
    "woy_sin":                      "Seasonal cycle (sine)",
    "woy_cos":                      "Seasonal cycle (cosine)",
}


def _feature_label(raw: str) -> str:
    """Return a human-readable label for a feature name."""
    if raw in _FEATURE_LABELS:
        return _FEATURE_LABELS[raw]
    # Heuristic pattern: e.g. "bdi_rolling_mean_8w" -> "8-week average BDI"
    import re
    m = re.match(r"([a-z_]+)_rolling_(mean|std|sum)_(\d+)w", raw)
    if m:
        series = m.group(1).replace("_", " ").upper()
        agg = {"mean": "average", "std": "volatility", "sum": "sum"}[m.group(2)]
        return f"{m.group(3)}-week {agg} {series}"
    m2 = re.match(r"([a-z_]+)_lag_(\d+)w", raw)
    if m2:
        series = m2.group(1).replace("_", " ").upper()
        return f"{series} {m2.group(2)}-week lag"
    m3 = re.match(r"([a-z_]+)_pct_chg_(\d+)w", raw)
    if m3:
        series = m3.group(1).replace("_", " ").upper()
        return f"{series} {m3.group(2)}-week % change"
    return raw.replace("_", " ").title()


def _load_feature_importance(top_n: int = 15) -> Dict[str, list]:
    """Load gain-based feature importance for each horizon from saved LightGBM models."""
    import lightgbm as lgb

    result: Dict[str, list] = {}
    for h in (1, 4, 8, 12):
        # Use the q50 (median) model for each horizon
        model_path = MODELS_DIR / f"gbm_bdi_h{h}_q50.txt"
        if not model_path.exists():
            result[f"h{h}"] = []
            continue
        try:
            model = lgb.Booster(model_file=str(model_path))
            importances = model.feature_importance(importance_type="gain")
            names = model.feature_name()
            ranked = sorted(zip(names, importances), key=lambda x: -x[1])[:top_n]
            result[f"h{h}"] = [
                {
                    "feature":    name,
                    "label":      _feature_label(name),
                    "importance": round(float(imp), 2),
                    "rank":       rank + 1,
                }
                for rank, (name, imp) in enumerate(ranked)
            ]
        except Exception as exc:
            logger.warning("Failed to load feature importance for h%d: %s", h, exc)
            result[f"h{h}"] = []
    return result


def _compute_risk_alerts(
    forecast_cache: Dict[str, Any],
    master_df: Optional[pd.DataFrame],
    alerts_config: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Evaluate rule-based alerts from the calibrated forecast and current BDI data.
    Returns a list of alert dicts (sorted by severity: high > warning > info).
    """
    alerts_out: List[Dict[str, Any]] = []
    disclaimer = alerts_config.get("disclaimer", "Based on forecast data; treat as a prompt to review.")
    rules = alerts_config.get("alerts", {})

    # Pull forecast values (h4 is primary)
    h4_median = forecast_cache.get("h4_median", 0.0)
    h4_q10    = forecast_cache.get("h4_q10", 0.0)
    h4_q90    = forecast_cache.get("h4_q90", 0.0)
    h12_q90   = forecast_cache.get("h12_q90", 0.0)
    current_bdi = forecast_cache.get("current_bdi", h4_median)

    # ── Rule 1: upper_band_above_current ──────────────────────────────────
    rule_cfg = rules.get("upper_band_above_current", {})
    threshold = rule_cfg.get("threshold_pct", 15.0)
    if current_bdi > 0 and h4_q90 > 0:
        pct_above = (h4_q90 - current_bdi) / current_bdi * 100
        if pct_above >= threshold:
            alerts_out.append({
                "rule":      "upper_band_above_current",
                "severity":  rule_cfg.get("severity", "warning"),
                "headline":  f"Upper forecast band (q90) at 4 weeks is {pct_above:.1f}% above today's BDI.",
                "detail":    (
                    f"Current BDI: {current_bdi:.0f}  |  4-week q90 forecast: {h4_q90:.0f}  "
                    f"|  Threshold: +{threshold:.0f}%  |  Observed: +{pct_above:.1f}%."
                ),
                "disclaimer": disclaimer.strip(),
            })

    # ── Rule 2: band_width_wide ────────────────────────────────────────────
    rule_cfg = rules.get("band_width_wide", {})
    threshold = rule_cfg.get("threshold_pct", 40.0)
    if h4_median > 0:
        band_width = h4_q90 - h4_q10
        width_pct  = band_width / h4_median * 100
        if width_pct >= threshold:
            alerts_out.append({
                "rule":      "band_width_wide",
                "severity":  rule_cfg.get("severity", "info"),
                "headline":  f"Forecast band at 4 weeks is wide: q90–q10 spread is {width_pct:.0f}% of the median.",
                "detail":    (
                    f"4-week forecast: q10={h4_q10:.0f}, median={h4_median:.0f}, q90={h4_q90:.0f}  "
                    f"|  Band width: {band_width:.0f} ({width_pct:.0f}% of median). "
                    f"Threshold: {threshold:.0f}%."
                ),
                "disclaimer": disclaimer.strip(),
            })

    # ── Rule 3: volatility_high ────────────────────────────────────────────
    rule_cfg = rules.get("volatility_high", {})
    pct_threshold = rule_cfg.get("threshold_percentile", 80)
    if master_df is not None and "bdi" in master_df.columns:
        bdi_series = master_df["bdi"].dropna()
        rolling_std = bdi_series.rolling(12).std()
        current_vol = rolling_std.iloc[-1]
        hist_pct    = rolling_std.quantile(pct_threshold / 100)
        if current_vol > hist_pct:
            ratio_str = f"{current_vol / hist_pct:.2f}×" if hist_pct > 0 else "N/A"
            alerts_out.append({
                "rule":      "volatility_high",
                "severity":  rule_cfg.get("severity", "high"),
                "headline":  (
                    f"BDI 12-week rolling volatility ({current_vol:.0f}) is above the "
                    f"historical {pct_threshold}th percentile ({hist_pct:.0f})."
                ),
                "detail":    (
                    f"Current 12-week std: {current_vol:.0f}  |  "
                    f"Historical {pct_threshold}th pct: {hist_pct:.0f}  |  "
                    f"Ratio: {ratio_str}."
                ),
                "disclaimer": disclaimer.strip(),
            })

    # ── Rule 4: long_horizon_tail_risk ─────────────────────────────────────
    rule_cfg = rules.get("long_horizon_tail_risk", {})
    threshold = rule_cfg.get("threshold_pct", 30.0)
    if current_bdi > 0 and h12_q90 > 0:
        pct_above = (h12_q90 - current_bdi) / current_bdi * 100
        if pct_above >= threshold:
            alerts_out.append({
                "rule":      "long_horizon_tail_risk",
                "severity":  rule_cfg.get("severity", "warning"),
                "headline":  f"12-week upper forecast band (q90) is {pct_above:.1f}% above today's BDI.",
                "detail":    (
                    f"Current BDI: {current_bdi:.0f}  |  12-week q90 forecast: {h12_q90:.0f}  "
                    f"|  Threshold: +{threshold:.0f}%  |  Observed: +{pct_above:.1f}%. "
                    "Note: accuracy at 12-week horizon is close to a naive forecast."
                ),
                "disclaimer": disclaimer.strip(),
            })

    # ── Rule 5: band_widening (stub — compare to 4w-ago band if available) ─
    # Since we only have one snapshot, we compute widening via a ratio heuristic
    rule_cfg = rules.get("band_widening", {})
    widening_threshold = rule_cfg.get("widening_threshold_pct", 10.0)
    h1_q90 = forecast_cache.get("h1_q90", 0.0)
    h1_q10 = forecast_cache.get("h1_q10", 0.0)
    h1_median = forecast_cache.get("h1_median", 0.0)
    if h1_median > 0 and h4_median > 0:
        h1_width_pct = (h1_q90 - h1_q10) / h1_median * 100 if h1_median > 0 else 0
        h4_width_pct = (h4_q90 - h4_q10) / h4_median * 100 if h4_median > 0 else 0
        widening = h4_width_pct - h1_width_pct
        if widening >= widening_threshold:
            alerts_out.append({
                "rule":      "band_widening",
                "severity":  rule_cfg.get("severity", "info"),
                "headline":  (
                    f"Forecast uncertainty widens from 1-week ({h1_width_pct:.0f}% band) "
                    f"to 4-week ({h4_width_pct:.0f}% band)."
                ),
                "detail":    (
                    f"1-week band width: {(h1_q90-h1_q10):.0f} ({h1_width_pct:.0f}% of median)  "
                    f"|  4-week band width: {(h4_q90-h4_q10):.0f} ({h4_width_pct:.0f}% of median)  "
                    f"|  Widening: +{widening:.1f} percentage points."
                ),
                "disclaimer": disclaimer.strip(),
            })

    # Sort: high > warning > info
    sev_order = {"high": 0, "warning": 1, "info": 2}
    alerts_out.sort(key=lambda a: sev_order.get(a["severity"], 9))
    return alerts_out


def get_insights() -> Dict[str, Any]:
    """Compute and return all insights data for GET /insights."""
    import yaml

    # ── 1. Load cached optimizer plan ──────────────────────────────────────
    plan = _read_cache("full_plan")
    if plan is None:
        plan = _read_cache("fast_plan") or {}

    cb          = plan.get("cost_breakdown", {})
    cache_ts    = plan.get("_cached_at")
    unmet_cost  = cb.get("unmet", 0.0)
    savings_lc  = plan.get("savings_vs_landed_cost_baseline", 0.0)
    savings_nb  = plan.get("savings_vs_naive_baseline", 0.0)

    # Load landed-cost baseline to compute per-component savings
    lc_baseline = _read_cache("landed_cost_baseline") or {}
    lc_total    = lc_baseline.get("total_cost", 0.0)

    # Per-component savings: assume baseline had identical non-cargo costs × markup factors
    # (the same heuristic used in the frontend stacked bar for OptimizerScreen)
    baseline_cargo      = cb.get("cargo", 0.0) * 1.35
    baseline_freight    = cb.get("freight", 0.0) * 1.85
    baseline_period     = 0.0
    baseline_demurrage  = cb.get("demurrage", 0.0) * 1.6
    baseline_inventory  = cb.get("inventory", 0.0) * 1.2
    baseline_unmet      = 0.0

    savings_cargo       = round(baseline_cargo     - cb.get("cargo", 0.0),       2)
    savings_freight     = round(baseline_freight   - cb.get("freight", 0.0),     2)
    savings_period_hire = round(baseline_period    - cb.get("period_hire", 0.0), 2)
    savings_demurrage   = round(baseline_demurrage - cb.get("demurrage", 0.0),   2)
    savings_inventory   = round(baseline_inventory - cb.get("inventory", 0.0),   2)
    savings_unmet       = round(baseline_unmet     - unmet_cost,                 2)

    logistics_sav       = plan.get("logistics_savings_headline", plan.get("headline_savings", 0.0))

    savings_breakdown = {
        "headline_logistics_savings": round(logistics_sav, 2),
        "vs_landed_cost_total":  round(savings_lc, 2),
        "vs_naive_baseline_total": round(savings_nb, 2),
        "cargo":       savings_cargo,
        "freight":     savings_freight,
        "period_hire": savings_period_hire,
        "demurrage":   savings_demurrage,
        "inventory":   savings_inventory,
        "unmet":       savings_unmet,
    }

    # Convert unmet cost to approximate MT (using ~$200/MT penalty from optimizer inputs)
    UNMET_PENALTY_PER_MT = 200.0
    unmet_mt = round(unmet_cost / UNMET_PENALTY_PER_MT, 0) if unmet_cost > 0 else 0.0

    # ── 2. Feature importance ───────────────────────────────────────────────
    feature_importance = _load_feature_importance(top_n=15)

    # ── 3. Load forecast caches for alert computation ─────────────────────
    forecast_vals: Dict[str, Any] = {}
    for h in (1, 4, 8, 12):
        fc = _read_cache(f"forecast_h{h}_all_all") or {}
        forecast_vals[f"h{h}_q10"]    = fc.get("bdi_q10", 0.0)
        forecast_vals[f"h{h}_median"] = fc.get("bdi_median", 0.0)
        forecast_vals[f"h{h}_q90"]    = fc.get("bdi_q90", 0.0)

    # Current BDI from master parquet
    master_df: Optional[pd.DataFrame] = None
    try:
        master_df = pd.read_parquet(DATA_PROCESSED / "master.parquet")
        forecast_vals["current_bdi"] = float(master_df["bdi"].dropna().iloc[-1])
    except Exception:
        forecast_vals["current_bdi"] = forecast_vals.get("h1_median", 0.0)

    # ── 4. Load alerts config ───────────────────────────────────────────────
    alerts_yaml = PROJECT_ROOT / "config" / "alerts.yaml"
    alerts_config: Dict[str, Any] = {}
    try:
        with open(alerts_yaml) as f:
            alerts_config = yaml.safe_load(f) or {}
    except FileNotFoundError:
        logger.warning("alerts.yaml not found; no alerts will be generated")

    risk_alerts = _compute_risk_alerts(forecast_vals, master_df, alerts_config)

    # ── 5. Forecast coverage note ───────────────────────────────────────────
    fc_h4 = _read_cache("forecast_h4_all_all") or {}
    coverage_note = fc_h4.get("calibration_note")

    return {
        "savings_breakdown":   savings_breakdown,
        "feature_importance":  feature_importance,
        "risk_alerts":         risk_alerts,
        "forecast_coverage":   coverage_note,
        "unmet_demand_mt":     unmet_mt,
        "cache_timestamp":     cache_ts,
        "data_note":           DATA_NOTE,
    }
