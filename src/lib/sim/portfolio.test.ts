import { describe, expect, it } from "vitest";
import {
  OPPORTUNITY_LANES,
  PRESET_ALLOCATIONS,
  buildCandidatePortfolios,
  cloneStrategyAsCustom,
  computeHHI,
  computePortfolio,
  computePortfolioStrategy,
  evaluatePortfolioSensitivities,
  evaluateSourcingStem,
  generatePortfolioRecommendation,
  normaliseAllocation,
  rebalanceStemsToDemand,
} from "./portfolio";
import { simulateCharterDecision, BASE_BUNKER_USD_PER_T } from "./charter";

const now = new Date("2026-10-25T06:00:00Z");

describe("Portfolio Engine — Contract allocation and presets (Preserved)", () => {
  it("normalises allocation percentages to sum to exactly 100", () => {
    const a = normaliseAllocation({ spot: 40, shortTerm: 40, mediumTerm: 40 });
    expect(a.spot + a.shortTerm + a.mediumTerm).toBe(100);
  });

  it("conservative preset carries lower cost variance than aggressive", () => {
    const c = computePortfolio("CONSERVATIVE", PRESET_ALLOCATIONS.CONSERVATIVE);
    const a = computePortfolio("AGGRESSIVE", PRESET_ALLOCATIONS.AGGRESSIVE);
    expect(c.stdDevUsdPerT).toBeLessThan(a.stdDevUsdPerT);
  });

  it("exposes opportunity lanes with valid ballast distances and revenue offsets", () => {
    expect(OPPORTUNITY_LANES.length).toBeGreaterThanOrEqual(4);
    for (const lane of OPPORTUNITY_LANES) {
      expect(lane.ballastNm).toBeGreaterThan(0);
      expect(lane.idleDaysSaved).toBeGreaterThan(0);
      expect(lane.revenueOffsetUsd).toBeGreaterThan(0);
    }
  });
});

describe("Portfolio Engine — Sourcing stem evaluation & charter parity", () => {
  it("evaluates sourcing stem with exact charter calculation parity", () => {
    const stem = evaluateSourcingStem({
      id: "stem-test-1",
      origin: "AUS_QLD",
      destination: "PRDP",
      tonnes: 160_000,
      vesselClass: "CAPESIZE",
      now,
    });

    const direct = simulateCharterDecision(
      {
        cargoTonnes: 160_000,
        cargoType: "COKING_COAL",
        origin: "AUS_QLD",
        destination: "PRDP",
        deliveryDeadline: "2026-12-31",
        contractPreference: "SHORT_TERM",
      },
      { now, bunkerUsdPerT: BASE_BUNKER_USD_PER_T },
    );

    const directCape = direct.checks.find((c) => c.vesselClass === "CAPESIZE")!;
    expect(stem.landedCostPerT).toBe(directCape.costPerT);
    expect(stem.voyages).toBe(directCape.voyages);
    expect(stem.feasibilityStatus).toBe(directCape.status);
    expect(stem.totalCostUsd).toBe(directCape.totalCostUsd);
  });

  it("flags part-laden or draft restriction on Capesize at Paradip", () => {
    const stem = evaluateSourcingStem({
      id: "stem-test-cape",
      origin: "AUS_QLD",
      destination: "PRDP",
      tonnes: 160_000,
      vesselClass: "CAPESIZE",
      now,
    });

    // Laden draft 18.1m exceeds Paradip limit 17.1m
    expect(stem.feasibilityStatus).toBe("CONDITIONAL");
    expect(stem.feasibilityReasons.join(" ")).toMatch(/draft restricted/i);
  });
});

