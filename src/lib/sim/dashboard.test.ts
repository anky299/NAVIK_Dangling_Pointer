import { describe, expect, it } from "vitest";
import {
  filterRiskAlerts,
  getPortOperationalDetail,
  summarizeCongestion,
  summarizeInflowPipeline,
} from "./dashboard";
import type {
  CongestionIndicator,
  ContractRecord,
  RecentDecision,
  RiskAlert,
} from "@/lib/api/types";

describe("summarizeCongestion", () => {
  it("computes averages and flags congested ports correctly", () => {
    const indicators: CongestionIndicator[] = [
      { port: "PRDP", waitingVessels: 14, avgWaitDays: 2.8, berthOccupancyPct: 86, trend: "up" },
      { port: "DHMR", waitingVessels: 4, avgWaitDays: 1.6, berthOccupancyPct: 68, trend: "flat" },
      { port: "HLDA", waitingVessels: 9, avgWaitDays: 2.4, berthOccupancyPct: 82, trend: "up" },
      { port: "VIZG", waitingVessels: 6, avgWaitDays: 1.9, berthOccupancyPct: 74, trend: "down" },
    ];

    const summary = summarizeCongestion(indicators);
    expect(summary.totalWaitingVessels).toBe(33);
    expect(summary.averageWaitDays).toBeCloseTo(2.2, 1);
    expect(summary.averageOccupancyPct).toBe(78);
    expect(summary.congestedPorts).toContain("PRDP");
    expect(summary.criticalPortCount).toBe(1);
  });

  it("handles empty congestion indicator lists", () => {
    const summary = summarizeCongestion([]);
    expect(summary.totalWaitingVessels).toBe(0);
    expect(summary.averageWaitDays).toBe(0);
    expect(summary.criticalPortCount).toBe(0);
  });
});

describe("summarizeInflowPipeline", () => {
  it("aggregates tonnage and weighted spend across decisions and contracts", () => {
    const decisions: RecentDecision[] = [
      {
        id: "D1",
        createdAt: "2026-10-24T10:00:00Z",
        cargoTonnes: 100_000,
        cargoType: "COKING_COAL",
        origin: "AUS_QLD",
        destination: "PRDP",
        decision: "CHARTER_NOW",
        vesselClass: "CAPESIZE",
        rateUsdPerT: 15.0,
        confidence: 0.8,
      },
      {
        id: "D2",
        createdAt: "2026-10-24T11:00:00Z",
        cargoTonnes: 50_000,
        cargoType: "IRON_ORE",
        origin: "AUS_WA",
        destination: "DHMR",
        decision: "WAIT",
        vesselClass: "PANAMAX",
        rateUsdPerT: 10.0,
        confidence: 0.7,
      },
    ];

    const contracts: ContractRecord[] = [
      {
        id: "C1",
        reference: "REF-1",
        counterparty: "Test Line",
        vesselName: "MV Test",
        vesselClass: "CAPESIZE",
        type: "VOYAGE",
        origin: "AUS_QLD",
        destination: "PRDP",
        tonnage: 100_000,
        rateUsdPerT: 15.0,
        laycanStart: "2026-11-01",
        laycanEnd: "2026-11-05",
        status: "FIXED",
        createdAt: "2026-10-24T00:00:00Z",
      },
    ];

    const res = summarizeInflowPipeline(decisions, contracts);
    expect(res.totalTonnage).toBe(150_000);
    // (100k * 15 + 50k * 10) / 150k = 2,000,000 / 150,000 = 13.33
    expect(res.averageRatePerTonne).toBeCloseTo(13.33, 2);
    expect(res.commodityBreakdown["COKING_COAL"].tonnage).toBe(100_000);
    expect(res.commodityBreakdown["IRON_ORE"].tonnage).toBe(50_000);
    expect(res.activeFixturesCount).toBe(1);
  });
});

describe("getPortOperationalDetail", () => {
  it("returns port draft and draft risk accurately for PRDP and HLDA", () => {
    const indicators: CongestionIndicator[] = [
      { port: "PRDP", waitingVessels: 12, avgWaitDays: 2.6, berthOccupancyPct: 84, trend: "up" },
      { port: "HLDA", waitingVessels: 8, avgWaitDays: 3.2, berthOccupancyPct: 92, trend: "up" },
    ];

    const prdp = getPortOperationalDetail("PRDP", indicators);
    expect(prdp.name).toBe("Paradip");
    expect(prdp.maxDraftM).toBe(17.1);
    expect(prdp.draftRisk).toBe(true); // Capesize draft exceeds 17.1m
    expect(prdp.status).toBe("CONGESTED");

    const hlda = getPortOperationalDetail("HLDA", indicators);
    expect(hlda.name).toBe("Haldia");
    expect(hlda.maxDraftM).toBe(8.5);
    expect(hlda.status).toBe("CRITICAL");
  });
});

describe("filterRiskAlerts", () => {
  const alerts: RiskAlert[] = [
    {
      id: "A1",
      severity: "LOW",
      title: "Torres Strait update",
      detail: "Easing delays",
      region: "Torres Strait",
      issuedAt: "2026-10-22T00:00:00Z",
    },
    {
      id: "A2",
      severity: "HIGH",
      title: "Haldia draft limit",
      detail: "River draft reduced",
      region: "Haldia",
      issuedAt: "2026-10-23T00:00:00Z",
    },
    {
      id: "A3",
      severity: "ELEVATED",
      title: "Bay of Bengal depression",
      detail: "Cyclone watch",
      region: "Bay of Bengal",
      issuedAt: "2026-10-24T00:00:00Z",
    },
  ];

  it("sorts by severity descending", () => {
    const filtered = filterRiskAlerts(alerts, "ALL");
    expect(filtered[0].severity).toBe("HIGH");
    expect(filtered[1].severity).toBe("ELEVATED");
    expect(filtered[2].severity).toBe("LOW");
  });

  it("filters by specific severity", () => {
    const highOnly = filterRiskAlerts(alerts, "HIGH");
    expect(highOnly).toHaveLength(1);
    expect(highOnly[0].id).toBe("A2");
  });

  it("searches by keyword", () => {
    const res = filterRiskAlerts(alerts, "ALL", "cyclone");
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("A3");
  });
});
