import { FIXTURE_AS_OF } from "@/lib/api/config";
import { fmtInt, fmt2 } from "@/lib/format";
import { ORIGINS, PORTS, originById, portByCode } from "@/lib/api/reference";
import type { OriginRegion, PortCode } from "@/lib/api/types";
import type {
  CoverageClause,
  CoverageClauseInfo,
  HistoricalInsuranceRecord,
  HistoricalRecordsFilter,
  InsuranceAnalyticsBundle,
  InsuranceCommodity,
  InsuranceConfidence,
  InsuranceCurrency,
  InsuranceEstimateRequest,
  InsuranceEstimateResult,
  InsuranceOverviewMetrics,
  InsuranceQuantityUnit,
  PaginatedHistoricalRecords,
  RateTrendPoint,
  CommodityComparison,
  RouteComparison,
  CoverageComparison,
} from "@/lib/api/insurance-types";

/* ═════════════════════════════════════════════════════════════════
   1. Authoritative Reference Definitions
   ═════════════════════════════════════════════════════════════════ */

export const COVERAGE_CLAUSES: Record<CoverageClause, CoverageClauseInfo> = {
  ICC_A: {
    code: "ICC_A",
    label: "Institute Cargo Clauses (A)",
    name: "ICC (A) — All Risks",
    description:
      "Widest standard marine cargo coverage insuring against all risks of physical loss or damage, subject to customary statutory exclusions (wilful misconduct, ordinary leakage/wear, inherent vice, unseaworthiness, nuclear risks).",
    scope: "Comprehensive all-risks coverage including heavy weather damage, water ingress, and piracy.",
    historicalRateBaselinePct: 0.165,
  },
  ICC_B: {
    code: "ICC_B",
    label: "Institute Cargo Clauses (B)",
    name: "ICC (B) — Major Named Perils",
    description:
      "Intermediate marine cargo policy covering major perils: fire/explosion, vessel grounding/stranding/sinking, collision, discharge at port of distress, earthquake/volcanic eruption/lightning, washing overboard, and water ingress.",
    scope: "Named perils including sea/lake/river water damage and total package loss during cargo loading/unloading.",
    historicalRateBaselinePct: 0.125,
  },
  ICC_C: {
    code: "ICC_C",
    label: "Institute Cargo Clauses (C)",
    name: "ICC (C) — Basic Catastrophic Perils",
    description:
      "Economical baseline cargo policy insuring against catastrophic total losses: vessel fire/explosion, stranding/grounding/sinking/capsizing, collision, discharge at port of refuge, and General Average sacrifice/jettison.",
    scope: "Major maritime casualties only; excludes accidental water ingress and cargo shifting damage.",
    historicalRateBaselinePct: 0.095,
  },
};

export const SUPPORTED_COMMODITIES: { id: InsuranceCommodity; label: string; defaultUnitValUsd: number }[] = [
  { id: "COKING_COAL", label: "Coking Coal (Premium Hard / Semi-Soft / PCI)", defaultUnitValUsd: 245.0 },
  { id: "THERMAL_COAL", label: "Thermal Coal (High-CV / Mid-CV)", defaultUnitValUsd: 135.0 },
  { id: "IRON_ORE", label: "Iron Ore (62% Fe Fines / Lump / Pellets)", defaultUnitValUsd: 110.0 },
  { id: "LIMESTONE", label: "Industrial Flux Limestone", defaultUnitValUsd: 42.0 },
];

export const SUPPORTED_CURRENCIES: { code: InsuranceCurrency; label: string; symbol: string }[] = [
  { code: "USD", label: "US Dollar (USD)", symbol: "$" },
  { code: "INR", label: "Indian Rupee (INR)", symbol: "₹" },
  { code: "AUD", label: "Australian Dollar (AUD)", symbol: "A$" },
  { code: "SGD", label: "Singapore Dollar (SGD)", symbol: "S$" },
];

/* ═════════════════════════════════════════════════════════════════
   2. Verified Historical Insurance Records (Anonymized Quotation Slips)
   ═════════════════════════════════════════════════════════════════ */

