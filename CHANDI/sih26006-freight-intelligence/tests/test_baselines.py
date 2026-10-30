"""Unit tests for time-series cross-validation and baseline models."""

import numpy as np
import pandas as pd
import pytest

from src.models.validation import make_folds, CVFold, EXTREME_REGIME_START, EXTREME_REGIME_END
from src.models.baselines import forecast_naive, forecast_seasonal_naive, forecast_sarimax


@pytest.fixture
def synthetic_bdi_series():
    """Create a 300-week synthetic BDI series."""
    dates = pd.date_range("2016-01-01", periods=350, freq="W-FRI")
    values = 1500 + np.sin(np.linspace(0, 20, 350)) * 500
    return pd.Series(values, index=dates, name="bdi")


def test_make_folds_structure(synthetic_bdi_series):
    """Test that make_folds returns correct fold structure for all horizons."""
    horizons = [1, 4, 8, 12]
    folds_dict = make_folds(synthetic_bdi_series, horizons=horizons, min_train_weeks=260, step_weeks=13)

    assert set(folds_dict.keys()) == set(horizons)

    for h in horizons:
        folds = folds_dict[h]
        assert len(folds) > 0
        for i, fold in enumerate(folds):
            assert isinstance(fold, CVFold)
            assert fold.fold_idx == i
            assert fold.horizon_weeks == h
            # Verify expanding window: train_start is always the very first date
            assert fold.train_start == synthetic_bdi_series.index[0]
            # Verify gap of h weeks: test_date must be strictly h weeks after train_end
            expected_test_date = synthetic_bdi_series.index[
                synthetic_bdi_series.index.get_loc(fold.train_end) + h
            ]
            assert fold.test_date == expected_test_date


def test_make_folds_no_lookahead_leakage(synthetic_bdi_series):
    """Verify that test dates never overlap with training period."""
    folds_dict = make_folds(synthetic_bdi_series, horizons=[1, 4, 8, 12], min_train_weeks=260, step_weeks=13)

    for h, folds in folds_dict.items():
        for fold in folds:
            assert fold.test_date > fold.train_end


def test_extreme_regime_flag():
    """Verify that folds whose test window overlaps 2020-01-01 to 2021-12-31 are flagged."""
    dates = pd.date_range("2015-01-02", periods=400, freq="W-FRI")
    series = pd.Series(1000.0, index=dates)
    folds = make_folds(series, horizons=[4], min_train_weeks=260, step_weeks=13)[4]

    extreme_start = pd.Timestamp("2020-01-01")
    extreme_end = pd.Timestamp("2021-12-31")

    for f in folds:
        test_window_start = f.train_end + pd.Timedelta(weeks=1)
        test_window_end = f.test_date
        overlaps = max(test_window_start, extreme_start) <= min(test_window_end, extreme_end)
        assert f.in_extreme_regime == overlaps


def test_forecast_naive():
    """Naive model predicts the last observed value in training."""
    s = pd.Series([100, 200, 350], index=pd.date_range("2020-01-03", periods=3, freq="W-FRI"))
    pred = forecast_naive(s, h=4)
    assert pred == 350.0


def test_forecast_seasonal_naive():
    """Seasonal naive predicts the value from 52 weeks prior to test date."""
    dates = pd.date_range("2018-01-05", periods=60, freq="W-FRI")
    values = list(range(60))
    s = pd.Series(values, index=dates)
    # For h=4: lookback = 52 - 4 = 48 weeks before train-end
    # len(s) = 60, idx = 59 - 48 = 11 -> value 11
    pred = forecast_seasonal_naive(s, h=4)
    assert pred == 11.0


def test_forecast_sarimax_valid():
    """SARIMAX runs and returns a plausible numeric float."""
    dates = pd.date_range("2018-01-05", periods=80, freq="W-FRI")
    bdi = pd.Series(1500.0 + np.arange(80) * 2.0, index=dates)
    master_slice = pd.DataFrame({
        "date": dates,
        "brent_crude_lag_1w": 70.0 + np.random.randn(80),
        "is_monsoon": [False] * 80
    })
    test_row = pd.Series({"brent_crude_lag_1w": 75.0, "is_monsoon": False})

    pred = forecast_sarimax(bdi, master_slice, h=4, test_master_row=test_row)
    assert isinstance(pred, float)
    assert not np.isnan(pred)
    assert 1000 < pred < 3000
