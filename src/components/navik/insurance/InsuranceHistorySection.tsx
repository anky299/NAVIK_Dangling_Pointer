import { useState, useMemo } from "react";
import {
  Clock,
  Search,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
  Calendar,
  Layers,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import type { InsuranceEstimateResult } from "@/lib/api/insurance-types";
import { BentoCard } from "@/components/navik/Bento";
import { fmtInt, fmt2, fmtDateTime } from "@/lib/format";

interface InsuranceHistorySectionProps {
  estimates: InsuranceEstimateResult[];
  onReopenEstimate: (estimate: InsuranceEstimateResult) => void;
}

export function InsuranceHistorySection({
  estimates,
  onReopenEstimate,
}: InsuranceHistorySectionProps) {
  const [search, setSearch] = useState("");
  const [filterConfidence, setFilterConfidence] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const filtered = useMemo(() => {
    return estimates.filter((e) => {
      if (filterConfidence !== "ALL" && e.confidence !== filterConfidence) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.estimateId.toLowerCase().includes(q) ||
          e.request.commodity.toLowerCase().includes(q) ||
          String(e.request.origin).toLowerCase().includes(q) ||
          String(e.request.destination).toLowerCase().includes(q) ||
          (e.request.vesselName && e.request.vesselName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [estimates, search, filterConfidence]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#24485C] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#F3EEE5] flex items-center gap-2">
            <Clock className="size-5 text-[#F2B653]" />
            <span>Estimation Run History</span>
          </h2>
          <p className="text-xs text-[#78958F] mt-0.5">
            Audit trail of previously generated marine cargo insurance assessments. Reopening an
            estimate preserves its exact original calculations and calibration evidence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[#35BFC3] bg-[#35BFC3]/15 px-2.5 py-1 rounded border border-[#35BFC3]/30">
            {estimates.length} historical runs preserved
          </span>
        </div>
      </div>

      <BentoCard glowColor="amber" className="p-5 space-y-4">
        {/* Search & Filter Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#24485C] pb-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#78958F]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by estimate ID, commodity, port..."
              className="w-full h-8 pl-9 pr-3 rounded-lg bg-[#081827] border border-[#24485C] text-xs text-[#F3EEE5] placeholder-[#78958F] focus:outline-none focus:border-[#F2B653]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#78958F]">Confidence:</span>
            <select
              value={filterConfidence}
              onChange={(e) => {
                setFilterConfidence(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded bg-[#081827] border border-[#24485C] px-2 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#F2B653]"
            >
              <option value="ALL">All Levels</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INSUFFICIENT_DATA">Insufficient Data</option>
            </select>
          </div>
        </div>

        {/* History List */}
        <div className="space-y-3">
          {paginated.length > 0 ? (
            paginated.map((est) => (
              <div
                key={est.estimateId}
                className="rounded-xl border border-[#24485C] bg-[#081827] p-4 hover:border-[#35BFC3]/60 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Summary */}
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#F2B653]">
                      {est.estimateId}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                        est.confidence === "HIGH"
                          ? "border-[#35BFC3]/40 bg-[#35BFC3]/15 text-[#35BFC3]"
                          : est.confidence === "MEDIUM"
                          ? "border-[#F2B653]/40 bg-[#F2B653]/15 text-[#F2B653]"
                          : est.confidence === "LOW"
                          ? "border-[#78958F]/40 bg-[#78958F]/15 text-[#78958F]"
                          : "border-[#E87945]/40 bg-[#E87945]/15 text-[#E87945]"
                      }`}
                    >
                      {est.confidence} CONFIDENCE
                    </span>
                    <span className="text-[11px] font-mono text-[#78958F]">
                      Created: {fmtDateTime(est.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-[#F3EEE5]">
                    {est.request.commodity.replace(/_/g, " ")} · {fmtInt(est.request.cargoQuantity)}{" "}
                    {est.request.quantityUnit}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[#78958F]">
                    <span>
                      Corridor:{" "}
                      <strong className="text-[#D8E2E8]">
                        {est.request.origin} → {est.request.destination}
                      </strong>
                    </span>
                    <span>
                      Clause:{" "}
                      <strong className="text-[#35BFC3]">
                        {est.request.coverageClause.replace("_", " ")}
                      </strong>
                    </span>
                    <span>
                      Cargo Value:{" "}
                      <strong className="text-[#F3EEE5]">
                        {est.currency} {fmt2(est.totalCargoValue)}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Right: Premium, Rate & Reopen CTA */}
                <div className="flex items-center gap-5 border-t md:border-t-0 md:border-l border-[#24485C] pt-3 md:pt-0 md:pl-5 shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-mono text-[#78958F] uppercase">
                      Indicative Premium
                    </p>
                    {est.isInsufficientData ? (
                      <p className="font-mono text-sm font-bold text-[#E87945]">Insufficient Data</p>
                    ) : (
                      <p className="font-mono text-lg font-bold text-[#F2B653]">
                        {est.currency} {fmt2(est.estimatedPremium || 0)}
                      </p>
                    )}
                    {!est.isInsufficientData && (
                      <p className="text-[11px] font-mono text-[#35BFC3]">
                        Rate: {est.estimatedRatePct?.toFixed(3)}%
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onReopenEstimate(est)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#15364A] hover:bg-[#35BFC3] hover:text-[#081827] px-3.5 py-2 text-xs font-semibold text-[#F3EEE5] border border-[#24485C] transition"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-[#78958F] font-mono">
              No previous estimation runs match the query.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#24485C] pt-3 text-xs font-mono text-[#78958F]">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2.5 py-1 rounded bg-[#081827] border border-[#24485C] text-[#D8E2E8] hover:bg-[#15364A] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2.5 py-1 rounded bg-[#081827] border border-[#24485C] text-[#D8E2E8] hover:bg-[#15364A] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </BentoCard>
    </div>
  );
}

