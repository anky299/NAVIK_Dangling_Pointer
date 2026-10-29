/**
 * Demo fixtures. Deterministic, illustrative values for the prototype only.
 * Nothing here is live market data. All series are generated lazily from a
 * seeded PRNG so server and client render identical numbers.
 */
import { FIXTURE_AS_OF } from "./config";
import { DEFAULT_CONGESTION } from "@/lib/sim/charter";
import type {
  AuditEvent,
  BunkerPoint,
  ContractRecord,
  FreightPoint,
  MarketSnapshot,
  OriginRegion,
  Provenance,
  RecentDecision,
  RiskAlert,
  Timeframe,
} from "./types";

export const DEMO_PROVENANCE: Provenance = {
  source: "demo",
  label: "Illustrative fixture",
  asOf: FIXTURE_AS_OF,
};

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEEK_MS = 7 * 86_400_000;
const LAST_WEEK = Date.UTC(2026, 9, 19); // Mon 19 Oct 2026
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const FREIGHT_PARAMS: Record<
  OriginRegion,
  { base: number; amp: number; phase: number; drift: number; seed: number; trend: number }
> = {
  AUS_QLD: { base: 14.6, amp: 0.11, phase: 0.6, drift: 0.0009, seed: 11, trend: 3.8 },
  AUS_NSW: { base: 17.1, amp: 0.09, phase: 1.1, drift: 0.0006, seed: 23, trend: 1.2 },
  AUS_WA: { base: 9.9, amp: 0.13, phase: 2.2, drift: -0.0004, seed: 37, trend: -5.4 },
  IDN_KAL: { base: 8.4, amp: 0.08, phase: 0.2, drift: 0.0002, seed: 41, trend: -1.6 },
};

const seriesCache = new Map<OriginRegion, FreightPoint[]>();

/** 104 weeks of history + 8 weeks of forecast with a P10–P90 band. */
export function freightHistory(origin: OriginRegion): FreightPoint[] {
  const cached = seriesCache.get(origin);
  if (cached) return cached;
  const p = FREIGHT_PARAMS[origin];
  const rand = mulberry32(p.seed);
  const pts: FreightPoint[] = [];
  let walk = 0;
  for (let i = 0; i < 104; i++) {
    walk = walk * 0.86 + (rand() - 0.5) * 0.05;
    const season = Math.sin((2 * Math.PI * i) / 52 + p.phase) * p.amp;
    const rate = p.base * (1 + season + walk + p.drift * (i - 52));
    pts.push({ date: iso(LAST_WEEK - (103 - i) * WEEK_MS), rate: Math.round(rate * 100) / 100 });
  }
  const last = pts[pts.length - 1]!.rate;
  for (let k = 1; k <= 8; k++) {
    const mid = last * (1 + (p.trend / 100) * (k / 4.3));
    const spread = 0.025 * Math.sqrt(k) + 0.01;
    pts.push({
      date: iso(LAST_WEEK + k * WEEK_MS),
      rate: Math.round(mid * 100) / 100,
      forecast: true,
      p10: Math.round(mid * (1 - spread) * 100) / 100,
      p90: Math.round(mid * (1 + spread) * 100) / 100,
    });
  }
  // Anchor the band to the last actual so the chart joins cleanly.
  pts[103] = { ...pts[103]!, p10: last, p90: last };
  seriesCache.set(origin, pts);
  return pts;
}

export const TIMEFRAME_WEEKS: Record<Timeframe, number> = {
  "3M": 13,
  "6M": 26,
  "1Y": 52,
  "2Y": 104,
};

export function sliceTimeframe<T>(pts: T[], timeframe: Timeframe, forecastTail = 0): T[] {
  const n = TIMEFRAME_WEEKS[timeframe];
  return pts.slice(Math.max(0, pts.length - forecastTail - n));
}

