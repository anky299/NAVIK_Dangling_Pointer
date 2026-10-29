import { describe, expect, it } from "vitest";
import {
  evaluateDraftConstraint,
  evaluateLoaConstraint,
  evaluateBeamConstraint,
  evaluateDwtConstraint,
  evaluateVesselFeasibility,
  evaluatePortFleetFeasibility,
} from "./feasibility";
import { portByCode, vesselById } from "@/lib/api/reference";

describe("Feasibility Engine - Dimensional and Nautical Constraints", () => {
  const gangavaram = portByCode("GGVM"); // Deepest draft: 21.0m, LOA: 340m, Beam: 60m, DWT: 250k
  const haldia = portByCode("HLDA"); // Shallow river: 8.5m draft, LOA: 220m, Beam: 32.3m, DWT: 45k
  const paradip = portByCode("PRDP"); // Draft: 17.1m, LOA: 300m, Beam: 50m, DWT: 165k
  const supramax = vesselById("SUPRAMAX"); // Draft: 12.8m, LOA: 190m, Beam: 32.3m, DWT: 60k
  const capesize = vesselById("CAPESIZE"); // Draft: 18.1m, LOA: 292m, Beam: 45m, DWT: 182k
  const newcastlemax = vesselById("NEWCASTLEMAX"); // Draft: 18.5m, LOA: 299.9m, Beam: 50m, DWT: 210k

  it("evaluates draft constraint as PASS with safe underkeel clearance", () => {
    const res = evaluateDraftConstraint(supramax, gangavaram);
    expect(res.status).toBe("PASS");
    expect(res.margin).toBe(8.2); // 21.0 - 12.8
    expect(res.isVerified).toBe(true);
  });

  it("evaluates draft constraint as CONDITIONAL when lightering is supported (Haldia)", () => {
    const lightering = { costUsdPerT: 4.6, extraDays: 3, location: "Sandheads anchorage" };
    const res = evaluateDraftConstraint(capesize, haldia, lightering);
    expect(res.status).toBe("CONDITIONAL");
    expect(res.explanation).toContain("Sandheads anchorage");
    expect(res.marginLabel).toContain("Lightering Required");
  });

  it("evaluates draft constraint as CONDITIONAL for part-laden excess within safety limit (Paradip)", () => {
    // Paradip draft is 17.1m, Capesize is 18.1m -> excess is 1.0m <= MAX_PART_LADEN_EXCESS_M (1.2m)
    const res = evaluateDraftConstraint(capesize, paradip);
    expect(res.status).toBe("CONDITIONAL");
    expect(res.explanation).toContain("part-laden");
  });

  it("evaluates draft constraint as VIOLATION when excess exceeds part-laden safety threshold without lightering", () => {
    // Haldia draft 8.5m without lightering vs Capesize 18.1m -> excess 9.6m
    const res = evaluateDraftConstraint(capesize, haldia, undefined);
    expect(res.status).toBe("VIOLATION");
    expect(res.marginLabel).toContain("Exceeds Limit");
  });

  it("evaluates LOA constraint as PASS when within berth envelope", () => {
    const res = evaluateLoaConstraint(supramax, paradip);
    expect(res.status).toBe("PASS");
    expect(res.margin).toBeGreaterThan(0);
  });

  it("evaluates LOA constraint as VIOLATION when exceeding berth length without lightering", () => {
    // Newcastlemax (299.9m) vs Haldia (220m) without lightering
    const res = evaluateLoaConstraint(newcastlemax, haldia, undefined);
    expect(res.status).toBe("VIOLATION");
    expect(res.margin).toBeLessThan(0);
  });

  it("evaluates Beam constraint as PASS when crane outreach is sufficient", () => {
    const res = evaluateBeamConstraint(capesize, gangavaram);
    expect(res.status).toBe("PASS");
    expect(res.margin).toBe(15.0); // 60m - 45m
  });

  it("evaluates DWT constraint as PASS when displacement is within quay civil ratings", () => {
    const res = evaluateDwtConstraint(supramax, paradip);
    expect(res.status).toBe("PASS");
  });
});

