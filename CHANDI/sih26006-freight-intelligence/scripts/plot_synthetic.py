"""Generate synthetic route freight intelligence visualization charts.

Saves 4 charts to docs/figures/:
1. chart1_weekly_rates_time_series.png: Weekly rate ($/MT) over time for short, medium, and long routes (Panamax).
2. chart2_rate_vs_distance_by_vessel.png: Average freight rate ($/MT) vs. nautical distance per vessel class.
3. chart3_rate_vs_bdi_dual_axis.png: Freight rate ($/MT) vs. Baltic Dry Index (BDI) over time (dual axis).
4. chart4_cost_breakdown_stacked.png: Stacked component breakdown (hire, bunker, port dues per MT) over time.

Each chart marks the derived sub-index estimation period (after 2019-07-31) with a shaded region and label.
"""

import os
import sys
from typing import Dict, List, Optional

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.data.loaders import load_bdi_daily
from src.data.synthetic_routes import load_routes_config

PROCESSED_PARQUET = os.path.join(PROJECT_ROOT, "data", "processed", "synthetic_route_rates.parquet")
OUTPUT_FIGURES_DIR = os.path.join(PROJECT_ROOT, "docs", "figures")
DERIVED_SPLIT_DATE = pd.to_datetime("2019-07-31")


def setup_plot_style() -> None:
    """Configure clean publication-quality styling."""
    plt.rcParams["font.sans-serif"] = ["DejaVu Sans", "Helvetica", "Arial"]
    plt.rcParams["axes.edgecolor"] = "#cccccc"
    plt.rcParams["axes.linewidth"] = 0.8
    plt.rcParams["grid.color"] = "#eaeaea"
    plt.rcParams["grid.linestyle"] = "--"
    plt.rcParams["grid.alpha"] = 0.7


def add_derived_period_shading(ax: plt.Axes, y_pos: float = 0.94) -> None:
    """Shade the region after 2019-07-31 indicating derived sub-indices."""
    xlim = ax.get_xlim()
    split_num = mdates.date2num(DERIVED_SPLIT_DATE)
    if xlim[1] > split_num:
        ax.axvspan(DERIVED_SPLIT_DATE, mdates.num2date(xlim[1]), color="#fff3cd", alpha=0.5, zorder=0)
        ax.axvline(DERIVED_SPLIT_DATE, color="#d39e00", linestyle=":", linewidth=1.5, zorder=1)
        ax.text(
            DERIVED_SPLIT_DATE + pd.Timedelta(days=40),
            ax.get_ylim()[0] + (ax.get_ylim()[1] - ax.get_ylim()[0]) * y_pos,
            "Derived Period\n(Post July 2019)",
            color="#856404",
            fontsize=8.5,
            fontweight="bold",
            va="top",
            bbox=dict(boxstyle="round,pad=0.2", facecolor="#fff8e1", edgecolor="#ffeeba", alpha=0.8),
        )


def plot_chart1_weekly_rates(df: pd.DataFrame, cfg: Dict) -> str:
    """Chart 1: Weekly rate_usd_per_mt over time for short, medium, and long routes (Panamax)."""
    fig, ax = plt.subplots(figsize=(11, 5.5), dpi=300)

    # Route selections for Panamax:
    # Short: IDN_PRT (Indonesia -> Paradip, ~2,600 nm)
    # Medium: NEW_PRT (Newcastle, Australia -> Paradip, ~5,200 nm)
    # Long: HMP_PRT (Hampton Roads, USA -> Paradip, ~10,200 nm)
    selected_routes = [
        ("IDN_PRT", "Short: Indonesia → Paradip (~2,600 nm)", "#2b8a3e"),
        ("NEW_PRT", "Medium: Newcastle → Paradip (~5,200 nm)", "#1971c2"),
        ("HMP_PRT", "Long: Hampton Roads → Paradip (~10,200 nm)", "#d9480f"),
    ]

    for r_id, label, color in selected_routes:
        sub = df[(df["route_id"] == r_id) & (df["vessel_class"] == "Panamax")].sort_values("date")
        if not sub.empty:
            ax.plot(sub["date"], sub["rate_usd_per_mt"], label=label, color=color, linewidth=1.5)

    add_derived_period_shading(ax, y_pos=0.92)

    ax.set_title("Weekly Synthetic Route Freight Rates ($/MT) — Panamax Vessel Class", fontsize=12, fontweight="bold", pad=12)
    ax.set_xlabel("Date (Weekly, Friday)", fontsize=10, labelpad=8)
    ax.set_ylabel("Freight Rate (USD / MT)", fontsize=10, labelpad=8)
    ax.grid(True)
    ax.xaxis.set_major_locator(mdates.YearLocator(2))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax.legend(loc="upper left", frameon=True, facecolor="white", edgecolor="#cccccc", fontsize=9)

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_FIGURES_DIR, "chart1_weekly_rates_time_series.png")
    plt.savefig(out_path)
    plt.close()
    return out_path


