"""
Baseline forecast models for weekly BDI.

Models
------
naive          : BDI(t+h) = BDI(t)           (random-walk / last-value)
seasonal_naive : BDI(t+h) = BDI(t - 52 + h)  (same week one year ago)
sarimax        : SARIMA(1,1,1)(1,1,0,52) with a small set of exogenous
                 regressors (brent_crude_lag_1w, iron_ore_lag_1w, is_monsoon).
                 Direct multi-step: a separate model is fitted for each
                 horizon h so the target is always BDI at t+h with features
                 computed only up to t.

Metrics
-------
For every (model, horizon, fold): MAE, RMSE, MAPE.
Summary table: mean across folds — reported ALL folds and EXCLUDING the
2020-2021 extreme regime.

Regime note (docstring as requested)
--------------------------------------
The 2020-2021 window is an extreme regime:
- 2020: COVID-19 caused a sharp demand collapse in H1 followed by a
  partial recovery in H2.
- 2021: a Chinese energy crunch combined with container overflow into dry
  bulk drove BDI to a 13-year high above 5,600 points in October 2021.
All three baseline models are expected to perform significantly worse in
that window. Metrics are reported with and without these years so that
readers can assess regime sensitivity before concluding on model adequacy.
"""

from __future__ import annotations

import os
import sys
import warnings
from typing import List, Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, PROJECT_ROOT)

from src.models.validation import CVFold, make_folds, EXTREME_REGIME_START, EXTREME_REGIME_END

HORIZONS = [1, 4, 8, 12]
DOCS_DIR = os.path.join(PROJECT_ROOT, "docs")
FIGS_DIR = os.path.join(PROJECT_ROOT, "docs", "figures")
os.makedirs(FIGS_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Metric helpers
# ---------------------------------------------------------------------------

def _mae(actual: np.ndarray, pred: np.ndarray) -> float:
    return float(np.mean(np.abs(actual - pred)))


def _rmse(actual: np.ndarray, pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((actual - pred) ** 2)))


def _mape(actual: np.ndarray, pred: np.ndarray) -> float:
    mask = actual != 0
    if mask.sum() == 0:
        return float("nan")
    return float(np.mean(np.abs((actual[mask] - pred[mask]) / actual[mask])) * 100)


# ---------------------------------------------------------------------------
# Baseline: Naive (last observed value)
# ---------------------------------------------------------------------------

def forecast_naive(
    train_bdi: pd.Series, h: int
) -> float:
    """Return the last value in training as the h-step forecast."""
    return float(train_bdi.iloc[-1])


# ---------------------------------------------------------------------------
# Baseline: Seasonal Naive (same week one year ago, i.e. lag-52)
# ---------------------------------------------------------------------------

def forecast_seasonal_naive(
    train_bdi: pd.Series, h: int
) -> float:
    """
    Return BDI from (52 - h) weeks before train-end as the h-step forecast,
    which corresponds to the observation one year prior to the test date.
    Falls back to naive if fewer than 52 observations are available.
    """
    lookback = 52 - h
    if lookback < 0:
        # h > 52 not expected here, but guard anyway
        lookback = 0
    idx = len(train_bdi) - 1 - lookback
    if idx < 0:
        return float(train_bdi.iloc[-1])
    return float(train_bdi.iloc[idx])


# ---------------------------------------------------------------------------
# Baseline: SARIMAX
# ---------------------------------------------------------------------------

# Exogenous features that are known at time t and are lag-safe for horizon h >= 1.
# iron_ore_lag_1w is not produced by the pipeline (iron_ore is monthly/forward-filled);
# brent_crude_lag_1w is the 1-week lag of Brent crude daily data.
_EXOG_COLS = ["brent_crude_lag_1w", "is_monsoon"]

# SARIMA order: (p,d,q)(P,D,Q,s)
# Simple settings: ARIMA(1,1,1) with quarterly seasonality (s=4) and exogenous regressors
_ORDER = (1, 1, 1)
_SEASONAL_ORDER = (1, 0, 0, 4)


def _prepare_exog(master_slice: pd.DataFrame) -> Optional[pd.DataFrame]:
    """Extract and clean exogenous columns from a master slice, indexed by date."""
    available = [c for c in _EXOG_COLS if c in master_slice.columns]
    if not available:
        return None
    exog = master_slice.set_index("date")[available].copy()
    exog = exog.ffill(limit=5)
    if exog.isna().any().any():
        exog = exog.fillna(exog.median())
    return exog.astype(float)


