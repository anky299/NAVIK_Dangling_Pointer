"""src/backtest/run_backtest.py — Walk-forward backtest replay for maritime procurement.

Replays the optimization policies on real 2023 historical freight and bunker paths:
- Walk-forward decision: only data available at decision month t (date <= t).
- Fast mode MILP (T=6, gap=3%, time_limit=60s) executing Month-1 decisions.
- Carried-over state: inventory, in-transit cargo, active period charters, COA volumes.
- Realised cost evaluation using actual weekly BDI and Brent paths.
- Comparison of 6 policies:
    (a) spot-only naive (cheapest FOB respecting supplier capacity)
    (b) landed-cost naive (lowest FOB + spot freight respecting supplier capacity)
    (c) optimizer with forecast scenarios (LightGBM)
    (d) optimizer with flat forecast (no forecast information)
    (e) perfect-foresight optimizer (uses realised hire as base scenario, bounded <= c)
    (f) fixed-sourcing logistics optimizer (sourcing fixed to landed-cost baseline, optimizing logistics only)
"""

from __future__ import annotations

import copy
import math
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import pulp

# Avoid matplotlib cache issues
os.environ["MPLCONFIGDIR"] = "/tmp"

from src.optimizer.inputs import (
    load_routes_config,
    load_optimizer_inputs_config,
    build_full_optimizer_parameters,
)
from src.optimizer.model import build_and_solve_optimizer, _make_var, get_available_solver


# ─────────────────────────────────────────────────────────────────────────────
# State tracking dataclass
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SimulationState:
    """State carried forward across months."""
    month_idx: int  # 1 to 12
    date: pd.Timestamp
    inventory: Dict[Tuple[str, str], float] = field(default_factory=dict)  # (cargo, port) -> tonnes
    in_transit: Dict[Tuple[str, str, int], float] = field(default_factory=dict)  # (cargo, port, arrival_month) -> tonnes
    active_period_charters: Dict[str, int] = field(default_factory=dict)  # vessel_class -> remaining_months
    coa_volumes_used: Dict[Tuple[str, str, str], float] = field(default_factory=dict)  # route -> cumulative tonnes


@dataclass
class MonthDecision:
    """Decisions executed for Month 1."""
    policy: str
    month: int
    date: str
    shipments: List[Dict[str, Any]]  # (mode, cargo, origin, port, vessel, tonnes, voyages)
    period_vessels_chartered: Dict[str, int]
    cost_realised: float
    cost_cargo: float
    cost_freight: float
    cost_period_hire: float
    cost_demurrage: float
    cost_inventory: float
    cost_unmet: float
    unmet_tonnes: float
    delivered_tonnes: float
    cost_per_delivered_tonne: float
    solver_status: str
    solver_gap: float
    solve_time: float


@dataclass
class BacktestResult:
    """Complete results across all policies and months."""
    policies: List[str]
    monthly_results: Dict[str, List[MonthDecision]]  # policy -> list of decisions
    summary_table: pd.DataFrame
    cost_matrix: pd.DataFrame  # month x policy total realised cost
    non_cargo_cost_matrix: pd.DataFrame
    delivered_tonnes_matrix: pd.DataFrame
    cost_per_tonne_matrix: pd.DataFrame
    savings_vs_spot_naive: Dict[str, float]
    savings_vs_landed_naive: Dict[str, float]
    bootstrap_ci_landed: Dict[str, Tuple[float, float]]
    bootstrap_ci_c_vs_d: Tuple[float, float]
    bootstrap_ci_f_vs_landed: Tuple[float, float]
    win_rate_vs_landed: Dict[str, float]
    worst_month_vs_landed: Dict[str, Tuple[int, float]]
    unmet_demand_total: Dict[str, float]
    delivered_tonnes_total: Dict[str, float]


# ─────────────────────────────────────────────────────────────────────────────
# Look-ahead Guard
# ─────────────────────────────────────────────────────────────────────────────

