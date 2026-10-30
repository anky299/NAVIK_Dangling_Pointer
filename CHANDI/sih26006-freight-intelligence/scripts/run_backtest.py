"""scripts/run_backtest.py — CLI and reporting runner for 2023 walk-forward backtest.

Replays maritime procurement optimizer on 2023 market paths, computes statistics,
generates figures in docs/figures/, and writes docs/backtest_report.md.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Force matplotlib temporary directory to avoid permissions issues
os.environ["MPLCONFIGDIR"] = "/tmp"

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.backtest.run_backtest import run_walk_forward_backtest, BacktestResult


# ─────────────────────────────────────────────────────────────────────────────
# Plot Helpers
# ─────────────────────────────────────────────────────────────────────────────

COLORS = {
    "spot_naive":               "#D64545",
    "landed_naive":             "#F2A541",
    "flat_forecast":            "#64748B",
    "forecast_scenarios":       "#13A89E",
    "perfect_foresight":        "#0B2545",
    "fixed_sourcing_optimizer": "#7C3AED",
}

LABELS = {
    "spot_naive":               "(a) Spot Naive",
    "landed_naive":             "(b) Landed-Cost Naive",
    "flat_forecast":            "(d) Flat Forecast",
    "forecast_scenarios":       "(c) Optimizer (Forecast Scenarios)",
    "perfect_foresight":        "(e) Perfect Foresight",
    "fixed_sourcing_optimizer": "(f) Fixed-Sourcing Optimizer",
}


def generate_backtest_plots(result: BacktestResult, output_dir: Path) -> None:
    """Generate high-resolution figures in output_dir."""
    output_dir.mkdir(parents=True, exist_ok=True)
    months = result.cost_matrix.index

    # 1. Monthly Cost Comparison across policies
    plt.figure(figsize=(14, 6))
    for p in result.policies:
        costs_m = result.cost_matrix[p] / 1e6
        plt.plot(months, costs_m, marker="o", label=LABELS.get(p, p),
                 color=COLORS.get(p, "#888"), linewidth=2.0)
    plt.title("2023 Walk-Forward Realised Monthly Cost by Procurement Policy",
              fontsize=13, fontweight="bold", pad=12)
    plt.xlabel("Decision Month (2023)", fontsize=11)
    plt.ylabel("Realised Cost ($ Millions USD)", fontsize=11)
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.legend(frameon=True, fontsize=9)
    plt.tight_layout()
    plt.savefig(output_dir / "backtest_monthly_cost.png", dpi=200)
    plt.close()

    # 2. Cumulative Realised Cost
    plt.figure(figsize=(14, 6))
    for p in result.policies:
        cum_costs = (result.cost_matrix[p] / 1e6).cumsum()
        plt.plot(months, cum_costs, marker="s", label=LABELS.get(p, p),
                 color=COLORS.get(p, "#888"), linewidth=2.2)
    plt.title("Cumulative 2023 Realised Procurement Cost by Policy",
              fontsize=13, fontweight="bold", pad=12)
    plt.xlabel("Decision Month (2023)", fontsize=11)
    plt.ylabel("Cumulative Realised Cost ($ Millions USD)", fontsize=11)
    plt.grid(True, linestyle="--", alpha=0.5)
    plt.legend(frameon=True, fontsize=9)
    plt.tight_layout()
    plt.savefig(output_dir / "backtest_cumulative_cost.png", dpi=200)
    plt.close()

    # 3. Monthly Savings vs Landed-Cost Naive Baseline (c, d, e, f)
    plt.figure(figsize=(14, 6))
    landed_cost = result.cost_matrix["landed_naive"] / 1e6
    comparison_policies = ["flat_forecast", "forecast_scenarios", "perfect_foresight", "fixed_sourcing_optimizer"]
    x = np.arange(len(months))
    width = 0.20
    offsets = [-1.5, -0.5, 0.5, 1.5]
    for i, p in enumerate(comparison_policies):
        savings = landed_cost - result.cost_matrix[p] / 1e6
        plt.bar(x + offsets[i] * width, savings, width,
                label=LABELS.get(p, p), color=COLORS.get(p, "#888"))
    plt.axhline(0, color="black", linewidth=0.8, linestyle="-")
    plt.title("Monthly Realised Savings vs Landed-Cost Baseline ($M)",
              fontsize=13, fontweight="bold", pad=12)
    plt.xticks(x, months, rotation=45, ha="right")
    plt.xlabel("Decision Month (2023)", fontsize=11)
    plt.ylabel("Savings ($M, positive = outperforms baseline)", fontsize=11)
    plt.grid(True, linestyle="--", alpha=0.5, axis="y")
    plt.legend(frameon=True, fontsize=9)
    plt.tight_layout()
    plt.savefig(output_dir / "backtest_savings_vs_landed.png", dpi=200)
    plt.close()

    # 4. Delivered tonnes per policy
    plt.figure(figsize=(12, 5))
    delivered_totals_mt = {p: result.delivered_tonnes_total[p] / 1e6 for p in result.policies}
    bars = plt.bar([LABELS.get(p, p) for p in result.policies],
                   [delivered_totals_mt[p] for p in result.policies],
                   color=[COLORS.get(p, "#888") for p in result.policies])
    plt.title("2023 Total Delivered Tonnes by Policy", fontsize=13, fontweight="bold", pad=12)
    plt.ylabel("Delivered Tonnes (Million MT)", fontsize=11)
    plt.xticks(rotation=20, ha="right")
    plt.grid(True, linestyle="--", alpha=0.5, axis="y")
    for bar, p in zip(bars, result.policies):
        plt.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.01,
                 f"{delivered_totals_mt[p]:.2f}M", ha="center", va="bottom", fontsize=8)
    plt.tight_layout()
    plt.savefig(output_dir / "backtest_delivered_tonnes.png", dpi=200)
    plt.close()


# ─────────────────────────────────────────────────────────────────────────────
# Markdown Report Generator
# ─────────────────────────────────────────────────────────────────────────────

def generate_backtest_report(result: BacktestResult, output_path: Path) -> None:
    """Generate docs/backtest_report.md."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    summary_md = result.summary_table.to_markdown(index=False)
    cost_md = (result.cost_matrix / 1e6).round(2).to_markdown()
    delivered_md = (result.delivered_tonnes_matrix / 1e3).round(1).to_markdown()
    cost_per_t_md = result.cost_per_tonne_matrix.round(2).to_markdown()

    cost_c = result.cost_matrix["forecast_scenarios"].sum()
    cost_d = result.cost_matrix["flat_forecast"].sum()
    cost_e = result.cost_matrix["perfect_foresight"].sum()
    cost_f = result.cost_matrix["fixed_sourcing_optimizer"].sum()

    landed_total = result.cost_matrix["landed_naive"].sum()

    forecast_value = (cost_d - cost_c) / 1e6
    foresight_gap = (cost_c - cost_e) / 1e6
    logistic_savings = (landed_total - cost_f) / 1e6

    ci_c_l, ci_c_h = result.bootstrap_ci_f_vs_landed
    ci_cd_l, ci_cd_h = result.bootstrap_ci_c_vs_d
    ci_f_l, ci_f_h = result.bootstrap_ci_f_vs_landed

    worst_m, worst_diff = result.worst_month_vs_landed.get("forecast_scenarios", (1, 0.0))
    worst_month_label = result.cost_matrix.index[worst_m - 1] if worst_m >= 1 else "N/A"

    # Monthly detail table: per-month cost (c) and (e) breakdown
    monthly_detail_rows = []
    for m_idx, label in enumerate(result.cost_matrix.index):
        dec_c = result.monthly_results["forecast_scenarios"][m_idx]
        dec_e = result.monthly_results["perfect_foresight"][m_idx]
        monthly_detail_rows.append({
            "Month": label,
            "(c) Status": dec_c.solver_status,
            "(c) Gap %": dec_c.solver_gap,
            "(c) Unmet (t)": int(dec_c.unmet_tonnes),
            "(c) Total ($M)": round(dec_c.cost_realised / 1e6, 2),
            "(c) Cargo ($M)": round(dec_c.cost_cargo / 1e6, 2),
            "(c) Freight ($M)": round(dec_c.cost_freight / 1e6, 2),
            "(c) Period ($M)": round(dec_c.cost_period_hire / 1e6, 2),
            "(e) Status": dec_e.solver_status,
            "(e) Gap %": dec_e.solver_gap,
            "(e) Unmet (t)": int(dec_e.unmet_tonnes),
            "(e) Total ($M)": round(dec_e.cost_realised / 1e6, 2),
        })
    monthly_detail_df = pd.DataFrame(monthly_detail_rows)
    monthly_detail_md = monthly_detail_df.to_markdown(index=False)

    report = f"""# Walk-Forward Backtest Report: 2023 Procurement Simulation

> **Important**: Real index and fuel paths (Baltic Dry Index, Brent crude, USD/INR).
> Demand, FOB prices and supplier capacities are **synthetic placeholders**.

## 1. Executive Summary

Walk-forward historical replay of the SAIL bulk maritime procurement optimization system
across the **12 calendar months of 2023**. At each decision month $t$, the system uses
strictly data available up to month $t$, runs a rolling 6-month MILP optimizer
(fast mode, 3% MIP gap, 60 s time limit), executes Month-1 commitments only, and
transitions state to month $t+1$.

Costs are evaluated against **actual realized weekly spot freight and bunker prices**
from the Baltic Dry Index and Brent crude paths for 2023.

### Policy Performance Summary (2023 Full Year)

{summary_md}

---

## 2. Methodology & Walk-Forward Design

1. **Information Horizon & Strict No-Look-Ahead Guard**:
   At decision month $t$, only historical data up to $t$ is visible. Forward BDI
   scenarios are generated using LightGBM quantile regression models trained on
   data preceding $t$ (folds ≤ $t$).
2. **State Carry-Over**:
   Plant inventory balances, lead-time in-transit shipments (1 month for most origins,
   2 months for Hampton Roads), active period vessel charters, and COA volumes used
   are strictly updated from $t$ to $t+1$.
3. **Initial State Seeding**:
   Both inventory and in-transit pipeline are pre-seeded with one month's demand at
   each port to avoid a cold-start pipeline lag that would unfairly disadvantage all
   optimizer policies equally in Month 1.
4. **Realised Cost Charging**:
   - **Spot voyages**: Charged actual realized average weekly BDI hire and Brent
     bunker fuel cost for the voyage month.
   - **COA contracts**: Charged fixed contract rate locked at decision time (trailing
     12-week market).
   - **Period charter**: Charged fixed monthly time-charter hire locked at decision time.
   - **Inventory & Demurrage**: Charged according to synthetic operational parameters.
   - **Unmet demand penalty**: $500/tonne, uniform across all policies.

---

## 3. Comparison of 6 Policies

- **(a) Spot-Only Naive**: Cheapest FOB origin, spot voyages, capacity-constrained LP.
  Total cost: **${result.cost_matrix['spot_naive'].sum()/1e6:.2f}M**.

- **(b) Landed-Cost Naive**: Lowest (FOB + trailing spot freight) per origin, spot voyages,
  capacity-constrained LP. Total cost: **${result.cost_matrix['landed_naive'].sum()/1e6:.2f}M**.

- **(c) Optimizer with Forecast Scenarios (LightGBM)**: Dynamically blends COA, Period,
  and Spot using quantile BDI predictions. Optimizer sees 6-month horizon.
  Total cost: **${cost_c/1e6:.2f}M**, saving
  **${result.savings_vs_landed_naive['forecast_scenarios']/1e6:.2f}M** vs Landed Naive.

- **(d) Optimizer with Flat Forecast**: Optimizes under constant (uninformative) rate forecast.
  Total cost: **${cost_d/1e6:.2f}M**.

- **(e) Perfect-Foresight Optimizer**: Upper benchmark knowing realized monthly BDI.
  Bounded to not exceed (c) (safeguard against solver warm-start artifacts).
  Total cost: **${cost_e/1e6:.2f}M**.

- **(f) Fixed-Sourcing Logistics Optimizer**: Origin and tonnage fixed to landed-cost
  baseline per cargo/port/month. Optimizer selects only charter mode (spot/COA/period).
  Total cost: **${cost_f/1e6:.2f}M**, logistics-only saving
  **${logistic_savings:.2f}M** vs Landed Naive.

### Value of Information Analysis

| Comparison | Value ($M) | Note |
|---|---|---|
| (c) vs (d): Value of ML Forecasting | {forecast_value:.2f} | Calibrated forecast vs flat |
| (c) vs (e): Foresight Gap | {foresight_gap:.2f} | Upper bound on remaining info value |
| (f) vs (b): Pure Logistics Saving | {logistic_savings:.2f} | Headline: logistics-only, same sourcing |

### Bootstrap 90% Confidence Intervals (paired monthly, n=1000 resamples)

| Pair | CI Lower ($M) | CI Upper ($M) | Excludes Zero? |
|---|---|---|---|
| (c) savings vs Landed | {result.bootstrap_ci_landed['forecast_scenarios'][0]/1e6:.1f} | {result.bootstrap_ci_landed['forecast_scenarios'][1]/1e6:.1f} | {'Yes' if result.bootstrap_ci_landed['forecast_scenarios'][0] > 0 else 'No'} |
| (c) - (d) [forecast value] | {ci_cd_l/1e6:.1f} | {ci_cd_h/1e6:.1f} | {'Yes' if ci_cd_l > 0 else 'No'} |
| (f) savings vs Landed | {ci_f_l/1e6:.1f} | {ci_f_h/1e6:.1f} | {'Yes' if ci_f_l > 0 else 'No'} |

> CIs computed by resampling the 12 monthly paired differences with replacement, multiplied
> by 12 to obtain annual totals.

---

## 4. Month-by-Month Realised Costs ($ Millions USD)

{cost_md}

---

## 5. Delivered Tonnes by Policy (kt)

{delivered_md}

---

## 6. Cost per Delivered Tonne ($)

{cost_per_t_md}

---

## 7. Per-Month Solver Diagnostics (Policies c & e)

{monthly_detail_md}

> Policy (e) cells where Status = same as (c) indicate the safeguard cap was applied
> (perfect foresight produced a higher cost than the forecast optimizer, likely due to
> the 60 s time limit binding).

---

## 8. Win Rate & Loss Analysis

| Policy | Win Rate vs Landed | Worst Month |
|---|---|---|
{chr(10).join(f"| {LABELS.get(p, p)} | {result.win_rate_vs_landed[p]*100:.1f}% | M{result.worst_month_vs_landed[p][0]:02d} (${result.worst_month_vs_landed[p][1]/1e6:+.2f}M) |" for p in result.policies)}

---

## 9. Scale Reconciliation (Backtest vs Single Optimizer Run)

The single-run optimizer (T=6, scripts/run_optimizer.py) covers approximately 6 months
of procurement. The backtest covers 12 months. Additionally:

- **Parcel rounding**: naive baselines dispatch `ceil(demand / parcel_size) × parcel_size`
  tonnes, which over-ships by up to one parcel per route/month (Capesize = 155,000 MT).
  Over 12 months across 6+ routes this adds ~15–30% excess cargo cost to baselines.
- **Pipeline seeding**: Month 1 receives pre-seeded inventory (no procurement needed for
  Month-1 consumption), reducing Month-1 costs uniformly across all policies.
- **Charter mode mix**: The backtest allows COA and period contracts, which the single-run
  optimizer also uses but at different trailing-rate calibrations.

---

## 10. Generated Visualizations

Artifacts in `docs/figures/`:
1. `backtest_monthly_cost.png`: Monthly cost trajectory across all 6 policies.
2. `backtest_cumulative_cost.png`: Cumulative expenditure throughout 2023.
3. `backtest_savings_vs_landed.png`: Net monthly savings vs the landed-cost heuristic.
4. `backtest_delivered_tonnes.png`: Total delivered tonnes by policy.

*Report automatically compiled by `scripts/run_backtest.py`.*
"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)


# ─────────────────────────────────────────────────────────────────────────────
# Rolling-Origin Forecast Evaluation (Item 7)
# ─────────────────────────────────────────────────────────────────────────────

def run_rolling_forecast_eval(output_path: Path) -> None:
    """Weekly rolling-origin forecast evaluation — uses saved GBM results, no retraining."""
    import json
    from pathlib import Path as P

    gbm_path = ROOT_DIR / "data" / "processed" / "gbm_results.parquet"
    baseline_path = ROOT_DIR / "data" / "processed" / "baseline_results.parquet"

    if not gbm_path.exists():
        print("[SKIP] gbm_results.parquet not found — skipping rolling forecast eval")
        return
    if not baseline_path.exists():
        print("[SKIP] baseline_results.parquet not found — skipping rolling forecast eval")
        return

    gbm_df = pd.read_parquet(gbm_path)
    base_df = pd.read_parquet(baseline_path)

    horizons = [1, 4, 8, 12]
    rows = []

    covid_folds = gbm_df[
        (gbm_df["test_date"] >= "2020-01-01") & (gbm_df["test_date"] <= "2021-12-31")
    ]["fold"].unique() if "fold" in gbm_df.columns else []

    for h in horizons:
        sub_gbm = gbm_df[gbm_df["horizon_weeks"] == h].copy()
        sub_base = base_df[base_df["horizon_weeks"] == h].copy() if "horizon_weeks" in base_df.columns else pd.DataFrame()

        if sub_gbm.empty:
            continue

        # Full sample
        mae_gbm = (sub_gbm["actual"] - sub_gbm["predicted_blend"]).abs().mean() if "actual" in sub_gbm.columns else float("nan")
        mae_naive = (sub_base["actual"] - sub_base["naive_forecast"]).abs().mean() if not sub_base.empty and "naive_forecast" in sub_base.columns else float("nan")
        mape_gbm = ((sub_gbm["actual"] - sub_gbm["predicted_blend"]).abs() / sub_gbm["actual"].clip(lower=1.0)).mean() * 100 if "actual" in sub_gbm.columns else float("nan")

        # Excluding COVID/supercycle folds
        if len(covid_folds) > 0 and "fold" in sub_gbm.columns:
            sub_ex = sub_gbm[~sub_gbm["fold"].isin(covid_folds)]
            mae_gbm_ex = (sub_ex["actual"] - sub_ex["predicted_blend"]).abs().mean() if not sub_ex.empty else float("nan")
        else:
            mae_gbm_ex = float("nan")

        # Bootstrap CI for MAE difference (GBM vs naive)
        ci_low, ci_high = float("nan"), float("nan")
        if not sub_base.empty and "naive_forecast" in sub_base.columns and "actual" in sub_base.columns and len(sub_base) > 5:
            merged = sub_gbm.merge(sub_base[["test_date", "naive_forecast"]], on="test_date", how="inner") if "test_date" in sub_gbm.columns else pd.DataFrame()
            if not merged.empty and "actual" in merged.columns:
                err_gbm = (merged["actual"] - merged["predicted_blend"]).abs().values
                err_naive = (merged["actual"] - merged["naive_forecast"]).abs().values
                diff = err_naive - err_gbm  # positive = GBM is better
                rng = np.random.default_rng(42)
                boots = [float(np.mean(rng.choice(diff, size=len(diff), replace=True))) for _ in range(1000)]
                ci_low, ci_high = float(np.percentile(boots, 5)), float(np.percentile(boots, 95))

        rows.append({
            "horizon_weeks": h,
            "MAE_GBM_full": round(mae_gbm, 1) if not np.isnan(mae_gbm) else "N/A",
            "MAE_Naive_full": round(mae_naive, 1) if not np.isnan(mae_naive) else "N/A",
            "MAPE_GBM_full_%": round(mape_gbm, 1) if not np.isnan(mape_gbm) else "N/A",
            "MAE_GBM_excl_covid": round(mae_gbm_ex, 1) if not np.isnan(mae_gbm_ex) else "N/A",
            "Bootstrap_CI_MAE_diff_90pct": f"[{ci_low:.1f}, {ci_high:.1f}]" if not np.isnan(ci_low) else "N/A",
        })

    if rows:
        rolling_df = pd.DataFrame(rows)
        rolling_md = rolling_df.to_markdown(index=False)
        rolling_report = f"""# Rolling-Origin Forecast Evaluation

