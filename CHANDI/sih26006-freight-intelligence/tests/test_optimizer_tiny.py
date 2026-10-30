"""Tests for Maritime Raw-Material Shipping Procurement Optimizer (MILP).

Includes:
1. Hand-verifiable toy case with exact analytical solution.
2. Variation 1: Raise Origin A freight -> Origin B wins.
3. Variation 2: Cap Origin A supplier capacity -> Demand splits across A and B.
4. Variation 3: Freight spike in month 3 -> Pre-ship earlier and hold inventory.
5. Variation 4: Period charter priced at trailing average -> Chosen only when high scenario is weighted enough.
6. Variation 5: Impossible demand -> Positive unmet demand and heavy penalty.
"""

import copy
import time
from typing import Any, Dict

import pytest

from src.optimizer.model import build_and_solve_optimizer


def get_base_toy_parameters() -> Dict[str, Any]:
    """Base parameter dictionary for the hand-verifiable toy case.

    Setup:
    - 1 cargo: coking_coal
    - 2 origins: origin_A, origin_B
    - 1 port: port_1
    - 2 vessel classes: small (30,000 t) and large (60,000 t)
    - 4 months: 1, 2, 3, 4
    - Lead time: 1 month for all origins and vessel classes
    - Demand: 60,000 t per month (t=1, 2, 3, 4)
    - In-transit arriving month 1: 60,000 t (satisfies month 1 demand)
    - FOB price: origin_A = $100/t, origin_B = $115/t
    - Spot voyage cost for large (60,000 t):
        origin_A = $600,000 ($10/t freight) -> Landed cost = $110/t
        origin_B = $480,000 ($8/t freight)  -> Landed cost = $123/t
    - Spot voyage cost for small (30,000 t):
        origin_A = $450,000 ($15/t freight) -> Landed cost = $115/t
        origin_B = $360,000 ($12/t freight) -> Landed cost = $127/t
    """
    return {
        "cargoes": ["coking_coal"],
        "origins": ["origin_A", "origin_B"],
        "ports": ["port_1"],
        "vessel_classes": ["small", "large"],
        "months": [1, 2, 3, 4],
        "modes": ["spot"],
        "scenarios": ["base"],
        "routes": [
            ("origin_A", "port_1", "small"),
            ("origin_A", "port_1", "large"),
            ("origin_B", "port_1", "small"),
            ("origin_B", "port_1", "large"),
        ],
        "origin_cargo_eligibility": {"coking_coal": ["origin_A", "origin_B"]},
        "demand": {("coking_coal", t): 60000.0 for t in [1, 2, 3, 4]},
        "port_demand_shares": {("coking_coal", "port_1"): 1.0},
        "parcel_size": {"small": 30000.0, "large": 60000.0},
        "lead_time": {
            ("origin_A", "port_1", "small"): 1,
            ("origin_A", "port_1", "large"): 1,
            ("origin_B", "port_1", "small"): 1,
            ("origin_B", "port_1", "large"): 1,
        },
        "round_trip_days": {
            ("origin_A", "port_1", "small"): 25.0,
            ("origin_A", "port_1", "large"): 25.0,
            ("origin_B", "port_1", "small"): 18.0,
            ("origin_B", "port_1", "large"): 18.0,
        },
        "fob_price": {
            ("coking_coal", "origin_A", t): 100.0 for t in [1, 2, 3, 4]
        } | {
            ("coking_coal", "origin_B", t): 115.0 for t in [1, 2, 3, 4]
        },
        "spot_voyage_cost": {
            ("origin_A", "port_1", "large", t, "base"): 600000.0 for t in [1, 2, 3, 4]
        } | {
            ("origin_A", "port_1", "small", t, "base"): 450000.0 for t in [1, 2, 3, 4]
        } | {
            ("origin_B", "port_1", "large", t, "base"): 480000.0 for t in [1, 2, 3, 4]
        } | {
            ("origin_B", "port_1", "small", t, "base"): 360000.0 for t in [1, 2, 3, 4]
        },
        "in_transit": {("coking_coal", "port_1", 1): 60000.0},
        "initial_inventory": {("coking_coal", "port_1"): 0.0},
        "terminal_inventory_min": {("coking_coal", "port_1"): 0.0},
        "inventory_cost": {"coking_coal": 2.0},
        "demurrage_rate": 18000.0,
        "expected_delay_days": {
            ("origin_A", "port_1", "small"): 0.0,
            ("origin_A", "port_1", "large"): 0.0,
            ("origin_B", "port_1", "small"): 0.0,
            ("origin_B", "port_1", "large"): 0.0,
        },
        "scenario_weights": {"base": 1.0},
        "objective_type": "base",
    }


