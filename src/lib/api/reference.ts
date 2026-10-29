import type {
  CargoType,
  ContractPreference,
  Decision,
  OriginProfile,
  OriginRegion,
  PortCode,
  PortProfile,
  RiskLevel,
  VesselClassId,
  VesselClassSpec,
} from "./types";

/**
 * Static reference data used by the demo adapters and the simulation.
 * Values are illustrative approximations for a prototype — not survey-grade
 * port or vessel particulars. The backend should own the authoritative copy.
 */

export const ORIGINS: OriginProfile[] = [
  {
    id: "AUS_QLD",
    name: "Queensland, Australia",
    shortName: "Queensland",
    loadPort: "Hay Point",
    lon: 149.3,
    lat: -21.28,
  },
  {
    id: "AUS_NSW",
    name: "New South Wales, Australia",
    shortName: "New South Wales",
    loadPort: "Newcastle",
    lon: 151.78,
    lat: -32.92,
  },
  {
    id: "AUS_WA",
    name: "Western Australia",
    shortName: "Western Australia",
    loadPort: "Port Hedland",
    lon: 118.58,
    lat: -20.31,
  },
  {
    id: "IDN_KAL",
    name: "East Kalimantan, Indonesia",
    shortName: "Kalimantan",
    loadPort: "Muara Pantai",
    lon: 117.4,
    lat: -0.9,
  },
];

export const PORTS: PortProfile[] = [
  {
    code: "PRDP",
    name: "Paradip",
    state: "Odisha",
    lon: 86.67,
    lat: 20.27,
    maxDraftM: 17.1,
    maxLoaM: 300,
    maxBeamM: 50,
    maxDwt: 165_000,
    berths: 18,
    dischargeRateTpd: 45_000,
    portDuesUsdPerT: 1.35,
    notes: "Major coking-coal gateway for Odisha steel belt. Capesize accepted part-laden.",
  },
  {
    code: "VIZG",
    name: "Visakhapatnam",
    state: "Andhra Pradesh",
    lon: 83.29,
    lat: 17.69,
    maxDraftM: 17.0,
    maxLoaM: 290,
    maxBeamM: 48,
    maxDwt: 150_000,
    berths: 24,
    dischargeRateTpd: 38_000,
    portDuesUsdPerT: 1.4,
    notes: "Outer harbour handles large bulkers; inner harbour limited to Panamax.",
  },
  {
    code: "GGVM",
    name: "Gangavaram",
    state: "Andhra Pradesh",
    lon: 83.23,
    lat: 17.62,
    maxDraftM: 21.0,
    maxLoaM: 340,
    maxBeamM: 60,
    maxDwt: 250_000,
    berths: 9,
    dischargeRateTpd: 55_000,
    portDuesUsdPerT: 1.25,
    notes: "Deepest draft on the east coast; fully laden Capesize and Newcastlemax.",
  },
  {
    code: "DHMR",
    name: "Dhamra",
    state: "Odisha",
    lon: 86.97,
    lat: 20.8,
    maxDraftM: 18.0,
    maxLoaM: 330,
    maxBeamM: 55,
    maxDwt: 180_000,
    berths: 7,
    dischargeRateTpd: 50_000,
    portDuesUsdPerT: 1.3,
    notes: "Deep-draft private port serving eastern steel plants.",
  },
  {
    code: "HLDA",
    name: "Haldia",
    state: "West Bengal",
    lon: 88.06,
    lat: 22.03,
    maxDraftM: 8.5,
    maxLoaM: 220,
    maxBeamM: 32.3,
    maxDwt: 45_000,
    berths: 15,
    dischargeRateTpd: 22_000,
    portDuesUsdPerT: 1.6,
    notes: "Riverine dock on the Hooghly. Large bulkers lighter at Sandheads anchorage.",
  },
];

/** Lightering option where a port supports offshore transshipment. */
export const LIGHTERING: Partial<
  Record<PortCode, { costUsdPerT: number; extraDays: number; location: string }>
> = {
  HLDA: { costUsdPerT: 4.6, extraDays: 3, location: "Sandheads anchorage" },
};

