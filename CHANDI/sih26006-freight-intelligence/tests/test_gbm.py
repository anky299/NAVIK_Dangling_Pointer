"""Unit tests for LightGBM BDI forecasting models and feature filtering."""

import os
import numpy as np
import pandas as pd
import pytest
import lightgbm as lgb

from src.models.gbm import get_gbm_features, train_quantile_lgb, HORIZONS, QUANTILES, MODELS_DIR


@pytest.fixture
def sample_master_df():
    """Create a mock master dataframe with both valid and subindex features."""
    dates = pd.date_range("2018-01-05", periods=60, freq="W-FRI")
    data = {
        "date": dates,
        "is_derived": [False] * 60,
        "bdi": 1500.0 + np.random.randn(60) * 100,
        "bdi_lag_1w": 1500.0 + np.random.randn(60) * 100,
        "brent_crude": 75.0 + np.random.randn(60) * 5,
        "is_monsoon": [False] * 60,
        # Subindices that must be excluded
        "bci": 2000.0 + np.random.randn(60) * 200,
        "bci_lag_1w": 2000.0 + np.random.randn(60) * 200,
        "bpi": 1600.0 + np.random.randn(60) * 100,
        "bsi_rolling_mean_4w": 1400.0 + np.random.randn(60) * 80,
        "bhsi_pct_chg_1w": np.random.randn(60) * 0.05,
    }
    return pd.DataFrame(data)


def test_get_gbm_features_excludes_subindices(sample_master_df):
    """Test that get_gbm_features strictly excludes BCI, BPI, BSI, and BHSI."""
    features = get_gbm_features(sample_master_df)

    assert "date" not in features
    assert "is_derived" not in features

    # Ensure none of the sub-index prefixes exist
    subindex_prefixes = ["bci", "bpi", "bsi", "bhsi"]
    for feat in features:
        for prefix in subindex_prefixes:
            assert not (feat == prefix or feat.startswith(f"{prefix}_"))

    # Valid features must be kept
    assert "bdi" in features
    assert "bdi_lag_1w" in features
    assert "brent_crude" in features
    assert "is_monsoon" in features


def test_train_quantile_lgb_training():
    """Test training quantile models with early stopping."""
    np.random.seed(42)
    X_train = pd.DataFrame(np.random.randn(80, 5), columns=[f"feat_{i}" for i in range(5)])
    y_train = pd.Series(1000 + X_train["feat_0"] * 200 + np.random.randn(80) * 50)

    X_val = pd.DataFrame(np.random.randn(20, 5), columns=[f"feat_{i}" for i in range(5)])
    y_val = pd.Series(1000 + X_val["feat_0"] * 200 + np.random.randn(20) * 50)

    booster = train_quantile_lgb(X_train, y_train, X_val, y_val, alpha=0.50, seed=42)
    assert booster is not None

    preds = booster.predict(X_val)
    assert len(preds) == len(X_val)
    assert not np.isnan(preds).any()


def test_saved_models_exist_and_loadable():
    """Test that all saved production models in models/ are loadable boosters."""
    for h in HORIZONS:
        for alpha in QUANTILES:
            model_name = f"gbm_bdi_h{h}_q{int(alpha*100)}.txt"
            model_path = os.path.join(MODELS_DIR, model_name)
            assert os.path.exists(model_path), f"Missing model: {model_name}"

            booster = lgb.Booster(model_file=model_path)
            assert booster.num_trees() > 0