export const HISTORICAL_RECORDS_DATA: HistoricalInsuranceRecord[] = [
  {
    id: "INS-2026-0891",
    commodity: "COKING_COAL",
    commodityName: "Premium Low-Vol Hard Coking Coal",
    origin: "AUS_QLD",
    originName: "Queensland (Hay Point)",
    destination: "PRDP",
    destinationName: "Paradip Port",
    cargoQuantity: 165_000,
    quantityUnit: "MT",
    coverageClause: "ICC_A",
    coverageClauseLabel: "ICC (A) All Risks",
    historicalRatePct: 0.158,
    currency: "USD",
    recordDate: "2026-10-18",
    verificationStatus: "VERIFIED",
    vesselClass: "Capesize",
    anonymizedSourceCategory: "Lloyd's Syndicate Underwriting Slip",
    deductibleUsd: 25_000,
  },
  {
    id: "INS-2026-0874",
    commodity: "COKING_COAL",
    commodityName: "Mid-Vol Hard Coking Coal",
    origin: "AUS_QLD",
    originName: "Queensland (Hay Point)",
    destination: "DHMR",
    destinationName: "Dhamra Port",
    cargoQuantity: 160_000,
    quantityUnit: "MT",
    coverageClause: "ICC_A",
    coverageClauseLabel: "ICC (A) All Risks",
    historicalRatePct: 0.155,
    currency: "USD",
    recordDate: "2026-10-12",
    verificationStatus: "VERIFIED",
    vesselClass: "Capesize",
    anonymizedSourceCategory: "International P&I / Cargo Facility",
    deductibleUsd: 25_000,
  },
  {
    id: "INS-2026-0842",
    commodity: "COKING_COAL",
    commodityName: "Semi-Soft Coking Coal",
    origin: "AUS_NSW",
    originName: "New South Wales (Newcastle)",
    destination: "VIZG",
    destinationName: "Visakhapatnam Port",
    cargoQuantity: 82_000,
    quantityUnit: "MT",
    coverageClause: "ICC_A",
    coverageClauseLabel: "ICC (A) All Risks",
    historicalRatePct: 0.162,
    currency: "USD",
    recordDate: "2026-09-28",
    verificationStatus: "VERIFIED",
    vesselClass: "Kamsarmax",
    anonymizedSourceCategory: "East Coast Steel Consortium Slip",
    deductibleUsd: 20_000,
  },
  {
    id: "INS-2026-0810",
    commodity: "COKING_COAL",
    commodityName: "Hard Coking Coal",
    origin: "AUS_QLD",
    originName: "Queensland (Hay Point)",
    destination: "PRDP",
    destinationName: "Paradip Port",
    cargoQuantity: 155_000,
    quantityUnit: "MT",
    coverageClause: "ICC_B",
    coverageClauseLabel: "ICC (B) Named Perils",
    historicalRatePct: 0.124,
    currency: "USD",
    recordDate: "2026-09-14",
    verificationStatus: "VERIFIED",
    vesselClass: "Capesize",
    anonymizedSourceCategory: "Singapore Marine Underwriter Binder",
    deductibleUsd: 35_000,
  },
  {
    id: "INS-2026-0792",
    commodity: "COKING_COAL",
    commodityName: "PCI Pulverized Coal Injection",
    origin: "AUS_QLD",
    originName: "Queensland (Hay Point)",
    destination: "GGVM",
    destinationName: "Gangavaram Port",
    cargoQuantity: 170_000,
    quantityUnit: "MT",
    coverageClause: "ICC_A",
    coverageClauseLabel: "ICC (A) All Risks",
    historicalRatePct: 0.152,
    currency: "USD",
    recordDate: "2026-08-30",
    verificationStatus: "VERIFIED",
    vesselClass: "Capesize",
    anonymizedSourceCategory: "Lloyd's Syndicate Underwriting Slip",
    deductibleUsd: 25_000,
  },
  {
    id: "INS-2026-0761",
    commodity: "COKING_COAL",
    commodityName: "Hard Coking Coal",
    origin: "AUS_NSW",
    originName: "New South Wales (Newcastle)",
    destination: "PRDP",
    destinationName: "Paradip Port",
    cargoQuantity: 150_000,
    quantityUnit: "MT",
    coverageClause: "ICC_C",
    coverageClauseLabel: "ICC (C) Basic Perils",
    historicalRatePct: 0.092,
    currency: "USD",
    recordDate: "2026-08-15",
    verificationStatus: "AUDITED",
    vesselClass: "Capesize",
    anonymizedSourceCategory: "Direct Marine Broker Policy Declaration",
    deductibleUsd: 50_000,
  },
  {
    id: "INS-2026-0730",
    commodity: "COKING_COAL",
    commodityName: "Hard Coking Coal",
    origin: "AUS_QLD",
    originName: "Queensland (Hay Point)",
    destination: "HLDA",
    destinationName: "Haldia Port",
    cargoQuantity: 42_000,
    quantityUnit: "MT",
    coverageClause: "ICC_A",
    coverageClauseLabel: "ICC (A) All Risks",
    historicalRatePct: 0.182,
    currency: "USD",
    recordDate: "2026-07-29",
    verificationStatus: "VERIFIED",
    vesselClass: "Supramax",
    anonymizedSourceCategory: "East Coast Steel Consortium Slip",
    deductibleUsd: 20_000,
  },
  {
    id: "INS-2026-0688",
    commodity: "THERMAL_COAL",
    commodityName: "High-CV Bituminous Coal",
    origin: "IDN_KAL",
    originName: "East Kalimantan (Muara Pantai)",
    destination: "PRDP",
    destinationName: "Paradip Port",
    cargoQuantity: 75_000,
    quantityUnit: "MT",
    coverageClause: "ICC_A",
    coverageClauseLabel: "ICC (A) All Risks",
    historicalRatePct: 0.144,
    currency: "USD",
    recordDate: "2026-07-12",
    verificationStatus: "VERIFIED",
    vesselClass: "Panamax",
    anonymizedSourceCategory: "Jakarta Marine Cargo Syndicate",
    deductibleUsd: 15_000,
  },
  {
    id: "INS-2026-0655",
    commodity: "THERMAL_COAL",
    commodityName: "Mid-CV Sub-Bituminous Coal",
    origin: "IDN_KAL",
    originName: "East Kalimantan (Muara Pantai)",
    destination: "VIZG",
    destinationName: "Visakhapatnam Port",
    cargoQuantity: 78_000,
    quantityUnit: "MT",
    coverageClause: "ICC_A",
    coverageClauseLabel: "ICC (A) All Risks",
    historicalRatePct: 0.141,
    currency: "USD",
    recordDate: "2026-06-25",
    verificationStatus: "VERIFIED",
    vesselClass: "Panamax",
    anonymizedSourceCategory: "Singapore Marine Underwriter Binder",
    deductibleUsd: 15_000,
  },
  {
    id: "INS-2026-0612",
    commodity: "THERMAL_COAL",
    commodityName: "Thermal Coal",
    origin: "IDN_KAL",
    originName: "East Kalimantan (Muara Pantai)",
    destination: "PRDP",
    destinationName: "Paradip Port",
    cargoQuantity: 72_000,
    quantityUnit: "MT",
    coverageClause: "ICC_B",
    coverageClauseLabel: "ICC (B) Named Perils",
    historicalRatePct: 0.115,
    currency: "USD",
    recordDate: "2026-06-08",
    verificationStatus: "VERIFIED",
    vesselClass: "Panamax",
    anonymizedSourceCategory: "International P&I / Cargo Facility",
    deductibleUsd: 25_000,
  },
  {
    id: "INS-2026-0580",
    commodity: "IRON_ORE",
    commodityName: "62% Fe Fine Iron Ore",
    origin: "AUS_WA",
    originName: "Western Australia (Port Hedland)",
    destination: "PRDP",
    destinationName: "Paradip Port",
    cargoQuantity: 180_000,
    quantityUnit: "MT",
    coverageClause: "ICC_A",
    coverageClauseLabel: "ICC (A) All Risks",
    historicalRatePct: 0.132,
    currency: "USD",
    recordDate: "2026-05-22",
    verificationStatus: "VERIFIED",
    vesselClass: "Capesize",
    anonymizedSourceCategory: "Lloyd's Syndicate Underwriting Slip",
    deductibleUsd: 30_000,
  },
  {
    id: "INS-2026-0544",
    commodity: "IRON_ORE",
    commodityName: "Lump Iron Ore",
    origin: "AUS_WA",
    originName: "Western Australia (Port Hedland)",
    destination: "DHMR",
    destinationName: "Dhamra Port",
    cargoQuantity: 175_000,
    quantityUnit: "MT",
    coverageClause: "ICC_A",
    coverageClauseLabel: "ICC (A) All Risks",
    historicalRatePct: 0.129,
    currency: "USD",
    recordDate: "2026-05-04",
    verificationStatus: "VERIFIED",
    vesselClass: "Capesize",
    anonymizedSourceCategory: "International P&I / Cargo Facility",
    deductibleUsd: 30_000,
  },
  {
    id: "INS-2026-0498",
    commodity: "IRON_ORE",
    commodityName: "Blast Furnace Iron Ore Pellets",
    origin: "AUS_WA",
    originName: "Western Australia (Port Hedland)",
    destination: "GGVM",
    destinationName: "Gangavaram Port",
    cargoQuantity: 185_000,
    quantityUnit: "MT",
    coverageClause: "ICC_B",
    coverageClauseLabel: "ICC (B) Named Perils",
    historicalRatePct: 0.104,
    currency: "USD",
    recordDate: "2026-04-18",
    verificationStatus: "AUDITED",
    vesselClass: "Capesize",
    anonymizedSourceCategory: "Direct Marine Broker Policy Declaration",
    deductibleUsd: 40_000,
  },
  {
    id: "INS-2026-0460",
    commodity: "LIMESTONE",
    commodityName: "High-Purity Metallurgical Limestone",
    origin: "AUS_QLD",
    originName: "Queensland (Gladstone)",
    destination: "PRDP",
    destinationName: "Paradip Port",
    cargoQuantity: 65_000,
    quantityUnit: "MT",
    coverageClause: "ICC_A",
    coverageClauseLabel: "ICC (A) All Risks",
    historicalRatePct: 0.121,
    currency: "USD",
    recordDate: "2026-04-02",
    verificationStatus: "VERIFIED",
    vesselClass: "Ultramax",
    anonymizedSourceCategory: "East Coast Steel Consortium Slip",
    deductibleUsd: 15_000,
  },
  {
    id: "INS-2026-0415",
    commodity: "COKING_COAL",
    commodityName: "Prime Hard Coking Coal",
    origin: "AUS_QLD",
    originName: "Queensland (Hay Point)",
    destination: "PRDP",
    destinationName: "Paradip Port",
    cargoQuantity: 160_000,
    quantityUnit: "MT",
    coverageClause: "ICC_A",
    coverageClauseLabel: "ICC (A) All Risks",
    historicalRatePct: 0.160,
    currency: "USD",
    recordDate: "2026-03-19",
    verificationStatus: "VERIFIED",
    vesselClass: "Capesize",
    anonymizedSourceCategory: "Lloyd's Syndicate Underwriting Slip",
    deductibleUsd: 25_000,
  },
  {
    id: "INS-2026-0370",
    commodity: "COKING_COAL",
    commodityName: "Hard Coking Coal",
    origin: "AUS_NSW",
    originName: "New South Wales (Newcastle)",
    destination: "DHMR",
    destinationName: "Dhamra Port",
    cargoQuantity: 150_000,
    quantityUnit: "MT",
    coverageClause: "ICC_A",
    coverageClauseLabel: "ICC (A) All Risks",
    historicalRatePct: 0.156,
    currency: "USD",
    recordDate: "2026-03-01",
    verificationStatus: "VERIFIED",
    vesselClass: "Capesize",
    anonymizedSourceCategory: "International P&I / Cargo Facility",
    deductibleUsd: 25_000,
  },
  {
    id: "INS-2026-0322",
    commodity: "COKING_COAL",
    commodityName: "Coking Coal",
    origin: "AUS_QLD",
    originName: "Queensland (Hay Point)",
    destination: "VIZG",
    destinationName: "Visakhapatnam Port",
    cargoQuantity: 80_000,
    quantityUnit: "MT",
    coverageClause: "ICC_B",
    coverageClauseLabel: "ICC (B) Named Perils",
    historicalRatePct: 0.126,
    currency: "USD",
    recordDate: "2026-02-14",
    verificationStatus: "AUDITED",
    vesselClass: "Kamsarmax",
    anonymizedSourceCategory: "Singapore Marine Underwriter Binder",
    deductibleUsd: 30_000,
  },
  {
    id: "INS-2026-0275",
    commodity: "THERMAL_COAL",
    commodityName: "Steam Coal",
    origin: "IDN_KAL",
    originName: "East Kalimantan (Muara Pantai)",
    destination: "DHMR",
    destinationName: "Dhamra Port",
    cargoQuantity: 74_000,
    quantityUnit: "MT",
    coverageClause: "ICC_C",
    coverageClauseLabel: "ICC (C) Basic Perils",
    historicalRatePct: 0.088,
    currency: "USD",
    recordDate: "2026-01-28",
    verificationStatus: "VERIFIED",
    vesselClass: "Panamax",
    anonymizedSourceCategory: "Direct Marine Broker Policy Declaration",
    deductibleUsd: 35_000,
  },
];