def forecast_sarimax(
    train_bdi: pd.Series,
    train_master: pd.DataFrame,
    h: int,
    test_master_row: pd.Series,
) -> float:
    """
    Fit SARIMAX on the training window and produce a direct h-step forecast.
    Returns a single float prediction. Falls back to naive on any fitting error.
    """
    if len(train_bdi) < 50:
        return float(train_bdi.iloc[-1])

    train_exog = _prepare_exog(train_master)

    # Build forecast exog: h rows, one per step ahead
    if train_exog is not None:
        available = list(train_exog.columns)
        fcast_exog_vals = []
        for c in available:
            val = test_master_row.get(c, np.nan)
            if pd.isna(val):
                val = float(train_exog[c].iloc[-1])
            fcast_exog_vals.append(float(val))
        fcast_exog = pd.DataFrame(
            [fcast_exog_vals] * h, columns=available
        )
    else:
        fcast_exog = None

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = SARIMAX(
                train_bdi,
                exog=train_exog,
                order=_ORDER,
                seasonal_order=_SEASONAL_ORDER,
                enforce_stationarity=False,
                enforce_invertibility=False,
            )
            result = model.fit(disp=False, maxiter=50)
            fcast = result.forecast(steps=h, exog=fcast_exog)
            return float(fcast.iloc[-1])
    except Exception:
        return float(train_bdi.iloc[-1])


# ---------------------------------------------------------------------------
# Run backtest
# ---------------------------------------------------------------------------

def run_backtest(master: pd.DataFrame) -> pd.DataFrame:
    """
    Run all three baselines across all horizons using expanding-window CV.

    Returns a tidy DataFrame with one row per (model, horizon, fold).
    """
    master = master.sort_values("date").copy()
    master = master.dropna(subset=["bdi"]).reset_index(drop=True)

    bdi = master.set_index("date")["bdi"]
    folds_by_h = make_folds(bdi, horizons=HORIZONS)

    rows = []
    for h, folds in folds_by_h.items():
        print(f"\n--- Horizon h={h}w: {len(folds)} folds ---")
        for fold in folds:
            # Training slice (all rows up to and including train_end)
            train_mask = master["date"] <= fold.train_end
            train_master_df = master.loc[train_mask].copy()
            train_bdi_s = train_master_df.set_index("date")["bdi"]

            # Test row
            test_mask = master["date"] == fold.test_date
            if test_mask.sum() == 0:
                continue
            test_row = master.loc[test_mask].iloc[0]
            actual = float(test_row["bdi"])

            # --- Naive ---
            pred_naive = forecast_naive(train_bdi_s, h)

            # --- Seasonal Naive ---
            pred_sn = forecast_seasonal_naive(train_bdi_s, h)

            # --- SARIMAX ---
            pred_sarimax = forecast_sarimax(
                train_bdi_s, train_master_df, h, test_row
            )

            for model_name, pred in [
                ("naive", pred_naive),
                ("seasonal_naive", pred_sn),
                ("sarimax", pred_sarimax),
            ]:
                rows.append(
                    {
                        "model": model_name,
                        "horizon_weeks": h,
                        "fold_idx": fold.fold_idx,
                        "train_end": fold.train_end,
                        "test_date": fold.test_date,
                        "actual": actual,
                        "predicted": pred,
                        "mae": abs(actual - pred),
                        "se": (actual - pred) ** 2,
                        "ape": abs(actual - pred) / actual * 100 if actual != 0 else np.nan,
                        "in_extreme_regime": fold.in_extreme_regime,
                    }
                )
            if fold.fold_idx % 5 == 0:
                print(
                    f"  fold {fold.fold_idx:3d} | train_end={fold.train_end.date()} "
                    f"test={fold.test_date.date()} | actual={actual:.0f}"
                )

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Metrics summary
# ---------------------------------------------------------------------------

def metrics_table(results: pd.DataFrame, exclude_extreme: bool = False) -> pd.DataFrame:
    """Compute mean MAE, RMSE, MAPE per (model, horizon)."""
    df = results.copy()
    if exclude_extreme:
        df = df[~df["in_extreme_regime"]]

    summary = (
        df.groupby(["model", "horizon_weeks"])
        .agg(
            n_folds=("mae", "count"),
            MAE=("mae", "mean"),
            RMSE=("se", lambda x: np.sqrt(x.mean())),
            MAPE=("ape", "mean"),
        )
        .reset_index()
    )
    summary = summary.sort_values(["horizon_weeks", "model"])
    return summary


# ---------------------------------------------------------------------------
# Markdown report
# ---------------------------------------------------------------------------

def write_metrics_md(results: pd.DataFrame, out_path: str) -> None:
    """Write a Markdown metrics table to out_path."""
    tbl_all = metrics_table(results, exclude_extreme=False)
    tbl_no_ext = metrics_table(results, exclude_extreme=True)

    n_extreme = results[results["in_extreme_regime"]]["fold_idx"].nunique()

    lines = [
        "# Baseline Forecast Metrics — Weekly BDI",
        "",
        "**Target**: BDI level at week t+h, forecast from features known at week t.  ",
        "**Series**: all weekly BDI observations (real history + synthetically derived post-2019).  ",
        "**CV scheme**: expanding window, min 5 years training, 13-week step, h-week gap.  ",
        "**Horizons**: 1, 4, 8, 12 weeks.",
        "",
        "> **Regime note**: 2020-2021 is an extreme volatility regime.  ",
        "> 2020: COVID-19 demand collapse. 2021: dry-bulk super-cycle (BDI > 5,600 pts).  ",
        "> Metrics are reported with and without this period so regime sensitivity is visible.",
        "",
        "---",
        "",
        "## All Folds (including 2020–2021 extreme regime)",
        "",
        _df_to_md(tbl_all),
        "",
        "---",
        "",
        "## Excluding 2020–2021 Extreme Regime",
        "",
        _df_to_md(tbl_no_ext),
        "",
        "---",
        "",
        "## Notes",
        "- **naive**: predicts BDI(t+h) = BDI(t). Equivalent to a random-walk forecast.",
        "- **seasonal_naive**: predicts the same week one year ago.",
        "- **sarimax**: SARIMA(1,1,1)(1,0,0,4) with exogenous regressors",
        "  `brent_crude_lag_1w` and `is_monsoon`.",
        "  A separate model is fitted per fold using only training data (direct multi-step).",
        "- MAPE is in percent. MAE and RMSE are in BDI index points.",
    ]

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Saved metrics to {out_path}")