describe("Portfolio Engine — Aggregate calculations, reconciliation and HHI", () => {
  it("reconciles allocated tonnage and computes exact weighted cost per tonne", () => {
    const candidates = buildCandidatePortfolios(1_600_000, "COKING_COAL", "2026-12-31", now);
    const strat = candidates.BALANCED_RESILIENCE;

    const sumTonnes = strat.stems.reduce((acc, s) => acc + s.tonnes, 0);
    const sumSpend = strat.stems.reduce((acc, s) => acc + s.totalCostUsd, 0);

    expect(strat.allocatedT).toBe(sumTonnes);
    expect(strat.totalSpendUsd).toBe(sumSpend);
    expect(strat.weightedCostPerT).toBe(Math.round((sumSpend / sumTonnes) * 100) / 100);
    expect(strat.coveragePct).toBe(100);
  });

  it("computes HHI concentration correctly across origin and port shares", () => {
    // Single source has HHI of 10,000
    expect(computeHHI([100])).toBe(10_000);

    // Two equal sources has HHI of 5,000
    expect(computeHHI([50, 50])).toBe(5_000);

    // Four equal sources has HHI of 2,500
    expect(computeHHI([25, 25, 25, 25])).toBe(2_500);

    const candidates = buildCandidatePortfolios(1_000_000, "COKING_COAL", "2026-12-31", now);
    // Cost-optimized scale should have higher origin concentration than balanced resilience
    expect(candidates.LOWEST_COST.originHHI).toBeGreaterThan(
      candidates.BALANCED_RESILIENCE.originHHI,
    );
  });

  it("identifies matching repositioning opportunities from discharged stems", () => {
    const candidates = buildCandidatePortfolios(1_500_000, "COKING_COAL", "2026-12-31", now);
    const strat = candidates.BALANCED_RESILIENCE;

    expect(strat.repositioningOpportunities.length).toBeGreaterThan(0);
    expect(strat.totalRepositioningSavingsUsd).toBeGreaterThan(0);
    expect(strat.effectiveCostPerTWithRepositioning).toBeLessThanOrEqual(strat.weightedCostPerT);
  });
});

describe("Portfolio Engine — Candidate strategy comparison & sensitivity", () => {
  it("generates distinct candidate strategies fulfilling total demand", () => {
    const demand = 2_000_000;
    const candidates = buildCandidatePortfolios(demand, "COKING_COAL", "2026-12-31", now);

    expect(candidates.LOWEST_COST.allocatedT).toBe(demand);
    expect(candidates.BALANCED_RESILIENCE.allocatedT).toBe(demand);
    expect(candidates.SCHEDULE_RELIABILITY.allocatedT).toBe(demand);

    // Lowest cost should achieve lower unit cost than Schedule Reliability
    expect(candidates.LOWEST_COST.weightedCostPerT).toBeLessThanOrEqual(
      candidates.SCHEDULE_RELIABILITY.weightedCostPerT,
    );
  });

  it("stress tests portfolios through scenario shocks", () => {
    const candidates = buildCandidatePortfolios(1_200_000, "COKING_COAL", "2026-12-31", now);
    const sensitivities = evaluatePortfolioSensitivities(
      candidates.BALANCED_RESILIENCE,
      "COKING_COAL",
      "2026-12-31",
      now,
    );

    expect(sensitivities.length).toBe(5);
    const base = sensitivities[0]!;
    const freightShock = sensitivities[1]!;

    expect(base.shockLabel).toBe("Base Case");
    expect(freightShock.weightedCostPerT).toBeGreaterThan(base.weightedCostPerT);
    expect(freightShock.costDeltaUsdPerT).toBeGreaterThan(0);
  });

  it("generates explainable recommendations based on the selected objective", () => {
    const candidates = buildCandidatePortfolios(1_600_000, "COKING_COAL", "2026-12-31", now);
    const strats = Object.values(candidates);

    const costRec = generatePortfolioRecommendation(strats, "LOWEST_COST");
    expect(costRec.objective).toBe("LOWEST_COST");
    expect(costRec.headline).toMatch(/lowest landed expenditure/i);
    expect(costRec.primaryAdvantage).toBeDefined();
    expect(costRec.keyTradeoff).toBeDefined();
    expect(costRec.decisionCriteria).toBeDefined();
    expect(costRec.assumptionsThatCouldChangeRecommendation).toBeDefined();

    const balRec = generatePortfolioRecommendation(strats, "BALANCED_RESILIENCE");
    expect(balRec.objective).toBe("BALANCED_RESILIENCE");
    expect(balRec.headline).toMatch(/diversifies/i);
    expect(balRec.primaryAdvantage).toMatch(/protects/i);
  });
});