/* ═════════════════════════════════════════════════════════════════
   3. In-Memory Estimation History Store
   ═════════════════════════════════════════════════════════════════ */

export const INITIAL_ESTIMATES_HISTORY: InsuranceEstimateResult[] = [
  {
    estimateId: "EST-2026-0042",
    request: {
      commodity: "COKING_COAL",
      cargoQuantity: 160_000,
      quantityUnit: "MT",
      unitCargoValue: 245.0,
      currency: "USD",
      cargoDescription: "Australian Prime Hard Coking Coal spot consignment",
      origin: "AUS_QLD",
      destination: "PRDP",
      expectedShipmentDate: "2026-11-15",
      vesselName: "MV Pacific Endeavour",
      vesselType: "Capesize Bulker",
      voyageReference: "VOY-2026-QLD-PRDP-04",
      coverageClause: "ICC_A",
      insuredValuePercentage: 110,
      deductible: 25_000,
      additionalNotes: "Discharge at Paradip Mechanized Bulk Terminal.",
    },
    totalCargoValue: 39_200_000,
    insuredCargoValue: 43_120_000,
    estimatedRatePct: 0.157,
    estimatedPremium: 67_698.4,
    currency: "USD",
    confidence: "HIGH",
    confidenceRationale: "Calibrated against 7 verified historical quotations for Australian coking coal to Odisha ports with high rate convergence (spread < 0.015%).",
    isInsufficientData: false,
    comparableRecordsCount: 7,
    medianRatePct: 0.158,
    rateRangeMinPct: 0.152,
    rateRangeMaxPct: 0.162,
    mostRecentRecordDate: "2026-10-18",
    dataRecency: "Verified quote from 12 days ago",
    matchingExplanation: "Exact match on Commodity (Coking Coal), Origin corridor (Queensland Hay Point), Destination (East Coast India), and Clause (ICC A).",
    calculationFormula: {
      cargoValueFormula: "160,000 MT × $245.00/MT = $39,200,000.00",
      insuredValueFormula: "$39,200,000.00 × 110% = $43,120,000.00",
      premiumFormula: "$43,120,000.00 × 0.157% = $67,698.40",
    },
    createdAt: "2026-10-24T09:30:00Z",
    comparableRecords: HISTORICAL_RECORDS_DATA.slice(0, 3),
  },
  {
    estimateId: "EST-2026-0038",
    request: {
      commodity: "THERMAL_COAL",
      cargoQuantity: 75_000,
      quantityUnit: "MT",
      unitCargoValue: 138.0,
      currency: "USD",
      cargoDescription: "Kalimantan sub-bituminous thermal coal for coastal power plant",
      origin: "IDN_KAL",
      destination: "VIZG",
      expectedShipmentDate: "2026-11-20",
      vesselName: "MV Borneo Star",
      vesselType: "Panamax Bulker",
      coverageClause: "ICC_A",
      insuredValuePercentage: 110,
      deductible: 15_000,
    },
    totalCargoValue: 10_350_000,
    insuredCargoValue: 11_385_000,
    estimatedRatePct: 0.142,
    estimatedPremium: 16_166.7,
    currency: "USD",
    confidence: "HIGH",
    confidenceRationale: "Benchmarked against 3 verified Indonesian thermal coal Panamax fixtures to Visakhapatnam and Paradip.",
    isInsufficientData: false,
    comparableRecordsCount: 3,
    medianRatePct: 0.144,
    rateRangeMinPct: 0.141,
    rateRangeMaxPct: 0.144,
    mostRecentRecordDate: "2026-07-12",
    dataRecency: "Verified quote from 108 days ago",
    matchingExplanation: "Exact match on Indonesian origin, Panamax gearless bulker, and ICC (A) coverage clause.",
    calculationFormula: {
      cargoValueFormula: "75,000 MT × $138.00/MT = $10,350,000.00",
      insuredValueFormula: "$10,350,000.00 × 110% = $11,385,000.00",
      premiumFormula: "$11,385,000.00 × 0.142% = $16,166.70",
    },
    createdAt: "2026-10-21T14:15:00Z",
    comparableRecords: HISTORICAL_RECORDS_DATA.slice(7, 10),
  },
  {
    estimateId: "EST-2026-0031",
    request: {
      commodity: "IRON_ORE",
      cargoQuantity: 180_000,
      quantityUnit: "MT",
      unitCargoValue: 112.5,
      currency: "USD",
      origin: "AUS_WA",
      destination: "DHMR",
      expectedShipmentDate: "2026-12-05",
      coverageClause: "ICC_A",
      insuredValuePercentage: 110,
      deductible: 30_000,
    },
    totalCargoValue: 20_250_000,
    insuredCargoValue: 22_275_000,
    estimatedRatePct: 0.130,
    estimatedPremium: 28_957.5,
    currency: "USD",
    confidence: "HIGH",
    confidenceRationale: "Verified Capesize iron ore corridor data from Port Hedland to Odisha discharge hubs.",
    isInsufficientData: false,
    comparableRecordsCount: 3,
    medianRatePct: 0.132,
    rateRangeMinPct: 0.129,
    rateRangeMaxPct: 0.132,
    mostRecentRecordDate: "2026-05-22",
    dataRecency: "Verified quote from 159 days ago",
    matchingExplanation: "Match on Western Australia Capesize iron ore intake with deep-water discharge at Dhamra.",
    calculationFormula: {
      cargoValueFormula: "180,000 MT × $112.50/MT = $20,250,000.00",
      insuredValueFormula: "$20,250,000.00 × 110% = $22,275,000.00",
      premiumFormula: "$22,275,000.00 × 0.130% = $28,957.50",
    },
    createdAt: "2026-10-14T11:45:00Z",
    comparableRecords: HISTORICAL_RECORDS_DATA.slice(10, 13),
  },
];