def test_tiny_baseline_hand_computed():
    """Verify hand-computed optimal plan and cost on the toy baseline.

    ===========================================================================
    HAND-COMPUTED OPTIMAL PLAN & COST:
    ===========================================================================
    1. Demand: 60,000 t in each month t in {1, 2, 3, 4}.
    2. Month 1: in_transit = 60,000 t satisfies month 1 demand exactly (inventory = 0).
    3. Lead time = 1 month for all routes:
       - Shipments departing month 1 arrive in month 2.
       - Shipments departing month 2 arrive in month 3.
       - Shipments departing month 3 arrive in month 4.
       - Shipments departing month 4 would arrive in month 5 (beyond horizon T=4).
         Since terminal_inventory_min = 0, optimal departure in month 4 is 0 tonnes.
    4. Sourcing unit landed cost comparison:
       - Origin A (large): FOB $100 + Freight ($600,000 / 60,000 = $10) = $110/t
       - Origin A (small): FOB $100 + Freight ($450,000 / 30,000 = $15) = $115/t
       - Origin B (large): FOB $115 + Freight ($480,000 / 60,000 = $8)  = $123/t
       - Origin B (small): FOB $115 + Freight ($360,000 / 30,000 = $12) = $127/t
       -> Origin A with large vessel class is strictly optimal ($110/t).
    5. Optimal shipments:
       - Month 1: 60,000 t, 1 voyage of 'large' from Origin A (arrives Month 2)
       - Month 2: 60,000 t, 1 voyage of 'large' from Origin A (arrives Month 3)
       - Month 3: 60,000 t, 1 voyage of 'large' from Origin A (arrives Month 4)
       - Month 4: 0 t
       Total tonnes shipped: 3 x 60,000 = 180,000 tonnes.
    6. Optimal Cost Breakdown:
       - Cargo purchase cost: 180,000 t x $100/t = $18,000,000
       - Freight cost:        3 voyages x $600,000 = $1,800,000
       - Demurrage cost:      $0
       - Period hire cost:    $0
       - Inventory cost:      $0 (just-in-time arrivals, ending inventory = 0)
       - Unmet demand:        $0
       -----------------------------------------------------------------
       TOTAL OPTIMAL COST:    $19,800,000
    ===========================================================================
    """
    params = get_base_toy_parameters()

    t0 = time.perf_counter()
    res = build_and_solve_optimizer(params)
    solve_duration = time.perf_counter() - t0

    assert res["is_optimal"], f"Solver failed with status {res['status']}"
    assert res["objective_value"] == pytest.approx(19800000.0, rel=1e-5)

    cb = res["cost_breakdown"]
    assert cb["cargo"] == pytest.approx(18000000.0, rel=1e-5)
    assert cb["freight"] == pytest.approx(1800000.0, rel=1e-5)
    assert cb["period_hire"] == pytest.approx(0.0, abs=1e-5)
    assert cb["demurrage"] == pytest.approx(0.0, abs=1e-5)
    assert cb["inventory"] == pytest.approx(0.0, abs=1e-5)
    assert cb["unmet"] == pytest.approx(0.0, abs=1e-5)
    assert cb["total_mean"] == pytest.approx(19800000.0, rel=1e-5)

    # Verify shipments schedule
    shipments = res["plan"]["shipments"]
    assert len(shipments) == 3
    for s in shipments:
        assert s["origin"] == "origin_A"
        assert s["vessel_class"] == "large"
        assert s["mode"] == "spot"
        assert s["tonnes"] == pytest.approx(60000.0, rel=1e-5)
        assert s["voyages"] == 1
        assert s["month"] in [1, 2, 3]

    print(f"\n[test_tiny_baseline] Solved in {solve_duration * 1000:.2f} ms")


