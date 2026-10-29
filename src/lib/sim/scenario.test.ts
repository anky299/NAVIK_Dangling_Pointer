import { describe, expect, it } from "vitest";
import {
  BASELINE_INPUT,
  SCENARIO_BOUNDS,
  SCENARIO_PRESETS,
  compareMultipleScenarios,
  compareScenarios,
  simulateScenario,
  validateScenarioInput,
} from "./scenario";
import { BASE_BUNKER_USD_PER_T, simulateCharterDecision } from "./charter";
import type { CharterRequest } from "@/lib/api/types";

const now = new Date("2026-10-25T06:00:00Z");

const sampleRequest: CharterRequest = {
  cargoTonnes: 160_000,
  cargoType: "COKING_COAL",
  origin: "AUS_QLD",
  destination: "PRDP",
  deliveryDeadline: "2026-12-25",
  contractPreference: "SHORT_TERM",
};

describe("Scenario Engine — Baseline calculations & parity", () => {
  it("matches Charter engine output exactly for baseline voyage", () => {
    const direct = simulateCharterDecision(sampleRequest, {
      now,
      bunkerUsdPerT: BASE_BUNKER_USD_PER_T,
      extraWaitDays: 0,
      availabilityFactor: 1,
      speedDeltaKn: 0,
    });
    const result = simulateScenario(sampleRequest, BASELINE_INPUT, now);

    expect(result.baseline.totalCostUsd).toBe(direct.totalCostUsd);
    expect(result.baseline.freightUsdPerT).toBe(direct.estimatedFreightUsdPerT);
    expect(result.baseline.bunkerCostUsd).toBe(direct.costBreakdown.bunkerUsd);
    expect(result.baseline.demurrageUsd).toBe(direct.costBreakdown.demurrageReserveUsd);
    expect(result.baseline.decision).toBe(direct.decision);
    expect(result.baseline.vesselClass).toBe(direct.vesselClass);
  });

  it("yields zero variance for zero-change inputs", () => {
    const comparison = compareScenarios(sampleRequest, BASELINE_INPUT, now);

    expect(comparison.diff.totalCostUsd).toBe(0);
    expect(comparison.diff.totalCostPct).toBe(0);
    expect(comparison.diff.costPerTUsd).toBe(0);
    expect(comparison.diff.bunkerUsd).toBe(0);
    expect(comparison.diff.demurrageUsd).toBe(0);
    expect(comparison.simulated.totalCostUsd).toBe(comparison.baseline.totalCostUsd);
  });
});

describe("Scenario Engine — Shocks and stress sensitivities", () => {
  it("increases total cost and landed cost per tonne under positive freight shock", () => {
    const comp = compareScenarios(sampleRequest, { ...BASELINE_INPUT, freightShockPct: 25 }, now);

    expect(comp.diff.totalCostUsd).toBeGreaterThan(0);
    expect(comp.diff.costPerTUsd).toBeGreaterThan(0);
    expect(comp.diff.freightHireUsd).toBeGreaterThan(0);
    // Bunker expenditure should be constant when speed and bunker price are unchanged
    expect(comp.diff.bunkerUsd).toBe(0);
  });

  it("reduces landed spend under softening freight shock", () => {
    const comp = compareScenarios(sampleRequest, { ...BASELINE_INPUT, freightShockPct: -15 }, now);

    expect(comp.diff.totalCostUsd).toBeLessThan(0);
    expect(comp.diff.costPerTUsd).toBeLessThan(0);
    expect(comp.diff.freightHireUsd).toBeLessThan(0);
  });

  it("scales bunker fuel cost directly with bunker price spikes", () => {
    const comp = compareScenarios(sampleRequest, { ...BASELINE_INPUT, bunkerUsdPerT: 850 }, now);

    expect(comp.diff.bunkerUsd).toBeGreaterThan(0);
    expect(comp.simulated.bunkerCostUsd).toBeGreaterThan(comp.baseline.bunkerCostUsd);
    // Ocean hire and demurrage should remain unchanged
    expect(comp.diff.freightHireUsd).toBe(0);
    expect(comp.diff.demurrageUsd).toBe(0);
  });

  it("increases demurrage reserve and total voyage duration under port congestion", () => {
    const comp = compareScenarios(sampleRequest, { ...BASELINE_INPUT, congestionDays: 7 }, now);

    expect(comp.diff.demurrageUsd).toBeGreaterThan(0);
    expect(comp.diff.durationDays).toBeGreaterThanOrEqual(7);
    expect(comp.simulated.slackDays).toBeLessThan(comp.baseline.slackDays);
  });

  it("evaluates eco-steaming speed reductions via cubic fuel law", () => {
    // Steaming 2 knots slower
    const slow = compareScenarios(sampleRequest, { ...BASELINE_INPUT, speedDeltaKn: -2.0 }, now);

    // Sea transit days increase
    expect(slow.simulated.transitDays).toBeGreaterThan(slow.baseline.transitDays);
    // Bunker consumption drops cubically
    expect(slow.diff.bunkerUsd).toBeLessThan(0);
  });

  it("evaluates fast steaming speed increases", () => {
    const fast = compareScenarios(sampleRequest, { ...BASELINE_INPUT, speedDeltaKn: 1.5 }, now);

    expect(fast.simulated.transitDays).toBeLessThan(fast.baseline.transitDays);
    expect(fast.diff.bunkerUsd).toBeGreaterThan(0);
  });

  it("handles combined downside shock", () => {
    const combined = compareScenarios(
      sampleRequest,
      {
        freightShockPct: 22,
        congestionDays: 6,
        bunkerUsdPerT: 820,
        fleetAvailabilityPct: 75,
        speedDeltaKn: -1.0,
      },
      now,
    );

    expect(combined.diff.totalCostUsd).toBeGreaterThan(0);
    expect(combined.diff.bunkerUsd).toBeGreaterThan(0);
    expect(combined.diff.demurrageUsd).toBeGreaterThan(0);
    expect(combined.diff.freightHireUsd).toBeGreaterThan(0);
    expect(combined.simulated.riskScore).toBeGreaterThan(combined.baseline.riskScore);
  });
});