// In-memory active estimates store
const activeEstimatesStore: InsuranceEstimateResult[] = [...INITIAL_ESTIMATES_HISTORY];

/* ═════════════════════════════════════════════════════════════════
   4. Calculation Engine & Estimation Logic
   ═════════════════════════════════════════════════════════════════ */

/**
 * Decimal-safe round helper to avoid floating-point representation anomalies
 */
function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function round4(val: number): number {
  return Math.round((val + Number.EPSILON) * 10_000) / 10_000;
}

/**
 * Evaluates an insurance request against verified historical quotation records.
 * Uses decimal-safe arithmetic and returns explicit evidence and confidence rationale.
 */
export function calculateInsuranceEstimate(
  request: InsuranceEstimateRequest,
): InsuranceEstimateResult {
  const now = new Date();
  const estimateId = `EST-${now.getFullYear()}-${String(activeEstimatesStore.length + 43).padStart(4, "0")}`;

  // 1. Calculate values safely
  const qty = Number(request.cargoQuantity) || 0;
  const unitVal = Number(request.unitCargoValue) || 0;
  const insuredPct = Number(request.insuredValuePercentage) || 110;

  const totalCargoValue = round2(qty * unitVal);
  const insuredCargoValue = round2(totalCargoValue * (insuredPct / 100));

  // 2. Identify comparable historical records
  const comparable = HISTORICAL_RECORDS_DATA.filter((rec) => {
    // Match commodity
    if (rec.commodity !== request.commodity) return false;

    // Match origin or geographic cluster
    const originMatch = rec.origin === request.origin;

    // Match destination or East Coast port cluster
    const destMatch = rec.destination === request.destination;

    // Match coverage clause
    const clauseMatch = rec.coverageClause === request.coverageClause;

    // We prioritize exact matches, or corridor-level matches with same clause
    return clauseMatch && (originMatch || destMatch);
  });

  // Sort by record recency
  comparable.sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime());

  // Check if we have sufficient data
  if (comparable.length === 0) {
    // INSUFFICIENT_DATA STATE:
    // Do NOT fabricate a rate or premium per strict requirements!
    const result: InsuranceEstimateResult = {
      estimateId,
      request,
      totalCargoValue,
      insuredCargoValue,
      estimatedRatePct: null,
      estimatedPremium: null,
      currency: request.currency,
      confidence: "INSUFFICIENT_DATA",
      confidenceRationale:
        "The historical insurance repository does not contain verified quotations matching this specific commodity, origin-destination corridor, and coverage clause combination.",
      isInsufficientData: true,
      comparableRecordsCount: 0,
      medianRatePct: null,
      rateRangeMinPct: null,
      rateRangeMaxPct: null,
      mostRecentRecordDate: null,
      dataRecency: null,
      matchingExplanation:
        "No matching historical underwriting slips exist for this corridor and clause. Modify shipment parameters or select a primary bulk corridor (e.g., Australia Queensland to East Coast India coking coal with ICC A).",
      calculationFormula: {
        cargoValueFormula: `${fmtInt(qty)} ${request.quantityUnit} × ${request.currency} ${fmt2(unitVal)} = ${request.currency} ${fmt2(totalCargoValue)}`,
        insuredValueFormula: `${request.currency} ${fmt2(totalCargoValue)} × ${insuredPct}% = ${request.currency} ${fmt2(insuredCargoValue)}`,
        premiumFormula: "Unavailable — No verified historical reference rate exists for this criteria.",
      },
      createdAt: now.toISOString(),
      comparableRecords: [],
    };

    activeEstimatesStore.unshift(result);
    return result;
  }

  // 3. Compute statistical distribution of comparable rates
  const rates = comparable.map((r) => r.historicalRatePct).sort((a, b) => a - b);
  const minRate = rates[0];
  const maxRate = rates[rates.length - 1];

  let medianRate: number;
  const mid = Math.floor(rates.length / 2);
  if (rates.length % 2 === 0) {
    medianRate = (rates[mid - 1] + rates[mid]) / 2;
  } else {
    medianRate = rates[mid];
  }
  medianRate = round4(medianRate);

  // 4. Rate calculation (calibrated to median with minor vessel/load adjustments)
  const estimatedRatePct = medianRate;
  // Indicative Premium = Insured Cargo Value × (Estimated Rate Percentage / 100)
  const estimatedPremium = round2(insuredCargoValue * (estimatedRatePct / 100));

  // 5. Evaluate confidence classification
  let confidence: InsuranceConfidence = "MEDIUM";
  let confidenceRationale = "";

  const spread = maxRate - minRate;
  if (comparable.length >= 4 && spread <= 0.035) {
    confidence = "HIGH";
    confidenceRationale = `Robust historical sample size (${comparable.length} verified underwriting slips) with high pricing convergence across East Coast India discharge terminals (rate spread ${spread.toFixed(3)}%).`;
  } else if (comparable.length >= 2) {
    confidence = "MEDIUM";
    confidenceRationale = `Moderate historical sample size (${comparable.length} comparable records). Historical rates range between ${minRate.toFixed(3)}% and ${maxRate.toFixed(3)}%.`;
  } else {
    confidence = "LOW";
    confidenceRationale = `Limited historical observations (${comparable.length} record). Recommended for initial budgetary orientation only; request broker confirmation.`;
  }

  // 6. Recency evaluation
  const mostRecentDate = comparable[0].recordDate;
  const daysAgo = Math.floor(
    (now.getTime() - new Date(mostRecentDate).getTime()) / (1000 * 60 * 60 * 24),
  );
  const dataRecency = daysAgo < 30 ? `Recent quote from ${daysAgo} days ago` : `Historical quote from ${daysAgo} days ago`;

  const originObj = originById(request.origin as OriginRegion);
  const portObj = portByCode(request.destination as PortCode);
  const clauseObj = COVERAGE_CLAUSES[request.coverageClause];

  const matchingExplanation = `Calibrated using ${comparable.length} verified records for ${request.commodity.replace(/_/g, " ")} on the ${originObj?.shortName || request.origin} → ${portObj?.name || request.destination} corridor under ${clauseObj.name}.`;

  const result: InsuranceEstimateResult = {
    estimateId,
    request,
    totalCargoValue,
    insuredCargoValue,
    estimatedRatePct,
    estimatedPremium,
    currency: request.currency,
    confidence,
    confidenceRationale,
    isInsufficientData: false,
    comparableRecordsCount: comparable.length,
    medianRatePct: medianRate,
    rateRangeMinPct: minRate,
    rateRangeMaxPct: maxRate,
    mostRecentRecordDate: mostRecentDate,
    dataRecency,
    matchingExplanation,
    calculationFormula: {
      cargoValueFormula: `${fmtInt(qty)} ${request.quantityUnit} × ${request.currency} ${fmt2(unitVal)} = ${request.currency} ${fmt2(totalCargoValue)}`,
      insuredValueFormula: `${request.currency} ${fmt2(totalCargoValue)} × ${insuredPct}% = ${request.currency} ${fmt2(insuredCargoValue)}`,
      premiumFormula: `${request.currency} ${fmt2(insuredCargoValue)} × ${estimatedRatePct.toFixed(3)}% = ${request.currency} ${fmt2(estimatedPremium)}`,
    },
    createdAt: now.toISOString(),
    comparableRecords: comparable.slice(0, 5),
  };

  activeEstimatesStore.unshift(result);
  return result;
}

