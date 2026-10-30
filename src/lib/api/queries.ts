import { queryOptions } from "@tanstack/react-query";
import * as api from "./services";
import type { OriginRegion, Timeframe } from "./types";

export const dashboardQuery = () =>
  queryOptions({ queryKey: ["dashboard"], queryFn: api.getDashboard, staleTime: 60_000 });

export const freightQuery = (origin: OriginRegion, timeframe: Timeframe) =>
  queryOptions({
    queryKey: ["freight", origin, timeframe],
    queryFn: () => api.getFreightSeries(origin, timeframe),
    staleTime: 60_000,
  });

export const bunkerQuery = (timeframe: Timeframe) =>
  queryOptions({
    queryKey: ["bunker", timeframe],
    queryFn: () => api.getBunkerSeries(timeframe),
    staleTime: 60_000,
  });

export const congestionQuery = () =>
  queryOptions({ queryKey: ["congestion"], queryFn: api.getCongestion, staleTime: 60_000 });

export const portsQuery = () =>
  queryOptions({ queryKey: ["ports"], queryFn: api.getPorts, staleTime: Infinity });

export const vesselClassesQuery = () =>
  queryOptions({
    queryKey: ["vessel-classes"],
    queryFn: api.getVesselClasses,
    staleTime: Infinity,
  });

export const contractsQuery = () =>
  queryOptions({ queryKey: ["contracts"], queryFn: api.listContracts });

export const auditQuery = () => queryOptions({ queryKey: ["audit"], queryFn: api.listAuditEvents });

/* Insurance Intelligence Queries */
export const insuranceOverviewQuery = () =>
  queryOptions({ queryKey: ["insurance", "overview"], queryFn: api.getInsuranceOverview, staleTime: 60_000 });

export const insuranceReferenceQuery = () =>
  queryOptions({ queryKey: ["insurance", "reference"], queryFn: api.getInsuranceReferenceData, staleTime: Infinity });

export const insuranceEstimatesQuery = () =>
  queryOptions({ queryKey: ["insurance", "estimates"], queryFn: api.listInsuranceEstimates, staleTime: 30_000 });

export const insuranceRecordsQuery = (filters?: import("./insurance-types").HistoricalRecordsFilter) =>
  queryOptions({
    queryKey: ["insurance", "records", filters],
    queryFn: () => api.getInsuranceHistoricalRecords(filters),
    staleTime: 60_000,
  });

export const insuranceAnalyticsQuery = (filters?: {
  commodity?: import("./insurance-types").InsuranceCommodity | "ALL";
  origin?: OriginRegion | "ALL";
  destination?: PortCode | "ALL";
  clause?: import("./insurance-types").CoverageClause | "ALL";
}) =>
  queryOptions({
    queryKey: ["insurance", "analytics", filters],
    queryFn: () => api.getInsuranceAnalytics(filters),
    staleTime: 60_000,
  });
