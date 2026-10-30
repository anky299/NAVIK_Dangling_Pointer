import { Shield, ShieldCheck, Database, Layers, Route as RouteIcon, FileSpreadsheet, Download, Plus, Clock, RefreshCw } from "lucide-react";
import type { InsuranceOverviewMetrics } from "@/lib/api/insurance-types";
import { BentoCard, BentoGrid, BentoKpi } from "@/components/navik/Bento";
import { fmtInt, fmtDateTime } from "@/lib/format";

interface InsuranceOverviewSectionProps {
  metrics?: InsuranceOverviewMetrics;
  isLoading?: boolean;
  onNewEstimate: () => void;
  onExport: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function InsuranceOverviewSection({
  metrics,
  isLoading,
  onNewEstimate,
  onExport,
  onRefresh,
  isRefreshing,
}: InsuranceOverviewSectionProps) {
  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between border-b border-[#24485C] pb-6">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex h-2 w-2 rounded-full bg-[#35BFC3] animate-pulse shadow-[0_0_8px_rgba(53,191,195,0.8)]" />
            <span className="text-[0.68rem] font-mono uppercase tracking-[0.16em] text-[#D8E2E8]/70 font-semibold">
              NAVIK <span className="text-[#24485C]">•</span> INSURANCE INTELLIGENCE <span className="text-[#24485C]">•</span>{" "}
              <span className="text-[#35BFC3]">
                {metrics?.operationalStatus === "SYNCHRONIZED" ? "SYNCHRONIZED FEED" : "ONLINE"}
              </span>
            </span>

            {metrics?.lastDatasetUpdate && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-[#24485C] bg-[#0D2233] px-2 py-0.5 text-[0.65rem] font-mono text-[#78958F]">
                <Clock className="size-3 text-[#35BFC3]" />
                <span>Updated: {fmtDateTime(metrics.lastDatasetUpdate)}</span>
              </span>
            )}
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-[#F3EEE5] sm:text-4xl md:text-5xl">
            Insurance <span className="text-[#F2B653]">Intelligence</span>
          </h1>

          <p className="text-xs sm:text-sm leading-relaxed text-[#D8E2E8] font-normal">
            Historical marine cargo insurance intelligence for informed voyage procurement decisions.
            Calibrated against verified underwriting quotation slips across Indian East Coast discharge terminals.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#24485C] bg-[#15364A] px-3.5 py-2 text-xs font-semibold text-[#F3EEE5] shadow-sm hover:border-[#35BFC3] hover:bg-[#1f435b] transition disabled:opacity-50"
            title="Synchronize insurance repository"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-[#35BFC3]" : ""}`} />
            <span>Sync Telemetry</span>
          </button>

          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#24485C] bg-[#15364A] px-3.5 py-2 text-xs font-semibold text-[#F3EEE5] shadow-sm hover:border-[#F2B653] hover:text-[#F2B653] transition"
            title="Export historical insurance dataset"
          >
            <Download className="size-3.5 text-[#F2B653]" />
            <span>Export Evidence</span>
          </button>

          <button
            type="button"
            onClick={onNewEstimate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#F2B653] px-4 py-2 text-xs font-bold text-[#081827] shadow-[0_2px_12px_rgba(242,182,83,0.35)] hover:bg-[#F5C26B] transition active:scale-[0.98]"
          >
            <Plus className="size-3.5 stroke-[2.5]" />
            <span>New Estimate</span>
          </button>
        </div>
      </div>

      {/* 2. Four Compact KPI Cards (100% Backend-Driven) */}
      <BentoGrid cols={12}>
        {/* Card 1: Verified Historical Records */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <BentoKpi
            label="Verified Historical Records"
            value={metrics ? fmtInt(metrics.totalHistoricalRecords) : isLoading ? "—" : "Unavailable"}
            unit="slips"
            subtext="Anonymized underwriter records"
            icon={Database}
            accentColor="teal"
            glowColor="teal"
            className="h-full relative overflow-hidden"
          />
        </div>

        {/* Card 2: Supported Commodities */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <BentoKpi
            label="Supported Commodities"
            value={metrics ? fmtInt(metrics.supportedCommoditiesCount) : isLoading ? "—" : "Unavailable"}
            unit="intake grades"
            subtext="Coking coal, thermal, ore & flux"
            icon={Layers}
            accentColor="amber"
            glowColor="amber"
            className="h-full relative overflow-hidden"
          />
        </div>

        {/* Card 3: Supported Routes */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <BentoKpi
            label="Supported Corridors"
            value={metrics ? fmtInt(metrics.supportedRoutesCount) : isLoading ? "—" : "Unavailable"}
            unit="corridors"
            subtext="Australia, Indo & African origins"
            icon={RouteIcon}
            accentColor="teal"
            glowColor="teal"
            className="h-full relative overflow-hidden"
          />
        </div>

        {/* Card 4: Recent Generated Estimates */}
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <BentoKpi
            label="Recent Estimates"
            value={metrics ? fmtInt(metrics.recentEstimatesCount) : isLoading ? "—" : "Unavailable"}
            unit="fixtures evaluated"
            subtext="Active session & historical runs"
            icon={ShieldCheck}
            accentColor="coral"
            glowColor="coral"
            className="h-full relative overflow-hidden"
          />
        </div>
      </BentoGrid>
    </div>
  );
}