def plot_chart2_rate_vs_distance(df: pd.DataFrame, cfg: Dict) -> str:
    """Chart 2: Average freight rate ($/MT) vs. distance_nm per vessel class."""
    fig, ax = plt.subplots(figsize=(10, 5.5), dpi=300)

    # Extract distances from config
    dist_map = {r["route_id"]: r["distance_nm"] for r in cfg.get("routes", [])}
    df_copy = df.copy()
    df_copy["distance_nm"] = df_copy["route_id"].map(dist_map)

    colors = {
        "Capesize": "#2b8a3e",
        "Panamax": "#1971c2",
        "Supramax": "#e67700",
        "Handysize": "#c92a2a",
    }
    markers = {"Capesize": "o", "Panamax": "s", "Supramax": "^", "Handysize": "D"}

    avg_df = df_copy.groupby(["vessel_class", "route_id", "distance_nm"])["rate_usd_per_mt"].mean().reset_index()

    for v_class in ["Capesize", "Panamax", "Supramax", "Handysize"]:
        sub = avg_df[avg_df["vessel_class"] == v_class].sort_values("distance_nm")
        if not sub.empty:
            ax.plot(
                sub["distance_nm"],
                sub["rate_usd_per_mt"],
                label=v_class,
                color=colors.get(v_class, "#333333"),
                marker=markers.get(v_class, "o"),
                markersize=5,
                linestyle="-",
                linewidth=1.4,
                alpha=0.9,
            )

    ax.set_title("Average Freight Rate ($/MT) vs. Nautical Distance by Vessel Class", fontsize=12, fontweight="bold", pad=12)
    ax.set_xlabel("Voyage Nautical Distance (nm)", fontsize=10, labelpad=8)
    ax.set_ylabel("Average Freight Rate (USD / MT)", fontsize=10, labelpad=8)
    ax.grid(True)
    ax.legend(title="Vessel Class", loc="upper left", frameon=True, facecolor="white", edgecolor="#cccccc", fontsize=9)

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_FIGURES_DIR, "chart2_rate_vs_distance_by_vessel.png")
    plt.savefig(out_path)
    plt.close()
    return out_path


def plot_chart3_rate_vs_bdi(df: pd.DataFrame) -> str:
    """Chart 3: Rate vs BDI over time (dual axis, sample route NEW_PRT Capesize)."""
    fig, ax1 = plt.subplots(figsize=(11, 5.5), dpi=300)

    # Sample route: Newcastle -> Paradip Capesize
    sample_route = "NEW_PRT"
    v_class = "Capesize"
    sub = df[(df["route_id"] == sample_route) & (df["vessel_class"] == v_class)].sort_values("date")

    # Load BDI weekly
    df_bdi = load_bdi_daily()
    df_bdi["date"] = pd.to_datetime(df_bdi["date"])
    bdi_w = df_bdi.set_index("date").resample("W-FRI").agg({"bdi": "mean"}).dropna().reset_index()

    merged = pd.merge(sub, bdi_w, on="date", how="inner").sort_values("date")

    color1 = "#1864ab"
    color2 = "#e03131"

    ax1.plot(merged["date"], merged["rate_usd_per_mt"], color=color1, linewidth=1.6, label="Capesize Rate ($/MT)")
    ax1.set_xlabel("Date (Weekly, Friday)", fontsize=10, labelpad=8)
    ax1.set_ylabel("Newcastle → Paradip Freight Rate ($/MT)", color=color1, fontsize=10, labelpad=8)
    ax1.tick_params(axis="y", labelcolor=color1)
    ax1.grid(True)

    ax2 = ax1.twinx()
    ax2.plot(merged["date"], merged["bdi"], color=color2, linewidth=1.3, linestyle="--", alpha=0.85, label="Baltic Dry Index (BDI)")
    ax2.set_ylabel("Baltic Dry Index (Points)", color=color2, fontsize=10, labelpad=8)
    ax2.tick_params(axis="y", labelcolor=color2)

    add_derived_period_shading(ax1, y_pos=0.92)

    ax1.xaxis.set_major_locator(mdates.YearLocator(2))
    ax1.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    plt.title("Synthetic Freight Rate vs. Baltic Dry Index (BDI) — Newcastle to Paradip (Capesize)", fontsize=11.5, fontweight="bold", pad=12)

    # Combined legend
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc="upper left", frameon=True, facecolor="white", edgecolor="#cccccc", fontsize=9)

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_FIGURES_DIR, "chart3_rate_vs_bdi_dual_axis.png")
    plt.savefig(out_path)
    plt.close()
    return out_path


