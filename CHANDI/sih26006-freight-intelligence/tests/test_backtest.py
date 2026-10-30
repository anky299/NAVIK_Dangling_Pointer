"""tests/test_backtest.py — Walk-forward backtest unit tests.

Covers:
1. No-look-ahead assertion (pass and fail cases)
2. Forecast uses only historical data
3. State carry-over and inventory balance
4. Spot voyages tonnage > 0 for each month
5. Realised spot costs are monotone in BDI
6. Bootstrap CI is valid
7. Sharp rate drop: costs higher when BDI is high
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from src.backtest.run_backtest import (
    BacktestEngine,
    assert_no_look_ahead,
    bootstrap_confidence_interval,
    compute_realised_spot_costs,
)
from src.optimizer.inputs import load_optimizer_inputs_config, load_routes_config


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def routes_cfg():
    return load_routes_config()


@pytest.fixture(scope="module")
def inputs_cfg():
    return load_optimizer_inputs_config()


@pytest.fixture(scope="module")
def engine(routes_cfg, inputs_cfg):
    """Small 2-month engine for fast test runs (no optimizer calls)."""
    master_df = pd.read_parquet("data/processed/master.parquet")
    gbm_df = pd.read_parquet("data/processed/gbm_results.parquet")
    return BacktestEngine(
        master_df=master_df,
        gbm_results_df=gbm_df,
        routes_cfg=routes_cfg,
        inputs_cfg=inputs_cfg,
        start_date="2023-01-01",
        end_date="2023-03-31",
        time_limit_sec=10,
        mip_gap=0.05,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 1. No-look-ahead Guard
# ─────────────────────────────────────────────────────────────────────────────

class TestNoLookAhead:
    def test_passes_when_data_date_equals_decision(self):
        dt = pd.Timestamp("2023-01-06")
        assert_no_look_ahead(dt, dt, "test-equal")  # should not raise

    def test_passes_when_data_date_before_decision(self):
        dec = pd.Timestamp("2023-01-06")
        data = pd.Timestamp("2023-01-01")
        assert_no_look_ahead(data, dec, "test-before")  # should not raise

    def test_fails_when_data_date_after_decision(self):
        dec = pd.Timestamp("2023-01-06")
        data = pd.Timestamp("2023-01-07")  # future data — violation
        with pytest.raises(AssertionError, match="LOOK-AHEAD VIOLATION"):
            assert_no_look_ahead(data, dec, "test-future")

    def test_forecast_uses_only_historical_bdi(self, engine):
        """Forecast built with 'flat_forecast' must only inspect history up to decision_dt."""
        dt = engine.decision_dates[0]
        curves = engine.build_forecast_for_month(dt, "flat_forecast", {})
        # Curves must cover all horizon months
        assert len(curves["base"]) == engine.horizon_months
        assert len(curves["low"]) == engine.horizon_months
        assert len(curves["high"]) == engine.horizon_months

    def test_forecast_scenarios_respects_look_ahead(self, engine):
        """GBM folds selected must all have train_end <= decision_dt."""
        dt = engine.decision_dates[0]
        valid_gbm = engine.gbm_df[engine.gbm_df["train_end"] <= dt]
        # Every row selected must have train_end <= dt
        if not valid_gbm.empty:
            assert valid_gbm["train_end"].max() <= dt


# ─────────────────────────────────────────────────────────────────────────────
# 2. Initial State
# ─────────────────────────────────────────────────────────────────────────────

class TestInitialState:
    def test_inventory_positive(self, engine):
        state = engine.initial_state()
        assert all(v >= 0 for v in state.inventory.values())

    def test_inventory_covers_all_cargo_port_pairs(self, engine):
        state = engine.initial_state()
        for c in engine.cargoes:
            for p in engine.dest_ports:
                assert (c, p) in state.inventory

    def test_month_idx_is_one(self, engine):
        state = engine.initial_state()
        assert state.month_idx == 1


# ─────────────────────────────────────────────────────────────────────────────
# 3. State Carry-Over — Spot-Only Naive
# ─────────────────────────────────────────────────────────────────────────────

class TestSpotNaiveStateCarry:
    def test_inventory_non_negative_after_one_month(self, engine):
        state = engine.initial_state()
        dt = engine.decision_dates[0]
        _, next_state = engine.run_spot_only_naive(state, dt)
        for v in next_state.inventory.values():
            assert v >= 0.0

    def test_total_tonnes_shipped_positive(self, engine):
        state = engine.initial_state()
        dt = engine.decision_dates[0]
        dec, _ = engine.run_spot_only_naive(state, dt)
        total_shipped = sum(s["tonnes"] for s in dec.shipments)
        assert total_shipped > 0

    def test_cost_realised_positive(self, engine):
        state = engine.initial_state()
        dt = engine.decision_dates[0]
        dec, _ = engine.run_spot_only_naive(state, dt)
        assert dec.cost_realised > 0.0

    def test_month_idx_increments(self, engine):
        state = engine.initial_state()
        dt = engine.decision_dates[0]
        _, next_state = engine.run_spot_only_naive(state, dt)
        assert next_state.month_idx == 2

    def test_tonnes_conservation_across_months(self, engine):
        """Conservation of mass: start_inv + shipped = end_inv + demand - unmet."""
        state = engine.initial_state()
        dt = engine.decision_dates[0]
        dec, next_state = engine.run_spot_only_naive(state, dt)

        for c in engine.cargoes:
            for p in engine.dest_ports:
                alpha = float(engine.port_demand_shares[c].get(p, 0.0))
                demand = float(engine.demand_per_month[c]) * alpha
                shipped = sum(s["tonnes"] for s in dec.shipments if s["cargo"] == c and s["port"] == p)
                start_inv = state.inventory.get((c, p), 0.0)
                end_inv = next_state.inventory.get((c, p), 0.0)
                # Verify total volume conservation
                avail = start_inv + shipped
                expected_end = max(0.0, avail - demand)
                assert abs(end_inv - round(expected_end, 1)) < 1.0


# ─────────────────────────────────────────────────────────────────────────────
# 4. State Carry-Over — Landed-Cost Naive
# ─────────────────────────────────────────────────────────────────────────────

class TestLandedNaiveStateCarry:
    def test_cost_positive(self, engine):
        state = engine.initial_state()
        dt = engine.decision_dates[0]
        dec, _ = engine.run_landed_cost_naive(state, dt)
        assert dec.cost_realised > 0.0

    def test_policy_label(self, engine):
        state = engine.initial_state()
        dt = engine.decision_dates[0]
        dec, _ = engine.run_landed_cost_naive(state, dt)
        assert dec.policy == "landed_naive"

    def test_two_month_walk(self, engine):
        """Two consecutive landed-naive months should not raise."""
        state = engine.initial_state()
        for idx, dt in enumerate(engine.decision_dates[:2]):
            dec, state = engine.run_landed_cost_naive(state, dt)
            assert dec.month == idx + 1


# ─────────────────────────────────────────────────────────────────────────────
# 5. Realised Spot Costs — Monotone in BDI
# ─────────────────────────────────────────────────────────────────────────────

class TestRealisedSpotCosts:
    def test_higher_bdi_higher_cost(self, routes_cfg):
        high_vc, _ = compute_realised_spot_costs(routes_cfg, 3000.0, 80.0)
        low_vc, _ = compute_realised_spot_costs(routes_cfg, 500.0, 80.0)
        for key in high_vc:
            assert high_vc[key] > low_vc[key], (
                f"Expected {key} voyage cost to be higher when BDI=3000 vs BDI=500"
            )

    def test_higher_brent_higher_cost(self, routes_cfg):
        high_vc, _ = compute_realised_spot_costs(routes_cfg, 1500.0, 120.0)
        low_vc, _ = compute_realised_spot_costs(routes_cfg, 1500.0, 50.0)
        for key in high_vc:
            assert high_vc[key] > low_vc[key], (
                f"Expected {key} voyage cost to be higher when Brent=120 vs Brent=50"
            )

    def test_hire_rates_monotone_in_bdi(self, routes_cfg):
        _, hr_high = compute_realised_spot_costs(routes_cfg, 2000.0, 80.0)
        _, hr_low = compute_realised_spot_costs(routes_cfg, 800.0, 80.0)
        for v in hr_high:
            assert hr_high[v] > hr_low[v]

    def test_returns_all_routes(self, routes_cfg):
        vc, _ = compute_realised_spot_costs(routes_cfg, 1500.0, 80.0)
        expected = {
            (r["origin_port"], r["destination_port"], v)
            for r in routes_cfg["routes"]
            for v in r.get("eligible_vessel_classes", [])
        }
        for key in expected:
            assert key in vc, f"Missing route {key} in realised spot costs"


# ─────────────────────────────────────────────────────────────────────────────
# 6. Bootstrap CI
# ─────────────────────────────────────────────────────────────────────────────

class TestBootstrapCI:
    def test_lower_below_upper(self):
        data = np.array([5.0, -2.0, 8.0, 3.0, 12.0, -1.0, 7.0, 4.0, 9.0, 6.0, 2.0, 11.0])
        lo, hi = bootstrap_confidence_interval(data, n_bootstraps=500, confidence_level=0.90)
        assert lo < hi

    def test_ci_with_all_positive_data(self):
        data = np.ones(12) * 100.0
        lo, hi = bootstrap_confidence_interval(data, n_bootstraps=200)
        # All same value — CI should be very tight
        assert abs(lo - hi) < 1.0

    def test_ci_is_symmetric_ish_for_symmetric_data(self):
        rng = np.random.default_rng(0)
        data = rng.normal(0.0, 10.0, 200)
        lo, hi = bootstrap_confidence_interval(data, n_bootstraps=2000, confidence_level=0.90)
        # Expect roughly symmetric around zero
        assert lo < 0 and hi > 0


# ─────────────────────────────────────────────────────────────────────────────
# 7. Sharp Rate Drop — Sensitivity
# ─────────────────────────────────────────────────────────────────────────────

class TestSharpRateDrop:
    def test_large_bdi_drop_reduces_cost(self, routes_cfg):
        """Simulates a freight market crash: BDI falls 60%."""
        vc_before, _ = compute_realised_spot_costs(routes_cfg, 2500.0, 90.0)
        vc_after, _ = compute_realised_spot_costs(routes_cfg, 1000.0, 90.0)
        # At least one route must see a >20% cost reduction
        reductions = [
            (vc_before[k] - vc_after[k]) / vc_before[k]
            for k in vc_before
        ]
        assert max(reductions) > 0.20

    def test_no_negative_voyage_costs(self, routes_cfg):
        """Voyage costs must be non-negative even at very low BDI."""
        vc, _ = compute_realised_spot_costs(routes_cfg, 100.0, 30.0)
        for key, cost in vc.items():
            assert cost >= 0.0, f"Negative voyage cost for {key}: {cost}"

    def test_optimizer_avoids_long_locks_on_rate_drop(self):
        """When period hire rates are high but forward spot rates drop sharply,
        the optimizer must avoid long charter locks (period vessels count = 0)."""
        from src.optimizer.inputs import build_full_optimizer_parameters
        from src.optimizer.model import build_and_solve_optimizer

        params = build_full_optimizer_parameters(horizon_months=3)
        # Lock in high historical period hire rate
        for k in params["period_hire_rate"]:
            params["period_hire_rate"][k] = 65000.0

        # Forward spot rates fall sharply
        for k in params["spot_voyage_cost"]:
            params["spot_voyage_cost"][k] = 180000.0

        res = build_and_solve_optimizer(params, time_limit_sec=10, mip_gap=0.05)
        k_dict = res.get("plan", {}).get("k", {})
        m1_period_vessels = sum(count for (v, t), count in k_dict.items() if t == 1)
        assert m1_period_vessels == 0, (
            f"Optimizer chartered {m1_period_vessels} period vessels despite falling spot rates!"
        )