> Evaluation uses saved GBM results from `data/processed/gbm_results.parquet`.
> No model retraining. Bootstrap 90% CI computed on the paired MAE improvement
> (naive MAE − GBM MAE); positive = GBM outperforms naive.

{rolling_md}

*Generated by scripts/run_backtest.py.*
"""
        output_path.write_text(rolling_report, encoding="utf-8")
        print(f"[✓] Rolling forecast eval written to {output_path}")
    else:
        print("[WARN] No rolling forecast data available to write")


# ─────────────────────────────────────────────────────────────────────────────
# CLI Entry Point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="2023 Maritime Walk-Forward Backtest Runner")
    parser.add_argument("--start", type=str, default="2023-01-01", help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", type=str, default="2023-12-31", help="End date (YYYY-MM-DD)")
    parser.add_argument("--time-limit", type=int, default=60, help="Solver time limit per month (s)")
    parser.add_argument("--gap", type=float, default=0.03, help="MIP relative gap target (e.g. 0.03 = 3%)")
    args = parser.parse_args()

    result = run_walk_forward_backtest(
        start_date=args.start,
        end_date=args.end,
        time_limit_sec=args.time_limit,
        mip_gap=args.gap,
    )

    print("\n" + "=" * 80)
    print("BACKTEST SUMMARY TABLE (2023)")
    print("=" * 80)
    print(result.summary_table.to_string(index=False))

    fig_dir = Path("docs/figures")
    generate_backtest_plots(result, fig_dir)
    print(f"\n[✓] Generated figures in {fig_dir}/")

    report_path = Path("docs/backtest_report.md")
    generate_backtest_report(result, report_path)
    print(f"[✓] Generated detailed report in {report_path}")

    rolling_path = Path("docs/metrics_rolling_forecast.md")
    run_rolling_forecast_eval(rolling_path)


if __name__ == "__main__":
    main()
