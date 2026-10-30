"""Input loader and parameter builder for full-scale maritime procurement MILP.

Loads physical routes, port limits, and vessel specs from config/routes.yaml,
combines with calibrated BDI quantile forecasts from data/processed/gbm_results.parquet,
and populates operational parameters from config/optimizer_inputs.yaml.
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import yaml


def load_routes_config(routes_yaml_path: str = "config/routes.yaml") -> Dict[str, Any]:
    """Load maritime routes, vessel classes, ports, and bunker configuration."""
    path = Path(routes_yaml_path)
    if not path.is_absolute():
        path = Path.cwd() / path
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_optimizer_inputs_config(inputs_yaml_path: str = "config/optimizer_inputs.yaml") -> Dict[str, Any]:
    """Load synthetic and operational parameter configuration."""
    path = Path(inputs_yaml_path)
    if not path.is_absolute():
        path = Path.cwd() / path
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_bdi_scenarios(
    horizon_months: int = 6,
    gbm_results_path: str = "data/processed/gbm_results.parquet",
    master_path: str = "data/processed/master.parquet",
) -> Dict[str, Dict[int, float]]:
    """Build multi-scenario forward BDI curve (low=q10, base=q50, high=q90).

    Methodology:
    - Months 1, 2, 3: Direct calibrated quantile forecasts from LightGBM for horizons
      h = 4, 8, 12 weeks.
    - Months 4 to T: Median (base) is held constant at the 12-week forecast (q50_h12).
      The uncertainty band [q10, q90] widens based on historical monthly BDI volatility
      via sigma_hist * sqrt(t - 3), reflecting diffusion of freight uncertainty beyond
      the 12-week model horizon.

    Returns:
        Dict mapping scenario ('low', 'base', 'high') to {month: bdi_points}.
    """
    gbm_file = Path(gbm_results_path)
    if not gbm_file.is_absolute():
        gbm_file = Path.cwd() / gbm_file

    master_file = Path(master_path)
    if not master_file.is_absolute():
        master_file = Path.cwd() / master_file

    # Historical monthly volatility
    sigma_hist = 450.0  # fallback historical std of 4-week BDI changes
    if master_file.exists():
        master_df = pd.read_parquet(master_file)
        if "bdi" in master_df.columns:
            diffs = master_df["bdi"].diff(4).dropna()
            if len(diffs) > 10:
                sigma_hist = float(diffs.std())

    # Calibrated forecasts from LightGBM results
    q10_map = {1: 1875.0, 2: 914.0, 3: 1222.0}
    q50_map = {1: 2071.0, 2: 1702.0, 3: 1886.0}
    q90_map = {1: 2878.0, 2: 3097.0, 3: 2855.0}

    if gbm_file.exists():
        gbm_df = pd.read_parquet(gbm_file)
        for h, m_idx in [(4, 1), (8, 2), (12, 3)]:
            sub = gbm_df[gbm_df["horizon_weeks"] == h].sort_values("test_date")
            if len(sub) > 0:
                row = sub.iloc[-1]
                q10_map[m_idx] = float(row.get("predicted_q10_calib", row.get("predicted_q10", q10_map[m_idx])))
                q50_map[m_idx] = float(row.get("predicted_q50", q50_map[m_idx]))
                q90_map[m_idx] = float(row.get("predicted_q90_calib", row.get("predicted_q90", q90_map[m_idx])))

    bdi_scenarios: Dict[str, Dict[int, float]] = {"low": {}, "base": {}, "high": {}}

    for t in range(1, horizon_months + 1):
        if t <= 3:
            bdi_scenarios["low"][t] = max(200.0, q10_map[t])
            bdi_scenarios["base"][t] = q50_map[t]
            bdi_scenarios["high"][t] = q90_map[t]
        else:
            # Hold median at 12-week forecast and widen band with historical volatility
            spread_factor = math.sqrt(t - 3)
            base_val = q50_map[3]
            low_val = max(200.0, q10_map[3] - sigma_hist * spread_factor)
            high_val = q90_map[3] + sigma_hist * spread_factor
            bdi_scenarios["base"][t] = base_val
            bdi_scenarios["low"][t] = low_val
            bdi_scenarios["high"][t] = high_val

    return bdi_scenarios


def compute_trailing_hire_rate(
    vessel_class: str,
    hire_factor: float,
    month: int,
    bdi_base_forecast: Dict[int, float],
    master_path: str = "data/processed/master.parquet",
) -> float:
    """Compute trailing 12-week average spot hire rate combining history and base forecast.

    For month t=1: uses 12 historical weeks.
    For month t=2: uses 8 historical weeks + 4 base-forecast weeks.
    For month t=3: uses 4 historical weeks + 8 base-forecast weeks.
    For month t>=4: uses 12 base-forecast weeks.
    """
    hist_bdi_mean = 3000.0
    master_file = Path(master_path)
    if not master_file.is_absolute():
        master_file = Path.cwd() / master_file
    if master_file.exists():
        m_df = pd.read_parquet(master_file)
        if "bdi" in m_df.columns:
            hist_bdi_mean = float(m_df["bdi"].iloc[-12:].mean())

    if month == 1:
        avg_bdi = hist_bdi_mean
    elif month == 2:
        avg_bdi = (8.0 * hist_bdi_mean + 4.0 * bdi_base_forecast.get(1, hist_bdi_mean)) / 12.0
    elif month == 3:
        avg_bdi = (
            4.0 * hist_bdi_mean
            + 4.0 * bdi_base_forecast.get(1, hist_bdi_mean)
            + 4.0 * bdi_base_forecast.get(2, hist_bdi_mean)
        ) / 12.0
    else:
        avg_bdi = (
            bdi_base_forecast.get(month - 3, hist_bdi_mean)
            + bdi_base_forecast.get(month - 2, hist_bdi_mean)
            + bdi_base_forecast.get(month - 1, hist_bdi_mean)
        ) / 3.0

    return float(avg_bdi * hire_factor)


def build_full_optimizer_parameters(
    horizon_months: int = 6,
    routes_yaml_path: str = "config/routes.yaml",
    inputs_yaml_path: str = "config/optimizer_inputs.yaml",
    gbm_results_path: str = "data/processed/gbm_results.parquet",
    master_path: str = "data/processed/master.parquet",
) -> Dict[str, Any]:
    """Construct full parameter dictionary ready for build_and_solve_optimizer."""
    rcfg = load_routes_config(routes_yaml_path)
    icfg = load_optimizer_inputs_config(inputs_yaml_path)

    vessel_classes = list(rcfg["vessel_classes"].keys())
    ports_info = rcfg["ports"]
    dest_ports = [p for p, pdata in ports_info.items() if pdata.get("port_type") == "destination"]
    months = list(range(1, horizon_months + 1))
    cargoes = ["coking_coal", "thermal_coal"]
    scenarios = ["low", "base", "high"]
    scenario_weights = {"low": 0.25, "base": 0.50, "high": 0.25}

    # BDI Scenarios and vessel hire factors
    bdi_curves = get_bdi_scenarios(horizon_months, gbm_results_path, master_path)
    index_to_hire = rcfg.get("index_to_hire", {})
    # Map hire factor per vessel class
    hire_factors: Dict[str, float] = {
        "Capesize": index_to_hire.get("bci", {}).get("factor", 9.07),
        "Panamax": index_to_hire.get("bpi", {}).get("factor", 9.00),
        "Supramax": index_to_hire.get("bsi", {}).get("factor", 12.64),
        "Handysize": index_to_hire.get("bhsi", {}).get("factor", 18.00),
    }

    # Bunker pricing
    brent_price = float(icfg.get("bunker", {}).get("brent_price_usd_per_bbl", 80.0))
    brent_to_vlsfo = float(rcfg.get("bunker", {}).get("brent_to_vlsfo_factor", 8.5))
    vlsfo_price_usd_per_mt = brent_price * brent_to_vlsfo

    # Parcel sizes and vessel specifications
    parcel_sizes: Dict[str, float] = {
        v: float(rcfg["vessel_classes"][v]["parcel_size_mt"]) for v in vessel_classes
    }

    # Feasible routes R: (origin_port, destination_port, vessel_class)
    feasible_routes: List[Tuple[str, str, str]] = []
    round_trip_days: Dict[Tuple[str, str, str], float] = {}
    lead_times: Dict[Tuple[str, str, str], int] = {}
    fuel_cost_per_voyage: Dict[Tuple[str, str, str], float] = {}
    port_cost_per_voyage: Dict[Tuple[str, str, str], float] = {}

    for r_entry in rcfg["routes"]:
        orig = r_entry["origin_port"]
        dest = r_entry["destination_port"]
        dist = float(r_entry["distance_nm"])
        load_days = float(ports_info[orig].get("load_days", 3.5))
        discharge_days = float(ports_info[dest].get("discharge_days", 3.5))
        port_costs = float(ports_info[orig].get("port_cost_usd", 70000.0)) + float(
            ports_info[dest].get("port_cost_usd", 80000.0)
        )

        for v in r_entry.get("eligible_vessel_classes", []):
            route_triple = (orig, dest, v)
            feasible_routes.append(route_triple)

            vc_spec = rcfg["vessel_classes"][v]
            speed = float(vc_spec.get("speed_knots_laden", 13.0))
            sea_days = 2.0 * (dist / (speed * 24.0))  # Round trip laden + ballast
            port_days = load_days + discharge_days
            rt_days = round(sea_days + port_days, 1)
            round_trip_days[route_triple] = rt_days

            # Lead time in integer months (ceiling)
            lt_months = max(1, int(math.ceil(dist / (speed * 24.0 * 30.0))))
            lead_times[route_triple] = lt_months

            # Fuel consumption
            fuel_sea = sea_days * float(vc_spec.get("fuel_consumption_tpd", 30.0))
            fuel_port = port_days * float(vc_spec.get("fuel_consumption_port_tpd", 4.0))
            total_fuel_mt = fuel_sea + fuel_port
            fuel_cost_per_voyage[route_triple] = round(total_fuel_mt * vlsfo_price_usd_per_mt, 2)
            port_cost_per_voyage[route_triple] = port_costs

    origins = sorted(list(set(r[0] for r in feasible_routes)))

    # Cargo-origin eligibility mapping
    origin_cargo_eligibility = {
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

    # Demand and port shares
    demand_monthly_cfg = icfg["demand_per_month"]
    demand: Dict[Tuple[str, int], float] = {
        (c, t): float(demand_monthly_cfg[c]) for c in cargoes for t in months
    }

    port_demand_shares: Dict[Tuple[str, str], float] = {}
    for c in cargoes:
        shares = icfg["port_demand_shares"][c]
        for p in dest_ports:
            port_demand_shares[(c, p)] = float(shares.get(p, 0.0))

    # FOB prices & quality penalties
    fob_price: Dict[Tuple[str, str, int], float] = {}
    quality_penalty: Dict[Tuple[str, str], float] = {}
    for c in cargoes:
        fob_cfg = icfg["fob_prices"][c]
        qpen_cfg = icfg["quality_penalties"][c]
        for o in origin_cargo_eligibility[c]:
            quality_penalty[(c, o)] = float(qpen_cfg.get(o, 0.0))
            base_p = float(fob_cfg.get(o, 200.0))
            for t in months:
                fob_price[(c, o, t)] = base_p

    # Supplier monthly capacity
    supplier_capacity: Dict[Tuple[str, str, int], float] = {}
    for c in cargoes:
        sup_cfg = icfg["supplier_capacity_per_month"][c]
        for o in origin_cargo_eligibility[c]:
            cap_val = float(sup_cfg.get(o, 500000.0))
            for t in months:
                supplier_capacity[(o, c, t)] = cap_val

    # Berth capacity
    berth_cfg = icfg["berth_capacity_per_month"]
    berth_capacity: Dict[Tuple[str, int], float] = {
        (p, t): float(berth_cfg.get(p, 600000.0)) for p in dest_ports for t in months
    }

    # Inventory capacities and costs
    inv_cap_val = float(icfg.get("inventory_capacity_per_port", 800000.0))
    inventory_capacity: Dict[Tuple[str, str], float] = {
        (c, p): inv_cap_val for c in cargoes for p in dest_ports
    }
    inv_holding_cfg = icfg["inventory_holding_cost_usd_per_mt"]
    inventory_cost = {c: float(inv_holding_cfg.get(c, 2.0)) for c in cargoes}

    # Initial inventory (30 days demand) & terminal floor
    initial_inventory: Dict[Tuple[str, str], float] = {}
    terminal_inventory_min: Dict[Tuple[str, str], float] = {}
    in_transit: Dict[Tuple[str, str, int], float] = {}

    for c in cargoes:
        for p in dest_ports:
            monthly_port_demand = port_demand_shares[(c, p)] * demand[(c, 1)]
            # 30 days initial buffer
            initial_inventory[(c, p)] = round(monthly_port_demand * (30.0 / 30.5), 1)
            # 30 days terminal buffer
            terminal_inventory_min[(c, p)] = round(monthly_port_demand * (30.0 / 30.5), 1)
            # In-transit steady-state pipeline arrivals for initial lead time window
            for t in months:
                if t <= 2:
                    in_transit[(c, p, t)] = round(monthly_port_demand, 1)
                else:
                    in_transit[(c, p, t)] = 0.0

    # Spot & period voyage costs across scenarios
    spot_voyage_cost: Dict[Tuple[str, str, str, int, str], float] = {}
    period_voyage_cost: Dict[Tuple[str, str, str, int, str], float] = {}

    for (o, p, v) in feasible_routes:
        rt_days = round_trip_days[(o, p, v)]
        fuel_cost = fuel_cost_per_voyage[(o, p, v)]
        port_cost = port_cost_per_voyage[(o, p, v)]
        h_factor = hire_factors[v]

        for t in months:
            for s in scenarios:
                bdi_val = bdi_curves[s][t]
                hire_daily = bdi_val * h_factor
                spot_vc = hire_daily * rt_days + fuel_cost + port_cost
                period_vc = fuel_cost + port_cost  # Hire paid in vessel pool Z_period

                spot_voyage_cost[(o, p, v, t, s)] = round(spot_vc, 2)
                period_voyage_cost[(o, p, v, t, s)] = round(period_vc, 2)

    # Period charter hire rate (trailing 12-week average)
    period_hire_rate: Dict[Tuple[str, int], float] = {}
    for v in vessel_classes:
        h_factor = hire_factors[v]
        for t in months:
            period_hire_rate[(v, t)] = round(
                compute_trailing_hire_rate(v, h_factor, t, bdi_curves["base"], master_path), 2
            )

    # COA rates (trailing 12-week average per-tonne voyage cost)
    coa_rate: Dict[Tuple[str, str, str], float] = {}
    coa_min_vol_val = float(icfg.get("coa", {}).get("min_volume_mt", 300000.0))
    coa_min_volume: Dict[Tuple[str, str, str], float] = {
        r: coa_min_vol_val for r in feasible_routes
    }

    for (o, p, v) in feasible_routes:
        p_size = parcel_sizes[v]
        # Base scenario average voyage cost across first 3 months
        avg_vc = sum(spot_voyage_cost[(o, p, v, t, "base")] for t in [1, 2, 3]) / 3.0
        coa_discount = float(icfg.get("coa", {}).get("discount_rate", 0.0))
        coa_rate[(o, p, v)] = round((avg_vc / p_size) * (1.0 - coa_discount), 2)

    period_min_dur = {v: int(icfg.get("period_charter", {}).get("min_duration_months", 3)) for v in vessel_classes}

    dem_rate = float(icfg.get("demurrage", {}).get("rate_usd_per_day", 18000.0))
    delay_days = float(icfg.get("demurrage", {}).get("expected_delay_days", 1.5))
    expected_delay_days: Dict[Tuple[str, str, str], float] = {r: delay_days for r in feasible_routes}

    return {
        "cargoes": cargoes,
        "origins": origins,
        "ports": dest_ports,
        "vessel_classes": vessel_classes,
        "months": months,
        "modes": ["spot", "COA", "period"],
        "scenarios": scenarios,
        "scenario_weights": scenario_weights,
        "routes": feasible_routes,
        "origin_cargo_eligibility": origin_cargo_eligibility,
        "demand": demand,
        "port_demand_shares": port_demand_shares,
        "parcel_size": parcel_sizes,
        "lead_time": lead_times,
        "round_trip_days": round_trip_days,
        "fob_price": fob_price,
        "quality_penalty": quality_penalty,
        "supplier_capacity": supplier_capacity,
        "berth_capacity": berth_capacity,
        "inventory_capacity": inventory_capacity,
        "inventory_cost": inventory_cost,
        "initial_inventory": initial_inventory,
        "terminal_inventory_min": terminal_inventory_min,
        "in_transit": in_transit,
        "spot_voyage_cost": spot_voyage_cost,
        "period_voyage_cost": period_voyage_cost,
        "period_hire_rate": period_hire_rate,
        "period_min_duration": period_min_dur,
        "coa_rate": coa_rate,
        "coa_min_volume": coa_min_volume,
        "demurrage_rate": dem_rate,
        "expected_delay_days": expected_delay_days,
        "bdi_scenarios": bdi_curves,
    }