def test_variation_1_freight_increase_switches_origin():
    """Variation 1: Raise Origin A freight so Origin B becomes cheaper and wins."""
    params = get_base_toy_parameters()

    # Raise Origin A spot voyage cost on both vessel classes so Origin A is $130/t:
    # large: $1.8M / 60k = $30/t -> Landed = $100 + $30 = $130/t
    # small: $900k / 30k = $30/t -> Landed = $100 + $30 = $130/t
    # Landed cost Origin B (large): $115 FOB + $8 freight = $123/t.
    # Origin B now strictly wins by $7/t!
    for t in [1, 2, 3, 4]:
        params["spot_voyage_cost"][("origin_A", "port_1", "large", t, "base")] = 1800000.0
        params["spot_voyage_cost"][("origin_A", "port_1", "small", t, "base")] = 900000.0

    t0 = time.perf_counter()
    res = build_and_solve_optimizer(params)
    solve_duration = time.perf_counter() - t0

    assert res["is_optimal"]

    # Hand-computed cost for Origin B:
    # Cargo: 180,000 x $115 = $20,700,000
    # Freight: 3 x $480,000 = $1,440,000
    # Total = $22,140,000
    expected_total = 180000.0 * 115.0 + 3 * 480000.0
    assert res["objective_value"] == pytest.approx(expected_total, rel=1e-5)

    shipments = res["plan"]["shipments"]
    assert len(shipments) == 3
    for s in shipments:
        assert s["origin"] == "origin_B"
        assert s["vessel_class"] == "large"
        assert s["tonnes"] == pytest.approx(60000.0, rel=1e-5)
        assert s["voyages"] == 1

    print(f"[test_variation_1] Solved in {solve_duration * 1000:.2f} ms")


def test_variation_2_supplier_capacity_splits_demand():
    """Variation 2: Cap Origin A and Origin B capacity at 30k so demand splits across A and B."""
    params = get_base_toy_parameters()

    # Cap monthly supplier capacity at 30,000 t for both origins.
    # Since demand is 60,000 t/month, each origin must supply exactly 30,000 t.
    # Both must use the 30,000 t 'small' vessel class.
    params["supplier_capacity"] = {
        ("origin_A", "coking_coal", t): 30000.0 for t in [1, 2, 3, 4]
    } | {
        ("origin_B", "coking_coal", t): 30000.0 for t in [1, 2, 3, 4]
    }

    t0 = time.perf_counter()
    res = build_and_solve_optimizer(params)
    solve_duration = time.perf_counter() - t0

    assert res["is_optimal"]

    # Hand-computed cost per month for 3 departure months:
    # Origin A (small): 30,000 x $100 + $450,000 = $3,450,000
    # Origin B (small): 30,000 x $115 + $360,000 = $3,810,000
    # Monthly total = $7,260,000. Total for 3 months = $21,780,000.
    expected_total = 3 * (3450000.0 + 3810000.0)
    assert res["objective_value"] == pytest.approx(expected_total, rel=1e-5)

    shipments = res["plan"]["shipments"]
    assert len(shipments) == 6  # 3 departure months x 2 origins

    for t in [1, 2, 3]:
        a_ship = [s for s in shipments if s["origin"] == "origin_A" and s["month"] == t]
        b_ship = [s for s in shipments if s["origin"] == "origin_B" and s["month"] == t]
        assert len(a_ship) == 1
        assert len(b_ship) == 1
        assert a_ship[0]["tonnes"] == pytest.approx(30000.0, rel=1e-5)
        assert b_ship[0]["tonnes"] == pytest.approx(30000.0, rel=1e-5)
        assert a_ship[0]["vessel_class"] == "small"
        assert b_ship[0]["vessel_class"] == "small"

    print(f"[test_variation_2] Solved in {solve_duration * 1000:.2f} ms")