let bunkerCache: BunkerPoint[] | null = null;
export function bunkerHistory(): BunkerPoint[] {
  if (bunkerCache) return bunkerCache;
  const rand = mulberry32(97);
  const pts: BunkerPoint[] = [];
  let walk = 0;
  for (let i = 0; i < 104; i++) {
    walk = walk * 0.9 + (rand() - 0.5) * 18;
    const v = 600 + Math.sin(i / 9) * 28 + walk + (i > 90 ? (i - 90) * 1.4 : 0);
    pts.push({
      date: iso(LAST_WEEK - (103 - i) * WEEK_MS),
      vlsfo: Math.round(v),
      hsfo: Math.round(v * 0.71 + (rand() - 0.5) * 10),
    });
  }
  bunkerCache = pts;
  return pts;
}

export function marketSnapshot(): MarketSnapshot {
  return {
    freightIndex: 1842,
    freightIndexChangePct: 2.6,
    avgRateUsdPerT: 13.9,
    avgRateChangePct: 3.1,
    vlsfoUsdPerT: bunkerHistory().at(-1)!.vlsfo,
    vlsfoChangePct: 4.1,
    avgPortWaitDays: 2.3,
    avgPortWaitChange: 0.4,
    fleetAvailabilityPct: 79,
    forecastBias: "up",
    provenance: DEMO_PROVENANCE,
  };
}

export const congestionFixture = () => Object.values(DEFAULT_CONGESTION);

export const RISK_ALERTS: RiskAlert[] = [
  {
    id: "RA-311",
    severity: "ELEVATED",
    title: "Post-monsoon cyclone window — Bay of Bengal",
    detail:
      "Seasonal climatology flags elevated depression formation through mid-December. Build 2–3 days of weather contingency into Odisha discharges.",
    region: "Bay of Bengal",
    issuedAt: "2026-10-24T09:10:00Z",
  },
  {
    id: "RA-309",
    severity: "MODERATE",
    title: "Paradip anchorage queue lengthening",
    detail: "14 bulkers waiting, average 2.8 days. Coking-coal berths running at ~86% occupancy.",
    region: "Paradip",
    issuedAt: "2026-10-24T05:42:00Z",
  },
  {
    id: "RA-305",
    severity: "MODERATE",
    title: "VLSFO up 4.1% week-on-week at Singapore",
    detail:
      "Bunker cost pass-through adds roughly $0.35/t to Queensland → East Coast India voyages.",
    region: "Singapore",
    issuedAt: "2026-10-23T14:00:00Z",
  },
  {
    id: "RA-298",
    severity: "LOW",
    title: "Torres Strait pilot boarding normalised",
    detail: "Pilot boarding delays at Booby Island have eased to under 6 hours.",
    region: "Torres Strait",
    issuedAt: "2026-10-22T03:30:00Z",
  },
  {
    id: "RA-294",
    severity: "HIGH",
    title: "Haldia dock draft restriction",
    detail:
      "Hooghly working draft reduced; all Panamax and larger tonnage must lighter at Sandheads.",
    region: "Haldia",
    issuedAt: "2026-10-21T11:15:00Z",
  },
];

