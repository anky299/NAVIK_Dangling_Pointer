import {
  HelpCircle,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Scale,
  FileCheck,
  Building,
} from "lucide-react";
import { BentoCard } from "@/components/navik/Bento";

export function InsuranceMethodologySection() {
  const steps = [
    {
      num: "01",
      title: "Repository Ingestion",
      desc: "NAVIK archives and audits verified historical marine cargo quotation slips from Lloyd's syndicates, P&I clubs, and collective steel mill procurement slips.",
    },
    {
      num: "02",
      title: "Consignment Parameterization",
      desc: "The charterer submits shipment grade, metric tonnage, baseline cargo valuation, origin loading port, destination terminal, and Institute Cargo Clause selection.",
    },
    {
      num: "03",
      title: "Corridor & Peril Matching",
      desc: "The calibration engine filters the repository for matching commodity traits, geographic transit arcs, vessel classifications, and policy peril scopes.",
    },
    {
      num: "04",
      title: "Multi-Attribute Calibration",
      desc: "Comparable slips are evaluated based on similarity weights, voyage distance, historical seasonal risk factors, and port draft/transshipment requirements.",
    },
    {
      num: "05",
      title: "Reference Rate Estimation",
      desc: "A statistical median benchmark rate is computed, representing empirical market clearing levels for comparable bulk voyages.",
    },
    {
      num: "06",
      title: "Data Quality & Confidence Scoring",
      desc: "Confidence is assigned (HIGH, MEDIUM, LOW, or INSUFFICIENT_DATA) based on sample size, pricing dispersion, and data recency.",
    },
    {
      num: "07",
      title: "Decimal-Safe Premium Computation",
      desc: "The indicative premium is calculated using the agreed insured valuation basis (e.g. 110% CIF) and the calibrated historical rate percentage.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-[#24485C] pb-4">
        <h2 className="text-xl font-bold text-[#F3EEE5] flex items-center gap-2">
          <HelpCircle className="size-5 text-[#35BFC3]" />
          <span>Methodology & Underwriting Transparency</span>
        </h2>
        <p className="text-xs text-[#78958F] mt-0.5">
          How NAVIK transforms historical marine cargo insurance slips into indicative procurement benchmarks.
        </p>
      </div>

      {/* 7-Step Workflow Process */}
      <BentoCard glowColor="teal" className="p-5 space-y-4">
        <div className="border-b border-[#24485C] pb-3">
          <h3 className="text-sm font-semibold text-[#F3EEE5] flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#35BFC3]" />
            <span>Seven-Stage Historical Valuation Framework</span>
          </h3>
          <p className="text-xs text-[#78958F]">
            Transparent, auditable workflow executing each time an estimate is evaluated.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 pt-2">
          {steps.map((s) => (
            <div
              key={s.num}
              className="rounded-xl border border-[#24485C] bg-[#081827] p-3.5 space-y-2 flex flex-col justify-between"
            >
              <div>
                <span className="font-mono text-sm font-bold text-[#35BFC3]">{s.num}</span>
                <h4 className="text-xs font-bold text-[#F3EEE5] mt-1">{s.title}</h4>
                <p className="text-[11px] text-[#78958F] leading-snug mt-1.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </BentoCard>

      {/* Crucial Maritime Insurance Distinctions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <BentoCard glowColor="amber" className="p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#F2B653]">
            <Scale className="size-4 shrink-0" />
            <span>Historical Rate vs. Live Quotation</span>
          </div>
          <p className="text-xs text-[#D8E2E8] leading-relaxed">
            Historical benchmark rates reflect past clearing prices from executed underwriting slips.
            They are not live quotes from underwriters and do not bind insurers to future terms.
          </p>
        </BentoCard>

        <BentoCard glowColor="teal" className="p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#35BFC3]">
            <FileCheck className="size-4 shrink-0" />
            <span>Premium vs. Policy Deductible</span>
          </div>
          <p className="text-xs text-[#D8E2E8] leading-relaxed">
            Premium is the upfront cost of insurance cover (Cargo Value × Insured % × Rate %).
            Deductible is the retained first loss per incident borne by the cargo owner before claims payout.
          </p>
        </BentoCard>

        <BentoCard glowColor="coral" className="p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#E87945]">
            <Building className="size-4 shrink-0" />
            <span>Policy Terms & Exclusions</span>
          </div>
          <p className="text-xs text-[#D8E2E8] leading-relaxed">
            Coverage is strictly governed by the final underwriter wording, including Institute
            Classification Clauses, ISM warranties, war/strikes extensions, and trading limits.
          </p>
        </BentoCard>
      </div>
    </div>
  );
}

