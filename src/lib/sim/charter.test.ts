import { describe, expect, it } from "vitest";
import { decide, simulateCharterDecision, BASE_BUNKER_USD_PER_T } from "./charter";
import { simulateScenario, BASELINE_INPUT } from "./scenario";
import { computePortfolio, PRESET_ALLOCATIONS } from "./portfolio";
import type { CharterRequest } from "@/lib/api/types";

const now = new Date("2026-10-25T06:00:00Z");
const base: CharterRequest = {
  cargoTonnes: 160_000,
  cargoType: "COKING_COAL",
  origin: "AUS_QLD",
  destination: "PRDP",
  deliveryDeadline: "2026-12-15",
  contractPreference: "SHORT_TERM",
};
const run = (r: Partial<CharterRequest>) =>
  simulateCharterDecision({ ...base, ...r }, { now, bunkerUsdPerT: BASE_BUNKER_USD_PER_T });

describe("charter simulation rules", () => {
  it("never marks a laden Capesize as plainly feasible at Haldia (lightering only)", () => {
    const cape = run({ destination: "HLDA" }).checks.find((c) => c.vesselClass === "CAPESIZE")!;
    expect(cape.status).toBe("CONDITIONAL");
    expect(cape.reasons.join(" ")).toMatch(/lightering/i);
  });

  it("rejects Newcastlemax at Paradip on draft", () => {
    const ncm = run({}).checks.find((c) => c.vesselClass === "NEWCASTLEMAX")!;
    expect(ncm.status).toBe("REJECTED");
  });

  it("rejects every vessel when the deadline is too close", () => {
    const r = run({ deliveryDeadline: "2026-11-05" });
    expect(r.checks.every((c) => c.status === "REJECTED")).toBe(true);
    expect(r.decision).toBe("WAIT");
    expect(r.vesselClass).toBeNull();
  });

  it("recommends CHARTER_NOW when rates are firming", () => {
    expect(
      decide({ hasFeasible: true, trendPct: 3.8, slackDays: 30, voyages: 1, preference: "SPOT" }),
    ).toBe("CHARTER_NOW");
  });

  it("recommends WAIT when rates soften and there are 21+ days of slack", () => {
    expect(
      decide({ hasFeasible: true, trendPct: -5.4, slackDays: 25, voyages: 1, preference: "SPOT" }),
    ).toBe("WAIT");
  });

  it("recommends SPLIT when cargo needs more than one lifting in a flat market", () => {
    expect(
      decide({ hasFeasible: true, trendPct: 0.5, slackDays: 30, voyages: 2, preference: "SPOT" }),
    ).toBe("SPLIT");
  });

  it("split percentages always sum to 100", () => {
    const r = run({ origin: "IDN_KAL", contractPreference: "FLEXIBLE" });
    expect(r.decision).toBe("SPLIT");
    expect(r.split!.nowPct + r.split!.laterPct).toBe(100);
  });
});

describe("scenario simulation", () => {
  it("leaves the baseline unchanged when no shock is applied", () => {
    const s = simulateScenario(base, BASELINE_INPUT, now);
    expect(s.simulated.totalCostUsd).toBe(s.baseline.totalCostUsd);
  });

  it("raises landed cost under a +20% freight shock", () => {
    const s = simulateScenario(base, { ...BASELINE_INPUT, freightShockPct: 20 }, now);
    expect(s.simulated.costPerT).toBeGreaterThan(s.baseline.costPerT);
  });
});

describe("portfolio presets", () => {
  it("conservative carries lower cost variance than aggressive", () => {
    const c = computePortfolio("CONSERVATIVE", PRESET_ALLOCATIONS.CONSERVATIVE);
    const a = computePortfolio("AGGRESSIVE", PRESET_ALLOCATIONS.AGGRESSIVE);
    expect(c.stdDevUsdPerT).toBeLessThan(a.stdDevUsdPerT);
  });
});