describe("Portfolio Engine — Constraints, filtering, and rebalancing", () => {
  it("adapts candidate stems to respect allowed origins and ports filters", () => {
    const customOptions = {
      cargoType: "COKING_COAL" as const,
      deliveryDeadline: "2026-12-31",
      now,
      allowedOrigins: ["AUS_NSW" as const, "IDN_KAL" as const],
      allowedPorts: ["GGVM" as const, "DHMR" as const],
      allowedVesselClasses: ["PANAMAX" as const, "ULTRAMAX" as const],
    };

    const filteredPortfolios = buildCandidatePortfolios(1_500_000, customOptions);
    const lowestCost = filteredPortfolios.LOWEST_COST;

    // All stems must originate from allowed origins only
    for (const stem of lowestCost.stems) {
      expect(["AUS_NSW", "IDN_KAL"]).toContain(stem.origin);
      expect(["GGVM", "DHMR"]).toContain(stem.destination);
      expect(["PANAMAX", "ULTRAMAX"]).toContain(stem.vesselClass);
    }
  });

  it("rebalances stems proportionally so their sum exactly matches target demand", () => {
    const candidates = buildCandidatePortfolios(1_600_000, "COKING_COAL", "2026-12-31", now);
    const targetDemand = 2_350_000;

    const rebalanced = rebalanceStemsToDemand(
      candidates.BALANCED_RESILIENCE.stems,
      targetDemand,
      "COKING_COAL",
      "2026-12-31",
      now,
    );
    const totalRebalanced = rebalanced.reduce((sum, s) => sum + s.tonnes, 0);

    expect(totalRebalanced).toBe(targetDemand);
    for (const stem of rebalanced) {
      expect(stem.tonnes).toBeGreaterThan(0);
      expect(stem.totalCostUsd).toBeGreaterThan(0);
    }
  });

  it("clones a strategy into an editable custom plan with unique stem IDs", () => {
    const candidates = buildCandidatePortfolios(1_600_000, "COKING_COAL", "2026-12-31", now);
    const cloned = cloneStrategyAsCustom(
      candidates.LOWEST_COST,
      1_800_000,
      "COKING_COAL",
      "2026-12-31",
      now,
    );

    expect(cloned.length).toBe(candidates.LOWEST_COST.stems.length);
    const sumTonnes = cloned.reduce((sum, s) => sum + s.tonnes, 0);
    expect(sumTonnes).toBe(1_800_000);

    // Each cloned stem should have a unique custom ID
    const ids = cloned.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(cloned.length);
    expect(ids[0]).toMatch(/^custom-stem-/);
  });

  it("reconciles stem cost breakdown components with total landed expenditure", () => {
    const stem = evaluateSourcingStem({
      id: "stem-breakdown-test",
      origin: "AUS_QLD",
      destination: "PRDP",
      tonnes: 160_000,
      vesselClass: "KAMSARMAX",
      now,
    });

    expect(stem.costBreakdown).toBeDefined();
    if (stem.costBreakdown) {
      const sumComponents =
        stem.costBreakdown.freightUsd +
        stem.costBreakdown.bunkerUsd +
        stem.costBreakdown.portDuesUsd +
        stem.costBreakdown.demurrageReserveUsd +
        stem.costBreakdown.insuranceUsd;

      // Component sum reconciles to within 1% of totalCostUsd (rounding tolerance)
      expect(Math.abs(sumComponents - stem.totalCostUsd) / stem.totalCostUsd).toBeLessThan(0.01);
      expect(stem.freightUsdPerT).toBeGreaterThan(0);
      expect(stem.landedCostPerT).toBeGreaterThan(stem.freightUsdPerT);
    }
  });

  it("identifies physical constraint violation for Newcastlemax at Vizag (Rejected)", () => {
    const stem = evaluateSourcingStem({
      id: "stem-vizg-newcastle",
      origin: "AUS_QLD",
      destination: "VIZG",
      tonnes: 180_000,
      vesselClass: "NEWCASTLEMAX",
      now,
    });

    // Vizag max draft is 17.0m, max LOA 290m; Newcastlemax laden draft is 18.5m and LOA 300m with no lightering
    expect(stem.feasibilityStatus).toBe("REJECTED");
    expect(stem.feasibilityReasons.length).toBeGreaterThan(0);
    expect(
      stem.feasibilityReasons.some(
        (r) => r.includes("exceeds") || r.includes("draft") || r.includes("LOA"),
      ),
    ).toBe(true);
  });

  it("identifies operational conditional status for Capesize at Haldia requiring Sandheads lightering", () => {
    const stem = evaluateSourcingStem({
      id: "stem-haldia-cape",
      origin: "AUS_QLD",
      destination: "HLDA",
      tonnes: 160_000,
      vesselClass: "CAPESIZE",
      now,
    });

    // Haldia max draft is 8.5m, but supports offshore Sandheads lightering
    expect(stem.feasibilityStatus).toBe("CONDITIONAL");
    expect(stem.feasibilityReasons.join(" ")).toMatch(/lightering/i);
  });

  it("handles boundary conditions: minimum demand clamping", () => {
    // When demand is less than 100,000 MT, engine clamps to 100,000 MT minimum
    const candidates = buildCandidatePortfolios(50_000, "COKING_COAL", "2026-12-31", now);
    expect(candidates.LOWEST_COST.totalDemandT).toBe(100_000);
    expect(candidates.LOWEST_COST.allocatedT).toBe(100_000);
  });
});