export const VESSEL_CLASSES: VesselClassSpec[] = [
  {
    id: "SUPRAMAX",
    name: "Supramax",
    dwtMin: 50_000,
    dwtMax: 60_000,
    loaM: 190,
    beamM: 32.3,
    ladenDraftM: 12.8,
    serviceSpeedKn: 13.5,
    dailyHireUsd: 14_500,
    fuelTpd: 28,
    availabilityPct: 92,
  },
  {
    id: "ULTRAMAX",
    name: "Ultramax",
    dwtMin: 61_000,
    dwtMax: 66_000,
    loaM: 200,
    beamM: 32.3,
    ladenDraftM: 13.3,
    serviceSpeedKn: 13.5,
    dailyHireUsd: 15_800,
    fuelTpd: 29,
    availabilityPct: 88,
  },
  {
    id: "PANAMAX",
    name: "Panamax",
    dwtMin: 70_000,
    dwtMax: 78_000,
    loaM: 225,
    beamM: 32.3,
    ladenDraftM: 14.2,
    serviceSpeedKn: 13,
    dailyHireUsd: 13_900,
    fuelTpd: 31,
    availabilityPct: 84,
  },
  {
    id: "KAMSARMAX",
    name: "Kamsarmax",
    dwtMin: 80_000,
    dwtMax: 85_000,
    loaM: 229,
    beamM: 32.3,
    ladenDraftM: 14.5,
    serviceSpeedKn: 13,
    dailyHireUsd: 15_200,
    fuelTpd: 31,
    availabilityPct: 81,
  },
  {
    id: "CAPESIZE",
    name: "Capesize",
    dwtMin: 170_000,
    dwtMax: 182_000,
    loaM: 292,
    beamM: 45,
    ladenDraftM: 18.1,
    serviceSpeedKn: 12.5,
    dailyHireUsd: 23_500,
    fuelTpd: 48,
    availabilityPct: 74,
  },
  {
    id: "NEWCASTLEMAX",
    name: "Newcastlemax",
    dwtMin: 200_000,
    dwtMax: 210_000,
    loaM: 299.9,
    beamM: 50,
    ladenDraftM: 18.5,
    serviceSpeedKn: 12.5,
    dailyHireUsd: 26_800,
    fuelTpd: 52,
    availabilityPct: 63,
  },
];

/** Indicative laden sea distances (nautical miles). */
export const DISTANCES_NM: Record<OriginRegion, Record<PortCode, number>> = {
  AUS_QLD: { PRDP: 4780, VIZG: 4620, GGVM: 4630, DHMR: 4840, HLDA: 5020 },
  AUS_NSW: { PRDP: 5900, VIZG: 5720, GGVM: 5730, DHMR: 5960, HLDA: 6140 },
  AUS_WA: { PRDP: 3150, VIZG: 3010, GGVM: 3020, DHMR: 3210, HLDA: 3390 },
  IDN_KAL: { PRDP: 2790, VIZG: 2700, GGVM: 2710, DHMR: 2850, HLDA: 3010 },
};

export const ROUTE_LABELS: Record<OriginRegion, string> = {
  AUS_QLD: "Coral Sea → Torres Strait → Timor Sea → Bay of Bengal",
  AUS_NSW: "Bass Strait → Great Australian Bight → Cape Leeuwin → Bay of Bengal",
  AUS_WA: "Indian Ocean (west of Sumatra) → Bay of Bengal",
  IDN_KAL: "Makassar Strait → Java Sea → Sunda Strait → Bay of Bengal",
};

export const CARGO_LABELS: Record<CargoType, string> = {
  COKING_COAL: "Coking coal",
  THERMAL_COAL: "Thermal coal",
  IRON_ORE: "Iron ore",
  LIMESTONE: "Limestone",
};

export const CARGO_INSURANCE_USD_PER_T: Record<CargoType, number> = {
  COKING_COAL: 0.36,
  THERMAL_COAL: 0.18,
  IRON_ORE: 0.16,
  LIMESTONE: 0.06,
};

export const CONTRACT_LABELS: Record<ContractPreference, string> = {
  SPOT: "Spot voyage",
  SHORT_TERM: "Short-term (≤ 6 mo)",
  MEDIUM_TERM: "Medium-term (6–24 mo)",
  FLEXIBLE: "Flexible / let NAVIK advise",
};

export const DECISION_LABELS: Record<Decision, string> = {
  CHARTER_NOW: "Charter now",
  WAIT: "Wait",
  SPLIT: "Split",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  ELEVATED: "Elevated",
  HIGH: "High",
};

export const originById = (id: OriginRegion) => ORIGINS.find((o) => o.id === id)!;
export const portByCode = (code: PortCode) => PORTS.find((p) => p.code === code)!;
export const vesselById = (id: VesselClassId) => VESSEL_CLASSES.find((v) => v.id === id)!;