export const RECENT_DECISIONS: RecentDecision[] = [
  {
    id: "DR-1048",
    createdAt: "2026-10-24T16:20:00Z",
    cargoTonnes: 165_000,
    cargoType: "COKING_COAL",
    origin: "AUS_QLD",
    destination: "PRDP",
    decision: "CHARTER_NOW",
    vesselClass: "CAPESIZE",
    rateUsdPerT: 15.82,
    confidence: 0.74,
  },
  {
    id: "DR-1047",
    createdAt: "2026-10-24T09:05:00Z",
    cargoTonnes: 240_000,
    cargoType: "COKING_COAL",
    origin: "AUS_NSW",
    destination: "GGVM",
    decision: "SPLIT",
    vesselClass: "NEWCASTLEMAX",
    rateUsdPerT: 17.4,
    confidence: 0.68,
  },
  {
    id: "DR-1046",
    createdAt: "2026-10-23T12:40:00Z",
    cargoTonnes: 76_000,
    cargoType: "THERMAL_COAL",
    origin: "IDN_KAL",
    destination: "HLDA",
    decision: "WAIT",
    vesselClass: "PANAMAX",
    rateUsdPerT: 13.1,
    confidence: 0.61,
  },
  {
    id: "DR-1045",
    createdAt: "2026-10-22T18:12:00Z",
    cargoTonnes: 172_000,
    cargoType: "IRON_ORE",
    origin: "AUS_WA",
    destination: "DHMR",
    decision: "WAIT",
    vesselClass: "CAPESIZE",
    rateUsdPerT: 9.45,
    confidence: 0.7,
  },
  {
    id: "DR-1044",
    createdAt: "2026-10-21T07:55:00Z",
    cargoTonnes: 58_000,
    cargoType: "LIMESTONE",
    origin: "IDN_KAL",
    destination: "VIZG",
    decision: "CHARTER_NOW",
    vesselClass: "SUPRAMAX",
    rateUsdPerT: 11.6,
    confidence: 0.79,
  },
];

