"""MILP Formulation and Solver for Steel Plant Bulk Shipping Procurement.

Implements the multi-scenario, rolling-horizon procurement optimizer defined in
docs/optimizer_formulation.md using PuLP (supporting bundled CBC and HiGHS).
"""

from __future__ import annotations

import math
import time
from typing import Any, Dict, List, Optional, Tuple

import pulp


def _make_var(
    prob: pulp.LpProblem,
    name: str,
    lowBound: Optional[float] = 0.0,
    upBound: Optional[float] = None,
    cat: str = pulp.LpContinuous,
) -> pulp.LpVariable:
    """Create variable compatible with PuLP 2.x/3.x and PuLP 4.x."""
    if hasattr(prob, "add_variable"):
        return prob.add_variable(name, lowBound=lowBound, upBound=upBound, cat=cat)
    return pulp.LpVariable(name, lowBound=lowBound, upBound=upBound, cat=cat)


def get_available_solver(
    time_limit_sec: Optional[int] = None,
    mip_gap: Optional[float] = None,
    msg: bool = False,
):
    """Detect and instantiate the best available solver (HiGHS or CBC)."""
    available = pulp.listSolvers(onlyAvailable=True)
    highs_kwargs = {"msg": msg}
    if time_limit_sec is not None:
        highs_kwargs["timeLimit"] = time_limit_sec
    if mip_gap is not None:
        highs_kwargs["gapRel"] = mip_gap

    if hasattr(pulp, "HiGHS") and "HiGHS" in available:
        return pulp.HiGHS(**highs_kwargs)
    if hasattr(pulp, "PULP_CBC_CMD") and "PULP_CBC_CMD" in available:
        cbc_kwargs = {"msg": msg}
        if time_limit_sec is not None:
            cbc_kwargs["timeLimit"] = time_limit_sec
        if mip_gap is not None:
            cbc_kwargs["gapRel"] = mip_gap
        return pulp.PULP_CBC_CMD(**cbc_kwargs)
    if hasattr(pulp, "HiGHS_CMD") and "HiGHS_CMD" in available:
        return pulp.HiGHS_CMD(**highs_kwargs)
    if hasattr(pulp, "HiGHS"):
        return pulp.HiGHS(**highs_kwargs)
    return None


