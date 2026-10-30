import { describe, it, expect } from "vitest";
import {
  getBackendHealth,
  getHistorySeries,
  getFreightForecast,
  runProcurementOptimization,
  pollJobStatus,
  runScenarioAnalysis,
  getMarketInsights,
} from "@/lib/api/services";

describe("Milestone 18: Full Freight Intelligence Backend & Frontend Integration", () => {
  it("Phase 4: retrieves backend health telemetry and status", async () => {
    const health = await getBackendHealth();
    expect(health).toBeDefined();
    expect(["ok", "offline"]).toContain(health.status);
    expect(typeof health.model_version).toBe("string");
  });

  it("Phase 5: loads historical market series and flags derived sub-indices", async () => {
    const bdi = await getHistorySeries("bdi", "2024-01-01");
    expect(bdi.series).toBe("bdi");
    expect(bdi.data.length).toBeGreaterThan(0);
    expect(bdi.data[0]).toHaveProperty("date");
    expect(bdi.data[0]).toHaveProperty("value");
    expect(typeof bdi.data[0].is_derived).toBe("boolean");

    // BCI sub-index verification
    const bci = await getHistorySeries("bci", "2024-01-01");
    expect(bci.series).toBe("bci");
    expect(bci.data.length).toBeGreaterThan(0);
    // Recent BCI observations must be flagged as derived
    const recentBci = bci.data.find((p) => p.date > "2019-07-31");
    if (recentBci) {
      expect(recentBci.is_derived).toBe(true);
    }
  });

  it("Phase 6: calculates split-conformal quantile freight forecasts and route rates", async () => {
    const forecast = await getFreightForecast(4, "HAY_PRT", "Capesize");
    expect(forecast.horizon_weeks).toBe(4);
    expect(forecast.bdi_q10).toBeGreaterThan(0);
    expect(forecast.bdi_median).toBeGreaterThanOrEqual(forecast.bdi_q10);
    expect(forecast.bdi_q90).toBeGreaterThanOrEqual(forecast.bdi_median);
    expect(forecast.calibration_note).toBeDefined();
    if (forecast.per_tonne_rate_usd !== null && forecast.per_tonne_rate_usd !== undefined) {
      expect(forecast.per_tonne_rate_usd).toBeGreaterThan(0);
    }
  });

  it("Phase 7: executes multi-period MILP procurement optimizer", async () => {
    const opt = await runProcurementOptimization({
      cargo: "coking_coal",
      quantity_mt: 160000,
      deadline_month: 2,
      objective: "mean",
      mode: "cached",
    });
    expect(opt.solver_status).toBeDefined();
    expect(opt.month_1_recommendation).toBeDefined();
    expect(Array.isArray(opt.month_1_recommendation)).toBe(true);
    expect(opt.cost_breakdown).toBeDefined();
    expect(opt.cost_breakdown!.total_mean).toBeGreaterThan(0);
    expect(opt.savings_vs_naive_baseline).toBeGreaterThan(0);
    expect(opt.savings_vs_landed_cost_baseline).toBeGreaterThan(0);
  });

  it("Phase 8: supports background optimization job polling", async () => {
    const job = await pollJobStatus("mock-job-id-1234");
    expect(job.job_id).toBe("mock-job-id-1234");
    expect(["pending", "running", "done", "failed"]).toContain(job.status);
    expect(job.created_at).toBeDefined();
  });

  it("Phase 9: evaluates 3-scenario robust plans (low, base, high)", async () => {
    const scenarios = await runScenarioAnalysis({
      cargo: "coking_coal",
      quantity_mt: 160000,
      deadline_month: 2,
      mode: "cached",
    });
    expect(scenarios.plans.length).toBe(3);
    const low = scenarios.plans.find((p) => p.scenario === "low");
    const base = scenarios.plans.find((p) => p.scenario === "base");
    const high = scenarios.plans.find((p) => p.scenario === "high");
    expect(low).toBeDefined();
    expect(base).toBeDefined();
    expect(high).toBeDefined();
    expect(high!.objective_value).toBeGreaterThan(low!.objective_value);
    expect(scenarios.cost_differences).toBeDefined();
  }, 60000);

  it("Phase 10: retrieves LightGBM feature importance and risk alerts", async () => {
    const insights = await getMarketInsights();
    expect(insights.savings_breakdown).toBeDefined();
    expect(insights.savings_breakdown.vs_landed_cost_total).toBeGreaterThan(0);

    // Feature importance across all 4 horizons
    expect(insights.feature_importance.h1).toBeDefined();
    expect(insights.feature_importance.h4).toBeDefined();
    expect(insights.feature_importance.h8).toBeDefined();
    expect(insights.feature_importance.h12).toBeDefined();

    // Risk alerts
    expect(Array.isArray(insights.risk_alerts)).toBe(true);
    expect(insights.risk_alerts.length).toBeGreaterThan(0);
    expect(insights.risk_alerts[0].disclaimer).toBeDefined();
  });
});