def test_variation_3_freight_spike_triggers_inventory_arbitrage():
    """Variation 3: Add a freight spike in month 2 and verify pre-shipping + inventory holding."""
    params = get_base_toy_parameters()

    # Freight for departure in month 2 (which arrives in month 3) spikes to $3,000,000 (+$2.4M).
    # Holding inventory costs $2/tonne/month.
    # Pre-shipping 120,000 t in month 1 costs $60,000 x $2 = $120,000 in inventory holding,
    # saving $2,400,000 - $120,000 = $2,280,000 net!
    params["spot_voyage_cost"][("origin_A", "port_1", "large", 2, "base")] = 3000000.0
    params["inventory_cost"] = {"coking_coal": 2.0}

    t0 = time.perf_counter()
    res = build_and_solve_optimizer(params)
    solve_duration = time.perf_counter() - t0

    assert res["is_optimal"]

    # Month 1 ships 120,000 t (2 voyages of large). Month 2 ships 0. Month 3 ships 60,000 t.
    shipments = res["plan"]["shipments"]
    m1_ship = [s for s in shipments if s["month"] == 1]
    m2_ship = [s for s in shipments if s["month"] == 2]
    m3_ship = [s for s in shipments if s["month"] == 3]

    assert sum(s["tonnes"] for s in m1_ship) == pytest.approx(120000.0, rel=1e-5)
    assert sum(s["voyages"] for s in m1_ship) == 2
    assert len(m2_ship) == 0  # Completely avoids month 2 spike!
    assert sum(s["tonnes"] for s in m3_ship) == pytest.approx(60000.0, rel=1e-5)

    # Check that 60,000 t inventory was held at end of month 2
    I_vals = res["plan"]["inventory"]
    assert I_vals[("coking_coal", "port_1", 2)] == pytest.approx(60000.0, rel=1e-5)

    # Hand-computed cost:
    # Cargo: 180,000 x $100 = $18,000,000
    # Freight: 3 x $600,000 = $1,800,000
    # Inventory holding: 60,000 t x $2 = $120,000
    # Total = $19,920,000
    assert res["objective_value"] == pytest.approx(19920000.0, rel=1e-5)
    assert res["cost_breakdown"]["inventory"] == pytest.approx(120000.0, rel=1e-5)

    print(f"[test_variation_3] Solved in {solve_duration * 1000:.2f} ms")


def test_variation_4_period_charter_selection_by_scenario_weight():
    """Variation 4: Period charter chosen only when high scenario is weighted enough."""
    params = get_base_toy_parameters()
    params["modes"] = ["spot", "period"]
    params["scenarios"] = ["base", "high"]
    params["vessel_classes"] = ["large"]
    params["routes"] = [("origin_A", "port_1", "large")]
    params["parcel_size"] = {"large": 60000.0}
    params["lead_time"] = {("origin_A", "port_1", "large"): 1}
    params["round_trip_days"] = {("origin_A", "port_1", "large"): 20.0}

    # Base scenario spot hire = $20,000/day (voyage days=20 -> VC = $400k)
    # High scenario spot hire = $60,000/day (voyage days=20 -> VC = $1,200k)
    # Period charter rate = $20,000/day (hire = $600k/month, variable = $100k -> total monthly = $700k)
    params["spot_voyage_cost"] = {
        ("origin_A", "port_1", "large", t, "base"): 400000.0 for t in [1, 2, 3, 4]
    } | {
        ("origin_A", "port_1", "large", t, "high"): 1200000.0 for t in [1, 2, 3, 4]
    }
    params["period_voyage_cost"] = {
        ("origin_A", "port_1", "large", t, s): 100000.0 for t in [1, 2, 3, 4] for s in ["base", "high"]
    }
    params["period_hire_rate"] = {("large", t): 20000.0 for t in [1, 2, 3, 4]}
    params["period_min_duration"] = {"large": 3}
    params["objective_type"] = "mean"

    # Case A: w_high = 0.0 (w_base = 1.0) -> Spot ($400k) beats Period ($700k)
    p_low = copy.deepcopy(params)
    p_low["scenario_weights"] = {"base": 1.0, "high": 0.0}

    t0 = time.perf_counter()
    res_low = build_and_solve_optimizer(p_low)
    dur_low = time.perf_counter() - t0

    assert res_low["is_optimal"]
    assert res_low["cost_breakdown"]["period_hire"] == pytest.approx(0.0, abs=1e-5)
    for s in res_low["plan"]["shipments"]:
        assert s["mode"] == "spot"
    for v_key, k_val in res_low["plan"]["k"].items():
        assert k_val == 0

    # Case B: w_high = 0.9 (w_base = 0.1)
    # Expected spot = 0.1 * 400k + 0.9 * 1.2M = $1,120k > Period ($700k)
    # Model should lock in 1 period-chartered vessel!
    p_high = copy.deepcopy(params)
    p_high["scenario_weights"] = {"base": 0.1, "high": 0.9}

    t0 = time.perf_counter()
    res_high = build_and_solve_optimizer(p_high)
    dur_high = time.perf_counter() - t0

    assert res_high["is_optimal"]
    assert res_high["cost_breakdown"]["period_hire"] > 0
    # Period vessels chartered for months 1, 2, 3
    assert res_high["plan"]["k"][("large", 1)] == 1
    assert res_high["plan"]["k"][("large", 2)] == 1
    assert res_high["plan"]["k"][("large", 3)] == 1
    for s in res_high["plan"]["shipments"]:
        assert s["mode"] == "period"

    print(f"[test_variation_4] Solved low in {dur_low * 1000:.2f} ms, high in {dur_high * 1000:.2f} ms")