def build_optimizer_model(params: Dict[str, Any]) -> Tuple[pulp.LpProblem, Dict[str, Any]]:
    """Build the PuLP MILP problem from parameters dictionary.

    Args:
        params: Dictionary containing sets, parameters, and configuration as
                specified in docs/optimizer_formulation.md.

    Returns:
        (prob, var_dict)
    """
    # -------------------------------------------------------------------------
    # 1. Sets
    # -------------------------------------------------------------------------
    cargoes: List[str] = list(params["cargoes"])
    origins: List[str] = list(params["origins"])
    ports: List[str] = list(params["ports"])
    vessel_classes: List[str] = list(params["vessel_classes"])
    months: List[int] = sorted(params["months"])
    modes: List[str] = list(params.get("modes", ["spot", "COA", "period"]))
    scenarios: List[str] = list(params.get("scenarios", ["base"]))

    routes: List[Tuple[str, str, str]] = [tuple(r) for r in params["routes"]]  # (o, p, v)
    eligibility: Dict[str, List[str]] = params.get(
        "origin_cargo_eligibility", {c: origins for c in cargoes}
    )

    # -------------------------------------------------------------------------
    # 2. Parameters & Defaults
    # -------------------------------------------------------------------------
    demand = params["demand"]  # (c, t) -> tonnes
    num_ports = len(ports)
    port_shares = params.get("port_demand_shares", {})  # (c, p) -> [0, 1]
    parcel_size = params["parcel_size"]  # v -> tonnes
    lead_time = params.get("lead_time", {})  # (o, p, v) -> int (months)
    round_trip_days = params.get("round_trip_days", {})  # (o, p, v) -> float

    fob_price = params["fob_price"]  # (c, o, t) -> USD/t
    quality_penalty = params.get("quality_penalty", {})  # (c, o) -> USD/t
    supcap = params.get("supplier_capacity", {})  # (o, c, t) -> tonnes (or inf)

    # Voyage costs
    spot_vc = params.get("spot_voyage_cost", {})  # (o, p, v, t, s) -> USD
    period_vc = params.get("period_voyage_cost", {})  # (o, p, v, t, s) -> USD
    coa_rate = params.get("coa_rate", {})  # (o, p, v) -> USD/tonne
    coa_min_vol = params.get("coa_min_volume", {})  # (o, p, v) -> tonnes

    # Period hire & fleet
    period_hire = params.get("period_hire_rate", {})  # (v, t) -> USD/day
    period_min_dur = params.get("period_min_duration", {v: 3 for v in vessel_classes})

    # Inventory & Risk
    inv_cost = params.get("inventory_cost", {c: 0.0 for c in cargoes})  # c -> USD/t/month
    inv_cap = params.get("inventory_capacity", {})  # (c, p) -> tonnes
    initial_inv = params.get("initial_inventory", {})  # (c, p) -> tonnes
    terminal_min = params.get("terminal_inventory_min", {})  # (c, p) -> tonnes
    in_transit = params.get("in_transit", {})  # (c, p, t) -> tonnes
    berth_cap = params.get("berth_capacity", {})  # (p, t) -> tonnes

    dem_rate = float(params.get("demurrage_rate", 18000.0))
    delay_days = params.get("expected_delay_days", {})  # (o, p, v) -> days

    # Scenario Weights & Objective Type
    scenario_weights = params.get("scenario_weights", {s: 1.0 / len(scenarios) for s in scenarios})
    obj_type = params.get("objective_type", "mean").lower()  # 'base', 'mean', 'minimax'

    # Unmet demand penalty
    unmet_pen = params.get("unmet_demand_penalty", {})
    if not unmet_pen:
        # Compute formula: 3 * max(price + qpen + freight)
        unmet_pen = {}
        for c in cargoes:
            max_landed = 0.0
            for o in eligibility.get(c, []):
                for t in months:
                    p_val = fob_price.get((c, o, t), 100.0)
                    qp_val = quality_penalty.get((c, o), 0.0)
                    for (ro, rp, rv) in routes:
                        if ro == o:
                            for s in scenarios:
                                svc = spot_vc.get((ro, rp, rv, t, s), 0.0)
                                fr = svc / max(parcel_size.get(rv, 1.0), 1.0)
                                landed = p_val + qp_val + fr
                                if landed > max_landed:
                                    max_landed = landed
            unmet_pen[c] = max(3.0 * max_landed, 500.0)

    # -------------------------------------------------------------------------
    # 3. Create Problem & Decision Variables
    # -------------------------------------------------------------------------
    prob = pulp.LpProblem("MaritimeProcurementOptimizer", pulp.LpMinimize)

    # x[m, c, o, p, v, t]: Tonnes shipped
    x_vars: Dict[Tuple[str, str, str, str, str, int], pulp.LpVariable] = {}
    # n[m, c, o, p, v, t]: Integer voyage count
    n_vars: Dict[Tuple[str, str, str, str, str, int], pulp.LpVariable] = {}

    for m in modes:
        for c in cargoes:
            for (o, p, v) in routes:
                if o in eligibility.get(c, []):
                    for t in months:
                        var_key = (m, c, o, p, v, t)
                        tag = f"x_{m}_{c}_{o}_{p}_{v}_m{t}"
                        x_vars[var_key] = _make_var(prob, tag, lowBound=0.0, cat=pulp.LpContinuous)
                        n_tag = f"n_{m}_{c}_{o}_{p}_{v}_m{t}"
                        n_vars[var_key] = _make_var(prob, n_tag, lowBound=0, cat=pulp.LpInteger)

    # k[v, t]: Period time-chartered vessels
    k_vars: Dict[Tuple[str, int], pulp.LpVariable] = {}
    for v in vessel_classes:
        for t in months:
            k_vars[(v, t)] = _make_var(prob, f"k_{v}_m{t}", lowBound=0, upBound=15, cat=pulp.LpInteger)

    # psi[o, p, v]: Binary COA activation trigger
    psi_vars: Dict[Tuple[str, str, str], pulp.LpVariable] = {}
    if "COA" in modes:
        for (o, p, v) in routes:
            psi_vars[(o, p, v)] = _make_var(prob, f"psi_{o}_{p}_{v}", cat=pulp.LpBinary)

    # I[c, p, t]: Ending inventory at port p
    I_vars: Dict[Tuple[str, str, int], pulp.LpVariable] = {}
    # u[c, p, t]: Unmet demand at port p
    u_vars: Dict[Tuple[str, str, int], pulp.LpVariable] = {}
    for c in cargoes:
        for p in ports:
            for t in months:
                I_vars[(c, p, t)] = _make_var(prob, f"I_{c}_{p}_m{t}", lowBound=0.0, cat=pulp.LpContinuous)
                u_vars[(c, p, t)] = _make_var(prob, f"u_{c}_{p}_m{t}", lowBound=0.0, cat=pulp.LpContinuous)

    # -------------------------------------------------------------------------
    # 4. Constraints
    # -------------------------------------------------------------------------

    # 5.3 Parcel Size Linking: x[m, c, o, p, v, t] <= Q_v * n[m, c, o, p, v, t]
    for key, x_var in x_vars.items():
        m, c, o, p, v, t = key
        q_v = parcel_size[v]
        prob += x_var <= q_v * n_vars[key], f"Parcel_{m}_{c}_{o}_{p}_{v}_m{t}"

    # 5.1 Port-level Demand Satisfaction & Inventory Balance
    for c in cargoes:
        for p in ports:
            alpha_cp = port_shares.get((c, p), 1.0 / num_ports)
            for idx, t in enumerate(months):
                prev_I = initial_inv.get((c, p), 0.0) if idx == 0 else I_vars[(c, p, months[idx - 1])]
                trans = in_transit.get((c, p, t), 0.0)

                # Arriving shipments: departed at tau = t - lt
                arriving_exprs = []
                for (o, rp, v) in routes:
                    if rp == p and o in eligibility.get(c, []):
                        lt = lead_time.get((o, p, v), 1)
                        dep_t = t - lt
                        if dep_t in months:
                            for m in modes:
                                arriving_exprs.append(x_vars[(m, c, o, p, v, dep_t)])

                port_demand = alpha_cp * demand.get((c, t), 0.0)
                prob += (
                    prev_I + trans + pulp.lpSum(arriving_exprs)
                    == port_demand - u_vars[(c, p, t)] + I_vars[(c, p, t)],
                    f"Balance_{c}_{p}_m{t}",
                )

            # Terminal inventory floor
            t_last = months[-1]
            term_req = terminal_min.get((c, p), 0.0)
            if term_req > 0:
                prob += I_vars[(c, p, t_last)] >= term_req, f"TerminalFloor_{c}_{p}"

    # 5.2 Supplier Capacity
    for c in cargoes:
        for o in eligibility.get(c, []):
            for t in months:
                cap = supcap.get((o, c, t), None)
                if cap is not None and not math.isinf(cap):
                    exprs = [
                        x_vars[(m, c, o, p, v, t)]
                        for (ro, p, v) in routes
                        if ro == o
                        for m in modes
                    ]
                    if exprs:
                        prob += pulp.lpSum(exprs) <= cap, f"SupCap_{c}_{o}_m{t}"

    # 5.4 Period Charter Capacity & Duration
    if "period" in modes:
        for v in vessel_classes:
            for t in months:
                period_days_exprs = []
                for (o, p, rv) in routes:
                    if rv == v:
                        days = round_trip_days.get((o, p, v), 30.0)
                        for c in cargoes:
                            if o in eligibility.get(c, []):
                                period_days_exprs.append(days * n_vars[("period", c, o, p, v, t)])
                prob += pulp.lpSum(period_days_exprs) <= 30.0 * k_vars[(v, t)], f"PeriodCap_{v}_m{t}"

        # Minimum duration constraint
        for v in vessel_classes:
            delta = period_min_dur.get(v, 3)
            for idx, t in enumerate(months):
                prev_k = 0 if idx == 0 else k_vars[(v, months[idx - 1])]
                max_tau_idx = min(idx + delta, len(months))
                for tau_idx in range(idx, max_tau_idx):
                    tau = months[tau_idx]
                    prob += k_vars[(v, tau)] >= k_vars[(v, t)] - prev_k, f"PeriodDur_{v}_m{t}_to_m{tau}"

    # 5.5 Berth Capacity
    for p in ports:
        for t in months:
            b_cap = berth_cap.get((p, t), None)
            if b_cap is not None and not math.isinf(b_cap):
                arriving_all = []
                for (o, rp, v) in routes:
                    if rp == p:
                        lt = lead_time.get((o, p, v), 1)
                        dep_t = t - lt
                        if dep_t in months:
                            for c in cargoes:
                                if o in eligibility.get(c, []):
                                    for m in modes:
                                        arriving_all.append(x_vars[(m, c, o, p, v, dep_t)])
                trans_sum = sum(in_transit.get((c, p, t), 0.0) for c in cargoes)
                prob += pulp.lpSum(arriving_all) + trans_sum <= b_cap, f"BerthCap_{p}_m{t}"

    # 5.6 COA Linking
    if "COA" in modes:
        horizon_total_demand = sum(demand.get((c, t), 0.0) for c in cargoes for t in months)
        for (o, p, v) in routes:
            min_v = coa_min_vol.get((o, p, v), 0.0)
            coa_shipments = [
                x_vars[("COA", c, o, p, v, t)]
                for c in cargoes
                if o in eligibility.get(c, [])
                for t in months
            ]
            if coa_shipments:
                # Minimum volume condition
                if min_v > 0:
                    prob += pulp.lpSum(coa_shipments) >= min_v * psi_vars[(o, p, v)], f"COAMinVol_{o}_{p}_{v}"
                # Monthly upper bound bound by psi
                for t in months:
                    monthly_coa = [
                        x_vars[("COA", c, o, p, v, t)]
                        for c in cargoes
                        if o in eligibility.get(c, [])
                    ]
                    bound = horizon_total_demand if horizon_total_demand > 0 else 1e9
                    prob += pulp.lpSum(monthly_coa) <= bound * psi_vars[(o, p, v)], f"COACap_{o}_{p}_{v}_m{t}"

    # 5.6.1 Fixed Sourcing Allocations (e.g. for Policy f)
    fixed_alloc = params.get("fixed_shipment_tonnes", None)
    if fixed_alloc is not None:
        for key, target_tonnes in fixed_alloc.items():
            if len(key) == 4:
                c, o, p, t = key
            elif len(key) == 3:
                c, o, p = key
                t = 1
            else:
                continue
            if t in months:
                exprs = [
                    x_vars[(m, c, o, p, v, t)]
                    for m in modes
                    for (ro, rp, v) in routes
                    if ro == o and rp == p and o in eligibility.get(c, [])
                ]
                if exprs:
                    prob += pulp.lpSum(exprs) == target_tonnes, f"FixedAlloc_{c}_{o}_{p}_m{t}"

    # 5.7 Inventory Capacity
    for c in cargoes:
        for p in ports:
            for t in months:
                cap_inv = inv_cap.get((c, p), None)
                if cap_inv is not None and not math.isinf(cap_inv):
                    prob += I_vars[(c, p, t)] <= cap_inv, f"InvCap_{c}_{p}_m{t}"

    # -------------------------------------------------------------------------
    # 5. Scenario Costs & Objective
    # -------------------------------------------------------------------------
    # Cargo cost
    cargo_exprs = []
    for (m, c, o, p, v, t), x_var in x_vars.items():
        p_fob = fob_price.get((c, o, t), 0.0)
        q_pen = quality_penalty.get((c, o), 0.0)
        cargo_exprs.append((p_fob + q_pen) * x_var)
    z_cargo = pulp.lpSum(cargo_exprs)

    # Demurrage cost
    dem_exprs = []
    for (m, c, o, p, v, t), n_var in n_vars.items():
        del_d = delay_days.get((o, p, v), 0.0)
        if del_d > 0:
            dem_exprs.append(dem_rate * del_d * n_var)
    z_demurrage = pulp.lpSum(dem_exprs)

    # Inventory cost
    inv_exprs = [inv_cost.get(c, 0.0) * I_vars[(c, p, t)] for (c, p, t) in I_vars]
    z_inventory = pulp.lpSum(inv_exprs)

    # Unmet demand penalty
    unmet_exprs = [unmet_pen.get(c, 1000.0) * u_vars[(c, p, t)] for (c, p, t) in u_vars]
    z_unmet = pulp.lpSum(unmet_exprs)

    # Period hire cost (vessel pool level)
    period_hire_exprs = []
    for (v, t), k_var in k_vars.items():
        h_rate = period_hire.get((v, t), 0.0)
        period_hire_exprs.append(h_rate * 30.0 * k_var)
    z_period = pulp.lpSum(period_hire_exprs)

    # Freight cost per scenario
    scenario_freight: Dict[str, Any] = {}
    for s in scenarios:
        fr_exprs = []
        for (m, c, o, p, v, t), n_var in n_vars.items():
            if m == "spot":
                svc = spot_vc.get((o, p, v, t, s), 0.0)
                fr_exprs.append(svc * n_var)
            elif m == "period":
                pvc = period_vc.get((o, p, v, t, s), 0.0)
                fr_exprs.append(pvc * n_var)
            elif m == "COA":
                cr = coa_rate.get((o, p, v), 0.0)
                fr_exprs.append(cr * x_vars[(m, c, o, p, v, t)])
        scenario_freight[s] = pulp.lpSum(fr_exprs)

    # Scenario total cost Z(s)
    z_scenario: Dict[str, Any] = {}
    for s in scenarios:
        z_scenario[s] = (
            z_cargo
            + scenario_freight[s]
            + z_period
            + z_demurrage
            + z_inventory
            + z_unmet
        )

    # Objective formulation
    eta_var = None
    if obj_type == "minimax":
        eta_var = _make_var(prob, "eta_minimax", lowBound=0.0, cat=pulp.LpContinuous)
        for s in scenarios:
            prob += eta_var >= z_scenario[s], f"Minimax_bound_{s}"
        prob.setObjective(eta_var)
    elif obj_type == "base":
        base_scen = "base" if "base" in scenarios else scenarios[0]
        prob.setObjective(z_scenario[base_scen])
    else:  # 'mean'
        mean_obj = pulp.lpSum(scenario_weights.get(s, 1.0 / len(scenarios)) * z_scenario[s] for s in scenarios)
        prob.setObjective(mean_obj)

    var_dict = {
        "x": x_vars,
        "n": n_vars,
        "k": k_vars,
        "psi": psi_vars,
        "I": I_vars,
        "u": u_vars,
        "eta": eta_var,
        "z_cargo": z_cargo,
        "z_freight_s": scenario_freight,
        "z_period": z_period,
        "z_demurrage": z_demurrage,
        "z_inventory": z_inventory,
        "z_unmet": z_unmet,
        "z_scenario": z_scenario,
        "scenarios": scenarios,
        "params": params,
    }

    return prob, var_dict


