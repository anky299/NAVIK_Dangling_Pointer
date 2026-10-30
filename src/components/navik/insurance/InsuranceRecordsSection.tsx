import { useState, useMemo } from "react";
import {
  Database,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  CheckCircle2,
  Lock,
  Calendar,
} from "lucide-react";
import type {
  HistoricalInsuranceRecord,
  HistoricalRecordsFilter,
  InsuranceCommodity,
  CoverageClause,
  InsuranceVerificationStatus,
} from "@/lib/api/insurance-types";
import { ORIGINS, PORTS } from "@/lib/api/reference";
import { SUPPORTED_COMMODITIES } from "@/lib/sim/insurance";
import { BentoCard } from "@/components/navik/Bento";
import { fmtInt, fmtDate } from "@/lib/format";

interface InsuranceRecordsSectionProps {
  recordsData: {
    records: HistoricalInsuranceRecord[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  filters: HistoricalRecordsFilter;
  onFilterChange: (filters: HistoricalRecordsFilter) => void;
  onSelectRecord: (record: HistoricalInsuranceRecord) => void;
}

export function InsuranceRecordsSection({
  recordsData,
  filters,
  onFilterChange,
  onSelectRecord,
}: InsuranceRecordsSectionProps) {
  const [searchInput, setSearchInput] = useState(filters.searchQuery || "");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({ ...filters, searchQuery: searchInput, page: 1 });
  };

  const handleResetFilters = () => {
    setSearchInput("");
    onFilterChange({
      commodity: "ALL",
      origin: "ALL",
      destination: "ALL",
      coverageClause: "ALL",
      verificationStatus: "ALL",
      searchQuery: "",
      page: 1,
      pageSize: 8,
      sortBy: "recordDate",
      sortOrder: "desc",
    });
  };

  const handleSort = (column: "recordDate" | "historicalRatePct" | "cargoQuantity" | "id") => {
    const isCurrent = filters.sortBy === column;
    const newOrder = isCurrent && filters.sortOrder === "asc" ? "desc" : "asc";
    onFilterChange({ ...filters, sortBy: column, sortOrder: newOrder, page: 1 });
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#24485C] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#F3EEE5] flex items-center gap-2">
            <Database className="size-5 text-[#35BFC3]" />
            <span>Comparable Historical Quotation Records</span>
          </h2>
          <p className="text-xs text-[#78958F] mt-0.5">
            Verified, anonymized underwriting slips used to statistically calibrate NAVIK's insurance models.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[#78958F]">
          <Lock className="size-3.5 text-[#35BFC3]" />
          <span>Commercial PII Anonymized</span>
        </div>
      </div>

      <BentoCard glowColor="teal" className="p-5 space-y-4">
        {/* Filters and Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#24485C] pb-4">
          {/* Search by Record ID or Keyword */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#78958F]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search slip ID, commodity, port..."
              className="w-full h-8 pl-9 pr-3 rounded-lg bg-[#081827] border border-[#24485C] text-xs text-[#F3EEE5] placeholder-[#78958F] focus:outline-none focus:border-[#35BFC3]"
            />
          </form>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Commodity */}
            <select
              value={filters.commodity || "ALL"}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  commodity: e.target.value as InsuranceCommodity | "ALL",
                  page: 1,
                })
              }
              className="h-8 rounded bg-[#081827] border border-[#24485C] px-2 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3]"
            >
              <option value="ALL">All Commodities</option>
              {SUPPORTED_COMMODITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label.split(" (")[0]}
                </option>
              ))}
            </select>

            {/* Origin */}
            <select
              value={filters.origin || "ALL"}
              onChange={(e) => onFilterChange({ ...filters, origin: e.target.value as any, page: 1 })}
              className="h-8 rounded bg-[#081827] border border-[#24485C] px-2 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3]"
            >
              <option value="ALL">All Origins</option>
              {ORIGINS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.shortName}
                </option>
              ))}
            </select>

            {/* Destination */}
            <select
              value={filters.destination || "ALL"}
              onChange={(e) => onFilterChange({ ...filters, destination: e.target.value as any, page: 1 })}
              className="h-8 rounded bg-[#081827] border border-[#24485C] px-2 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3]"
            >
              <option value="ALL">All Destinations</option>
              {PORTS.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Clause */}
            <select
              value={filters.coverageClause || "ALL"}
              onChange={(e) =>
                onFilterChange({
                  ...filters,
                  coverageClause: e.target.value as CoverageClause | "ALL",
                  page: 1,
                })
              }
              className="h-8 rounded bg-[#081827] border border-[#24485C] px-2 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3]"
            >
              <option value="ALL">All Clauses</option>
              <option value="ICC_A">ICC (A)</option>
              <option value="ICC_B">ICC (B)</option>
              <option value="ICC_C">ICC (C)</option>
            </select>

            {/* Reset */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 rounded bg-[#15364A] hover:bg-[#24485C] px-2.5 py-1.5 text-xs text-[#D8E2E8] border border-[#24485C] transition"
              title="Reset all filters"
            >
              <RotateCcw className="size-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[#24485C] text-[#78958F]">
                <th
                  onClick={() => handleSort("id")}
                  className="pb-2.5 cursor-pointer hover:text-[#F3EEE5] transition select-none"
                >
                  <span className="flex items-center gap-1">
                    Record ID
                    <ArrowUpDown className="size-3" />
                  </span>
                </th>
                <th className="pb-2.5">Commodity</th>
                <th className="pb-2.5">Origin</th>
                <th className="pb-2.5">Destination</th>
                <th
                  onClick={() => handleSort("cargoQuantity")}
                  className="pb-2.5 cursor-pointer hover:text-[#F3EEE5] transition select-none"
                >
                  <span className="flex items-center gap-1">
                    Quantity
                    <ArrowUpDown className="size-3" />
                  </span>
                </th>
                <th className="pb-2.5">Clause</th>
                <th
                  onClick={() => handleSort("historicalRatePct")}
                  className="pb-2.5 text-right cursor-pointer hover:text-[#F3EEE5] transition select-none"
                >
                  <span className="flex items-center justify-end gap-1">
                    Rate (%)
                    <ArrowUpDown className="size-3" />
                  </span>
                </th>
                <th
                  onClick={() => handleSort("recordDate")}
                  className="pb-2.5 text-right cursor-pointer hover:text-[#F3EEE5] transition select-none"
                >
                  <span className="flex items-center justify-end gap-1">
                    Slip Date
                    <ArrowUpDown className="size-3" />
                  </span>
                </th>
                <th className="pb-2.5 text-center">Status</th>
                <th className="pb-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24485C]/50">
              {recordsData.records.length > 0 ? (
                recordsData.records.map((rec) => (
                  <tr
                    key={rec.id}
                    onClick={() => onSelectRecord(rec)}
                    className="hover:bg-[#15364A]/40 cursor-pointer transition"
                  >
                    <td className="py-2.5 font-bold text-[#F2B653]">{rec.id}</td>
                    <td className="py-2.5 text-[#F3EEE5]">{rec.commodity.replace("_", " ")}</td>
                    <td className="py-2.5 text-[#D8E2E8]">{rec.originName.split(" (")[0]}</td>
                    <td className="py-2.5 text-[#35BFC3]">{rec.destinationName.replace(" Port", "")}</td>
                    <td className="py-2.5 text-[#D8E2E8]">
                      {fmtInt(rec.cargoQuantity)} {rec.quantityUnit}
                    </td>
                    <td className="py-2.5">
                      <span className="bg-[#081827] px-2 py-0.5 rounded border border-[#24485C] text-[11px] text-[#D8E2E8]">
                        {rec.coverageClause.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold text-[#35BFC3]">
                      {rec.historicalRatePct.toFixed(3)}%
                    </td>
                    <td className="py-2.5 text-right text-[#D8E2E8]/80">{fmtDate(rec.recordDate)}</td>
                    <td className="py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#35BFC3] bg-[#35BFC3]/15 px-1.5 py-0.5 rounded border border-[#35BFC3]/30">
                        <CheckCircle2 className="size-2.5" />
                        {rec.verificationStatus}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRecord(rec);
                        }}
                        className="inline-flex items-center gap-1 rounded bg-[#081827] hover:bg-[#24485C] px-2 py-1 text-[11px] text-[#D8E2E8] border border-[#24485C] transition"
                      >
                        <Eye className="size-3 text-[#35BFC3]" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-xs text-[#78958F] font-mono">
                    No historical records match the active criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#24485C] pt-3 text-xs font-mono text-[#78958F]">
          <div>
            Showing{" "}
            <span className="text-[#F3EEE5] font-bold">
              {recordsData.records.length > 0 ? (recordsData.page - 1) * recordsData.pageSize + 1 : 0}
            </span>{" "}
            to{" "}
            <span className="text-[#F3EEE5] font-bold">
              {Math.min(recordsData.page * recordsData.pageSize, recordsData.totalCount)}
            </span>{" "}
            of <span className="text-[#35BFC3] font-bold">{recordsData.totalCount}</span> verified
            quotation slips
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={recordsData.page <= 1}
              onClick={() => onFilterChange({ ...filters, page: recordsData.page - 1 })}
              className="inline-flex items-center gap-1 rounded bg-[#081827] px-2.5 py-1 text-xs text-[#D8E2E8] border border-[#24485C] hover:bg-[#15364A] disabled:opacity-40 transition"
            >
              <ChevronLeft className="size-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-2 text-[#D8E2E8]">
              Page {recordsData.page} of {recordsData.totalPages}
            </span>

            <button
              type="button"
              disabled={recordsData.page >= recordsData.totalPages}
              onClick={() => onFilterChange({ ...filters, page: recordsData.page + 1 })}
              className="inline-flex items-center gap-1 rounded bg-[#081827] px-2.5 py-1 text-xs text-[#D8E2E8] border border-[#24485C] hover:bg-[#15364A] disabled:opacity-40 transition"
            >
              <span>Next</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </BentoCard>
    </div>
  );
}