def test_variation_5_unmet_demand_penalty():
    """Variation 5: Make demand impossible to meet and check unmet demand and penalty."""
    params = get_base_toy_parameters()

    # Month 1 demand is 100,000 t, but initial in_transit is only 60,000 t.
    # Since lead time is 1 month, no shipments can arrive in month 1.
    # Unmet demand in month 1 is strictly 40,000 t!
    params["demand"][("coking_coal", 1)] = 100000.0
    params["unmet_demand_penalty"] = {"coking_coal": 500.0}

    t0 = time.perf_counter()
    res = build_and_solve_optimizer(params)
    solve_duration = time.perf_counter() - t0

    assert res["is_optimal"]

    # Month 1 unmet demand must be exactly 40,000 t
    u_vals = res["plan"]["unmet_demand"]
    assert u_vals[("coking_coal", "port_1", 1)] == pytest.approx(40000.0, rel=1e-5)

    # Cost breakdown must reflect 40,000 t x $500/t = $20,000,000
    expected_unmet_cost = 40000.0 * 500.0
    assert res["cost_breakdown"]["unmet"] == pytest.approx(expected_unmet_cost, rel=1e-5)

    # Total objective must equal normal 3-month cost ($19.8M) + unmet penalty ($20M) = $39.8M
    assert res["objective_value"] == pytest.approx(19800000.0 + expected_unmet_cost, rel=1e-5)

    print(f"[test_variation_5] Solved in {solve_duration * 1000:.2f} ms")


def test_terminal_floor_constraint():
    """1. Terminal floor: assert ending inventory >= 30/30.5 * demand, and cost rises by cargo+freight+holding."""
    params = get_base_toy_parameters()

    # Base cost without terminal floor is $19,800,000.
    # Set 30-day floor: 30 / 30.5 * 60,000 ≈ 59,016.39 tonnes.
    floor_val = (30.0 / 30.5) * 60000.0
    params["terminal_inventory_min"] = {("coking_coal", "port_1"): floor_val}

    t0 = time.perf_counter()
    res = build_and_solve_optimizer(params)
    solve_duration = time.perf_counter() - t0

    assert res["is_optimal"]

    # Ending inventory in month 4 must satisfy floor
    ending_inv = res["plan"]["inventory"][("coking_coal", "port_1", 4)]
    assert ending_inv >= floor_val - 1e-5
    assert ending_inv == pytest.approx(floor_val, rel=1e-5)

    # To supply the terminal buffer at month 4, an additional shipment departed in month 3.
    # Hand-computed cost delta:
    # Extra cargo cost: 59,016.3934 t * $100/t = $5,901,639.34
    # Extra freight cost: 1 additional voyage of 'large' = $600,000.00
    # Extra inventory holding cost at m4: 59,016.3934 t * $2/t = $118,032.79
    # Total expected delta = $6,619,672.13
    expected_delta = floor_val * 100.0 + 600000.0 + floor_val * 2.0
    base_cost = 19800000.0
    assert res["objective_value"] == pytest.approx(base_cost + expected_delta, rel=1e-5)

    print(f"[test_terminal_floor] Solved in {solve_duration * 1000:.2f} ms")


