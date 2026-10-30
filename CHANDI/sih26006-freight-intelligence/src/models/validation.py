"""
Expanding-window time-series cross-validation for weekly BDI forecasting.

Scheme
------
- Series  : weekly BDI, all rows where BDI is non-null (real + synthetically
            derived post-2019). Observations are ordered by date ascending.
- Training : starts from the first available BDI observation and expands by
             ``step`` weeks per fold. Minimum training size is ``min_train_weeks``.
- Gap      : a gap of exactly ``h`` weeks is left between the last training
             observation and the first test observation so that no future
             information leaks into features computed up to train-end.
- Test     : a single observation at week t_train_end + h.

Regime note
-----------
2020-2021 is an extreme volatility regime (COVID-19 demand collapse followed
by the 2021 dry-bulk super-cycle). Metrics are reported both including and
excluding weeks that fall in 2020-01-01 to 2021-12-31 so that regime
sensitivity is visible.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

import pandas as pd


EXTREME_REGIME_START = pd.Timestamp("2020-01-01")
EXTREME_REGIME_END = pd.Timestamp("2021-12-31")


@dataclass
class CVFold:
    """One expanding-window fold for horizon h."""

    fold_idx: int
    horizon_weeks: int
    train_start: pd.Timestamp
    train_end: pd.Timestamp      # last date included in training
    test_date: pd.Timestamp      # date of the single test observation
    in_extreme_regime: bool      # True if test_date falls in 2020-2021


def make_folds(
    bdi_series: pd.Series,
    horizons: List[int] = (1, 4, 8, 12),
    min_train_weeks: int = 260,   # ~5 years
    step_weeks: int = 13,         # advance 1 quarter per fold
) -> dict[int, List[CVFold]]:
    """
    Build expanding-window CV folds for every horizon in ``horizons``.

    Parameters
    ----------
    bdi_series : pd.Series
        Indexed by pd.DatetimeIndex (weekly Friday), values are BDI points.
        Must already be sorted ascending and contain no NaNs.
    horizons : list of int
        Forecast horizons in weeks.
    min_train_weeks : int
        Minimum number of training observations before the first fold.
        Default 260 ≈ 5 years of weekly data.
    step_weeks : int
        Number of weeks to advance the training window per fold.

    Returns
    -------
    dict mapping horizon -> list of CVFold
    """
    if not bdi_series.index.is_monotonic_increasing:
        raise ValueError("bdi_series must be sorted by date ascending.")

    if bdi_series.isna().any():
        raise ValueError("bdi_series must not contain NaN values.")

    dates = bdi_series.index.to_list()
    n = len(dates)

    folds_by_horizon: dict[int, List[CVFold]] = {}

    for h in horizons:
        folds: List[CVFold] = []
        fold_idx = 0
        # train_end_pos is the 0-based index of the last training observation
        train_end_pos = min_train_weeks - 1

        while train_end_pos + h < n:
            test_pos = train_end_pos + h
            train_start = dates[0]
            train_end = dates[train_end_pos]
            test_date = dates[test_pos]

            # Define extreme regime overlap explicitly: drop any fold whose test window
            # [train_end + 1 week, test_date] overlaps 2020-01-01 to 2021-12-31
            test_window_start = train_end + pd.Timedelta(days=7)
            test_window_end = test_date
            in_extreme = (test_window_start <= EXTREME_REGIME_END) and (test_window_end >= EXTREME_REGIME_START)

            folds.append(
                CVFold(
                    fold_idx=fold_idx,
                    horizon_weeks=h,
                    train_start=train_start,
                    train_end=train_end,
                    test_date=test_date,
                    in_extreme_regime=in_extreme,
                )
            )
            fold_idx += 1
            train_end_pos += step_weeks

        folds_by_horizon[h] = folds

    return folds_by_horizon


def folds_summary(folds_by_horizon: dict[int, List[CVFold]]) -> pd.DataFrame:
    """Return a tidy DataFrame summarising all folds across horizons."""
    rows = []
    for h, folds in folds_by_horizon.items():
        for f in folds:
            rows.append(
                {
                    "horizon_weeks": h,
                    "fold_idx": f.fold_idx,
                    "train_start": f.train_start.date(),
                    "train_end": f.train_end.date(),
                    "test_date": f.test_date.date(),
                    "in_extreme_regime": f.in_extreme_regime,
                }
            )
    return pd.DataFrame(rows)


if __name__ == "__main__":
    import os
    import sys

    PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    sys.path.insert(0, PROJECT_ROOT)

    master = pd.read_parquet(
        os.path.join(PROJECT_ROOT, "data", "processed", "master.parquet")
    )
    master["date"] = pd.to_datetime(master["date"])
    master = master.sort_values("date")

    bdi = master.dropna(subset=["bdi"]).set_index("date")["bdi"]

    folds = make_folds(bdi)
    summary = folds_summary(folds)

    for h in (1, 4, 8, 12):
        subset = summary[summary["horizon_weeks"] == h]
        n_total = len(subset)
        n_extreme = subset["in_extreme_regime"].sum()
        print(
            f"h={h:2d}w | folds={n_total:3d} | "
            f"extreme-regime folds={n_extreme:2d} | "
            f"first test {subset.iloc[0]['test_date']} | "
            f"last test {subset.iloc[-1]['test_date']}"
        )