def build_and_solve_optimizer(
    params: Dict[str, Any],
    solver_name: Optional[str] = None,
    time_limit_sec: Optional[int] = None,
    mip_gap: Optional[float] = None,
    msg: bool = False,
) -> Dict[str, Any]:
    """Build and solve the MILP optimizer, returning structured plan and cost breakdown."""
    start_time = time.time()
    prob, var_dict = build_optimizer_model(params)

    solver = get_available_solver(time_limit_sec=time_limit_sec, mip_gap=mip_gap, msg=msg)
    res = prob.solve(solver)
    solve_duration = time.time() - start_time

    # Determine status
    status_code = getattr(res, "status", getattr(prob, "status", None))
    is_optimal = (status_code == 1) or (str(status_code).lower() in ["optimal", "1"])
    status_str = getattr(res, "status_str", "Optimal" if is_optimal else str(status_code))
    gap_val = getattr(res, "gap_rel", getattr(res, "gap", 0.0))
    if hasattr(res, "num_variables") and res.num_variables is not None:
        num_vars = res.num_variables
    elif callable(getattr(prob, "variables", None)):
        num_vars = len(prob.variables())
    else:
        num_vars = len(prob.variables)

    if hasattr(res, "num_constraints") and res.num_constraints is not None:
        num_cons = res.num_constraints
    elif callable(getattr(prob, "constraints", None)):
        num_cons = len(prob.constraints())
    else:
        num_cons = len(prob.constraints)

    # Extract variable values safely
    def _val(v):
        if v is None:
            return 0.0
        val = getattr(v, "varValue", None)
        if val is None:
            try:
                val = v.value()
            except Exception:
                val = pulp.value(v)
        return float(val or 0.0)

    x_res = {k: _val(v) for k, v in var_dict["x"].items()}
    n_res = {k: int(round(_val(v))) for k, v in var_dict["n"].items()}
    k_res = {k: int(round(_val(v))) for k, v in var_dict["k"].items()}
    psi_res = {k: bool(round(_val(v))) for k, v in var_dict["psi"].items()}
    I_res = {k: _val(v) for k, v in var_dict["I"].items()}
    u_res = {k: _val(v) for k, v in var_dict["u"].items()}

    # Compute cost breakdown components
    cargo_cost = float(pulp.value(var_dict["z_cargo"]) or 0.0)
    period_hire_cost = float(pulp.value(var_dict["z_period"]) or 0.0)
    demurrage_cost = float(pulp.value(var_dict["z_demurrage"]) or 0.0)
    inventory_cost = float(pulp.value(var_dict["z_inventory"]) or 0.0)
    unmet_cost = float(pulp.value(var_dict["z_unmet"]) or 0.0)

    scenarios = var_dict["scenarios"]
    freight_by_scen = {s: float(pulp.value(var_dict["z_freight_s"][s]) or 0.0) for s in scenarios}
    total_by_scen = {s: float(pulp.value(var_dict["z_scenario"][s]) or 0.0) for s in scenarios}

    weights = params.get("scenario_weights", {s: 1.0 / len(scenarios) for s in scenarios})
    mean_freight = sum(weights.get(s, 1.0 / len(scenarios)) * freight_by_scen[s] for s in scenarios)
    mean_total = sum(weights.get(s, 1.0 / len(scenarios)) * total_by_scen[s] for s in scenarios)

    # Active shipments list for reporting
    shipments_plan = []
    for (m, c, o, p, v, t), tonnes in x_res.items():
        voyages = n_res.get((m, c, o, p, v, t), 0)
        if tonnes > 1e-4 or voyages > 0:
            shipments_plan.append({
                "mode": m,
                "cargo": c,
                "origin": o,
                "port": p,
                "vessel_class": v,
                "month": t,
                "tonnes": tonnes,
                "voyages": voyages,
            })

    cost_breakdown = {
        "cargo": cargo_cost,
        "freight": mean_freight,
        "freight_by_scenario": freight_by_scen,
        "period_hire": period_hire_cost,
        "demurrage": demurrage_cost,
        "inventory": inventory_cost,
        "unmet": unmet_cost,
        "total_mean": mean_total,
        "total_by_scenario": total_by_scen,
    }

    return {
        "status": status_str,
        "is_optimal": is_optimal,
        "objective_value": float(prob.objective.value() if hasattr(prob.objective, "value") else pulp.value(prob.objective)),
        "solve_time_seconds": solve_duration,
        "mip_gap": float(gap_val or 0.0),
        "num_variables": int(num_vars),
        "num_constraints": int(num_cons),
        "cost_breakdown": cost_breakdown,
        "plan": {
            "shipments": shipments_plan,
            "x": x_res,
            "n": n_res,
            "k": k_res,
            "psi": psi_res,
            "inventory": I_res,
            "unmet_demand": u_res,
        },
    }