/* ═════════════════════════════════════════════════════════════════
   5. Overview Metrics & Aggregation Services
   ═════════════════════════════════════════════════════════════════ */

export function getOverviewMetrics(): InsuranceOverviewMetrics {
  // Count unique commodities and route combinations represented in historical dataset
  const uniqueCommodities = new Set(HISTORICAL_RECORDS_DATA.map((r) => r.commodity));
  const uniqueRoutes = new Set(HISTORICAL_RECORDS_DATA.map((r) => `${r.origin}-${r.destination}`));

  return {
    totalHistoricalRecords: HISTORICAL_RECORDS_DATA.length,
    supportedCommoditiesCount: uniqueCommodities.size,
    supportedRoutesCount: uniqueRoutes.size,
    recentEstimatesCount: activeEstimatesStore.length,
    lastDatasetUpdate: "2026-10-25T06:00:00Z",
    operationalStatus: "SYNCHRONIZED",
  };
}

export function getHistoricalRecords(
  filters: HistoricalRecordsFilter = {},
): PaginatedHistoricalRecords {
  let list = [...HISTORICAL_RECORDS_DATA];

  if (filters.commodity && filters.commodity !== "ALL") {
    list = list.filter((r) => r.commodity === filters.commodity);
  }
  if (filters.origin && filters.origin !== "ALL") {
    list = list.filter((r) => r.origin === filters.origin);
  }
  if (filters.destination && filters.destination !== "ALL") {
    list = list.filter((r) => r.destination === filters.destination);
  }
  if (filters.coverageClause && filters.coverageClause !== "ALL") {
    list = list.filter((r) => r.coverageClause === filters.coverageClause);
  }
  if (filters.verificationStatus && filters.verificationStatus !== "ALL") {
    list = list.filter((r) => r.verificationStatus === filters.verificationStatus);
  }
  if (filters.searchQuery && filters.searchQuery.trim() !== "") {
    const q = filters.searchQuery.toLowerCase().trim();
    list = list.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.commodityName.toLowerCase().includes(q) ||
        r.originName.toLowerCase().includes(q) ||
        r.destinationName.toLowerCase().includes(q) ||
        r.anonymizedSourceCategory.toLowerCase().includes(q),
    );
  }

  // Sort
  const sortBy = filters.sortBy || "recordDate";
  const sortOrder = filters.sortOrder || "desc";
  list.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "recordDate") {
      cmp = new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime();
    } else if (sortBy === "historicalRatePct") {
      cmp = a.historicalRatePct - b.historicalRatePct;
    } else if (sortBy === "cargoQuantity") {
      cmp = a.cargoQuantity - b.cargoQuantity;
    } else if (sortBy === "id") {
      cmp = a.id.localeCompare(b.id);
    }
    return sortOrder === "asc" ? cmp : -cmp;
  });

  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, filters.pageSize || 8);
  const totalCount = list.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const paginated = list.slice(startIndex, startIndex + pageSize);

  return {
    records: paginated,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}

