import {
  FileText,
  Shield,
  CheckCircle2,
  Calendar,
  Anchor,
  MapPin,
  Scale,
  DollarSign,
  AlertCircle,
  X,
  ExternalLink,
} from "lucide-react";
import type { HistoricalInsuranceRecord } from "@/lib/api/insurance-types";
import { COVERAGE_CLAUSES } from "@/lib/sim/insurance";
import { fmtInt, fmtDate, fmt2 } from "@/lib/format";

interface InsuranceRecordDetailModalProps {
  record: HistoricalInsuranceRecord | null;
  onClose: () => void;
}

export function InsuranceRecordDetailModal({
  record,
  onClose,
}: InsuranceRecordDetailModalProps) {
  if (!record) return null;

  const clauseInfo = COVERAGE_CLAUSES[record.coverageClause];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#081827]/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-[#24485C] bg-[#0D2233] p-6 lg:p-7 shadow-2xl text-[#F3EEE5] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#24485C] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-bold text-[#F2B653] bg-[#F2B653]/15 border border-[#F2B653]/30 px-2 py-0.5 rounded">
                {record.id}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#35BFC3] bg-[#35BFC3]/15 border border-[#35BFC3]/30 px-2 py-0.5 rounded">
                <CheckCircle2 className="size-3" />
                {record.verificationStatus}
              </span>
            </div>
            <h2 id="record-detail-title" className="text-lg font-bold text-[#F3EEE5] pt-1">
              Historical Underwriting Quotation Particulars
            </h2>
            <p className="text-xs text-[#78958F] font-mono">
              Anonymized Verified Marine Cargo Insurance Evidence
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg border border-[#24485C] bg-[#15364A] p-1.5 text-[#D8E2E8] hover:bg-[#24485C] hover:text-[#F3EEE5] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content Grid */}
        <div className="mt-5 space-y-6 text-xs">
          {/* Key Metric Highlight */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 rounded-xl border border-[#24485C] bg-[#081827] p-4">
            <div>
              <p className="text-[11px] font-mono text-[#78958F] uppercase tracking-wider">
                Historical Rate
              </p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-[#35BFC3]">
                {record.historicalRatePct.toFixed(3)}%
              </p>
              <p className="text-[10px] text-[#D8E2E8]/60 font-mono">
                {(record.historicalRatePct * 100).toFixed(1)} bps of cargo value
              </p>
            </div>

            <div>
              <p className="text-[11px] font-mono text-[#78958F] uppercase tracking-wider">
                Consignment Volume
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-[#F3EEE5]">
                {fmtInt(record.cargoQuantity)}{" "}
                <span className="text-xs font-normal text-[#78958F]">{record.quantityUnit}</span>
              </p>
              <p className="text-[10px] text-[#D8E2E8]/60 font-mono">
                {record.vesselClass || "Bulk Carrier"} fixture
              </p>
            </div>

            <div>
              <p className="text-[11px] font-mono text-[#78958F] uppercase tracking-wider">
                Quotation Slip Date
              </p>
              <p className="mt-1 font-mono text-base font-bold text-[#F2B653]">
                {fmtDate(record.recordDate)}
              </p>
              <p className="text-[10px] text-[#D8E2E8]/60 font-mono">
                Verified repository archive
              </p>
            </div>
          </div>

          {/* Shipment & Voyage Details */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#78958F] font-mono mb-2.5">
              Shipment & Transit Corridor
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#24485C] bg-[#15364A]/40 p-3 space-y-1">
                <span className="text-[10px] text-[#78958F] uppercase font-mono">Commodity</span>
                <p className="text-sm font-semibold text-[#F3EEE5]">{record.commodityName}</p>
                <span className="inline-block text-[10px] font-mono text-[#D8E2E8]/70">
                  Code: {record.commodity}
                </span>
              </div>

              <div className="rounded-lg border border-[#24485C] bg-[#15364A]/40 p-3 space-y-1">
                <span className="text-[10px] text-[#78958F] uppercase font-mono">Corridor Route</span>
                <p className="text-sm font-semibold text-[#F3EEE5]">
                  {record.originName} → {record.destinationName}
                </p>
                <span className="inline-block text-[10px] font-mono text-[#D8E2E8]/70">
                  {record.origin} → {record.destination}
                </span>
              </div>
            </div>
          </div>

          {/* Insurance Terms */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#78958F] font-mono mb-2.5">
              Underwriting Terms & Conditions
            </h3>
            <div className="rounded-xl border border-[#24485C] bg-[#15364A]/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#24485C] pb-2.5">
                <div>
                  <span className="text-xs font-bold text-[#35BFC3]">
                    {record.coverageClauseLabel}
                  </span>
                  <p className="text-[11px] text-[#D8E2E8] mt-0.5">{clauseInfo.scope}</p>
                </div>
                <span className="font-mono text-xs text-[#D8E2E8] bg-[#081827] px-2.5 py-1 rounded border border-[#24485C]">
                  Currency: {record.currency}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[10px] font-mono text-[#78958F] uppercase">Deductible</span>
                  <p className="font-mono text-xs font-semibold text-[#F3EEE5]">
                    {record.deductibleUsd
                      ? `$${fmtInt(record.deductibleUsd)} per occurrence`
                      : "Standard policy deductible"}
                  </p>
                  <p className="text-[10px] text-[#78958F] mt-0.5">
                    Separately applied to claims; not included in premium calculation.
                  </p>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-[#78958F] uppercase">
                    Source Provenance
                  </span>
                  <p className="font-mono text-xs font-semibold text-[#F2B653]">
                    {record.anonymizedSourceCategory}
                  </p>
                  <p className="text-[10px] text-[#78958F] mt-0.5">
                    Anonymized commercial citation verified by NAVIK audit desk.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Data Protection Notice */}
          <div className="rounded-lg border border-[#24485C]/70 bg-[#081827] p-3 text-[11px] text-[#78958F] flex items-start gap-2.5">
            <Shield className="size-4 text-[#35BFC3] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-[#D8E2E8]">Commercial Confidentiality Guarantee:</strong> In
              accordance with maritime procurement confidentiality standards, charterer names,
              trader identities, and specific underwriter policy numbers are strictly anonymized.
              Only verified rates, dates, and technical risk parameters are retained for statistical
              calibration.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-[#24485C] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#15364A] hover:bg-[#24485C] px-4 py-2 text-xs font-semibold text-[#F3EEE5] border border-[#24485C] transition-colors"
          >
            Close Detail
          </button>
        </div>
      </div>
    </div>
  );
}

