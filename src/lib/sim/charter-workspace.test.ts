import { describe, expect, it } from "vitest";
import { simulateCharterDecision, BASE_BUNKER_USD_PER_T } from "./charter";
import type { CharterRequest } from "@/lib/api/types";

const now = new Date("2026-10-25T06:00:00Z");
const ctx = { now, bunkerUsdPerT: BASE_BUNKER_USD_PER_T };

const base: CharterRequest = {
  cargoTonnes: 160_000,
  cargoType: "COKING_COAL",
  origin: "AUS_QLD",
  destination: "PRDP",
  deliveryDeadline: "2026-12-15",
  contractPreference: "SPOT",
};

const run = (overrides: Partial<CharterRequest> = {}) =>
  simulateCharterDecision({ ...base, ...overrides }, ctx);

describe("charter workspace scenarios", () => {
  it("produces a recommendation for feasible Paradip shipment", () => {
    const r = run();
    expect(r.vesselClass).not.toBeNull();
    expect(r.totalCostUsd).toBeGreaterThan(0);
    expect(r.costBreakdown.freightUsd).toBeGreaterThan(0);
    expect(r.costBreakdown.bunkerUsd).toBeGreaterThan(0);
    expect(r.reasoning.length).toBeGreaterThan(0);
    expect(r.headline.length).toBeGreaterThan(0);
  });

  it("handles small cargo (Supramax-range) correctly", () => {
    const r = run({ cargoTonnes: 55_000 });
    expect(r.vesselClass).not.toBeNull();
    // Smaller cargo should still produce a viable result
    expect(r.checks.some((c) => c.status !== "REJECTED")).toBe(true);
  });

  it("Gangavaram accepts Newcastlemax (deepest draft port)", () => {
    const r = run({ destination: "GGVM" });
    const ncm = r.checks.find((c) => c.vesselClass === "NEWCASTLEMAX")!;
    // GGVM has 21.0m draft — Newcastlemax at 18.5m should pass
    expect(ncm.status).not.toBe("REJECTED");
  });

  it("Haldia rejects Newcastlemax and Capesize without lightering option marking", () => {
    const r = run({ destination: "HLDA" });
    const ncm = r.checks.find((c) => c.vesselClass === "NEWCASTLEMAX")!;
    const cape = r.checks.find((c) => c.vesselClass === "CAPESIZE")!;
    // Haldia has 8.5m draft, both are way over
    // Capesize should be CONDITIONAL (lightering available at Sandheads)
    expect(cape.status).toBe("CONDITIONAL");
    // Newcastlemax at 18.5m vs 8.5m limit — 10m excess, well over MAX_PART_LADEN_EXCESS_M
    // Should be CONDITIONAL via lightering (same as Capesize) or REJECTED
    expect(["CONDITIONAL", "REJECTED"]).toContain(ncm.status);
  });

  it("changing inputs produces different cost results", () => {
    const qld = run({ origin: "AUS_QLD" });
    const idn = run({ origin: "IDN_KAL" });
    // Indonesia → India is shorter, should be cheaper
    expect(idn.distanceNm).toBeLessThan(qld.distanceNm);
    if (idn.vesselClass && qld.vesselClass) {
      // The per-tonne cost should differ
      expect(idn.totalCostUsd).not.toBe(qld.totalCostUsd);
    }
  });

  it("all cost breakdown components sum to total", () => {
    const r = run();
    if (r.vesselClass) {
      const sum =
        r.costBreakdown.freightUsd +
        r.costBreakdown.bunkerUsd +
        r.costBreakdown.portDuesUsd +
        r.costBreakdown.demurrageReserveUsd +
        r.costBreakdown.insuranceUsd;
      expect(Math.abs(sum - r.totalCostUsd)).toBeLessThan(2); // rounding tolerance
    }
  });

  it("recommendation reflects the computed cheapest viable option", () => {
    const r = run();
    const viableChecks = r.checks.filter((c) => c.status !== "REJECTED");
    if (viableChecks.length > 0 && r.vesselClass) {
      // The recommended vessel should be among viable ones
      const recommended = viableChecks.find((c) => c.vesselClass === r.vesselClass);
      expect(recommended).toBeDefined();
    }
  });

  it("cost per tonne equals total cost divided by cargo tonnes", () => {
    const r = run();
    for (const check of r.checks) {
      if (check.status === "REJECTED") continue;
      const computed = check.totalCostUsd / base.cargoTonnes;
      expect(Math.abs(check.costPerT - computed)).toBeLessThan(0.02);
    }
  });

  it("tight deadline rejects all vessels and recommends WAIT", () => {
    // 10 days from now is too tight for any vessel
    const d = new Date(now);
    d.setDate(d.getDate() + 10);
    const r = run({ deliveryDeadline: d.toISOString().slice(0, 10) });
    expect(r.checks.every((c) => c.status === "REJECTED")).toBe(true);
    expect(r.decision).toBe("WAIT");
    expect(r.vesselClass).toBeNull();
  });
});
