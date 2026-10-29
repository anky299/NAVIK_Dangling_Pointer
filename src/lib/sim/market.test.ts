import { describe, expect, it } from "vitest";
import {
  buildRouteComparisons,
  computeBunkerImpact,
  generateInsights,
  type BunkerImpact,
  type RouteComparison,
} from "./market";
import type {
  BunkerPoint,
  CongestionIndicator,
  FreightPoint,
  MarketSnapshot,
  OriginRegion,
  RiskAlert,
} from "@/lib/api/types";
import {
  freightHistory,
  bunkerHistory,
  marketSnapshot,
  congestionFixture,
  RISK_ALERTS,
} from "@/lib/api/fixtures";

/* ---------- Route Comparisons ---------- */

describe("buildRouteComparisons", () => {
  const allData: Record<OriginRegion, FreightPoint[]> = {
    AUS_QLD: freightHistory("AUS_QLD"),
    AUS_NSW: freightHistory("AUS_NSW"),
    AUS_WA: freightHistory("AUS_WA"),
    IDN_KAL: freightHistory("IDN_KAL"),
  };

  it("returns one comparison per origin", () => {
    const result = buildRouteComparisons(allData, "PRDP");
    expect(result).toHaveLength(4);
    const origins = result.map((r) => r.origin);
    expect(origins).toContain("AUS_QLD");
    expect(origins).toContain("AUS_NSW");
    expect(origins).toContain("AUS_WA");
    expect(origins).toContain("IDN_KAL");
  });

  it("populates correct destination name", () => {
    const result = buildRouteComparisons(allData, "PRDP");
    for (const r of result) {
      expect(r.destName).toBe("Paradip");
      expect(r.destination).toBe("PRDP");
    }
  });

  it("computes positive current rates", () => {
    const result = buildRouteComparisons(allData, "VIZG");
    for (const r of result) {
      expect(r.currentRate).toBeGreaterThan(0);
      expect(r.distanceNm).toBeGreaterThan(0);
      expect(r.transitDays).toBeGreaterThan(0);
    }
  });

  it("includes forecast data when available", () => {
    const result = buildRouteComparisons(allData, "PRDP");
    for (const r of result) {
      expect(r.forecastRate).not.toBeNull();
      expect(typeof r.forecastRate).toBe("number");
    }
  });

  it("assigns a valid trend to each route", () => {
    const result = buildRouteComparisons(allData, "PRDP");
    for (const r of result) {
      expect(["up", "down", "flat"]).toContain(r.trend);
      expect(["up", "down", "flat"]).toContain(r.forecastTrend);
    }
  });

  it("Queensland has higher rate than Western Australia", () => {
    const result = buildRouteComparisons(allData, "PRDP");
    const qld = result.find((r) => r.origin === "AUS_QLD")!;
    const wa = result.find((r) => r.origin === "AUS_WA")!;
    expect(qld.currentRate).toBeGreaterThan(wa.currentRate);
  });
});

/* ---------- Bunker Impact ---------- */

describe("computeBunkerImpact", () => {
  it("returns valid impact from fixture data", () => {
    const pts = bunkerHistory();
    const impact = computeBunkerImpact(pts);
    expect(impact.currentVlsfo).toBeGreaterThan(0);
    expect(impact.currentHsfo).toBeGreaterThan(0);
    expect(typeof impact.vlsfoChangePct).toBe("number");
    expect(typeof impact.refVoyageImpactUsd).toBe("number");
    expect(typeof impact.refImpactPerT).toBe("number");
  });

  it("returns zeros for empty input", () => {
    const impact = computeBunkerImpact([]);
    expect(impact.currentVlsfo).toBe(0);
    expect(impact.refVoyageImpactUsd).toBe(0);
  });

  it("returns zeros for single data point", () => {
    const impact = computeBunkerImpact([{ date: "2026-10-25", vlsfo: 620, hsfo: 440 }]);
    expect(impact.currentVlsfo).toBe(0);
    expect(impact.refVoyageImpactUsd).toBe(0);
  });

  it("computes correct direction for rising VLSFO", () => {
    const pts: BunkerPoint[] = [
      { date: "2026-10-18", vlsfo: 600, hsfo: 420 },
      { date: "2026-10-25", vlsfo: 650, hsfo: 460 },
    ];
    const impact = computeBunkerImpact(pts);
    expect(impact.vlsfoChangePct).toBeGreaterThan(0);
    expect(impact.refVoyageImpactUsd).toBeGreaterThan(0);
  });

  it("computes correct direction for falling VLSFO", () => {
    const pts: BunkerPoint[] = [
      { date: "2026-10-18", vlsfo: 650, hsfo: 460 },
      { date: "2026-10-25", vlsfo: 600, hsfo: 420 },
    ];
    const impact = computeBunkerImpact(pts);
    expect(impact.vlsfoChangePct).toBeLessThan(0);
    expect(impact.refVoyageImpactUsd).toBeLessThan(0);
  });

  it("HSFO is cheaper than VLSFO", () => {
    const pts = bunkerHistory();
    const impact = computeBunkerImpact(pts);
    expect(impact.currentHsfo).toBeLessThan(impact.currentVlsfo);
  });
});

/* ---------- Analyst Insights ---------- */

describe("generateInsights", () => {
  const allData: Record<OriginRegion, FreightPoint[]> = {
    AUS_QLD: freightHistory("AUS_QLD"),
    AUS_NSW: freightHistory("AUS_NSW"),
    AUS_WA: freightHistory("AUS_WA"),
    IDN_KAL: freightHistory("IDN_KAL"),
  };
  const snap = marketSnapshot();
  const routes = buildRouteComparisons(allData, "PRDP");
  const congestion = congestionFixture();
  const bunker = computeBunkerImpact(bunkerHistory());

  it("returns at least one insight from demo data", () => {
    const insights = generateInsights(snap, routes, congestion, bunker, RISK_ALERTS);
    expect(insights.length).toBeGreaterThan(0);
  });

  it("every insight has required fields", () => {
    const insights = generateInsights(snap, routes, congestion, bunker, RISK_ALERTS);
    for (const ins of insights) {
      expect(ins.id).toBeTruthy();
      expect(ins.signal).toBeTruthy();
      expect(ins.metric).toBeTruthy();
      expect(ins.implication).toBeTruthy();
      expect(ins.route).toBeTruthy();
      expect(["info", "warning", "opportunity"]).toContain(ins.severity);
    }
  });

  it("generates congestion insight for Paradip (high wait + up trend)", () => {
    const insights = generateInsights(snap, routes, congestion, bunker, RISK_ALERTS);
    const paradipInsight = insights.find((i) => i.route === "Paradip");
    expect(paradipInsight).toBeDefined();
    expect(paradipInsight!.severity).toBe("warning");
  });

  it("generates freight market firming insight when index rises > 2%", () => {
    const insights = generateInsights(snap, routes, congestion, bunker, RISK_ALERTS);
    const firmingInsight = insights.find((i) => i.signal.includes("firming"));
    // The demo snapshot has freightIndexChangePct: 2.6 which is > 2
    expect(firmingInsight).toBeDefined();
  });

  it("generates unique IDs for each insight", () => {
    const insights = generateInsights(snap, routes, congestion, bunker, RISK_ALERTS);
    const ids = insights.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