def plot_chart4_cost_breakdown(df: pd.DataFrame, cfg: Dict) -> str:
    """Chart 4: Stacked component breakdown (hire, bunker, port costs per MT) over time."""
    fig, ax = plt.subplots(figsize=(11, 5.5), dpi=300)

    # Sample route: Newcastle -> Paradip Panamax
    sample_route = "NEW_PRT"
    v_class = "Panamax"
    sub = df[(df["route_id"] == sample_route) & (df["vessel_class"] == v_class)].sort_values("date").copy()

    parcel_mt = cfg.get("vessel_classes", {}).get(v_class, {}).get("parcel_size_mt", 70000)

    sub["hire_cost_per_mt"] = (sub["hire_usd_per_day"] * sub["voyage_days"]) / parcel_mt
    sub["bunker_cost_per_mt"] = sub["bunker_cost"] / parcel_mt
    sub["port_cost_per_mt"] = sub["port_costs"] / parcel_mt

    dates = sub["date"]
    hire_comp = sub["hire_cost_per_mt"].values
    bunker_comp = sub["bunker_cost_per_mt"].values
    port_comp = sub["port_cost_per_mt"].values

    ax.stackplot(
        dates,
        hire_comp,
        bunker_comp,
        port_comp,
        labels=["TCE Charter Hire ($/MT)", "VLSFO Fuel Bunker ($/MT)", "Port Dues & Charges ($/MT)"],
        colors=["#339af0", "#ff922b", "#51cf66"],
        alpha=0.85,
    )

    add_derived_period_shading(ax, y_pos=0.92)

    ax.set_title("Stacked Cost Breakdown per Metric Ton — Newcastle to Paradip (Panamax)", fontsize=12, fontweight="bold", pad=12)
    ax.set_xlabel("Date (Weekly, Friday)", fontsize=10, labelpad=8)
    ax.set_ylabel("Voyage Cost Components (USD / MT)", fontsize=10, labelpad=8)
    ax.grid(True)
    ax.xaxis.set_major_locator(mdates.YearLocator(2))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax.legend(loc="upper left", frameon=True, facecolor="white", edgecolor="#cccccc", fontsize=9)

    plt.tight_layout()
    out_path = os.path.join(OUTPUT_FIGURES_DIR, "chart4_cost_breakdown_stacked.png")
    plt.savefig(out_path)
    plt.close()
    return out_path


def main() -> None:
    setup_plot_style()
    os.makedirs(OUTPUT_FIGURES_DIR, exist_ok=True)

    if not os.path.exists(PROCESSED_PARQUET):
        raise FileNotFoundError(f"Parquet file not found at: {PROCESSED_PARQUET}")

    df = pd.read_parquet(PROCESSED_PARQUET)
    df["date"] = pd.to_datetime(df["date"])
    cfg = load_routes_config()

    print("Generating visualization charts...")
    c1 = plot_chart1_weekly_rates(df, cfg)
    c2 = plot_chart2_rate_vs_distance(df, cfg)
    c3 = plot_chart3_rate_vs_bdi(df)
    c4 = plot_chart4_cost_breakdown(df, cfg)

    saved_files = [c1, c2, c3, c4]
    print("\nSuccessfully generated all 4 charts:")
    for f in saved_files:
        print(f"  - {os.path.relpath(f, PROJECT_ROOT)} ({os.path.getsize(f):,} bytes)")


if __name__ == "__main__":
    main()