describe("Vessel Feasibility Report Generation", () => {
  const gangavaram = portByCode("GGVM");
  const haldia = portByCode("HLDA");
  const paradip = portByCode("PRDP");
  const supramax = vesselById("SUPRAMAX");
  const panamax = vesselById("PANAMAX");
  const capesize = vesselById("CAPESIZE");
  const newcastlemax = vesselById("NEWCASTLEMAX");

  it("evaluates Capesize at Gangavaram as fully FEASIBLE", () => {
    const rep = evaluateVesselFeasibility(capesize, gangavaram);
    expect(rep.status).toBe("FEASIBLE");
    expect(rep.effectiveCapacityT).toBe(capesize.dwtMax);
    expect(rep.capacityDeratingPct).toBe(0);
    expect(rep.requiresLightering).toBe(false);
  });

  it("evaluates Capesize at Paradip as CONDITIONAL due to part-laden derating", () => {
    const rep = evaluateVesselFeasibility(capesize, paradip);
    expect(rep.status).toBe("CONDITIONAL");
    expect(rep.capacityDeratingPct).toBeGreaterThan(0);
    expect(rep.effectiveCapacityT).toBeLessThan(capesize.dwtMax);
    expect(rep.summaryReason).toContain("part-laden");
  });

  it("evaluates Capesize at Haldia as CONDITIONAL due to Sandheads lightering", () => {
    const rep = evaluateVesselFeasibility(capesize, haldia);
    expect(rep.status).toBe("CONDITIONAL");
    expect(rep.requiresLightering).toBe(true);
    expect(rep.lighteringDetails?.location).toBe("Sandheads anchorage");
  });

  it("evaluates Newcastlemax at Paradip as REJECTED due to LOA/DWT exceeding berth envelope", () => {
    // Newcastlemax DWT is 210k vs Paradip 165k (excess 45k) and draft 18.5m vs 17.1m (excess 1.4m > 1.2m)
    const rep = evaluateVesselFeasibility(newcastlemax, paradip);
    expect(rep.status).toBe("REJECTED");
  });

  it("flags missing verification items and sets unverifiedCount appropriately", () => {
    const rep = evaluateVesselFeasibility(panamax, haldia);
    // River pilotage verification check is generated for Haldia
    expect(rep.unverifiedCount).toBeGreaterThan(0);
    const unverifiedCheck = rep.checks.find((c) => c.status === "UNVERIFIED");
    expect(unverifiedCheck).toBeDefined();
    expect(unverifiedCheck?.name).toContain("Hooghly River");
  });
});

describe("Port Fleet Feasibility Summary", () => {
  it("evaluates all registered bulk vessel classes for Gangavaram", () => {
    const summary = evaluatePortFleetFeasibility("GGVM");
    expect(summary.totalEvaluated).toBe(6);
    expect(summary.port.code).toBe("GGVM");
    expect(summary.feasibleCount).toBeGreaterThanOrEqual(5);
    expect(summary.rejectedCount).toBe(0);
    expect(summary.recommendedClassId).toBeDefined();
  });

  it("evaluates all registered bulk vessel classes for Haldia", () => {
    const summary = evaluatePortFleetFeasibility("HLDA");
    expect(summary.totalEvaluated).toBe(6);
    expect(summary.port.code).toBe("HLDA");
    // All larger bulkers require Sandheads lightering or are conditional
    expect(summary.conditionalCount).toBeGreaterThan(0);
  });

  it("evaluates all registered bulk vessel classes for Dhamra", () => {
    const summary = evaluatePortFleetFeasibility("DHMR");
    expect(summary.totalEvaluated).toBe(6);
    expect(summary.port.code).toBe("DHMR");
    expect(summary.feasibleCount).toBeGreaterThanOrEqual(4);
  });
});
