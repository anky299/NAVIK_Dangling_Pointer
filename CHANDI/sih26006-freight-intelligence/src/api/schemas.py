"""src/api/schemas.py — Pydantic request / response models.

All business validation lives here; routers stay thin.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, field_validator, model_validator
from .config import KNOWN_CARGOES, DEFAULT_HORIZON_MONTHS


# ─────────────────────────── Shared ────────────────────────────────────────

class Overrides(BaseModel):
    fuel_price_pct: float = 1.0   # multiplier on base fuel price (1.0 = no change)
    demand_pct: float = 1.0       # multiplier on base demand (1.0 = no change)

    @field_validator("fuel_price_pct", "demand_pct")
    @classmethod
    def positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Override multiplier must be positive")
        return v


# ─────────────────────────── /optimize ─────────────────────────────────────

class OptimizeRequest(BaseModel):
    cargo: str
    quantity_mt: float
    deadline_month: int                        # 1-indexed month within horizon
    objective: str = "mean"                    # "mean" | "minimax"
    scenario_weights: Optional[Dict[str, float]] = None   # {"low":w, "base":w, "high":w}
    overrides: Overrides = Overrides()
    mode: str = "fast"                         # "cached" | "fast" | "full"

    @field_validator("cargo")
    @classmethod
    def known_cargo(cls, v: str) -> str:
        if v not in KNOWN_CARGOES:
            raise ValueError(f"Unknown cargo '{v}'. Valid: {sorted(KNOWN_CARGOES)}")
        return v

    @field_validator("quantity_mt")
    @classmethod
    def positive_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("quantity_mt must be positive")
        return v

    @field_validator("deadline_month")
    @classmethod
    def deadline_in_horizon(cls, v: int) -> int:
        if not (1 <= v <= DEFAULT_HORIZON_MONTHS):
            raise ValueError(
                f"deadline_month must be between 1 and {DEFAULT_HORIZON_MONTHS}"
            )
        return v

    @field_validator("objective")
    @classmethod
    def valid_objective(cls, v: str) -> str:
        if v not in {"mean", "minimax"}:
            raise ValueError("objective must be 'mean' or 'minimax'")
        return v

    @field_validator("mode")
    @classmethod
    def valid_mode(cls, v: str) -> str:
        if v not in {"cached", "fast", "full"}:
            raise ValueError("mode must be 'cached', 'fast', or 'full'")
        return v

    @model_validator(mode="after")
    def weights_sum_to_one(self) -> "OptimizeRequest":
        w = self.scenario_weights
        if w is not None:
            total = sum(w.values())
            if abs(total - 1.0) > 1e-6:
                raise ValueError(
                    f"scenario_weights must sum to 1.0, got {total:.6f}"
                )
        return self


class Month1Recommendation(BaseModel):
    cargo: str
    origin: str
    port: str
    vessel_class: str
    charter_mode: str
    voyages: int
    tonnes: float


class CostBreakdown(BaseModel):
    cargo: float
    freight: float
    freight_by_scenario: Dict[str, float]
    period_hire: float
    demurrage: float
    inventory: float
    unmet: float
    total_mean: float
    total_by_scenario: Dict[str, float]


class OptimizeResponse(BaseModel):
    job_id: Optional[str] = None
    served_from_cache: bool
    cache_timestamp: Optional[str] = None
    solver_status: str
    solver_gap_pct: float
    solve_time_seconds: float
    month_1_recommendation: Optional[List[Month1Recommendation]] = None
    cost_breakdown: Optional[CostBreakdown] = None
    savings_vs_naive_baseline: Optional[float] = None
    savings_vs_landed_cost_baseline: Optional[float] = None
    data_note: str
    message: Optional[str] = None


# ─────────────────────────── /scenarios ────────────────────────────────────

class ScenariosRequest(BaseModel):
    cargo: str
    quantity_mt: float
    deadline_month: int
    scenario_weights: Optional[Dict[str, float]] = None
    overrides: Overrides = Overrides()
    mode: str = "fast"

    @field_validator("cargo")
    @classmethod
    def known_cargo(cls, v: str) -> str:
        if v not in KNOWN_CARGOES:
            raise ValueError(f"Unknown cargo '{v}'. Valid: {sorted(KNOWN_CARGOES)}")
        return v

    @field_validator("quantity_mt")
    @classmethod
    def positive_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("quantity_mt must be positive")
        return v

    @field_validator("deadline_month")
    @classmethod
    def deadline_in_horizon(cls, v: int) -> int:
        if not (1 <= v <= DEFAULT_HORIZON_MONTHS):
            raise ValueError(
                f"deadline_month must be between 1 and {DEFAULT_HORIZON_MONTHS}"
            )
        return v

    @field_validator("mode")
    @classmethod
    def valid_mode(cls, v: str) -> str:
        if v not in {"cached", "fast", "full"}:
            raise ValueError("mode must be 'cached', 'fast', or 'full'")
        return v


class ScenarioPlan(BaseModel):
    scenario: str
    objective_value: float
    cost_breakdown: CostBreakdown
    month_1_recommendation: Optional[List[Month1Recommendation]] = None
    solver_status: str
    solver_gap_pct: float
    solve_time_seconds: float


class ScenariosResponse(BaseModel):
    plans: List[ScenarioPlan]
    cost_differences: Dict[str, float]   # e.g. {"high_vs_low": X, "high_vs_base": Y}
    data_note: str


# ─────────────────────────── /jobs/{job_id} ────────────────────────────────

class JobStatusResponse(BaseModel):
    job_id: str
    status: str       # "pending" | "running" | "done" | "failed"
    created_at: str
    completed_at: Optional[str] = None
    result: Optional[OptimizeResponse] = None
    error: Optional[str] = None


# ─────────────────────────── /insights ─────────────────────────────────────

class SavingsBreakdown(BaseModel):
    """Per-component savings: baseline_cost − optimizer_cost for each bucket."""
    vs_landed_cost_total: float
    vs_naive_baseline_total: float
    cargo:       float
    freight:     float
    period_hire: float
    demurrage:   float
    inventory:   float
    unmet:       float


class FeatureImportanceItem(BaseModel):
    feature:     str    # raw feature name, e.g. "bdi_rolling_mean_4w"
    label:       str    # plain-English label, e.g. "4-week average BDI"
    importance:  float  # gain-based importance
    rank:        int


class RiskAlert(BaseModel):
    rule:       str    # rule id key from alerts.yaml
    severity:   str    # "info" | "warning" | "high"
    headline:   str    # one short sentence
    detail:     str    # numbers behind the alert
    disclaimer: str    # always the standard sentence


class InsightsResponse(BaseModel):
    savings_breakdown:   SavingsBreakdown
    feature_importance:  Dict[str, List[FeatureImportanceItem]]  # key = "h1"|"h4"|"h8"|"h12"
    risk_alerts:         List[RiskAlert]
    forecast_coverage:   Optional[str]   # calibration_note from forecast cache
    unmet_demand_mt:     float
    cache_timestamp:     Optional[str]
    data_note:           str