def _df_to_md(df: pd.DataFrame) -> str:
    """Convert a DataFrame to a Markdown table string."""
    df = df.copy()
    df["MAE"] = df["MAE"].map("{:.1f}".format)
    df["RMSE"] = df["RMSE"].map("{:.1f}".format)
    df["MAPE"] = df["MAPE"].map("{:.2f}%".format)
    df.columns = [c.replace("_", " ") for c in df.columns]
    header = "| " + " | ".join(df.columns) + " |"
    sep = "| " + " | ".join(["---"] * len(df.columns)) + " |"
    rows = ["| " + " | ".join(str(v) for v in row) + " |" for row in df.itertuples(index=False)]
    return "\n".join([header, sep] + rows)


# ---------------------------------------------------------------------------
# Backtest chart (h=4)
# ---------------------------------------------------------------------------

def plot_backtest(results: pd.DataFrame, out_path: str, h: int = 4) -> None:
    """
    Plot actual vs predicted BDI for the h-week horizon backtest,
    one line per model. Shade the 2020-2021 extreme regime.
    """
    sub = results[results["horizon_weeks"] == h].copy()
    sub = sub.sort_values("test_date")

    models = sub["model"].unique()
    colors = {"naive": "#868e96", "seasonal_naive": "#1971c2", "sarimax": "#2f9e44"}
    ls = {"naive": "--", "seasonal_naive": "-.", "sarimax": "-"}

    fig, ax = plt.subplots(figsize=(12, 5.5), dpi=200)

    # Actual (one line, from naive results which all share the same actual)
    actuals = sub[sub["model"] == models[0]][["test_date", "actual"]].drop_duplicates()
    ax.plot(actuals["test_date"], actuals["actual"], color="#212529", linewidth=2,
            label="Actual BDI", zorder=5)

    # Predicted lines
    for m in models:
        m_df = sub[sub["model"] == m]
        ax.plot(m_df["test_date"], m_df["predicted"],
                color=colors.get(m, "#adb5bd"),
                linestyle=ls.get(m, "-"),
                linewidth=1.4,
                alpha=0.85,
                label=m.replace("_", " ").title())

    # Extreme regime shading
    ax.axvspan(EXTREME_REGIME_START, EXTREME_REGIME_END,
               color="#ffe3e3", alpha=0.55, zorder=0,
               label="2020–2021 Extreme Regime")

    ax.set_title(f"BDI Backtest: Actual vs Predicted — {h}-Week Ahead Horizon", fontsize=12, fontweight="bold", pad=12)
    ax.set_xlabel("Test Week (Friday)", fontsize=10)
    ax.set_ylabel("BDI Index Points", fontsize=10)
    ax.grid(True, linestyle="--", alpha=0.5)
    ax.xaxis.set_major_locator(mdates.YearLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax.legend(loc="upper left", frameon=True, facecolor="white", edgecolor="#cccccc", fontsize=9)
    plt.tight_layout()
    plt.savefig(out_path)
    plt.close()
    print(f"Saved backtest chart to {out_path}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    master = pd.read_parquet(
        os.path.join(PROJECT_ROOT, "data", "processed", "master.parquet")
    )
    master["date"] = pd.to_datetime(master["date"])

    print("Running baseline backtest...")
    results = run_backtest(master)

    print("\n=== Metrics: ALL folds (including 2020-2021) ===")
    tbl = metrics_table(results, exclude_extreme=False)
    print(tbl.to_string(index=False))

    print("\n=== Metrics: EXCLUDING 2020-2021 extreme regime ===")
    tbl_nx = metrics_table(results, exclude_extreme=True)
    print(tbl_nx.to_string(index=False))

    write_metrics_md(results, os.path.join(DOCS_DIR, "metrics_baselines.md"))

    chart_path = os.path.join(FIGS_DIR, "backtest_h4_baselines.png")
    plot_backtest(results, chart_path, h=4)

    # Save raw results for downstream use
    results_path = os.path.join(PROJECT_ROOT, "data", "processed", "baseline_results.parquet")
    results.to_parquet(results_path, index=False)
    print(f"Saved raw results to {results_path}")