export const CONTRACT_FIXTURES: ContractRecord[] = [
  {
    id: "c1",
    reference: "NVK-VC-2610-014",
    counterparty: "Oceanic Bulk Carriers Pte",
    vesselName: "MV Kalinga Star",
    vesselClass: "CAPESIZE",
    type: "VOYAGE",
    origin: "AUS_QLD",
    destination: "PRDP",
    commodity: "COKING_COAL",
    tonnage: 165_000,
    rateUsdPerT: 15.82,
    laycanStart: "2026-11-04",
    laycanEnd: "2026-11-10",
    status: "FIXED",
    verificationStatus: "VERIFIED",
    isIllustrative: true,
    linkedDecisionId: "DR-1048",
    demurrageTerms: {
      rateUsdPerDay: 24_000,
      despatchUsdPerDay: 12_000,
      laytimeHours: 48,
      laytimeTerms: "35,000 t/day WWD SHINC",
    },
    deadlines: [
      {
        id: "dl-1",
        label: "Laycan Closing Notice",
        dueDate: "2026-11-10",
        category: "LAYCAN",
        isCompleted: false,
        notes: "Final cancellation window",
      },
      {
        id: "dl-2",
        label: "Stem Nomination",
        dueDate: "2026-10-30",
        category: "NOMINATION",
        isCompleted: true,
        notes: "Confirmed by charterer",
      },
      {
        id: "dl-3",
        label: "Letter of Credit Expiry",
        dueDate: "2026-11-15",
        category: "DOCUMENTARY",
        isCompleted: false,
      },
    ],
    outstandingChecks: [
      {
        id: "ck-1",
        label: "Paradip tidal window verification",
        category: "PORT_NAUTICAL",
        status: "PASSED",
        detail: "Part-laden draft 17.1 m verified with port authority",
      },
      {
        id: "ck-2",
        label: "Vessel vetting & insurance",
        category: "VESSEL_SPEC",
        status: "PASSED",
        detail: "RightShip score 4.5/5",
      },
    ],
    assumptions: [
      "Paradip anchorage queue does not exceed 3.5 days",
      "VLSFO bunker baseline at $620/t",
    ],
    notes: "Primary coking coal stem supporting Q4 Odisha blast furnace operations.",
    createdAt: "2026-10-24T16:40:00Z",
  },
  {
    id: "c2",
    reference: "NVK-TC-2610-011",
    counterparty: "Hellenic Ore Shipping SA",
    vesselName: "MV Aegean Resolve",
    vesselClass: "NEWCASTLEMAX",
    type: "TIME_CHARTER",
    origin: "AUS_NSW",
    destination: "GGVM",
    commodity: "COKING_COAL",
    tonnage: 205_000,
    rateUsdPerT: 17.4,
    dailyHireUsd: 26_800,
    laycanStart: "2026-11-12",
    laycanEnd: "2026-11-20",
    status: "UNDER_REVIEW",
    verificationStatus: "PENDING_REVIEW",
    isIllustrative: true,
    linkedDecisionId: "DR-1047",
    deadlines: [
      {
        id: "dl-4",
        label: "Charter Party Execution",
        dueDate: "2026-11-04",
        category: "DOCUMENTARY",
        isCompleted: false,
        notes: "Awaiting legal signature",
      },
      {
        id: "dl-5",
        label: "Delivery Notice (48h)",
        dueDate: "2026-11-10",
        category: "NOTICE",
        isCompleted: false,
      },
    ],
    outstandingChecks: [
      {
        id: "ck-3",
        label: "Gangavaram berth & conveyor slot",
        category: "COMMERCIAL",
        status: "PENDING",
        detail: "Slot confirmation pending terminal schedule",
      },
    ],
    assumptions: ["Deep draft 21.0 m unconstrained at Gangavaram", "Re-delivery at Colombo range"],
    notes: "High-tonnage Newcastlemax charter for Gangavaram high-speed conveyor.",
    createdAt: "2026-10-24T10:02:00Z",
  },
  {
    id: "c3",
    reference: "NVK-COA-2609-006",
    counterparty: "Coromandel Freight Lines",
    vesselName: "Nominated per lifting",
    vesselClass: "PANAMAX",
    type: "COA",
    origin: "IDN_KAL",
    destination: "HLDA",
    commodity: "THERMAL_COAL",
    tonnage: 450_000,
    rateUsdPerT: 13.1,
    laycanStart: "2026-10-01",
    laycanEnd: "2027-03-31",
    status: "FIXED",
    verificationStatus: "VERIFIED",
    isIllustrative: true,
    linkedDecisionId: "DR-1046",
    demurrageTerms: {
      rateUsdPerDay: 16_000,
      despatchUsdPerDay: 8_000,
      laytimeHours: 36,
      laytimeTerms: "25,000 t/day WWD",
    },
    deadlines: [
      {
        id: "dl-6",
        label: "Quarterly Volume Re-audit",
        dueDate: "2026-12-31",
        category: "DOCUMENTARY",
        isCompleted: false,
      },
    ],
    outstandingChecks: [
      {
        id: "ck-4",
        label: "Sandheads barge lightering protocol",
        category: "PORT_NAUTICAL",
        status: "PASSED",
        detail: "Barge contract executed at $4.60/t",
      },
    ],
    assumptions: ["All liftings require offshore lightering at Sandheads anchorage (+3 days)"],
    notes: "Semi-annual contract of affreightment for power plant feedstock.",
    createdAt: "2026-09-18T08:20:00Z",
  },
  {
    id: "c4",
    reference: "NVK-VC-2610-009",
    counterparty: "Pacific Basin Dry (demo)",
    vesselName: "MV Dhamra Pride",
    vesselClass: "CAPESIZE",
    type: "VOYAGE",
    origin: "AUS_WA",
    destination: "DHMR",
    commodity: "IRON_ORE",
    tonnage: 172_000,
    rateUsdPerT: 9.45,
    laycanStart: "2026-11-18",
    laycanEnd: "2026-11-24",
    status: "DRAFT",
    verificationStatus: "UNVERIFIED",
    isIllustrative: true,
    linkedDecisionId: "DR-1045",
    deadlines: [
      {
        id: "dl-7",
        label: "Subject Clause Expiry",
        dueDate: "2026-10-31",
        category: "COMMERCIAL",
        isCompleted: false,
        notes: "Board approval required",
      },
    ],
    outstandingChecks: [
      {
        id: "ck-5",
        label: "Port dues tariff verification",
        category: "COMMERCIAL",
        status: "PENDING",
        detail: "Verify private terminal tariff $1.30/t",
      },
      {
        id: "ck-6",
        label: "Dhamra 18.0 m draft margin",
        category: "PORT_NAUTICAL",
        status: "PENDING",
        detail: "Laden draft 18.1 m exceeds nominal by 0.1 m",
      },
    ],
    assumptions: ["Pilbara export terminal congestion remains under 2.0 days"],
    notes: "Draft fixture pending board commercial approval.",
    createdAt: "2026-10-22T18:30:00Z",
  },
  {
    id: "c5",
    reference: "NVK-VC-2610-004",
    counterparty: "Bengal Bay Shipping",
    vesselName: "MV Godavari Spirit",
    vesselClass: "SUPRAMAX",
    type: "VOYAGE",
    origin: "IDN_KAL",
    destination: "VIZG",
    commodity: "LIMESTONE",
    tonnage: 58_000,
    rateUsdPerT: 11.6,
    laycanStart: "2026-10-28",
    laycanEnd: "2026-11-02",
    status: "FIXED",
    verificationStatus: "VERIFIED",
    isIllustrative: true,
    linkedDecisionId: "DR-1044",
    demurrageTerms: {
      rateUsdPerDay: 14_500,
      despatchUsdPerDay: 7_250,
      laytimeHours: 30,
      laytimeTerms: "20,000 t/day WWD SHINC",
    },
    deadlines: [
      {
        id: "dl-8",
        label: "Notice of Readiness",
        dueDate: "2026-10-28",
        category: "NOTICE",
        isCompleted: true,
      },
    ],
    outstandingChecks: [
      {
        id: "ck-7",
        label: "Vizag inner harbour beam check",
        category: "PORT_NAUTICAL",
        status: "PASSED",
        detail: "Beam 32.3 m passes within 48 m cap",
      },
    ],
    notes: "Limestone parcel for steel sintering plant.",
    createdAt: "2026-10-21T08:10:00Z",
  },
  {
    id: "c6",
    reference: "NVK-VC-2609-021",
    counterparty: "Oceanic Bulk Carriers Pte",
    vesselName: "MV Mahanadi Dawn",
    vesselClass: "CAPESIZE",
    type: "VOYAGE",
    origin: "AUS_QLD",
    destination: "PRDP",
    commodity: "COKING_COAL",
    tonnage: 168_000,
    rateUsdPerT: 14.95,
    laycanStart: "2026-09-20",
    laycanEnd: "2026-09-26",
    status: "COMPLETED",
    verificationStatus: "VERIFIED",
    isIllustrative: true,
    demurrageTerms: { rateUsdPerDay: 23_000, despatchUsdPerDay: 11_500, laytimeHours: 48 },
    notes: "Completed voyage. Discharged at Paradip Berth 14 with 0.8 days demurrage incurred.",
    createdAt: "2026-09-08T12:00:00Z",
  },
  {
    id: "c7",
    reference: "NVK-VC-2610-015",
    counterparty: "Eastern Maritime Lines",
    vesselName: "MV Brahmaputra Leader",
    vesselClass: "KAMSARMAX",
    type: "VOYAGE",
    origin: "AUS_QLD",
    destination: "PRDP",
    commodity: "COKING_COAL",
    tonnage: 82_000,
    rateUsdPerT: 16.15,
    laycanStart: "2026-11-08",
    laycanEnd: "2026-11-14",
    status: "FIXED",
    verificationStatus: "VERIFIED",
    isIllustrative: true,
    demurrageTerms: {
      rateUsdPerDay: 18_500,
      despatchUsdPerDay: 9_250,
      laytimeHours: 40,
      laytimeTerms: "30,000 t/day WWD SHINC",
    },
    deadlines: [
      {
        id: "dl-9",
        label: "Laycan Window Entry",
        dueDate: "2026-11-08",
        category: "LAYCAN",
        isCompleted: false,
      },
    ],
    outstandingChecks: [
      {
        id: "ck-8",
        label: "Paradip draft clearance",
        category: "PORT_NAUTICAL",
        status: "PASSED",
        detail: "Kamsarmax 14.5 m draft fully within 17.1 m limit",
      },
    ],
    assumptions: ["No lightering required at Paradip for Kamsarmax tonnage"],
    notes: "Overlaps with MV Kalinga Star laycan at Paradip (Nov 8–10); potential anchorage wait.",
    createdAt: "2026-10-25T08:30:00Z",
  },
  {
    id: "c8",
    reference: "NVK-VC-2610-018",
    counterparty: "Pacific Rim Navigation",
    vesselName: "MV Bengal Pioneer",
    vesselClass: "ULTRAMAX",
    type: "VOYAGE",
    origin: "IDN_KAL",
    destination: "HLDA",
    commodity: "THERMAL_COAL",
    tonnage: 62_000,
    rateUsdPerT: 12.8,
    laycanStart: "2026-11-20",
    laycanEnd: "2026-11-26",
    status: "UNDER_REVIEW",
    verificationStatus: "PENDING_REVIEW",
    isIllustrative: true,
    deadlines: [
      {
        id: "dl-10",
        label: "Lightering Barge Booking",
        dueDate: "2026-11-10",
        category: "NOMINATION",
        isCompleted: false,
      },
    ],
    outstandingChecks: [
      {
        id: "ck-9",
        label: "Sandheads lightering notice",
        category: "PORT_NAUTICAL",
        status: "PENDING",
        detail: "Awaiting Hooghly river pilot confirmation",
      },
    ],
    assumptions: ["Requires Sandheads lightering transshipment fee +$4.60/t"],
    notes: "Thermal coal parcel for Haldia power station.",
    createdAt: "2026-10-25T14:15:00Z",
  },
];