def test_two_cargoes_no_coloading():
    """2. Two cargoes (coking and thermal coal): assert each cargo's tonnes <= voyages * parcel and no co-loading."""
    params = get_base_toy_parameters()
    params["cargoes"] = ["coking_coal", "thermal_coal"]
    params["origins"] = ["origin_A"]
    params["vessel_classes"] = ["large"]  # 60,000 t
    params["routes"] = [("origin_A", "port_1", "large")]
    params["origin_cargo_eligibility"] = {
        "coking_coal": ["origin_A"],
        "thermal_coal": ["origin_A"],
    }
    # Monthly demand: 40k coking coal, 20k thermal coal
    # Together they sum to 60k, but a vessel class can NEVER co-load them!
    params["demand"] = {
        ("coking_coal", t): 40000.0 for t in [1, 2, 3, 4]
    } | {
        ("thermal_coal", t): 20000.0 for t in [1, 2, 3, 4]
    }
    params["port_demand_shares"] = {
        ("coking_coal", "port_1"): 1.0,
        ("thermal_coal", "port_1"): 1.0,
    }
    params["fob_price"] = {
        ("coking_coal", "origin_A", t): 100.0 for t in [1, 2, 3, 4]
    } | {
        ("thermal_coal", "origin_A", t): 70.0 for t in [1, 2, 3, 4]
    }
    params["spot_voyage_cost"] = {
        ("origin_A", "port_1", "large", t, "base"): 600000.0 for t in [1, 2, 3, 4]
    }
    params["lead_time"] = {("origin_A", "port_1", "large"): 1}
    params["in_transit"] = {
        ("coking_coal", "port_1", 1): 40000.0,
        ("thermal_coal", "port_1", 1): 20000.0,
    }

    t0 = time.perf_counter()
    res = build_and_solve_optimizer(params)
    solve_duration = time.perf_counter() - t0

    assert res["is_optimal"]

    # Check parcel constraint strictly per cargo: x[m, c, o, p, v, t] <= Q_v * n[m, c, o, p, v, t]
    x_dict = res["plan"]["x"]
    n_dict = res["plan"]["n"]
    parcel_q = params["parcel_size"]["large"]

    for (m, c, o, p, v, t), tonnes in x_dict.items():
        voyages = n_dict[(m, c, o, p, v, t)]
        assert tonnes <= voyages * parcel_q + 1e-5

    # Total coking needed for months 2, 3, 4 = 120,000 t -> exactly 2 voyages of 60k
    # Total thermal needed for months 2, 3, 4 = 60,000 t  -> exactly 1 voyage of 60k
    # Since co-loading is disallowed, total voyages = 3 (not 2!)
    total_coking_voyages = sum(
        n_dict[("spot", "coking_coal", "origin_A", "port_1", "large", t)] for t in [1, 2, 3, 4]
    )
    total_thermal_voyages = sum(
        n_dict[("spot", "thermal_coal", "origin_A", "port_1", "large", t)] for t in [1, 2, 3, 4]
    )

    assert total_coking_voyages == 2
    assert total_thermal_voyages == 1

    print(f"[test_two_cargoes_no_coloading] Solved in {solve_duration * 1000:.2f} ms")


def test_period_minimum_duration():
    """3. Period minimum duration: if chartered in month 2, stays for full 3 months or avoids if cost is higher."""
    params = get_base_toy_parameters()
    params["modes"] = ["spot", "period"]
    params["vessel_classes"] = ["large"]
    params["routes"] = [("origin_A", "port_1", "large")]
    params["round_trip_days"] = {("origin_A", "port_1", "large"): 20.0}
    params["period_voyage_cost"] = {
        ("origin_A", "port_1", "large", t, "base"): 200000.0 for t in [1, 2, 3, 4]
    }
    params["period_hire_rate"] = {("large", t): 20000.0 for t in [1, 2, 3, 4]}  # $600k/mo
    params["period_min_duration"] = {"large": 3}
    params["inventory_capacity"] = {("coking_coal", "port_1"): 0.0}  # No inventory buffering

    # Baseline spot cost in months 1, 3, 4 is $200k (equal to period variable cost)
    params["spot_voyage_cost"] = {
        ("origin_A", "port_1", "large", t, "base"): 200000.0 for t in [1, 2, 3, 4]
    }

    # Case A: Month 2 spot spike is moderate ($1,000,000).
    # 3-month period hire commitment is 3 * $600k = $1.8M > $1.0M spike!
    # The model avoids period charter (k = 0).
    p_avoid = copy.deepcopy(params)
    p_avoid["spot_voyage_cost"][("origin_A", "port_1", "large", 2, "base")] = 1000000.0
    res_avoid = build_and_solve_optimizer(p_avoid)

    assert res_avoid["is_optimal"]
    assert all(k == 0 for k in res_avoid["plan"]["k"].values())
    assert all(s["mode"] == "spot" for s in res_avoid["plan"]["shipments"])

    # Case B: Month 2 spot spike is huge ($5,000,000).
    # Model charters in month 2; due to min duration (3 months), k must remain 1 for months 2, 3, 4!
    p_commit = copy.deepcopy(params)
    p_commit["spot_voyage_cost"][("origin_A", "port_1", "large", 2, "base")] = 5000000.0
    res_commit = build_and_solve_optimizer(p_commit)

    assert res_commit["is_optimal"]
    k_plan = res_commit["plan"]["k"]
    assert k_plan[("large", 1)] == 0
    assert k_plan[("large", 2)] == 1
    assert k_plan[("large", 3)] == 1
    assert k_plan[("large", 4)] == 1  # Stays chartered for full 3 months!

    print(f"[test_period_minimum_duration] Passed both avoid and 3-month commitment cases")


