import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  ShieldCheck,
  Calculator,
  LineChart as LineChartIcon,
  Database,
  Clock,
  HelpCircle,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import type {
  HistoricalInsuranceRecord,
  HistoricalRecordsFilter,
  InsuranceEstimateRequest,
  InsuranceEstimateResult,
} from "@/lib/api/insurance-types";
import {
  insuranceOverviewQuery,
  insuranceReferenceQuery,
  insuranceEstimatesQuery,
  insuranceRecordsQuery,
  insuranceAnalyticsQuery,
} from "@/lib/api/queries";
import { createInsuranceEstimate } from "@/lib/api/services";
import { InsuranceOverviewSection } from "./InsuranceOverviewSection";
import { InsuranceEstimatorSection } from "./InsuranceEstimatorSection";
import { InsuranceAnalyticsSection } from "./InsuranceAnalyticsSection";
import { InsuranceRecordsSection } from "./InsuranceRecordsSection";
import { InsuranceHistorySection } from "./InsuranceHistorySection";
import { InsuranceMethodologySection } from "./InsuranceMethodologySection";
import { InsuranceRecordDetailModal } from "./InsuranceRecordDetailModal";
import { HISTORICAL_RECORDS_DATA } from "@/lib/sim/insurance";

export function InsuranceWorkspace() {
  const qc = useQueryClient();

  // Queries
  const overviewQ = useQuery(insuranceOverviewQuery());
  const estimatesQ = useQuery(insuranceEstimatesQuery());
  const analyticsQ = useQuery(insuranceAnalyticsQuery());

  // Filter state for historical records table
  const [recordFilters, setRecordFilters] = useState<HistoricalRecordsFilter>({
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

  const recordsQ = useQuery(insuranceRecordsQuery(recordFilters));

  // Active Estimate Result (state for right-side results panel)
  const [activeEstimate, setActiveEstimate] = useState<InsuranceEstimateResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Detail Modal Record Selection
  const [selectedRecord, setSelectedRecord] = useState<HistoricalInsuranceRecord | null>(null);

  // Active section tab / jump navigation
  const [activeSection, setActiveSection] = useState<
    "overview" | "estimator" | "analytics" | "records" | "history" | "methodology"
  >("overview");

  // Handler for calculating estimate
  const handleCalculate = useCallback(
    async (request: InsuranceEstimateRequest): Promise<InsuranceEstimateResult> => {
      setIsCalculating(true);
      try {
        const result = await createInsuranceEstimate(request);
        setActiveEstimate(result);
        // Invalidate estimates history query
        await qc.invalidateQueries({ queryKey: ["insurance", "estimates"] });
        await qc.invalidateQueries({ queryKey: ["insurance", "overview"] });
        return result;
      } finally {
        setIsCalculating(false);
      }
    },
    [qc],
  );

  // Handler for reopening an estimate from history
  const handleReopenEstimate = useCallback((estimate: InsuranceEstimateResult) => {
    setActiveEstimate(estimate);
    // Smooth scroll to estimator
    const el = document.getElementById("estimator-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Handler for refreshing data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["insurance"] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Handler for exporting evidence CSV
  const handleExport = useCallback(() => {
    const records = recordsQ.data?.records || HISTORICAL_RECORDS_DATA;
    const headers = [
      "Record ID",
      "Commodity",
      "Origin",
      "Destination",
      "Quantity (MT)",
      "Coverage Clause",
      "Historical Rate (%)",
      "Currency",
      "Record Date",
      "Verification Status",
      "Source Category",
    ];

    const rows = records.map((r) => [
      r.id,
      r.commodity,
      r.origin,
      r.destination,
      r.cargoQuantity,
      r.coverageClause,
      r.historicalRatePct,
      r.currency,
      r.recordDate,
      r.verificationStatus,
      `"${r.anonymizedSourceCategory}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `navik_insurance_evidence_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [recordsQ.data]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="space-y-12 pb-20">
      {/* Quick Jump Navigation Pill Bar */}
      <div className="sticky top-20 z-20 hidden md:flex items-center gap-1.5 rounded-xl border border-[#24485C] bg-[#0D2233]/90 px-3 py-2 backdrop-blur-md shadow-lg">
        <span className="text-[11px] font-mono text-[#78958F] uppercase pr-2 border-r border-[#24485C]">
          Workspace Sections:
        </span>
        <button
          type="button"
          onClick={() => scrollToSection("overview-section")}
          className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#D8E2E8] hover:text-[#35BFC3] hover:bg-[#15364A] transition"
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("estimator-section")}
          className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#D8E2E8] hover:text-[#35BFC3] hover:bg-[#15364A] transition"
        >
          Estimator
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("analytics-section")}
          className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#D8E2E8] hover:text-[#35BFC3] hover:bg-[#15364A] transition"
        >
          Historical Analytics
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("records-section")}
          className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#D8E2E8] hover:text-[#35BFC3] hover:bg-[#15364A] transition"
        >
          Quotation Records
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("history-section")}
          className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#D8E2E8] hover:text-[#35BFC3] hover:bg-[#15364A] transition"
        >
          Run History
        </button>
        <button
          type="button"
          onClick={() => scrollToSection("methodology-section")}
          className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#D8E2E8] hover:text-[#35BFC3] hover:bg-[#15364A] transition"
        >
          Methodology
        </button>
      </div>

      {/* SECTION 1: Overview */}
      <div id="overview-section">
        <InsuranceOverviewSection
          metrics={overviewQ.data}
          isLoading={overviewQ.isLoading}
          onNewEstimate={() => scrollToSection("estimator-section")}
          onExport={handleExport}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* SECTION 2: Cargo Insurance Estimator & Structured Results */}
      <div id="estimator-section">
        <InsuranceEstimatorSection
          onCalculate={handleCalculate}
          activeResult={activeEstimate}
          isCalculating={isCalculating}
          onSaveEstimate={(est) => {
            // Estimate is already stored in history
            scrollToSection("history-section");
          }}
        />
      </div>

      {/* SECTION 3: Historical Rate Analytics */}
      <div id="analytics-section">
        <InsuranceAnalyticsSection
          analytics={analyticsQ.data}
          isLoading={analyticsQ.isLoading}
        />
      </div>

      {/* SECTION 4: Comparable Historical Records Table */}
      <div id="records-section">
        <InsuranceRecordsSection
          recordsData={
            recordsQ.data || {
              records: HISTORICAL_RECORDS_DATA.slice(0, 8),
              totalCount: HISTORICAL_RECORDS_DATA.length,
              page: 1,
              pageSize: 8,
              totalPages: Math.ceil(HISTORICAL_RECORDS_DATA.length / 8),
            }
          }
          filters={recordFilters}
          onFilterChange={(f) => setRecordFilters(f)}
          onSelectRecord={(rec) => setSelectedRecord(rec)}
        />
      </div>

      {/* SECTION 5: Estimation History */}
      <div id="history-section">
        <InsuranceHistorySection
          estimates={estimatesQ.data || []}
          onReopenEstimate={handleReopenEstimate}
        />
      </div>

      {/* SECTION 6: Methodology & Transparency */}
      <div id="methodology-section">
        <InsuranceMethodologySection />
      </div>

      {/* Record Detail Modal */}
      <InsuranceRecordDetailModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />
    </div>
  );
}

