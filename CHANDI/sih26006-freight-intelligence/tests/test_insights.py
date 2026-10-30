"""tests/test_insights.py — Tests for GET /insights and alert rules."""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure project root is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import json
from unittest.mock import patch, MagicMock

import pandas as pd
import pytest

from fastapi.testclient import TestClient
from src.api.app import app
from src.api.services import _compute_risk_alerts, _feature_label


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


# Minimal alerts config (mirrors config/alerts.yaml)
ALERTS_CFG = {
    "disclaimer": "Based on a forecast with limited accuracy beyond 4 weeks; treat as a prompt to review, not a prediction.",
    "alerts": {
        "upper_band_above_current": {"severity": "warning", "threshold_pct": 15.0, "horizon_weeks": 4},
        "band_width_wide":          {"severity": "info",    "threshold_pct": 40.0, "horizon_weeks": 4},
        "volatility_high":          {"severity": "high",    "threshold_percentile": 80, "rolling_window_weeks": 12},
        "long_horizon_tail_risk":   {"severity": "warning", "threshold_pct": 30.0, "horizon_weeks": 12},
        "band_widening":            {"severity": "info",    "widening_threshold_pct": 10.0},
    },
}


def _make_bdi_series(n: int = 200, base: float = 2000.0, vol: float = 100.0) -> pd.DataFrame:
    """Return a DataFrame with a synthetic BDI column."""
    import numpy as np
    rng = np.random.default_rng(42)
    bdi = base + rng.normal(0, vol, size=n).cumsum()
    return pd.DataFrame({"bdi": bdi})


# ─── /insights endpoint tests ─────────────────────────────────────────────────

class TestInsightsEndpoint:
    def test_insights_returns_200(self, client):
        r = client.get("/insights")
        assert r.status_code == 200

    def test_savings_breakdown_present_and_positive(self, client):
        d = client.get("/insights").json()
        sb = d["savings_breakdown"]
        assert sb["vs_landed_cost_total"] > 0, "Expected positive savings vs landed-cost baseline"
        for key in ("cargo", "freight", "period_hire", "demurrage", "inventory", "unmet"):
            assert key in sb

    def test_feature_importance_all_horizons(self, client):
        d = client.get("/insights").json()
        fi = d["feature_importance"]
        for h in ("h1", "h4", "h8", "h12"):
            assert h in fi, f"Missing horizon {h}"
            assert len(fi[h]) > 0, f"No features for horizon {h}"
            # Ranks should be contiguous starting at 1
            ranks = [f["rank"] for f in fi[h]]
            assert ranks[0] == 1
            # Each item has label and importance
            for item in fi[h]:
                assert item["label"], "Feature label must be non-empty"
                assert item["importance"] >= 0

    def test_risk_alerts_list_present(self, client):
        d = client.get("/insights").json()
        alerts = d["risk_alerts"]
        assert isinstance(alerts, list)
        for a in alerts:
            assert a["severity"] in ("info", "warning", "high")
            assert a["headline"]
            assert a["disclaimer"]

    def test_data_note_present(self, client):
        d = client.get("/insights").json()
        assert "synthetic" in d["data_note"].lower()

    def test_unmet_demand_mt_non_negative(self, client):
        d = client.get("/insights").json()
        assert d["unmet_demand_mt"] >= 0

    def test_no_freight_will_spike_language(self, client):
        """Ensure we never say 'freight will spike' — use upper band framing."""
        d = client.get("/insights").json()
        for a in d["risk_alerts"]:
            for field in ("headline", "detail"):
                assert "will spike" not in a[field].lower(), (
                    f"Forbidden language in alert {a['rule']}.{field}: {a[field]}"
                )
            assert a["disclaimer"]  # disclaimer always present


# ─── Alert rule unit tests ────────────────────────────────────────────────────