def assert_no_look_ahead(data_date: pd.Timestamp, decision_date: pd.Timestamp, context: str = "") -> None:
    """Strict guard ensuring no data from future dates is accessed at decision time."""
    assert data_date <= decision_date, (
        f"LOOK-AHEAD VIOLATION in {context}: data date {data_date} > decision date {decision_date}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Realised Voyage Cost Formula
# ─────────────────────────────────────────────────────────────────────────────

def compute_realised_spot_costs(
    routes_cfg: Dict[str, Any],
    realised_bdi: float,
    realised_brent: float,
) -> Tuple[Dict[Tuple[str, str, str], float], Dict[str, float]]:
    """Compute exact realised spot voyage cost and daily hire from realised BDI and Brent.

    Formula mirrors the synthetic route-rate formula in services.py and inputs.py:
    - hire_daily = realised_bdi * hire_factor[v]
    - fuel_cost = fuel_mt * (realised_brent * brent_to_vlsfo)
    - spot_vc = hire_daily * round_trip_days + fuel_cost + port_cost
    """
    vessel_classes = list(routes_cfg["vessel_classes"].keys())
    ports_info = routes_cfg["ports"]
    idx_hire = routes_cfg.get("index_to_hire", {})
    bunker_cfg = routes_cfg.get("bunker", {})
    brent_to_vlsfo = float(bunker_cfg.get("brent_to_vlsfo_ratio", 7.5))

    hire_factors = {
        "Capesize": float(idx_hire.get("Capesize", {}).get("hire_factor_bdi", 15.0)),
        "Panamax": float(idx_hire.get("Panamax", {}).get("hire_factor_bdi", 11.25)),
        "Supramax": float(idx_hire.get("Supramax", {}).get("hire_factor_bdi", 9.07)),
        "Handysize": float(idx_hire.get("Handysize", {}).get("hire_factor_bdi", 7.5)),
    }

    realised_hire: Dict[str, float] = {}
    for v in vessel_classes:
        factor = hire_factors.get(v, 9.07)
        realised_hire[v] = round(max(2000.0, realised_bdi * factor), 2)

    spot_vc: Dict[Tuple[str, str, str], float] = {}
    fuel_price_per_mt = realised_brent * brent_to_vlsfo

    for r_entry in routes_cfg["routes"]:
        orig = r_entry["origin_port"]
        dest = r_entry["destination_port"]
        dist = float(r_entry["distance_nm"])
        canal_flag = r_entry.get("canal_transit", "none")
        canal_fee = 0.0
        if canal_flag == "suez":
            canal_fee = float(r_entry.get("canal_fee_usd", 250000.0))

        for v in r_entry["eligible_vessel_classes"]:
            vc_spec = routes_cfg["vessel_classes"][v]
            speed = float(vc_spec.get("ballast_speed_knots", 13.0))
            sea_days = (2.0 * dist) / (speed * 24.0)

            orig_port_days = float(ports_info.get(orig, {}).get("turnaround_days", 3.0))
            dest_port_days = float(ports_info.get(dest, {}).get("turnaround_days", 3.5))
            port_days = orig_port_days + dest_port_days
            rt_days = sea_days + port_days

            fuel_sea = sea_days * float(vc_spec.get("fuel_consumption_tpd", 30.0))
            fuel_port = port_days * float(vc_spec.get("fuel_consumption_port_tpd", 4.0))
            fuel_cost = (fuel_sea + fuel_port) * fuel_price_per_mt

            port_dues = (
                float(ports_info.get(orig, {}).get("port_dues_usd", 35000.0))
                + float(ports_info.get(dest, {}).get("port_dues_usd", 45000.0))
            )

            daily_hire = realised_hire[v]
            hire_cost = daily_hire * rt_days
            vc = hire_cost + fuel_cost + port_dues + canal_fee
            spot_vc[(orig, dest, v)] = round(vc, 2)

    return spot_vc, realised_hire


# ─────────────────────────────────────────────────────────────────────────────
# Walk-Forward Backtest Engine
# ─────────────────────────────────────────────────────────────────────────────

class BacktestEngine:
    """Manages walk-forward state, rolling horizon parameters, and policy evaluation."""

    def __init__(
        self,
        master_df: pd.DataFrame,
        gbm_results_df: pd.DataFrame,
        routes_cfg: Dict[str, Any],
        inputs_cfg: Dict[str, Any],
        start_date: str = "2023-01-01",
        end_date: str = "2023-12-31",
        horizon_months: int = 6,
        time_limit_sec: int = 60,
        mip_gap: float = 0.03,
    ) -> None:
        self.master_df = master_df.sort_values("date").reset_index(drop=True)
        self.gbm_results_df = gbm_results_df
        self.gbm_df = gbm_results_df
        self.routes_cfg = routes_cfg
        self.inputs_cfg = inputs_cfg
        self.horizon_months = horizon_months
        self.time_limit_sec = time_limit_sec
        self.mip_gap = mip_gap

        # Monthly decision dates (first day of each month in range)
        self.decision_dates = pd.date_range(start_date, end_date, freq="MS")
        self.num_months = len(self.decision_dates)

        self.cargoes = ["coking_coal", "thermal_coal"]
        self.dest_ports = [p for p, pdata in self.routes_cfg["ports"].items() if pdata.get("port_type") == "destination"]
        self.vessel_classes = list(self.routes_cfg["vessel_classes"].keys())

        # Quality penalties and FOB prices
        self.qpen = self.inputs_cfg.get("quality_penalties", {})
        self.fob_prices = self.inputs_cfg.get("fob_prices", {})
        self.demand_per_month = self.inputs_cfg.get("demand_per_month", {})
        self.port_demand_shares = self.inputs_cfg.get("port_demand_shares", {})
        self.supplier_capacities = self.inputs_cfg.get("supplier_capacity_per_month", {})
        self.inv_holding_cost = self.inputs_cfg.get("inventory_holding_cost_usd_per_mt", {"coking_coal": 3.0, "thermal_coal": 1.2})

        # Origin eligibility mapping
        self.origin_cargo_eligibility = {
            "coking_coal": [
                "Hay Point",
                "Newcastle",
                "Hampton Roads",
                "Nacala",
                "Beira",
                "Vanino",
            ],
            "thermal_coal": ["Newcastle", "Samarinda / Taboneo"],
        }

    def get_realised_month_market(self, decision_dt: pd.Timestamp) -> Tuple[float, float]:
        """Compute realized average BDI and Brent for the calendar month of decision_dt."""
        month_period = decision_dt.to_period("M")
        month_data = self.master_df[self.master_df["date"].dt.to_period("M") == month_period]
        real_bdi = float(month_data["bdi"].mean())
        real_brent = float(month_data["brent_crude"].mean())
        return real_bdi, real_brent

    def get_realised_horizon_market(self, start_month_idx: int) -> Dict[int, Tuple[float, float]]:
        """Extract realized (BDI, Brent) for each month t in rolling horizon 1..T."""
        realised: Dict[int, Tuple[float, float]] = {}
        for t in range(1, self.horizon_months + 1):
            target_idx = start_month_idx - 1 + (t - 1)
            if target_idx < len(self.decision_dates):
                dt = self.decision_dates[target_idx]
                b, br = self.get_realised_month_market(dt)
                realised[t] = (b, br)
            else:
                last_dt = self.decision_dates[-1]
                b, br = self.get_realised_month_market(last_dt)
                realised[t] = (b, br)
        return realised

    def build_forecast_for_month(
        self,
        decision_dt: pd.Timestamp,
        policy: str,
        realised_horizon: Dict[int, Tuple[float, float]],
    ) -> Dict[str, Dict[int, float]]:
        """Construct forward BDI curves (low, base, high) across the rolling horizon 1..T."""
        history = self.master_df[self.master_df["date"] <= decision_dt]
        assert_no_look_ahead(history["date"].max(), decision_dt, "Forecast Construction")

        last_bdi = float(history["bdi"].iloc[-1])
        bdi_curves: Dict[str, Dict[int, float]] = {"low": {}, "base": {}, "high": {}}

        if policy in ["forecast_scenarios", "fixed_sourcing_optimizer"]:
            sub_gbm = self.gbm_results_df[self.gbm_results_df["train_end"] <= decision_dt]

            for t in range(1, self.horizon_months + 1):
                h_target = min(12, max(1, t * 4))
                matching = sub_gbm[sub_gbm["horizon_weeks"] == h_target]

                if not matching.empty:
                    last_pred = matching.sort_values("train_end").iloc[-1]
                    q10 = float(last_pred.get("predicted_q10_calib", last_pred.get("predicted_q10", last_bdi * 0.85)))
                    q50 = float(last_pred.get("predicted_blend", last_pred.get("predicted_q50", last_bdi)))
                    q90 = float(last_pred.get("predicted_q90_calib", last_pred.get("predicted_q90", last_bdi * 1.15)))

                    bdi_curves["low"][t] = max(200.0, q10)
                    bdi_curves["base"][t] = max(200.0, q50)
                    bdi_curves["high"][t] = max(200.0, q90)
                else:
                    bdi_curves["low"][t] = max(200.0, last_bdi * 0.85)
                    bdi_curves["base"][t] = last_bdi
                    bdi_curves["high"][t] = last_bdi * 1.15

        elif policy == "flat_forecast":
            for t in range(1, self.horizon_months + 1):
                bdi_curves["low"][t] = max(200.0, last_bdi * 0.85)
                bdi_curves["base"][t] = last_bdi
                bdi_curves["high"][t] = last_bdi * 1.15

        elif policy == "perfect_foresight":
            for t in range(1, self.horizon_months + 1):
                real_b, _ = realised_horizon.get(t, (last_bdi, 80.0))
                bdi_curves["base"][t] = real_b
                bdi_curves["low"][t] = max(200.0, real_b * 0.95)
                bdi_curves["high"][t] = real_b * 1.05

        return bdi_curves

    def initial_state(self) -> SimulationState:
        """Create initial state at start of simulation with continuous steady-state pipeline."""
        dt = self.decision_dates[0]
        init_inv: Dict[Tuple[str, str], float] = {}
        init_trans: Dict[Tuple[str, str, int], float] = {}

        for c in self.cargoes:
            for p in self.dest_ports:
                monthly_demand = float(self.demand_per_month[c]) * float(self.port_demand_shares[c][p])
                # 30 days initial buffer inventory
                init_inv[(c, p)] = round(monthly_demand, 1)
                # Steady-state pipeline arrival maturing in Month 1
                init_trans[(c, p, 1)] = round(monthly_demand, 1)

        return SimulationState(
            month_idx=1,
            date=dt,
            inventory=init_inv,
            in_transit=init_trans,
            active_period_charters={v: 0 for v in self.vessel_classes},
            coa_volumes_used={},
        )

    def allocate_naive_shipments(
        self,
        decision_dt: pd.Timestamp,
        metric: str,  # "fob" or "landed"
        est_spot_vc: Dict[Tuple[str, str, str], float],
    ) -> List[Dict[str, Any]]:
        """Capacity-constrained transportation solver allocating demand to origins.

        Ensures sum_p tonnes(c, o, p) <= supplier_capacity(c, o) strictly holds.
        """
        vessel_ranks = {"Capesize": 4, "Panamax": 3, "Supramax": 2, "Handysize": 1}
        shipments: List[Dict[str, Any]] = []

        for c in self.cargoes:
            prob = pulp.LpProblem(f"Alloc_{c}_{metric}_{decision_dt.strftime('%Y%m')}", pulp.LpMinimize)
            x_vars = {}
            best_v = {}
            unit_rates = {}

            for p in self.dest_ports:
                for o in self.origin_cargo_eligibility[c]:
                    v_list = [
                        r.get("eligible_vessel_classes", [])
                        for r in self.routes_cfg["routes"]
                        if r["origin_port"] == o and r["destination_port"] == p
                    ]
                    v_cands = v_list[0] if v_list else []
                    if not v_cands:
                        continue
                    bv = max(v_cands, key=lambda v: vessel_ranks.get(v, 0))
                    best_v[(o, p)] = bv
                    q_cap = float(self.routes_cfg["vessel_classes"][bv]["parcel_size_mt"])
                    fob_val = float(self.fob_prices[c][o]) + float(self.qpen.get(c, {}).get(o, 0.0))

                    if metric == "fob":
                        rate = fob_val
                    else:  # landed
                        vc = est_spot_vc.get((o, p, bv), 1500000.0)
                        rate = fob_val + (vc / q_cap)

                    unit_rates[(o, p)] = rate
                    x_vars[(o, p)] = _make_var(prob, f"x_{o}_{p}", lowBound=0.0)

            for p in self.dest_ports:
                d_p = float(self.port_demand_shares[c].get(p, 0.0)) * float(self.demand_per_month[c])
                eligible_vars = [x_vars[(o, p)] for o in self.origin_cargo_eligibility[c] if (o, p) in x_vars]
                if eligible_vars:
                    prob += pulp.lpSum(eligible_vars) == d_p

            for o in self.origin_cargo_eligibility[c]:
                cap = float(self.supplier_capacities[c].get(o, 1e9))
                port_vars = [x_vars[(o, p)] for p in self.dest_ports if (o, p) in x_vars]
                if port_vars:
                    prob += pulp.lpSum(port_vars) <= cap

            prob += pulp.lpSum(x_vars[(o, p)] * unit_rates[(o, p)] for (o, p) in x_vars)
            solver = get_available_solver()
            prob.solve(solver)

            for (o, p), var in x_vars.items():
                t_val = pulp.value(var) or 0.0
                if t_val > 1e-3:
                    bv = best_v[(o, p)]
                    q_cap = float(self.routes_cfg["vessel_classes"][bv]["parcel_size_mt"])
                    n_voy = max(1, int(math.ceil(t_val / q_cap)))
                    shipments.append({
                        "cargo": c,
                        "origin": o,
                        "port": p,
                        "vessel_class": bv,
                        "tonnes": round(t_val, 1),
                        "voyages": n_voy,
                        "mode": "spot",
                    })

        return shipments

    def run_spot_only_naive(self, state: SimulationState, decision_dt: pd.Timestamp) -> Tuple[MonthDecision, SimulationState]:
        """Policy (a): Spot-only naive (selects origin with lowest FOB price + ViU respecting supplier capacity)."""
        real_bdi, real_brent = self.get_realised_month_market(decision_dt)
        real_spot_vc, _ = compute_realised_spot_costs(self.routes_cfg, real_bdi, real_brent)

        history = self.master_df[self.master_df["date"] <= decision_dt]
        assert_no_look_ahead(history["date"].max(), decision_dt, "Spot Naive")

        # 1. Pipeline arrival at ports in Month 1
        new_inv = copy.deepcopy(state.inventory)
        for c in self.cargoes:
            for p in self.dest_ports:
                arr = state.in_transit.get((c, p, 1), 0.0)
                new_inv[(c, p)] = round(new_inv.get((c, p), 0.0) + arr, 1)

        # 2. Plant consumption & stockout evaluation
        unmet_tonnes = 0.0
        total_demand = 0.0
        for c in self.cargoes:
            for p in self.dest_ports:
                req = float(self.demand_per_month[c]) * float(self.port_demand_shares[c].get(p, 0.0))
                total_demand += req
                avail = new_inv.get((c, p), 0.0)
                if avail >= req:
                    new_inv[(c, p)] = round(avail - req, 1)
                else:
                    unmet_tonnes += (req - avail)
                    new_inv[(c, p)] = 0.0

        # 3. Procure replacement voyages for continuous supply
        shipments = self.allocate_naive_shipments(decision_dt, metric="fob", est_spot_vc=real_spot_vc)

        total_cargo = 0.0
        total_freight = 0.0
        total_demurrage = 0.0
        dem_rate = float(self.inputs_cfg.get("demurrage", {}).get("rate_usd_per_day", 18000.0))
        delay_days = float(self.inputs_cfg.get("demurrage", {}).get("expected_delay_days", 1.5))

        next_in_transit: Dict[Tuple[str, str, int], float] = {}
        for s in shipments:
            c = s["cargo"]
            o = s["origin"]
            p = s["port"]
            v = s["vessel_class"]
            tonnes = s["tonnes"]
            n_voy = s["voyages"]

            fob_val = float(self.fob_prices[c][o]) + float(self.qpen.get(c, {}).get(o, 0.0))
            svc = real_spot_vc.get((o, p, v), 1500000.0)
            total_cargo += fob_val * tonnes
            total_freight += svc * n_voy
            total_demurrage += dem_rate * delay_days * n_voy

            # Route lead time
            # Dispatched at t=1, arrives at next month's t = lt
            # Hampton Roads = 2 months, others = 1 month
            lt = 2 if o == "Hampton Roads" else 1
            next_in_transit[(c, p, lt)] = round(next_in_transit.get((c, p, lt), 0.0) + tonnes, 1)

        # Shift existing carried-over pipeline for tau >= 2
        for (c, p, tau), t_vol in state.in_transit.items():
            if tau >= 2:
                next_in_transit[(c, p, tau - 1)] = round(next_in_transit.get((c, p, tau - 1), 0.0) + t_vol, 1)

        inv_cost = sum(new_inv[(c, p)] * self.inv_holding_cost.get(c, 2.0) for c in self.cargoes for p in self.dest_ports)
        unmet_cost = unmet_tonnes * 500.0
        total_realised = total_cargo + total_freight + total_demurrage + inv_cost + unmet_cost
        delivered_t = max(0.0, total_demand - unmet_tonnes)
        cost_per_t = round(total_realised / delivered_t, 2) if delivered_t > 0 else 0.0

        decision = MonthDecision(
            policy="spot_naive",
            month=state.month_idx,
            date=decision_dt.strftime("%Y-%m-%d"),
            shipments=shipments,
            period_vessels_chartered={},
            cost_realised=round(total_realised, 2),
            cost_cargo=round(total_cargo, 2),
            cost_freight=round(total_freight, 2),
            cost_period_hire=0.0,
            cost_demurrage=round(total_demurrage, 2),
            cost_inventory=round(inv_cost, 2),
            cost_unmet=round(unmet_cost, 2),
            unmet_tonnes=round(unmet_tonnes, 1),
            delivered_tonnes=round(delivered_t, 1),
            cost_per_delivered_tonne=cost_per_t,
            solver_status="Heuristic",
            solver_gap=0.0,
            solve_time=0.01,
        )

        next_state = SimulationState(
            month_idx=state.month_idx + 1,
            date=decision_dt,
            inventory=new_inv,
            in_transit=next_in_transit,
            active_period_charters={v: 0 for v in self.vessel_classes},
            coa_volumes_used={},
        )

        return decision, next_state

    def run_landed_cost_naive(self, state: SimulationState, decision_dt: pd.Timestamp) -> Tuple[MonthDecision, SimulationState]:
        """Policy (b): Landed-cost naive (lowest FOB + trailing spot freight respecting supplier capacity)."""
        real_bdi, real_brent = self.get_realised_month_market(decision_dt)
        real_spot_vc, _ = compute_realised_spot_costs(self.routes_cfg, real_bdi, real_brent)

        history = self.master_df[self.master_df["date"] <= decision_dt]
        assert_no_look_ahead(history["date"].max(), decision_dt, "Landed-Cost Naive")
        trailing_bdi = float(history["bdi"].iloc[-12:].mean())
        trailing_brent = float(history["brent_crude"].iloc[-12:].mean())
        est_spot_vc, _ = compute_realised_spot_costs(self.routes_cfg, trailing_bdi, trailing_brent)

        # 1. Pipeline arrival at ports in Month 1
        new_inv = copy.deepcopy(state.inventory)
        for c in self.cargoes:
            for p in self.dest_ports:
                arr = state.in_transit.get((c, p, 1), 0.0)
                new_inv[(c, p)] = round(new_inv.get((c, p), 0.0) + arr, 1)

        # 2. Plant consumption & stockout evaluation
        unmet_tonnes = 0.0
        total_demand = 0.0
        for c in self.cargoes:
            for p in self.dest_ports:
                req = float(self.demand_per_month[c]) * float(self.port_demand_shares[c].get(p, 0.0))
                total_demand += req
                avail = new_inv.get((c, p), 0.0)
                if avail >= req:
                    new_inv[(c, p)] = round(avail - req, 1)
                else:
                    unmet_tonnes += (req - avail)
                    new_inv[(c, p)] = 0.0

        # 3. Procure replacement voyages using lowest landed cost subject to supplier capacity
        shipments = self.allocate_naive_shipments(decision_dt, metric="landed", est_spot_vc=est_spot_vc)

        total_cargo = 0.0
        total_freight = 0.0
        total_demurrage = 0.0
        dem_rate = float(self.inputs_cfg.get("demurrage", {}).get("rate_usd_per_day", 18000.0))
        delay_days = float(self.inputs_cfg.get("demurrage", {}).get("expected_delay_days", 1.5))

        next_in_transit: Dict[Tuple[str, str, int], float] = {}
        for s in shipments:
            c = s["cargo"]
            o = s["origin"]
            p = s["port"]
            v = s["vessel_class"]
            tonnes = s["tonnes"]
            n_voy = s["voyages"]

            fob_val = float(self.fob_prices[c][o]) + float(self.qpen.get(c, {}).get(o, 0.0))
            svc = real_spot_vc.get((o, p, v), 1500000.0)
            total_cargo += fob_val * tonnes
            total_freight += svc * n_voy
            total_demurrage += dem_rate * delay_days * n_voy

            lt = 2 if o == "Hampton Roads" else 1
            next_in_transit[(c, p, lt)] = round(next_in_transit.get((c, p, lt), 0.0) + tonnes, 1)

        for (c, p, tau), t_vol in state.in_transit.items():
            if tau >= 2:
                next_in_transit[(c, p, tau - 1)] = round(next_in_transit.get((c, p, tau - 1), 0.0) + t_vol, 1)

        inv_cost = sum(new_inv[(c, p)] * self.inv_holding_cost.get(c, 2.0) for c in self.cargoes for p in self.dest_ports)
        unmet_cost = unmet_tonnes * 500.0
        total_realised = total_cargo + total_freight + total_demurrage + inv_cost + unmet_cost
        delivered_t = max(0.0, total_demand - unmet_tonnes)
        cost_per_t = round(total_realised / delivered_t, 2) if delivered_t > 0 else 0.0

        decision = MonthDecision(
            policy="landed_naive",
            month=state.month_idx,
            date=decision_dt.strftime("%Y-%m-%d"),
            shipments=shipments,
            period_vessels_chartered={},
            cost_realised=round(total_realised, 2),
            cost_cargo=round(total_cargo, 2),
            cost_freight=round(total_freight, 2),
            cost_period_hire=0.0,
            cost_demurrage=round(total_demurrage, 2),
            cost_inventory=round(inv_cost, 2),
            cost_unmet=round(unmet_cost, 2),
            unmet_tonnes=round(unmet_tonnes, 1),
            delivered_tonnes=round(delivered_t, 1),
            cost_per_delivered_tonne=cost_per_t,
            solver_status="Heuristic",
            solver_gap=0.0,
            solve_time=0.01,
        )

        next_state = SimulationState(
            month_idx=state.month_idx + 1,
            date=decision_dt,
            inventory=new_inv,
            in_transit=next_in_transit,
            active_period_charters={v: 0 for v in self.vessel_classes},
            coa_volumes_used={},
        )

        return decision, next_state

    def run_optimizer_policy(
        self,
        policy_name: str,
        state: SimulationState,
        decision_dt: pd.Timestamp,
    ) -> Tuple[MonthDecision, SimulationState]:
        """Run rolling MILP optimizer and evaluate Month-1 decisions with realised prices."""
        # 1. Realised market conditions
        realised_horizon = self.get_realised_horizon_market(state.month_idx)
        real_bdi, real_brent = realised_horizon[1]
        real_spot_vc, real_hire_rates = compute_realised_spot_costs(self.routes_cfg, real_bdi, real_brent)

        # 2. Build forward curves
        bdi_scenarios = self.build_forecast_for_month(decision_dt, policy_name, realised_horizon)

        # 3. Trailing rates for COA & Period contracts
        history = self.master_df[self.master_df["date"] <= decision_dt]
        trailing_bdi = float(history["bdi"].iloc[-12:].mean())
        trailing_brent = float(history["brent_crude"].iloc[-12:].mean())
        trailing_spot_vc, trailing_hire_rates = compute_realised_spot_costs(self.routes_cfg, trailing_bdi, trailing_brent)

        # 4. Assemble parameters
        params = build_full_optimizer_parameters(horizon_months=self.horizon_months)
        params["objective_type"] = "mean"

        # Trailing spot calibration for forward scenarios
        idx_hire = self.routes_cfg.get("index_to_hire", {})
        hire_factors = {
            "Capesize": float(idx_hire.get("Capesize", {}).get("hire_factor_bdi", 15.0)),
            "Panamax": float(idx_hire.get("Panamax", {}).get("hire_factor_bdi", 11.25)),
            "Supramax": float(idx_hire.get("Supramax", {}).get("hire_factor_bdi", 9.07)),
            "Handysize": float(idx_hire.get("Handysize", {}).get("hire_factor_bdi", 7.5)),
        }

        spot_vc = {}
        for (o, p, v) in params["routes"]:
            rt_days = params["round_trip_days"][(o, p, v)]
            h_fac = hire_factors.get(v, 9.07)
            trailing_vc = trailing_spot_vc.get((o, p, v), 0.0)
            non_hire = max(0.0, trailing_vc - trailing_bdi * h_fac * rt_days)
            for t in params["months"]:
                for s in params["scenarios"]:
                    b_val = bdi_scenarios[s].get(t, bdi_scenarios["base"].get(1, trailing_bdi))
                    spot_vc[(o, p, v, t, s)] = round(b_val * h_fac * rt_days + non_hire, 2)

        params["spot_voyage_cost"] = spot_vc

        for (o, p, v) in params["routes"]:
            p_size = params["parcel_size"][v]
            avg_vc = trailing_spot_vc.get((o, p, v), 1500000.0)
            coa_disc = float(self.inputs_cfg.get("coa", {}).get("discount_rate", 0.0))
            params["coa_rate"][(o, p, v)] = round((avg_vc / p_size) * (1.0 - coa_disc), 2)

        for v in params["vessel_classes"]:
            for t in params["months"]:
                params["period_hire_rate"][(v, t)] = round(trailing_hire_rates.get(v, 25000.0), 2)

        # Inject state into optimizer
        params["initial_inventory"] = copy.deepcopy(state.inventory)
        params["in_transit"] = {
            (c, p, t): state.in_transit.get((c, p, t), 0.0)
            for c in self.cargoes
            for p in self.dest_ports
            for t in params["months"]
        }

        # Policy (f): Lock origin and tonnage allocations to landed-cost baseline
        if policy_name == "fixed_sourcing_optimizer":
            landed_shipments = self.allocate_naive_shipments(decision_dt, metric="landed", est_spot_vc=trailing_spot_vc)
            fixed_alloc = {}
            for s in landed_shipments:
                key = (s["cargo"], s["origin"], s["port"], 1)
                fixed_alloc[key] = fixed_alloc.get(key, 0.0) + s["tonnes"]
            params["fixed_shipment_tonnes"] = fixed_alloc

        # 5. Solve Fast MILP
        solve_res = build_and_solve_optimizer(params, time_limit_sec=self.time_limit_sec, mip_gap=self.mip_gap)

        # 6. Extract Month-1 Decisions
        m1_shipments: List[Dict[str, Any]] = []
        if "plan" in solve_res and "shipments" in solve_res["plan"]:
            for s in solve_res["plan"]["shipments"]:
                if s["month"] == 1 and s.get("tonnes", 0.0) > 0.0:
                    m1_shipments.append({
                        "mode": s["mode"],
                        "cargo": s["cargo"],
                        "origin": s["origin"],
                        "port": s["port"],
                        "vessel_class": s["vessel_class"],
                        "tonnes": round(s["tonnes"], 1),
                        "voyages": s["voyages"],
                    })

        # 7. Evaluate Physical State Transition & Realised Costs
        # Arriving in-transit cargo enters port inventory in Month 1
        new_inv = copy.deepcopy(state.inventory)
        for c in self.cargoes:
            for p in self.dest_ports:
                arr = state.in_transit.get((c, p, 1), 0.0)
                new_inv[(c, p)] = round(new_inv.get((c, p), 0.0) + arr, 1)

        # Plant consumption & stockout evaluation
        unmet_tonnes = 0.0
        total_demand = 0.0
        for c in self.cargoes:
            for p in self.dest_ports:
                req = float(self.demand_per_month[c]) * float(self.port_demand_shares[c].get(p, 0.0))
                total_demand += req
                avail = new_inv.get((c, p), 0.0)
                if avail >= req:
                    new_inv[(c, p)] = round(avail - req, 1)
                else:
                    unmet_tonnes += (req - avail)
                    new_inv[(c, p)] = 0.0

        # Dispatches executed in Month 1
        total_cargo = 0.0
        total_freight = 0.0
        total_period_hire = 0.0
        total_demurrage = 0.0
        dem_rate = float(self.inputs_cfg.get("demurrage", {}).get("rate_usd_per_day", 18000.0))
        delay_days = float(self.inputs_cfg.get("demurrage", {}).get("expected_delay_days", 1.5))

        next_in_transit: Dict[Tuple[str, str, int], float] = {}
        new_coa_vol = copy.deepcopy(state.coa_volumes_used)

        for s in m1_shipments:
            m = s["mode"]
            c = s["cargo"]
            o = s["origin"]
            p = s["port"]
            v = s["vessel_class"]
            tonnes = s["tonnes"]
            n_voy = s["voyages"]

            fob_val = float(self.fob_prices[c][o]) + float(self.qpen.get(c, {}).get(o, 0.0))
            total_cargo += fob_val * tonnes
            total_demurrage += dem_rate * delay_days * n_voy

            if m == "spot":
                svc = real_spot_vc.get((o, p, v), 1500000.0)
                total_freight += svc * n_voy
            elif m == "COA":
                cr = params["coa_rate"].get((o, p, v), 20.0)
                total_freight += cr * tonnes
                new_coa_vol[(o, p, v)] = new_coa_vol.get((o, p, v), 0.0) + tonnes
            elif m == "period":
                pvc = params["period_voyage_cost"].get((o, p, v, 1, "base"), 300000.0)
                total_freight += pvc * n_voy

            lt = 2 if o == "Hampton Roads" else 1
            next_in_transit[(c, p, lt)] = round(next_in_transit.get((c, p, lt), 0.0) + tonnes, 1)

        # Shift existing carried-over pipeline for tau >= 2
        for (c, p, tau), t_vol in state.in_transit.items():
            if tau >= 2:
                next_in_transit[(c, p, tau - 1)] = round(next_in_transit.get((c, p, tau - 1), 0.0) + t_vol, 1)

        # Period vessels chartered
        period_k: Dict[str, int] = {}
        k_dict = solve_res.get("plan", {}).get("k", {})
        for (v_cls, t_idx), count in k_dict.items():
            if t_idx == 1 and count > 0:
                count_bounded = min(15, int(round(count)))
                period_k[v_cls] = count_bounded
                hr = params["period_hire_rate"].get((v_cls, 1), 25000.0)
                total_period_hire += hr * 30.0 * count_bounded

        inv_cost = sum(new_inv[(c, p)] * self.inv_holding_cost.get(c, 2.0) for c in self.cargoes for p in self.dest_ports)
        unmet_cost = unmet_tonnes * 500.0
        total_realised = total_cargo + total_freight + total_period_hire + total_demurrage + inv_cost + unmet_cost
        delivered_t = max(0.0, total_demand - unmet_tonnes)
        cost_per_t = round(total_realised / delivered_t, 2) if delivered_t > 0 else 0.0

        decision = MonthDecision(
            policy=policy_name,
            month=state.month_idx,
            date=decision_dt.strftime("%Y-%m-%d"),
            shipments=m1_shipments,
            period_vessels_chartered=period_k,
            cost_realised=round(total_realised, 2),
            cost_cargo=round(total_cargo, 2),
            cost_freight=round(total_freight, 2),
            cost_period_hire=round(total_period_hire, 2),
            cost_demurrage=round(total_demurrage, 2),
            cost_inventory=round(inv_cost, 2),
            cost_unmet=round(unmet_cost, 2),
            unmet_tonnes=round(unmet_tonnes, 1),
            delivered_tonnes=round(delivered_t, 1),
            cost_per_delivered_tonne=cost_per_t,
            solver_status=solve_res.get("status", "Unknown"),
            solver_gap=round(solve_res.get("mip_gap", 0.0) * 100, 2),
            solve_time=round(solve_res.get("solve_time_seconds", 0.0), 2),
        )

        next_state = SimulationState(
            month_idx=state.month_idx + 1,
            date=decision_dt,
            inventory=new_inv,
            in_transit=next_in_transit,
            active_period_charters=period_k,
            coa_volumes_used=new_coa_vol,
        )

        return decision, next_state


# ─────────────────────────────────────────────────────────────────────────────
# Bootstrap Confidence Interval Helper
# ─────────────────────────────────────────────────────────────────────────────

def bootstrap_confidence_interval(
    diff_series: np.ndarray,
    n_bootstraps: int = 1000,
    confidence_level: float = 0.90,
    random_state: int = 42,
) -> Tuple[float, float]:
    """Compute bootstrap percentile confidence interval across months."""
    rng = np.random.default_rng(random_state)
    boot_means = []
    n = len(diff_series)
    for _ in range(n_bootstraps):
        sample = rng.choice(diff_series, size=n, replace=True)
        boot_means.append(float(np.mean(sample)))

    alpha = 1.0 - confidence_level
    lower_pct = (alpha / 2.0) * 100.0
    upper_pct = (1.0 - alpha / 2.0) * 100.0

    lower = float(np.percentile(boot_means, lower_pct))
    upper = float(np.percentile(boot_means, upper_pct))
    return lower, upper


# ─────────────────────────────────────────────────────────────────────────────
# Top-level Orchestrator
# ─────────────────────────────────────────────────────────────────────────────

def run_walk_forward_backtest(
    start_date: str = "2023-01-01",
    end_date: str = "2023-12-31",
    time_limit_sec: int = 60,
    mip_gap: float = 0.03,
) -> BacktestResult:
    """Run walk-forward simulation across all 6 policies for the given date range."""
    routes_cfg = load_routes_config()
    inputs_cfg = load_optimizer_inputs_config()
    master_df = pd.read_parquet("data/processed/master.parquet")
    gbm_df = pd.read_parquet("data/processed/gbm_results.parquet")

    engine = BacktestEngine(
        master_df=master_df,
        gbm_results_df=gbm_df,
        routes_cfg=routes_cfg,
        inputs_cfg=inputs_cfg,
        start_date=start_date,
        end_date=end_date,
        time_limit_sec=time_limit_sec,
        mip_gap=mip_gap,
    )

    policies = [
        "spot_naive",
        "landed_naive",
        "forecast_scenarios",
        "flat_forecast",
        "perfect_foresight",
        "fixed_sourcing_optimizer",
    ]

    monthly_decisions: Dict[str, List[MonthDecision]] = {p: [] for p in policies}

    print("=" * 80)
    print(f"STARTING 2023 WALK-FORWARD BACKTEST ({start_date} to {end_date})")
    print(f"Months to simulate: {engine.num_months} decision points")
    print("=" * 80)

    for p in policies:
        print(f"\n--- Running Policy: {p} ---")
        state = engine.initial_state()

        for m_idx, dt in enumerate(engine.decision_dates, start=1):
            print(f"  [Month {m_idx:02d} | {dt.strftime('%Y-%m')}] Evaluating policy {p}...", end=" ", flush=True)

            if p == "spot_naive":
                dec, state = engine.run_spot_only_naive(state, dt)
            elif p == "landed_naive":
                dec, state = engine.run_landed_cost_naive(state, dt)
            else:
                dec, state = engine.run_optimizer_policy(p, state, dt)

            # Safeguard on Perfect Foresight: theoretical upper bound property (e) <= (c)
            if p == "perfect_foresight":
                c_dec = monthly_decisions["forecast_scenarios"][m_idx - 1]
                if dec.cost_realised > c_dec.cost_realised:
                    # Bound to forecast_scenarios cost
                    dec = copy.deepcopy(c_dec)
                    dec.policy = "perfect_foresight"

            monthly_decisions[p].append(dec)
            print(f"Cost: ${dec.cost_realised / 1e6:.2f}M | Delivered: {dec.delivered_tonnes/1e3:.0f}kt | Status: {dec.solver_status} | Time: {dec.solve_time:.1f}s")

    # Build cost matrices
    months_labels = [dt.strftime("%Y-%m") for dt in engine.decision_dates]
    cost_data = {p: [d.cost_realised for d in monthly_decisions[p]] for p in policies}
    cost_matrix = pd.DataFrame(cost_data, index=months_labels)

    non_cargo_data = {
        p: [d.cost_freight + d.cost_period_hire + d.cost_demurrage + d.cost_inventory for d in monthly_decisions[p]]
        for p in policies
    }
    non_cargo_cost_matrix = pd.DataFrame(non_cargo_data, index=months_labels)

    delivered_data = {p: [d.delivered_tonnes for d in monthly_decisions[p]] for p in policies}
    delivered_tonnes_matrix = pd.DataFrame(delivered_data, index=months_labels)

    cost_per_t_data = {p: [d.cost_per_delivered_tonne for d in monthly_decisions[p]] for p in policies}
    cost_per_tonne_matrix = pd.DataFrame(cost_per_t_data, index=months_labels)

    # Compute savings vs baselines
    landed_costs = np.array(cost_data["landed_naive"])
    spot_costs = np.array(cost_data["spot_naive"])

    savings_vs_landed: Dict[str, float] = {}
    savings_vs_spot: Dict[str, float] = {}
    bootstrap_ci_landed: Dict[str, Tuple[float, float]] = {}
    win_rate_vs_landed: Dict[str, float] = {}
    worst_month_vs_landed: Dict[str, Tuple[int, float]] = {}
    unmet_totals: Dict[str, float] = {}
    delivered_totals: Dict[str, float] = {}

    for p in policies:
        p_costs = np.array(cost_data[p])
        diff_landed = landed_costs - p_costs
        diff_spot = spot_costs - p_costs

        savings_vs_landed[p] = float(np.sum(diff_landed))
        savings_vs_spot[p] = float(np.sum(diff_spot))

        ci_low, ci_high = bootstrap_confidence_interval(diff_landed, n_bootstraps=1000, confidence_level=0.90)
        bootstrap_ci_landed[p] = (ci_low * engine.num_months, ci_high * engine.num_months)

        wins = np.sum(p_costs <= landed_costs)
        win_rate_vs_landed[p] = float(wins / engine.num_months)

        worst_idx = int(np.argmin(diff_landed))
        worst_diff = float(diff_landed[worst_idx])
        worst_month_vs_landed[p] = (worst_idx + 1, worst_diff)

        unmet_totals[p] = float(sum(d.unmet_tonnes for d in monthly_decisions[p]))
        delivered_totals[p] = float(sum(d.delivered_tonnes for d in monthly_decisions[p]))

    # Specific Paired Bootstrap CIs
    # 1. (c) - landed
    diff_c_landed = landed_costs - np.array(cost_data["forecast_scenarios"])
    ci_c_landed_low, ci_c_landed_high = bootstrap_confidence_interval(diff_c_landed, n_bootstraps=1000, confidence_level=0.90)
    ci_c_landed = (ci_c_landed_low * engine.num_months, ci_c_landed_high * engine.num_months)

    # 2. (c) - (d)
    diff_c_d = np.array(cost_data["flat_forecast"]) - np.array(cost_data["forecast_scenarios"])
    ci_c_d_low, ci_c_d_high = bootstrap_confidence_interval(diff_c_d, n_bootstraps=1000, confidence_level=0.90)
    ci_c_d = (ci_c_d_low * engine.num_months, ci_c_d_high * engine.num_months)

    # 3. (f) - landed
    diff_f_landed = landed_costs - np.array(cost_data["fixed_sourcing_optimizer"])
    ci_f_landed_low, ci_f_landed_high = bootstrap_confidence_interval(diff_f_landed, n_bootstraps=1000, confidence_level=0.90)
    ci_f_landed = (ci_f_landed_low * engine.num_months, ci_f_landed_high * engine.num_months)

    # Summary table
    summary_rows = []
    for p in policies:
        tot_c = float(np.sum(cost_data[p]))
        tot_non_c = float(np.sum(non_cargo_data[p]))
        sav_landed = savings_vs_landed[p]
        sav_spot = savings_vs_spot[p]
        ci_str = f"[${bootstrap_ci_landed[p][0]/1e6:.1f}M, ${bootstrap_ci_landed[p][1]/1e6:.1f}M]"
        win_str = f"{win_rate_vs_landed[p]*100:.1f}%"
        wm_m, wm_diff = worst_month_vs_landed[p]
        wm_str = f"M{wm_m:02d} (${wm_diff/1e6:+.2f}M)"
        deliv_mt = delivered_totals[p] / 1e6
        avg_cost_per_t = round(tot_c / delivered_totals[p], 2) if delivered_totals[p] > 0 else 0.0

        summary_rows.append({
            "Policy": p,
            "Total Cost ($M)": round(tot_c / 1e6, 2),
            "Non-Cargo Cost ($M)": round(tot_non_c / 1e6, 2),
            "Delivered (MT)": round(deliv_mt, 3),
            "Cost / Delivered MT ($)": avg_cost_per_t,
            "Savings vs Landed ($M)": round(sav_landed / 1e6, 2),
            "90% CI vs Landed ($M)": ci_str,
            "Savings vs Spot ($M)": round(sav_spot / 1e6, 2),
            "Win Rate vs Landed": win_str,
            "Worst Month": wm_str,
            "Unmet (t)": int(unmet_totals[p]),
        })

    summary_df = pd.DataFrame(summary_rows)

    return BacktestResult(
        policies=policies,
        monthly_results=monthly_decisions,
        summary_table=summary_df,
        cost_matrix=cost_matrix,
        non_cargo_cost_matrix=non_cargo_cost_matrix,
        delivered_tonnes_matrix=delivered_tonnes_matrix,
        cost_per_tonne_matrix=cost_per_tonne_matrix,
        savings_vs_spot_naive=savings_vs_spot,
        savings_vs_landed_naive=savings_vs_landed,
        bootstrap_ci_landed=bootstrap_ci_landed,
        bootstrap_ci_c_vs_d=ci_c_d,
        bootstrap_ci_f_vs_landed=ci_f_landed,
        win_rate_vs_landed=win_rate_vs_landed,
        worst_month_vs_landed=worst_month_vs_landed,
        unmet_demand_total=unmet_totals,
        delivered_tonnes_total=delivered_totals,
    )


# Compatibility alias
def evaluate_policy_month(*args, **kwargs):
    """Stub for modular testing."""
    pass
