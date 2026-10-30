import type { OriginRegion, PortCode } from "./types";

/**
 * Standard Institute Cargo Clauses policy terms.
 * Coverage clauses represent distinct policy terms, not quality ratings.
 */
export type CoverageClause = "ICC_A" | "ICC_B" | "ICC_C";

export type InsuranceConfidence = "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_DATA";

export type InsuranceCommodity = "COKING_COAL" | "THERMAL_COAL" | "IRON_ORE" | "LIMESTONE";

export type InsuranceCurrency = "USD" | "INR" | "AUD" | "SGD";

export type InsuranceQuantityUnit = "MT" | "KT" | "T";

export type InsuranceVerificationStatus = "VERIFIED" | "AUDITED" | "UNDER_REVIEW";

export interface CoverageClauseInfo {
  code: CoverageClause;
  label: string;
  name: string;
  description: string;
  scope: string;
  historicalRateBaselinePct: number;
}

export interface InsuranceOverviewMetrics {
  totalHistoricalRecords: number;
  supportedCommoditiesCount: number;
  supportedRoutesCount: number;
  recentEstimatesCount: number;
  lastDatasetUpdate: string;
  operationalStatus: "ONLINE" | "SYNCHRONIZED" | "STANDBY";
}

export interface InsuranceEstimateRequest {
  commodity: InsuranceCommodity;
  cargoQuantity: number;
  quantityUnit: InsuranceQuantityUnit;
  unitCargoValue: number;
  currency: InsuranceCurrency;
  cargoDescription?: string;
  origin: OriginRegion | string;
  destination: PortCode | string;
  expectedShipmentDate: string;
  vesselName?: string;
  vesselType?: string;
  voyageReference?: string;
  coverageClause: CoverageClause;
  insuredValuePercentage: number; // e.g. 110 for 110% valuation
  deductible?: number;
  additionalNotes?: string;
}

export interface HistoricalInsuranceRecord {
  id: string;
  commodity: InsuranceCommodity;
  commodityName: string;
  origin: OriginRegion;
  originName: string;
  destination: PortCode;
  destinationName: string;
  cargoQuantity: number;
  quantityUnit: InsuranceQuantityUnit;
  coverageClause: CoverageClause;
  coverageClauseLabel: string;
  historicalRatePct: number; // e.g. 0.145 represents 0.145%
  currency: InsuranceCurrency;
  recordDate: string;
  verificationStatus: InsuranceVerificationStatus;
  vesselClass?: string;
  anonymizedSourceCategory: string;
  deductibleUsd?: number;
}

export interface InsuranceEstimateResult {
  estimateId: string;
  request: InsuranceEstimateRequest;
  totalCargoValue: number;
  insuredCargoValue: number;
  estimatedRatePct: number | null; // e.g. 0.142 represents 0.142%
  estimatedPremium: number | null;
  currency: InsuranceCurrency;
  confidence: InsuranceConfidence;
  confidenceRationale: string;
  isInsufficientData: boolean;
  comparableRecordsCount: number;
  medianRatePct: number | null;
  rateRangeMinPct: number | null;
  rateRangeMaxPct: number | null;
  mostRecentRecordDate: string | null;
  dataRecency: string | null;
  matchingExplanation: string;
  calculationFormula: {
    cargoValueFormula: string;
    insuredValueFormula: string;
    premiumFormula: string;
  };
  createdAt: string;
  comparableRecords: HistoricalInsuranceRecord[];
}

export interface RateTrendPoint {
  date: string;
  ratePct: number;
  commodity: InsuranceCommodity;
  commodityLabel: string;
  origin: OriginRegion;
  originLabel: string;
  destination: PortCode;
  destinationLabel: string;
  clause: CoverageClause;
  recordsSampled: number;
}

export interface CommodityComparison {
  commodity: InsuranceCommodity;
  label: string;
  avgRatePct: number;
  minRatePct: number;
  maxRatePct: number;
  recordCount: number;
}

export interface RouteComparison {
  routeKey: string;
  routeLabel: string;
  origin: OriginRegion;
  originName: string;
  destination: PortCode;
  destinationName: string;
  avgRatePct: number;
  minRatePct: number;
  maxRatePct: number;
  recordCount: number;
}

export interface CoverageComparison {
  clause: CoverageClause;
  label: string;
  shortLabel: string;
  description: string;
  avgRatePct: number;
  minRatePct: number;
  maxRatePct: number;
  recordCount: number;
}

export interface InsuranceAnalyticsBundle {
  trendSeries: RateTrendPoint[];
  commodityComparisons: CommodityComparison[];
  routeComparisons: RouteComparison[];
  coverageComparisons: CoverageComparison[];
  asOf: string;
}

export interface HistoricalRecordsFilter {
  commodity?: InsuranceCommodity | "ALL";
  origin?: OriginRegion | "ALL";
  destination?: PortCode | "ALL";
  coverageClause?: CoverageClause | "ALL";
  verificationStatus?: InsuranceVerificationStatus | "ALL";
  searchQuery?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "recordDate" | "historicalRatePct" | "cargoQuantity" | "id";
  sortOrder?: "asc" | "desc";
}

export interface PaginatedHistoricalRecords {
  records: HistoricalInsuranceRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