def test_period_charter_no_free_lunch_flat_forecast():
    """4. Period charter at default scenario weights with flat forecast & no discount picks spot."""
    params = get_base_toy_parameters()
    params["modes"] = ["spot", "period"]
    params["scenarios"] = ["low", "base", "high"]
    params["scenario_weights"] = {"low": 0.25, "base": 0.50, "high": 0.25}
    params["vessel_classes"] = ["large"]
    params["routes"] = [("origin_A", "port_1", "large")]
    params["round_trip_days"] = {("origin_A", "port_1", "large"): 20.0}

    # Flat / symmetric spot rates across scenarios (mean = $400k)
    params["spot_voyage_cost"] = {
        ("origin_A", "port_1", "large", t, "low"): 360000.0 for t in [1, 2, 3, 4]
    } | {
        ("origin_A", "port_1", "large", t, "base"): 400000.0 for t in [1, 2, 3, 4]
    } | {
        ("origin_A", "port_1", "large", t, "high"): 440000.0 for t in [1, 2, 3, 4]
    }
    # Period charter hire = $20k/day ($600k/mo) + variable voyage cost ($100k) = $700k/month
    # Expected spot cost = $400k < Period cost $700k
    params["period_voyage_cost"] = {
        ("origin_A", "port_1", "large", t, s): 100000.0 for t in [1, 2, 3, 4] for s in ["low", "base", "high"]
    }
    params["period_hire_rate"] = {("large", t): 20000.0 for t in [1, 2, 3, 4]}
    params["period_min_duration"] = {"large": 3}
    params["objective_type"] = "mean"

    t0 = time.perf_counter()
    res = build_and_solve_optimizer(params)
    solve_duration = time.perf_counter() - t0

    assert res["is_optimal"]
    assert res["cost_breakdown"]["period_hire"] == pytest.approx(0.0, abs=1e-5)
    assert all(k == 0 for k in res["plan"]["k"].values())
    for s in res["plan"]["shipments"]:
        assert s["mode"] == "spot"

    print(f"[test_period_charter_no_free_lunch] Solved in {solve_duration * 1000:.2f} ms")


def test_coa_minimum_volume():
    """5. COA minimum volume: COA is used only if minimum volume is met; psi=0 if demand is too low."""
    params = get_base_toy_parameters()
    params["modes"] = ["spot", "COA"]
    params["vessel_classes"] = ["large"]
    params["routes"] = [("origin_A", "port_1", "large")]
    # COA rate = $8/t (cheaper than spot $10/t), but minimum volume = 200,000 tonnes
    params["coa_rate"] = {("origin_A", "port_1", "large"): 8.0}
    params["coa_min_volume"] = {("origin_A", "port_1", "large"): 200000.0}

    # Case A: Demand is 60k/mo for months 2, 3, 4 -> 180k total shipments < 200k minimum.
    # Model cannot meet minimum volume without over-procuring -> psi=0, uses spot.
    p_low = copy.deepcopy(params)
    res_low = build_and_solve_optimizer(p_low)

    assert res_low["is_optimal"]
    assert res_low["plan"]["psi"][("origin_A", "port_1", "large")] is False
    assert all(s["mode"] == "spot" for s in res_low["plan"]["shipments"])

    # Case B: Demand is 80k/mo (total shipments = 240k >= 200k minimum).
    # Model meets minimum volume and takes COA discount -> psi=1, uses COA.
    p_high = copy.deepcopy(params)
    p_high["demand"] = {("coking_coal", t): 80000.0 for t in [1, 2, 3, 4]}
    p_high["in_transit"] = {("coking_coal", "port_1", 1): 80000.0}
    res_high = build_and_solve_optimizer(p_high)

    assert res_high["is_optimal"]
    assert res_high["plan"]["psi"][("origin_A", "port_1", "large")] is True
    assert all(s["mode"] == "COA" for s in res_high["plan"]["shipments"])

    print(f"[test_coa_minimum_volume] Passed both sub-volume (psi=0) and eligible-volume (psi=1) cases")


