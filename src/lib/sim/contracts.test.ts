import { describe, expect, it } from "vitest";
import {
  detectCommercialRisks,
  detectLaycanConflicts,
  filterContracts,
  formatLaycanRange,
  summarizeCommercialPortfolio,
  validateContractInput,
} from "./contracts";
import { CONTRACT_FIXTURES } from "@/lib/api/fixtures";
import type { ContractRecord } from "@/lib/api/types";

describe("Contracts & Commercial Risk Intelligence Engine", () => {
  describe("Contract Filtering & Search", () => {
    it("searches contracts by reference, counterparty, and vessel", () => {
      const byRef = filterContracts(CONTRACT_FIXTURES, { search: "NVK-VC-2610-014" });
      expect(byRef.length).toBe(1);
      expect(byRef[0].vesselName).toBe("MV Kalinga Star");

      const byVessel = filterContracts(CONTRACT_FIXTURES, { search: "Aegean" });
      expect(byVessel.length).toBe(1);
      expect(byVessel[0].reference).toBe("NVK-TC-2610-011");

      const byCounterparty = filterContracts(CONTRACT_FIXTURES, { search: "Oceanic Bulk" });
      expect(byCounterparty.length).toBe(2);
    });

    it("filters contracts by status and type", () => {
      const fixed = filterContracts(CONTRACT_FIXTURES, { status: "FIXED" });
      expect(fixed.every((c) => c.status === "FIXED")).toBe(true);

      const tc = filterContracts(CONTRACT_FIXTURES, { type: "TIME_CHARTER" });
      expect(tc.length).toBe(1);
      expect(tc[0].vesselClass).toBe("NEWCASTLEMAX");

      const draft = filterContracts(CONTRACT_FIXTURES, { status: "DRAFT" });
      expect(draft.length).toBe(1);
      expect(draft[0].vesselName).toBe("MV Dhamra Pride");
    });

    it("filters by verification status and destination port", () => {
      const verified = filterContracts(CONTRACT_FIXTURES, { verification: "VERIFIED" });
      expect(verified.every((c) => c.verificationStatus === "VERIFIED")).toBe(true);

      const prdp = filterContracts(CONTRACT_FIXTURES, { destination: "PRDP" });
      expect(prdp.length).toBe(3); // Kalinga Star, Mahanadi Dawn, Brahmaputra Leader
    });

    it("sorts contracts by laycan, tonnage, and freight rate", () => {
      const sortedTonnage = filterContracts(CONTRACT_FIXTURES, {
        sortKey: "tonnage",
        sortDir: "desc",
      });
      expect(sortedTonnage[0].tonnage).toBeGreaterThanOrEqual(sortedTonnage[1].tonnage);

      const sortedRate = filterContracts(CONTRACT_FIXTURES, {
        sortKey: "rateUsdPerT",
        sortDir: "asc",
      });
      expect(sortedRate[0].rateUsdPerT).toBeLessThanOrEqual(sortedRate[1].rateUsdPerT);
    });
  });

  describe("Commercial Portfolio Summary", () => {
    it("computes accurate aggregate commercial volume and spend", () => {
      const summary = summarizeCommercialPortfolio(CONTRACT_FIXTURES);

      expect(summary.totalTonnage).toBeGreaterThan(1_000_000);
      expect(summary.totalSpendUsd).toBeGreaterThan(10_000_000);
      expect(summary.weightedRateUsdPerT).toBeGreaterThan(10);
      expect(summary.weightedRateUsdPerT).toBeLessThan(20);

      expect(summary.activeFixturesCount).toBeGreaterThanOrEqual(4);
      expect(summary.commodityShares.length).toBeGreaterThanOrEqual(3);
      expect(summary.typeDistribution.VOYAGE).toBeGreaterThan(0);
      expect(summary.typeDistribution.TIME_CHARTER).toBe(1);
    });
  });

  describe("Laycan Conflict Detection", () => {
    it("detects overlapping laycan windows at the same discharge port", () => {
      const conflicts = detectLaycanConflicts(CONTRACT_FIXTURES);

      // MV Kalinga Star (Nov 04-10) and MV Brahmaputra Leader (Nov 08-14) overlap at PRDP (Nov 08-10)
      const prdpConflict = conflicts.find((c) => c.portCode === "PRDP");
      expect(prdpConflict).toBeDefined();
      expect(prdpConflict?.overlapStart).toBe("2026-11-08");
      expect(prdpConflict?.overlapEnd).toBe("2026-11-10");
      expect(prdpConflict?.overlapDays).toBe(3);
      expect(prdpConflict?.combinedTonnage).toBe(165_000 + 82_000);
      expect(prdpConflict?.severity).toBe("HIGH");
      expect(prdpConflict?.suggestedAction).toContain("buffer");
    });

    it("does not report conflict when laycans do not overlap", () => {
      const nonOverlapping: ContractRecord[] = [
        {
          id: "t1",
          reference: "NVK-VC-1",
          counterparty: "A",
          vesselName: "Ship 1",
          vesselClass: "CAPESIZE",
          type: "VOYAGE",
          origin: "AUS_QLD",
          destination: "PRDP",
          tonnage: 160_000,
          rateUsdPerT: 15.0,
          laycanStart: "2026-11-01",
          laycanEnd: "2026-11-05",
          status: "FIXED",
          createdAt: "2026-10-20T00:00:00Z",
        },
        {
          id: "t2",
          reference: "NVK-VC-2",
          counterparty: "B",
          vesselName: "Ship 2",
          vesselClass: "PANAMAX",
          type: "VOYAGE",
          origin: "AUS_QLD",
          destination: "PRDP",
          tonnage: 75_000,
          rateUsdPerT: 14.5,
          laycanStart: "2026-11-10",
          laycanEnd: "2026-11-15",
          status: "FIXED",
          createdAt: "2026-10-20T00:00:00Z",
        },
      ];

      const conflicts = detectLaycanConflicts(nonOverlapping);
      expect(conflicts.length).toBe(0);
    });
  });

  describe("Commercial Risk & Outstanding Checks", () => {
    it("flags imminent deadlines, unverified terms, and pending checks", () => {
      const risks = detectCommercialRisks(CONTRACT_FIXTURES, "2026-10-27");

      expect(risks.length).toBeGreaterThan(0);

      // Check deadline detection
      const deadlineRisk = risks.find((r) => r.category === "DEADLINE");
      expect(deadlineRisk).toBeDefined();
      expect(deadlineRisk?.daysRemaining).toBeLessThanOrEqual(14);

      // Check unverified contract detection
      const unverifiedRisk = risks.find(
        (r) => r.category === "VERIFICATION" && r.contractReference === "NVK-VC-2610-009",
      );
      expect(unverifiedRisk).toBeDefined();

      // Check nautical check
      const nauticalRisk = risks.find((r) => r.category === "NAUTICAL_CHECK");
      expect(nauticalRisk).toBeDefined();

      // Check laycan conflict risk
      const conflictRisk = risks.find((r) => r.category === "LAYCAN_CONFLICT");
      expect(conflictRisk).toBeDefined();
      expect(conflictRisk?.portName).toBe("Paradip");
    });
  });

  describe("Contract Form Validation", () => {
    it("validates valid contract payload successfully", () => {
      const valid = validateContractInput({
        counterparty: "Oceanic Bulk Carriers",
        vesselName: "MV Kalinga Star",
        vesselClass: "CAPESIZE",
        origin: "AUS_QLD",
        destination: "PRDP",
        tonnage: 160_000,
        rateUsdPerT: 15.82,
        laycanStart: "2026-11-04",
        laycanEnd: "2026-11-10",
      });

      expect(valid.isValid).toBe(true);
      expect(Object.keys(valid.errors).length).toBe(0);
    });

    it("rejects missing fields and invalid dates/tonnage", () => {
      const invalid = validateContractInput({
        counterparty: "",
        tonnage: -500,
        rateUsdPerT: -10,
        laycanStart: "2026-11-10",
        laycanEnd: "2026-11-04", // precedes start
      });

      expect(invalid.isValid).toBe(false);
      expect(invalid.errors.counterparty).toBeDefined();
      expect(invalid.errors.tonnage).toBeDefined();
      expect(invalid.errors.rateUsdPerT).toBeDefined();
      expect(invalid.errors.laycanEnd).toContain("precede");
    });
  });

  describe("Formatters", () => {
    it("formats laycan range readable string", () => {
      const range = formatLaycanRange("2026-11-04", "2026-11-10");
      expect(range).toContain("Nov 2026");
    });
  });
});