const ACTORS = [
  "a.menon@navik.demo",
  "r.iyer@navik.demo",
  "s.das@navik.demo",
  "system · scheduler",
  "k.rao@navik.demo",
];
const AUDIT_TEMPLATES: Pick<AuditEvent, "action" | "entity" | "detail">[] = [
  {
    action: "ANALYSIS_RUN",
    entity: "Charter analysis",
    detail: "165k t coking coal · Queensland → Paradip",
  },
  {
    action: "DECISION_APPROVED",
    entity: "Decision report",
    detail: "CHARTER_NOW approved for Capesize",
  },
  { action: "CONTRACT_CREATED", entity: "Contract", detail: "Voyage charter drafted" },
  { action: "SCENARIO_RUN", entity: "Scenario", detail: "Cost pressure preset vs baseline" },
  { action: "DATA_REFRESH", entity: "Market data", detail: "Freight & bunker fixtures reloaded" },
  { action: "CONTRACT_UPDATED", entity: "Contract", detail: "Status moved to UNDER_REVIEW" },
  {
    action: "DECISION_OVERRIDDEN",
    entity: "Decision report",
    detail: "WAIT overridden to CHARTER_NOW by desk lead",
  },
  { action: "SETTINGS_CHANGED", entity: "Workspace", detail: "Risk preference set to BALANCED" },
];

export function auditFixtures(): AuditEvent[] {
  const rand = mulberry32(503);
  const start = Date.parse(FIXTURE_AS_OF);
  const out: AuditEvent[] = [];
  let t = start - 25 * 60_000;
  for (let i = 0; i < 36; i++) {
    const tpl = AUDIT_TEMPLATES[Math.floor(rand() * AUDIT_TEMPLATES.length)]!;
    const actor =
      tpl.action === "DATA_REFRESH"
        ? "system · scheduler"
        : (ACTORS[Math.floor(rand() * 5) % 5] ?? "a.menon@navik.demo");
    out.push({
      id: `AU-${(9120 - i).toString()}`,
      timestamp: new Date(t).toISOString(),
      action: tpl.action,
      entity: tpl.entity,
      entityId: `${tpl.entity.slice(0, 2).toUpperCase()}-${1000 + Math.floor(rand() * 60)}`,
      actor:
        actor === "system · scheduler" && tpl.action !== "DATA_REFRESH"
          ? "a.menon@navik.demo"
          : actor,
      detail: tpl.detail,
    });
    t -= Math.floor(40 + rand() * 300) * 60_000;
  }
  return out;
}