describe("Scenario Engine — Boundary validation and clamping", () => {
  it("clamps out-of-bounds inputs to allowed ranges", () => {
    const clamped = validateScenarioInput({
      freightShockPct: 250,
      bunkerUsdPerT: 200,
      congestionDays: -5,
      fleetAvailabilityPct: 20,
      speedDeltaKn: 10,
    });

    expect(clamped.freightShockPct).toBe(SCENARIO_BOUNDS.freightShockPct.max);
    expect(clamped.bunkerUsdPerT).toBe(SCENARIO_BOUNDS.bunkerUsdPerT.min);
    expect(clamped.congestionDays).toBe(SCENARIO_BOUNDS.congestionDays.min);
    expect(clamped.fleetAvailabilityPct).toBe(SCENARIO_BOUNDS.fleetAvailabilityPct.min);
    expect(clamped.speedDeltaKn).toBe(SCENARIO_BOUNDS.speedDeltaKn.max);
  });

  it("handles non-numeric or NaN values by falling back to safe defaults", () => {
    const safe = validateScenarioInput({
      freightShockPct: NaN,
      bunkerUsdPerT: undefined,
      congestionDays: "invalid" as unknown as number,
    });

    expect(safe.freightShockPct).toBe(0);
    expect(safe.bunkerUsdPerT).toBe(BASE_BUNKER_USD_PER_T);
    expect(safe.congestionDays).toBe(0);
  });
});

describe("Scenario Engine — Waterfall & mathematical parity", () => {
  it("guarantees component variances sum exactly to total cost variance", () => {
    const comp = compareScenarios(
      sampleRequest,
      {
        freightShockPct: 15,
        congestionDays: 4,
        bunkerUsdPerT: 780,
        fleetAvailabilityPct: 85,
        speedDeltaKn: -0.5,
      },
      now,
    );

    const sumOfDeltas =
      comp.diff.freightHireUsd +
      comp.diff.bunkerUsd +
      comp.diff.demurrageUsd +
      comp.diff.portDuesUsd +
      comp.diff.insuranceUsd;

    expect(Math.abs(sumOfDeltas - comp.diff.totalCostUsd)).toBeLessThanOrEqual(1);
    expect(comp.waterfall[comp.waterfall.length - 1]!.deltaUsd).toBe(comp.simulated.totalCostUsd);
  });
});

describe("Scenario Engine — Multi-scenario comparison and presets", () => {
  it("all presets contain valid inputs within bounds", () => {
    for (const preset of SCENARIO_PRESETS) {
      const v = validateScenarioInput(preset.input);
      expect(v.freightShockPct).toBe(preset.input.freightShockPct);
      expect(v.bunkerUsdPerT).toBe(preset.input.bunkerUsdPerT);
      expect(v.congestionDays).toBe(preset.input.congestionDays);
      expect(v.fleetAvailabilityPct).toBe(preset.input.fleetAvailabilityPct);
    }
  });

  it("compares multiple scenarios against identical baseline", () => {
    const list = SCENARIO_PRESETS.slice(0, 4);
    const results = compareMultipleScenarios(sampleRequest, list, now);

    expect(results).toHaveLength(4);
    const baseCost = results[0]!.baseline.totalCostUsd;
    for (const r of results) {
      expect(r.baseline.totalCostUsd).toBe(baseCost);
      expect(r.vesselComparisons.length).toBe(6);
    }
  });

  it("generates explainable insights matching the scenario drivers", () => {
    // Bunker spike should produce bunker driver insight
    const bunkerComp = compareScenarios(
      sampleRequest,
      { ...BASELINE_INPUT, bunkerUsdPerT: 900 },
      now,
    );
    const hasBunkerInsight = bunkerComp.insights.some((i) => i.id === "bunker-driver");
    expect(hasBunkerInsight).toBe(true);

    // Always includes methodology disclosure
    expect(bunkerComp.insights.some((i) => i.category === "METHODOLOGY")).toBe(true);
  });
});