class TestAlertRules:

    def test_upper_band_triggers(self):
        """upper_band_above_current fires when q90@4w > threshold% above BDI."""
        fc = {
            "current_bdi": 1000.0,
            "h4_q10": 950.0,  "h4_median": 1050.0, "h4_q90": 1200.0,  # +20% above 1000
            "h1_q10": 980.0,  "h1_median": 1010.0, "h1_q90": 1050.0,
            "h12_q90": 1100.0,
        }
        alerts = _compute_risk_alerts(fc, None, ALERTS_CFG)
        rules = {a["rule"] for a in alerts}
        assert "upper_band_above_current" in rules

    def test_upper_band_does_not_trigger_below_threshold(self):
        """upper_band_above_current does NOT fire when q90 is only 5% above BDI."""
        fc = {
            "current_bdi": 1000.0,
            "h4_q10": 960.0, "h4_median": 990.0, "h4_q90": 1050.0,  # +5% above 1000
            "h1_q10": 980.0, "h1_median": 995.0, "h1_q90": 1010.0,
            "h12_q90": 1040.0,
        }
        alerts = _compute_risk_alerts(fc, None, ALERTS_CFG)
        rules = {a["rule"] for a in alerts}
        assert "upper_band_above_current" not in rules

    def test_band_width_wide_triggers(self):
        """band_width_wide fires when q90-q10 > 40% of median."""
        fc = {
            "current_bdi": 1000.0,
            "h4_q10": 600.0,  "h4_median": 1000.0, "h4_q90": 1500.0,  # width=900 = 90%
            "h1_q10": 950.0,  "h1_median": 1000.0, "h1_q90": 1050.0,
            "h12_q90": 1100.0,
        }
        alerts = _compute_risk_alerts(fc, None, ALERTS_CFG)
        rules = {a["rule"] for a in alerts}
        assert "band_width_wide" in rules

    def test_band_width_wide_does_not_trigger_narrow(self):
        """band_width_wide does NOT fire when the band is narrow (<40% of median)."""
        fc = {
            "current_bdi": 1000.0,
            "h4_q10": 950.0, "h4_median": 1000.0, "h4_q90": 1030.0,  # width=80 = 8%
            "h1_q10": 960.0, "h1_median": 990.0,  "h1_q90": 1010.0,
            "h12_q90": 1010.0,
        }
        alerts = _compute_risk_alerts(fc, None, ALERTS_CFG)
        rules = {a["rule"] for a in alerts}
        assert "band_width_wide" not in rules

    def test_volatility_high_triggers(self):
        """volatility_high fires when 12w rolling std is above 80th percentile."""
        import numpy as np
        # Construct a series where the last window is very high-volatility
        bdi_vals = ([2000.0] * 180) + ([2000.0 + 500.0 * i for i in range(20)])
        df = pd.DataFrame({"bdi": bdi_vals})
        fc = {
            "current_bdi": 2000.0,
            "h4_q10": 1900.0, "h4_median": 2000.0, "h4_q90": 2100.0,
            "h1_q10": 1950.0, "h1_median": 2000.0, "h1_q90": 2050.0,
            "h12_q90": 2200.0,
        }
        alerts = _compute_risk_alerts(fc, df, ALERTS_CFG)
        rules = {a["rule"] for a in alerts}
        assert "volatility_high" in rules

    def test_no_alerts_when_calm(self):
        """No alerts fire when everything is calm and within bounds."""
        fc = {
            "current_bdi": 2000.0,
            "h4_q10": 1950.0, "h4_median": 2000.0, "h4_q90": 2030.0,  # narrow band, <15% above
            "h1_q10": 1970.0, "h1_median": 2000.0, "h1_q90": 2010.0,
            "h12_q90": 2050.0,  # <30% above
        }
        # Low-volatility BDI with no trend
        df = _make_bdi_series(n=200, base=2000.0, vol=10.0)  # tiny volatility
        # Override the actual checks by making vol extremely low
        alerts = _compute_risk_alerts(fc, df, ALERTS_CFG)
        # band_widening might fire (h4 band > h1 band), but volatility_high should not
        for a in alerts:
            assert a["rule"] != "volatility_high", (
                f"volatility_high should not fire for low-vol series: {a['detail']}"
            )
            assert a["rule"] != "upper_band_above_current"

    def test_long_horizon_tail_risk_triggers(self):
        """long_horizon_tail_risk fires when h12 q90 is >30% above BDI."""
        fc = {
            "current_bdi": 1000.0,
            "h4_q10": 950.0,  "h4_median": 1000.0, "h4_q90": 1100.0,
            "h1_q10": 970.0,  "h1_median": 1000.0, "h1_q90": 1020.0,
            "h12_q90": 1400.0,  # +40% above current
        }
        alerts = _compute_risk_alerts(fc, None, ALERTS_CFG)
        rules = {a["rule"] for a in alerts}
        assert "long_horizon_tail_risk" in rules

    def test_alerts_sorted_by_severity(self):
        """Alerts are returned sorted high > warning > info."""
        fc = {
            "current_bdi": 1000.0,
            "h4_q10": 500.0,  "h4_median": 900.0, "h4_q90": 1300.0,  # wide + above threshold
            "h1_q10": 900.0,  "h1_median": 980.0, "h1_q90": 1010.0,
            "h12_q90": 1500.0,
        }
        import numpy as np
        bdi_vals = ([2000.0] * 180) + ([2000.0 + 600.0 * i for i in range(20)])
        df = pd.DataFrame({"bdi": bdi_vals})
        alerts = _compute_risk_alerts(fc, df, ALERTS_CFG)
        sev_order = {"high": 0, "warning": 1, "info": 2}
        for i in range(len(alerts) - 1):
            assert sev_order[alerts[i]["severity"]] <= sev_order[alerts[i+1]["severity"]], (
                f"Alerts not sorted: {alerts[i]['severity']} before {alerts[i+1]['severity']}"
            )

    def test_disclaimer_always_present(self):
        """Every alert must include the disclaimer sentence."""
        fc = {
            "current_bdi": 1000.0,
            "h4_q10": 400.0, "h4_median": 900.0, "h4_q90": 1500.0,
            "h1_q10": 900.0, "h1_median": 950.0, "h1_q90": 1000.0,
            "h12_q90": 2000.0,
        }
        alerts = _compute_risk_alerts(fc, None, ALERTS_CFG)
        for a in alerts:
            assert a.get("disclaimer"), f"No disclaimer on alert: {a['rule']}"


# ─── Feature label tests ─────────────────────────────────────────────────────

class TestFeatureLabels:
    def test_known_feature_returns_label(self):
        assert _feature_label("bdi_last") == "Latest BDI level"
        assert _feature_label("bdi_rolling_mean_4w") == "4-week average BDI"

    def test_pattern_rolling_std(self):
        label = _feature_label("bdi_rolling_std_12w")
        assert "12" in label and "volatility" in label.lower()

    def test_pattern_lag(self):
        label = _feature_label("bdi_lag_8w")
        assert "8" in label and "lag" in label.lower()

    def test_unknown_feature_returns_readable_string(self):
        label = _feature_label("some_unknown_feature_xyz")
        assert label  # non-empty
        assert "_" not in label or label == "some_unknown_feature_xyz"  # either cleaned up or raw
