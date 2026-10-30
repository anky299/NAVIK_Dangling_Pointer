"""src/backtest/__init__.py — Walk-forward backtest module."""
from __future__ import annotations

from .run_backtest import (
    BacktestEngine,
    BacktestResult,
    run_walk_forward_backtest,
    evaluate_policy_month,
    compute_realised_spot_costs,
    bootstrap_confidence_interval,
)

__all__ = [
    "BacktestEngine",
    "BacktestResult",
    "run_walk_forward_backtest",
    "evaluate_policy_month",
    "compute_realised_spot_costs",
    "bootstrap_confidence_interval",
]