def test_berth_capacity_spreads_or_unmet():
    """6. Berth capacity: set port capacity below demand; assert plan spreads arrivals or reports unmet demand."""
    params = get_base_toy_parameters()
    # Set berth capacity at port_1 in month 2 to 30,000 t (demand is 60,000 t)
    params["berth_capacity"] = {("port_1", 2): 30000.0}

    # Case A: No pre-existing buffer stock. Month 2 arrivals cannot exceed 30k -> 30k unmet demand!
    res_a = build_and_solve_optimizer(params)
    assert res_a["is_optimal"]
    assert res_a["plan"]["unmet_demand"][("coking_coal", "port_1", 2)] == pytest.approx(30000.0, rel=1e-5)
    month_1_departures = sum(s["tonnes"] for s in res_a["plan"]["shipments"] if s["month"] == 1)
    assert month_1_departures <= 30000.0 + 1e-5

    # Case B: In-transit month 1 has 90k (extra 30k buffer). Plan spreads arrival and meets demand with 0 unmet!
    p_spread = copy.deepcopy(params)
    p_spread["in_transit"] = {("coking_coal", "port_1", 1): 90000.0}
    res_b = build_and_solve_optimizer(p_spread)

    assert res_b["is_optimal"]
    assert res_b["plan"]["unmet_demand"][("coking_coal", "port_1", 2)] == pytest.approx(0.0, abs=1e-5)
    assert res_b["plan"]["inventory"][("coking_coal", "port_1", 1)] == pytest.approx(30000.0, rel=1e-5)

    print(f"[test_berth_capacity] Passed bottleneck unmet demand and pre-buffer spreading cases")


def test_minimax_worst_case_hedging():
    """7. Minimax objective: assert worst-case cost of minimax plan <= worst-case cost of mean plan."""
    params = get_base_toy_parameters()
    params["scenarios"] = ["low", "base", "high"]
    params["scenario_weights"] = {"low": 0.70, "base": 0.20, "high": 0.10}

    # Origin A: cheap in low ($200k) and base ($400k), but huge spike in high ($3,000,000)
    # Origin B: stable, moderately priced at $600k across all scenarios
    # Mean weights favor low/base -> Mean plan picks Origin A.
    # Minimax minimizes max_s Z(s) -> Minimax plan hedges by picking Origin B!
    params["spot_voyage_cost"] = {
        ("origin_A", "port_1", "large", t, "low"): 200000.0 for t in [1, 2, 3, 4]
    } | {
        ("origin_A", "port_1", "large", t, "base"): 400000.0 for t in [1, 2, 3, 4]
    } | {
        ("origin_A", "port_1", "large", t, "high"): 3000000.0 for t in [1, 2, 3, 4]
    } | {
        ("origin_B", "port_1", "large", t, s): 600000.0 for t in [1, 2, 3, 4] for s in ["low", "base", "high"]
    } | {
        ("origin_A", "port_1", "small", t, s): 9999999.0 for t in [1, 2, 3, 4] for s in ["low", "base", "high"]
    } | {
        ("origin_B", "port_1", "small", t, s): 9999999.0 for t in [1, 2, 3, 4] for s in ["low", "base", "high"]
    }
    params["fob_price"] = {
        ("coking_coal", "origin_A", t): 100.0 for t in [1, 2, 3, 4]
    } | {
        ("coking_coal", "origin_B", t): 100.0 for t in [1, 2, 3, 4]
    }

    # 1. Mean objective solve
    p_mean = copy.deepcopy(params)
    p_mean["objective_type"] = "mean"
    res_mean = build_and_solve_optimizer(p_mean)
    worst_case_mean = max(res_mean["cost_breakdown"]["total_by_scenario"].values())

    # 2. Minimax objective solve
    p_minimax = copy.deepcopy(params)
    p_minimax["objective_type"] = "minimax"
    res_minimax = build_and_solve_optimizer(p_minimax)
    worst_case_minimax = max(res_minimax["cost_breakdown"]["total_by_scenario"].values())

    # Assert minimax worst-case is strictly less than or equal to mean plan's worst-case
    assert worst_case_minimax <= worst_case_mean + 1e-4

    # Specifically verify the risk-hedging mechanism:
    # Mean plan exposed to high spike: worst-case = $27,000,000
    # Minimax hedged plan: worst-case = $19,800,000
    assert worst_case_mean == pytest.approx(27000000.0, rel=1e-5)
    assert worst_case_minimax == pytest.approx(19800000.0, rel=1e-5)
    assert worst_case_mean - worst_case_minimax == pytest.approx(7200000.0, rel=1e-5)

    print(f"[test_minimax_worst_case] Minimax reduced worst-case scenario cost by $7,200,000")

