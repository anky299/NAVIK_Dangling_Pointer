import { describe, expect, it } from "vitest";
import {
  calculateInsuranceEstimate,
  getEstimateById,
  getEstimationHistory,
  getHistoricalRecords,
  getInsuranceAnalyticsBundle,
  getOverviewMetrics,
  COVERAGE_CLAUSES,
} from "./insurance";
import type { InsuranceEstimateRequest } from "@/lib/api/insurance-types";

describe("Insurance Intelligence simulation & calculation engine", () => {
  it("computes accurate decimal-safe total cargo value, insured value, and premium for valid Australian coking coal fixture", () => {
    const req: InsuranceEstimateRequest = {
      commodity: "COKING_COAL",
      cargoQuantity: 160_000,
      quantityUnit: "MT",
      unitCargoValue: 245.0,
      currency: "USD",
      origin: "AUS_QLD",
      destination: "PRDP",
      expectedShipmentDate: "2026-11-20",
      coverageClause: "ICC_A",
      insuredValuePercentage: 110,
    };

    const result = calculateInsuranceEstimate(req);

    // Total Cargo Value = 160,000 * 245 = 39,200,000
    expect(result.totalCargoValue).toBe(39_200_000);
    // Insured Value = 39,200,000 * 1.10 = 43,120,000
    expect(result.insuredCargoValue).toBe(43_120_000);
    // Rate should be around 0.15% - 0.16%
    expect(result.estimatedRatePct).toBeGreaterThan(0.14);
    expect(result.estimatedRatePct).toBeLessThan(0.18);
    // Premium = Insured Cargo Value * (Rate / 100)
    expect(result.estimatedPremium).toBe(
      Math.round(43_120_000 * ((result.estimatedRatePct || 0) / 100) * 100) / 100,
    );
    expect(result.confidence).toBe("HIGH");
    expect(result.isInsufficientData).toBe(false);
    expect(result.comparableRecordsCount).toBeGreaterThan(0);
    expect(result.calculationFormula.cargoValueFormula).toContain("160,000");
  });

  it("handles INSUFFICIENT_DATA properly and does NOT fabricate a rate or premium", () => {
    const req: InsuranceEstimateRequest = {
      commodity: "LIMESTONE",
      cargoQuantity: 50_000,
      quantityUnit: "MT",
      unitCargoValue: 40.0,
      currency: "USD",
      origin: "IDN_KAL", // No limestone historical quotes exist for Kalimantan to Haldia with ICC C
      destination: "HLDA",
      expectedShipmentDate: "2026-12-01",
      coverageClause: "ICC_C",
      insuredValuePercentage: 100,
    };

    const result = calculateInsuranceEstimate(req);

    expect(result.confidence).toBe("INSUFFICIENT_DATA");
    expect(result.isInsufficientData).toBe(true);
    expect(result.estimatedRatePct).toBeNull();
    expect(result.estimatedPremium).toBeNull();
    expect(result.comparableRecordsCount).toBe(0);
    expect(result.confidenceRationale).toContain("historical insurance repository does not contain");
  });

  it("returns overview metrics driven by verified historical repository", () => {
    const metrics = getOverviewMetrics();

    expect(metrics.totalHistoricalRecords).toBeGreaterThanOrEqual(18);
    expect(metrics.supportedCommoditiesCount).toBe(4);
    expect(metrics.supportedRoutesCount).toBeGreaterThan(5);
    expect(metrics.operationalStatus).toBe("SYNCHRONIZED");
  });

  it("filters and paginates historical quotation slips correctly", () => {
    const page1 = getHistoricalRecords({
      commodity: "COKING_COAL",
      coverageClause: "ICC_A",
      pageSize: 5,
      page: 1,
    });

    expect(page1.records.length).toBeLessThanOrEqual(5);
    page1.records.forEach((r) => {
      expect(r.commodity).toBe("COKING_COAL");
      expect(r.coverageClause).toBe("ICC_A");
    });
    expect(page1.totalCount).toBeGreaterThan(0);
  });

  it("aggregates historical analytics comparisons for commodities and clauses", () => {
    const analytics = getInsuranceAnalyticsBundle();

    expect(analytics.commodityComparisons.length).toBeGreaterThan(0);
    expect(analytics.coverageComparisons.length).toBe(3);

    // ICC A average rate should be higher than ICC C average rate
    const iccA = analytics.coverageComparisons.find((c) => c.clause === "ICC_A");
    const iccC = analytics.coverageComparisons.find((c) => c.clause === "ICC_C");

    expect(iccA).toBeDefined();
    expect(iccC).toBeDefined();
    expect(iccA!.avgRatePct).toBeGreaterThan(iccC!.avgRatePct);
  });

  it("persists previous estimates and retrieves exact original calculation without recalculation", () => {
    const history = getEstimationHistory();
    expect(history.length).toBeGreaterThan(0);

    const first = history[0];
    const retrieved = getEstimateById(first.estimateId);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.estimateId).toBe(first.estimateId);
    expect(retrieved?.totalCargoValue).toBe(first.totalCargoValue);
    expect(retrieved?.estimatedPremium).toBe(first.estimatedPremium);
  });
});