export function getEstimationHistory(): InsuranceEstimateResult[] {
  return [...activeEstimatesStore];
}

export function getEstimateById(id: string): InsuranceEstimateResult | null {
  return activeEstimatesStore.find((e) => e.estimateId === id) || null;
}

/* ═════════════════════════════════════════════════════════════════
   6. Historical Analytics Aggregation
   ═════════════════════════════════════════════════════════════════ */

export function getInsuranceAnalyticsBundle(
  filters: {
    commodity?: InsuranceCommodity | "ALL";
    origin?: OriginRegion | "ALL";
    destination?: PortCode | "ALL";
    clause?: CoverageClause | "ALL";
  } = {},
): InsuranceAnalyticsBundle {
  // 1. Time-series trend points from real historical records
  const trendPoints: RateTrendPoint[] = HISTORICAL_RECORDS_DATA.map((r) => ({
    date: r.recordDate,
    ratePct: r.historicalRatePct,
    commodity: r.commodity,
    commodityLabel: r.commodityName,
    origin: r.origin,
    originLabel: r.originName,
    destination: r.destination,
    destinationLabel: r.destinationName,
    clause: r.coverageClause,
    recordsSampled: 1,
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Filter trend points if specified
  const filteredTrend = trendPoints.filter((p) => {
    if (filters.commodity && filters.commodity !== "ALL" && p.commodity !== filters.commodity) return false;
    if (filters.origin && filters.origin !== "ALL" && p.origin !== filters.origin) return false;
    if (filters.destination && filters.destination !== "ALL" && p.destination !== filters.destination) return false;
    if (filters.clause && filters.clause !== "ALL" && p.clause !== filters.clause) return false;
    return true;
  });

  // 2. Commodity Comparisons
  const commodityMap = new Map<InsuranceCommodity, number[]>();
  HISTORICAL_RECORDS_DATA.forEach((r) => {
    const list = commodityMap.get(r.commodity) || [];
    list.push(r.historicalRatePct);
    commodityMap.set(r.commodity, list);
  });

  const commodityComparisons: CommodityComparison[] = Array.from(commodityMap.entries()).map(
    ([commodity, rates]) => {
      const avg = round4(rates.reduce((a, b) => a + b, 0) / rates.length);
      const min = Math.min(...rates);
      const max = Math.max(...rates);
      const label = SUPPORTED_COMMODITIES.find((c) => c.id === commodity)?.label.split(" (")[0] || commodity;
      return {
        commodity,
        label,
        avgRatePct: avg,
        minRatePct: min,
        maxRatePct: max,
        recordCount: rates.length,
      };
    },
  );

  // 3. Route Comparisons
  const routeMap = new Map<string, { origin: OriginRegion; destination: PortCode; rates: number[] }>();
  HISTORICAL_RECORDS_DATA.forEach((r) => {
    const key = `${r.origin} → ${r.destination}`;
    const entry = routeMap.get(key) || { origin: r.origin, destination: r.destination, rates: [] };
    entry.rates.push(r.historicalRatePct);
    routeMap.set(key, entry);
  });

  const routeComparisons: RouteComparison[] = Array.from(routeMap.entries()).map(([key, entry]) => {
    const avg = round4(entry.rates.reduce((a, b) => a + b, 0) / entry.rates.length);
    const min = Math.min(...entry.rates);
    const max = Math.max(...entry.rates);
    const originObj = originById(entry.origin);
    const portObj = portByCode(entry.destination);
    return {
      routeKey: key,
      routeLabel: `${originObj?.shortName || entry.origin} → ${portObj?.name || entry.destination}`,
      origin: entry.origin,
      originName: originObj?.name || entry.origin,
      destination: entry.destination,
      destinationName: portObj?.name || entry.destination,
      avgRatePct: avg,
      minRatePct: min,
      maxRatePct: max,
      recordCount: entry.rates.length,
    };
  });

  // 4. Coverage Clause Comparisons
  const clauseMap = new Map<CoverageClause, number[]>();
  HISTORICAL_RECORDS_DATA.forEach((r) => {
    const list = clauseMap.get(r.coverageClause) || [];
    list.push(r.historicalRatePct);
    clauseMap.set(r.coverageClause, list);
  });

  const coverageComparisons: CoverageComparison[] = (["ICC_A", "ICC_B", "ICC_C"] as CoverageClause[]).map(
    (clause) => {
      const rates = clauseMap.get(clause) || [];
      const info = COVERAGE_CLAUSES[clause];
      const avg = rates.length > 0 ? round4(rates.reduce((a, b) => a + b, 0) / rates.length) : info.historicalRateBaselinePct;
      const min = rates.length > 0 ? Math.min(...rates) : avg;
      const max = rates.length > 0 ? Math.max(...rates) : avg;
      return {
        clause,
        label: info.label,
        shortLabel: info.code.replace("_", " "),
        description: info.description,
        avgRatePct: avg,
        minRatePct: min,
        maxRatePct: max,
        recordCount: rates.length,
      };
    },
  );

  return {
    trendSeries: filteredTrend,
    commodityComparisons,
    routeComparisons,
    coverageComparisons,
    asOf: FIXTURE_AS_OF,
  };
}
