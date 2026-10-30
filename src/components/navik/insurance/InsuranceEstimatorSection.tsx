import { useState, useMemo, useEffect } from "react";
import {
  Calculator,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Info,
  Calendar,
  Anchor,
  MapPin,
  Ship,
  Sparkles,
  AlertTriangle,
  FileText,
  DollarSign,
  TrendingDown,
  Layers,
  HelpCircle,
  BookmarkPlus,
} from "lucide-react";
import type {
  CoverageClause,
  InsuranceCommodity,
  InsuranceCurrency,
  InsuranceEstimateRequest,
  InsuranceEstimateResult,
  InsuranceQuantityUnit,
} from "@/lib/api/insurance-types";
import {
  COVERAGE_CLAUSES,
  SUPPORTED_COMMODITIES,
  SUPPORTED_CURRENCIES,
} from "@/lib/sim/insurance";
import { ORIGINS, PORTS } from "@/lib/api/reference";
import { BentoCard, BentoHeader } from "@/components/navik/Bento";
import { fmtInt, fmt2, fmtDate } from "@/lib/format";

interface InsuranceEstimatorSectionProps {
  onCalculate: (req: InsuranceEstimateRequest) => Promise<InsuranceEstimateResult>;
  onSaveEstimate?: (estimate: InsuranceEstimateResult) => void;
  activeResult?: InsuranceEstimateResult | null;
  isCalculating?: boolean;
}

export function InsuranceEstimatorSection({
  onCalculate,
  onSaveEstimate,
  activeResult,
  isCalculating,
}: InsuranceEstimatorSectionProps) {
  // Form State
  const [commodity, setCommodity] = useState<InsuranceCommodity>("COKING_COAL");
  const [cargoQuantity, setCargoQuantity] = useState<number>(160_000);
  const [quantityUnit, setQuantityUnit] = useState<InsuranceQuantityUnit>("MT");
  const [unitCargoValue, setUnitCargoValue] = useState<number>(245.0);
  const [currency, setCurrency] = useState<InsuranceCurrency>("USD");
  const [cargoDescription, setCargoDescription] = useState<string>("");

  const [origin, setOrigin] = useState<string>("AUS_QLD");
  const [destination, setDestination] = useState<string>("PRDP");
  const [expectedShipmentDate, setExpectedShipmentDate] = useState<string>(
    new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [vesselName, setVesselName] = useState<string>("");
  const [vesselType, setVesselType] = useState<string>("Capesize Bulker");
  const [voyageReference, setVoyageReference] = useState<string>("");

  const [coverageClause, setCoverageClause] = useState<CoverageClause>("ICC_A");
  const [insuredValuePercentage, setInsuredValuePercentage] = useState<number>(110);
  const [deductible, setDeductible] = useState<number>(25_000);
  const [additionalNotes, setAdditionalNotes] = useState<string>("");

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic Total Cargo Value computation
  const liveTotalCargoValue = useMemo(() => {
    const q = Number(cargoQuantity) || 0;
    const u = Number(unitCargoValue) || 0;
    return Math.round(q * u * 100) / 100;
  }, [cargoQuantity, unitCargoValue]);

  // Dynamic Insured Value preview
  const liveInsuredCargoValue = useMemo(() => {
    const pct = Number(insuredValuePercentage) || 110;
    return Math.round(liveTotalCargoValue * (pct / 100) * 100) / 100;
  }, [liveTotalCargoValue, insuredValuePercentage]);

  // When selected commodity changes, prefill sensible default benchmark unit value
  const handleCommodityChange = (comm: InsuranceCommodity) => {
    setCommodity(comm);
    const benchmark = SUPPORTED_COMMODITIES.find((c) => c.id === comm);
    if (benchmark) {
      setUnitCargoValue(benchmark.defaultUnitValUsd);
    }
    // Clear validation error
    if (errors.commodity) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.commodity;
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!commodity) newErrors.commodity = "Please select a commodity";
    if (!cargoQuantity || cargoQuantity <= 0)
      newErrors.cargoQuantity = "Cargo quantity must be a positive number";
    if (!unitCargoValue || unitCargoValue <= 0)
      newErrors.unitCargoValue = "Unit cargo value must be a positive number";
    if (!origin) newErrors.origin = "Please select an origin port/region";
    if (!destination) newErrors.destination = "Please select a destination port";
    if (!expectedShipmentDate) newErrors.expectedShipmentDate = "Shipment date is required";
    if (!insuredValuePercentage || insuredValuePercentage < 50 || insuredValuePercentage > 200) {
      newErrors.insuredValuePercentage = "Valuation percentage typically ranges between 90% and 130%";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const request: InsuranceEstimateRequest = {
      commodity,
      cargoQuantity: Number(cargoQuantity),
      quantityUnit,
      unitCargoValue: Number(unitCargoValue),
      currency,
      cargoDescription: cargoDescription || undefined,
      origin,
      destination,
      expectedShipmentDate,
      vesselName: vesselName || undefined,
      vesselType: vesselType || undefined,
      voyageReference: voyageReference || undefined,
      coverageClause,
      insuredValuePercentage: Number(insuredValuePercentage),
      deductible: deductible ? Number(deductible) : undefined,
      additionalNotes: additionalNotes || undefined,
    };

    await onCalculate(request);
  };

  const handleReset = () => {
    setCommodity("COKING_COAL");
    setCargoQuantity(160_000);
    setQuantityUnit("MT");
    setUnitCargoValue(245.0);
    setCurrency("USD");
    setCargoDescription("");
    setOrigin("AUS_QLD");
    setDestination("PRDP");
    setExpectedShipmentDate(
      new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    );
    setVesselName("");
    setVesselType("Capesize Bulker");
    setVoyageReference("");
    setCoverageClause("ICC_A");
    setInsuredValuePercentage(110);
    setDeductible(25_000);
    setAdditionalNotes("");
    setErrors({});
  };

  const selectedClauseInfo = COVERAGE_CLAUSES[coverageClause];

  return (
    <div id="estimator-section" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#24485C] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#F3EEE5] flex items-center gap-2">
            <Calculator className="size-5 text-[#35BFC3]" />
            <span>Cargo Insurance Estimator</span>
          </h2>
          <p className="text-xs text-[#78958F] mt-0.5">
            Enter cargo, voyage, and coverage parameters to evaluate indicative marine cargo premiums.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-[#D8E2E8]/70 bg-[#0D2233] px-2.5 py-1 rounded border border-[#24485C]">
            Model: Historical Calibration v1.2
          </span>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Input Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* A. Cargo Information */}
            <BentoCard glowColor="teal" className="p-5 space-y-4">
              <div className="border-b border-[#24485C] pb-3">
                <p className="text-[11px] font-mono font-bold text-[#35BFC3] uppercase tracking-wider">
                  Section A · Cargo Information
                </p>
                <p className="text-xs text-[#D8E2E8]">
                  Consignment particulars, quantity, and baseline commercial valuation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Commodity */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label htmlFor="commodity-select" className="text-xs font-semibold text-[#F3EEE5] flex items-center justify-between">
                    <span>Commodity Grade *</span>
                    <span className="text-[10px] font-mono text-[#78958F]">Verified reference</span>
                  </label>
                  <select
                    id="commodity-select"
                    value={commodity}
                    onChange={(e) => handleCommodityChange(e.target.value as InsuranceCommodity)}
                    className="w-full h-9 rounded-lg bg-[#081827] border border-[#24485C] px-3 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3] transition-colors"
                  >
                    {SUPPORTED_COMMODITIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {errors.commodity && (
                    <p className="text-[11px] text-[#E87945] font-mono">{errors.commodity}</p>
                  )}
                </div>

                {/* Cargo Quantity & Unit */}
                <div className="space-y-1.5">
                  <label htmlFor="cargo-quantity-input" className="text-xs font-semibold text-[#F3EEE5]">Cargo Quantity *</label>
                  <div className="flex gap-2">
                    <input
                      id="cargo-quantity-input"
                      type="number"
                      step="any"
                      min="1"
                      value={cargoQuantity || ""}
                      onChange={(e) => {
                        setCargoQuantity(Number(e.target.value));
                        if (errors.cargoQuantity) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.cargoQuantity;
                            return next;
                          });
                        }
                      }}
                      placeholder="e.g. 160000"
                      className="flex-1 h-9 rounded-lg bg-[#081827] border border-[#24485C] px-3 text-xs font-mono text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3] transition-colors"
                    />
                    <select
                      value={quantityUnit}
                      onChange={(e) => setQuantityUnit(e.target.value as InsuranceQuantityUnit)}
                      className="w-20 h-9 rounded-lg bg-[#081827] border border-[#24485C] px-2 text-xs font-mono text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3]"
                    >
                      <option value="MT">MT</option>
                      <option value="KT">KT</option>
                      <option value="T">T</option>
                    </select>
                  </div>
                  {errors.cargoQuantity && (
                    <p className="text-[11px] text-[#E87945] font-mono">{errors.cargoQuantity}</p>
                  )}
                </div>

                {/* Unit Cargo Value & Currency */}
                <div className="space-y-1.5">
                  <label htmlFor="unit-cargo-value-input" className="text-xs font-semibold text-[#F3EEE5]">Unit Cargo Value *</label>
                  <div className="flex gap-2">
                    <input
                      id="unit-cargo-value-input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={unitCargoValue || ""}
                      onChange={(e) => {
                        setUnitCargoValue(Number(e.target.value));
                        if (errors.unitCargoValue) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.unitCargoValue;
                            return next;
                          });
                        }
                      }}
                      placeholder="e.g. 245.00"
                      className="flex-1 h-9 rounded-lg bg-[#081827] border border-[#24485C] px-3 text-xs font-mono text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3] transition-colors"
                    />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as InsuranceCurrency)}
                      className="w-24 h-9 rounded-lg bg-[#081827] border border-[#24485C] px-2 text-xs font-mono text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3]"
                    >
                      {SUPPORTED_CURRENCIES.map((cur) => (
                        <option key={cur.code} value={cur.code}>
                          {cur.code}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.unitCargoValue && (
                    <p className="text-[11px] text-[#E87945] font-mono">{errors.unitCargoValue}</p>
                  )}
                </div>

                {/* Live Total Cargo Value Card */}
                <div className="sm:col-span-2 rounded-lg border border-[#24485C] bg-[#081827] p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-[#78958F] uppercase tracking-wider">
                      Calculated Total Cargo Value (Quantity × Unit Value)
                    </span>
                    <p className="text-base font-mono font-bold text-[#F3EEE5]">
                      {currency} {fmt2(liveTotalCargoValue)}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-[#35BFC3] bg-[#35BFC3]/15 px-2 py-0.5 rounded border border-[#35BFC3]/30">
                    Live Formula
                  </span>
                </div>

                {/* Cargo Description (Optional) */}
                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="cargo-description-input" className="text-xs font-semibold text-[#D8E2E8]">
                    Cargo Description / Grade Spec <span className="text-[#78958F] font-normal">(Optional)</span>
                  </label>
                  <input
                    id="cargo-description-input"
                    type="text"
                    value={cargoDescription}
                    onChange={(e) => setCargoDescription(e.target.value)}
                    placeholder="e.g. Peak Downs Hard Coking Coal, CSR 71, Ash 9.5%"
                    className="w-full h-8 rounded-lg bg-[#081827] border border-[#24485C] px-3 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3]"
                  />
                </div>
              </div>
            </BentoCard>

            {/* B. Voyage Information */}
            <BentoCard glowColor="amber" className="p-5 space-y-4">
              <div className="border-b border-[#24485C] pb-3">
                <p className="text-[11px] font-mono font-bold text-[#F2B653] uppercase tracking-wider">
                  Section B · Voyage & Transit Corridor
                </p>
                <p className="text-xs text-[#D8E2E8]">
                  Origin load port to Indian East Coast discharge terminals.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Origin Port */}
                <div className="space-y-1.5">
                  <label htmlFor="origin-port-select" className="text-xs font-semibold text-[#F3EEE5]">Origin Port / Region *</label>
                  <select
                    id="origin-port-select"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full h-9 rounded-lg bg-[#081827] border border-[#24485C] px-3 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#F2B653]"
                  >
                    {ORIGINS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} ({o.loadPort})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination Port */}
                <div className="space-y-1.5">
                  <label htmlFor="destination-port-select" className="text-xs font-semibold text-[#F3EEE5]">
                    Destination Port (East Coast India) *
                  </label>
                  <select
                    id="destination-port-select"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full h-9 rounded-lg bg-[#081827] border border-[#24485C] px-3 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#F2B653]"
                  >
                    {PORTS.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} Port ({p.state}) — Draft {p.maxDraftM}m
                      </option>
                    ))}
                  </select>
                </div>

                {/* Expected Shipment Date */}
                <div className="space-y-1.5">
                  <label htmlFor="expected-shipment-date-input" className="text-xs font-semibold text-[#F3EEE5]">
                    Expected Shipment Date *
                  </label>
                  <input
                    id="expected-shipment-date-input"
                    type="date"
                    value={expectedShipmentDate}
                    onChange={(e) => setExpectedShipmentDate(e.target.value)}
                    className="w-full h-9 rounded-lg bg-[#081827] border border-[#24485C] px-3 text-xs font-mono text-[#F3EEE5] focus:outline-none focus:border-[#F2B653]"
                  />
                </div>

                {/* Vessel Type / Class */}
                <div className="space-y-1.5">
                  <label htmlFor="vessel-type-input" className="text-xs font-semibold text-[#D8E2E8]">
                    Vessel Class / Spec <span className="text-[#78958F] font-normal">(Optional)</span>
                  </label>
                  <input
                    id="vessel-type-input"
                    type="text"
                    value={vesselType}
                    onChange={(e) => setVesselType(e.target.value)}
                    placeholder="e.g. Capesize, Panamax, Supramax"
                    className="w-full h-9 rounded-lg bg-[#081827] border border-[#24485C] px-3 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#F2B653]"
                  />
                </div>

                {/* Vessel Name & Voyage Ref */}
                <div className="space-y-1">
                  <label htmlFor="vessel-name-input" className="text-xs font-semibold text-[#D8E2E8]">
                    Vessel Name <span className="text-[#78958F] font-normal">(Optional)</span>
                  </label>
                  <input
                    id="vessel-name-input"
                    type="text"
                    value={vesselName}
                    onChange={(e) => setVesselName(e.target.value)}
                    placeholder="e.g. MV Pacific Voyager"
                    className="w-full h-8 rounded-lg bg-[#081827] border border-[#24485C] px-3 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#F2B653]"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="voyage-reference-input" className="text-xs font-semibold text-[#D8E2E8]">
                    Voyage Reference <span className="text-[#78958F] font-normal">(Optional)</span>
                  </label>
                  <input
                    id="voyage-reference-input"
                    type="text"
                    value={voyageReference}
                    onChange={(e) => setVoyageReference(e.target.value)}
                    placeholder="e.g. VOY-2026-ECI-08"
                    className="w-full h-8 rounded-lg bg-[#081827] border border-[#24485C] px-3 text-xs text-[#F3EEE5] focus:outline-none focus:border-[#F2B653]"
                  />
                </div>
              </div>
            </BentoCard>

            {/* C. Insurance Information */}
            <BentoCard glowColor="cyan" className="p-5 space-y-4">
              <div className="border-b border-[#24485C] pb-3">
                <p className="text-[11px] font-mono font-bold text-[#35BFC3] uppercase tracking-wider">
                  Section C · Underwriting Terms & Valuation
                </p>
                <p className="text-xs text-[#D8E2E8]">
                  Institute Cargo Clauses selection and valuation basis. Coverage clauses represent
                  distinct policy coverage terms, not quality ratings.
                </p>
              </div>

              {/* Coverage Clause Selector */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#F3EEE5]">
                  Policy Coverage Clause *
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(["ICC_A", "ICC_B", "ICC_C"] as CoverageClause[]).map((clause) => {
                    const info = COVERAGE_CLAUSES[clause];
                    const isSelected = coverageClause === clause;
                    return (
                      <button
                        type="button"
                        key={clause}
                        onClick={() => setCoverageClause(clause)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? "border-[#35BFC3] bg-[#35BFC3]/15 text-[#F3EEE5] shadow-[0_0_12px_rgba(53,191,195,0.2)]"
                            : "border-[#24485C] bg-[#081827] text-[#D8E2E8] hover:border-[#35BFC3]/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-[#F3EEE5]">
                            {clause.replace("_", " ")}
                          </span>
                          {isSelected && <CheckCircle2 className="size-3.5 text-[#35BFC3]" />}
                        </div>
                        <p className="text-[11px] font-semibold text-[#F2B653] mt-1">
                          {clause === "ICC_A"
                            ? "All Risks"
                            : clause === "ICC_B"
                            ? "Major Named Perils"
                            : "Basic Catastrophic"}
                        </p>
                        <p className="text-[10px] text-[#78958F] mt-1 leading-snug">
                          {clause === "ICC_A"
                            ? "Comprehensive all-risks coverage including weather & piracy."
                            : clause === "ICC_B"
                            ? "Named perils including water ingress & loading losses."
                            : "Major casualties: fire, sinking, collision & General Average."}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Insured Value % & Deductible */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="insured-value-percentage-input" className="text-xs font-semibold text-[#F3EEE5]">
                      Insured Value Basis (%) *
                    </label>
                    <span className="text-[10px] font-mono text-[#78958F]">Standard: 110%</span>
                  </div>
                  <div className="relative">
                    <input
                      id="insured-value-percentage-input"
                      type="number"
                      step="1"
                      min="50"
                      max="200"
                      value={insuredValuePercentage}
                      onChange={(e) => setInsuredValuePercentage(Number(e.target.value))}
                      className="w-full h-9 rounded-lg bg-[#081827] border border-[#24485C] px-3 pr-8 text-xs font-mono text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#78958F]">
                      %
                    </span>
                  </div>
                  <p className="text-[10px] text-[#78958F]">
                    Represents CIF cargo value plus expected margin (110% is standard Incoterms).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="deductible-input" className="text-xs font-semibold text-[#D8E2E8]">
                      Policy Deductible <span className="text-[#78958F] font-normal">(Optional)</span>
                    </label>
                    <span className="text-[10px] font-mono text-[#78958F]">Separate value</span>
                  </div>
                  <div className="relative">
                    <input
                      id="deductible-input"
                      type="number"
                      step="1000"
                      min="0"
                      value={deductible || ""}
                      onChange={(e) => setDeductible(Number(e.target.value))}
                      placeholder="e.g. 25000"
                      className="w-full h-9 rounded-lg bg-[#081827] border border-[#24485C] px-3 text-xs font-mono text-[#F3EEE5] focus:outline-none focus:border-[#35BFC3]"
                    />
                  </div>
                  <p className="text-[10px] text-[#78958F]">
                    Deductible applies per casualty occurrence; kept strictly separate from premium.
                  </p>
                </div>
              </div>

              {/* Insured Value Summary Preview */}
              <div className="rounded-lg border border-[#24485C] bg-[#081827] p-3 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-mono text-[#78958F] uppercase">
                    Resulting Insured Value ({insuredValuePercentage}% of Cargo Value)
                  </span>
                  <p className="text-sm font-mono font-bold text-[#35BFC3]">
                    {currency} {fmt2(liveInsuredCargoValue)}
                  </p>
                </div>
                <div className="text-right text-[11px] font-mono text-[#78958F]">
                  Valuation multiplier: ×{(insuredValuePercentage / 100).toFixed(2)}
                </div>
              </div>
            </BentoCard>

            {/* D. Form Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isCalculating}
                className="inline-flex items-center gap-2 rounded-lg bg-[#F2B653] px-5 py-2.5 text-xs font-bold text-[#081827] shadow-[0_2px_12px_rgba(242,182,83,0.35)] hover:bg-[#F5C26B] transition active:scale-[0.98] disabled:opacity-50"
              >
                <Calculator className={`size-4 ${isCalculating ? "animate-spin" : ""}`} />
                <span>
                  {isCalculating ? "Evaluating Historical Evidence..." : "Calculate Insurance Estimate"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#24485C] bg-[#15364A] px-4 py-2.5 text-xs font-semibold text-[#F3EEE5] hover:bg-[#1f435b] transition"
              >
                <RotateCcw className="size-3.5" />
                <span>Reset Form</span>
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: Structured Estimation Results Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {activeResult ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Primary Results Card */}
              <BentoCard
                glowColor={activeResult.isInsufficientData ? "coral" : "teal"}
                className="p-5 space-y-5"
              >
                <div className="flex items-center justify-between border-b border-[#24485C] pb-3">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#78958F]">
                      Estimate Result · Ref {activeResult.estimateId}
                    </span>
                    <h3 className="text-base font-bold text-[#F3EEE5]">
                      {activeResult.isInsufficientData
                        ? "Data Insufficient for Criteria"
                        : "Indicative Insurance Assessment"}
                    </h3>
                  </div>

                  {/* Confidence Badge */}
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-xs font-bold ${
                      activeResult.confidence === "HIGH"
                        ? "border-[#35BFC3]/40 bg-[#35BFC3]/15 text-[#35BFC3]"
                        : activeResult.confidence === "MEDIUM"
                        ? "border-[#F2B653]/40 bg-[#F2B653]/15 text-[#F2B653]"
                        : activeResult.confidence === "LOW"
                        ? "border-[#78958F]/40 bg-[#78958F]/15 text-[#78958F]"
                        : "border-[#E87945]/40 bg-[#E87945]/15 text-[#E87945]"
                    }`}
                  >
                    {activeResult.confidence === "HIGH" ? (
                      <ShieldCheck className="size-3.5" />
                    ) : (
                      <ShieldAlert className="size-3.5" />
                    )}
                    <span>{activeResult.confidence} CONFIDENCE</span>
                  </div>
                </div>

                {activeResult.isInsufficientData ? (
                  /* INSUFFICIENT DATA STATE: No fabricated rates or premiums! */
                  <div className="rounded-xl border border-[#E87945]/40 bg-[#E87945]/10 p-4 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="size-5 text-[#E87945] shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold text-[#E87945] uppercase tracking-wider">
                          Historical Data Gap Notice
                        </h4>
                        <p className="text-xs text-[#D8E2E8] mt-1 leading-relaxed">
                          {activeResult.confidenceRationale}
                        </p>
                      </div>
                    </div>
                    <div className="border-t border-[#E87945]/20 pt-2 text-[11px] text-[#78958F]">
                      <p>
                        <strong>Recommended Action:</strong> In accordance with strict audit policy,
                        NAVIK will not display fabricated rates or unverified approximations. Try
                        selecting a primary East Coast corridor (e.g. Queensland Coking Coal to
                        Paradip or Western Australia Iron Ore to Dhamra).
                      </p>
                    </div>
                  </div>
                ) : (
                  /* VALID ESTIMATE STATE */
                  <div className="space-y-4">
                    {/* Rate & Premium Highlight Box */}
                    <div className="rounded-xl border border-[#24485C] bg-[#081827] p-4 space-y-3">
                      <div>
                        <p className="text-[11px] font-mono text-[#78958F] uppercase tracking-wider">
                          Estimated Historical Insurance Rate
                        </p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="font-mono text-3xl font-extrabold text-[#35BFC3]">
                            {activeResult.estimatedRatePct?.toFixed(3)}%
                          </span>
                          <span className="text-xs font-mono text-[#78958F]">
                            ({((activeResult.estimatedRatePct || 0) * 100).toFixed(1)} bps)
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-[#24485C] pt-2.5">
                        <p className="text-[11px] font-mono text-[#78958F] uppercase tracking-wider">
                          Indicative Insurance Premium
                        </p>
                        <p className="font-mono text-2xl font-bold text-[#F2B653] mt-0.5">
                          {activeResult.currency} {fmt2(activeResult.estimatedPremium || 0)}
                        </p>
                      </div>
                    </div>

                    {/* Valuation Breakdown */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg border border-[#24485C] bg-[#15364A]/40 p-3">
                        <span className="text-[10px] font-mono text-[#78958F] uppercase">
                          Total Cargo Value
                        </span>
                        <p className="font-mono font-bold text-[#F3EEE5] mt-0.5">
                          {activeResult.currency} {fmt2(activeResult.totalCargoValue)}
                        </p>
                      </div>

                      <div className="rounded-lg border border-[#24485C] bg-[#15364A]/40 p-3">
                        <span className="text-[10px] font-mono text-[#78958F] uppercase">
                          Insured Value Basis
                        </span>
                        <p className="font-mono font-bold text-[#35BFC3] mt-0.5">
                          {activeResult.currency} {fmt2(activeResult.insuredCargoValue)}
                        </p>
                      </div>
                    </div>

                    {/* Calculation Formula Transparency */}
                    <div className="rounded-lg border border-[#24485C] bg-[#081827] p-3 text-[11px] space-y-1.5 font-mono">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#78958F]">
                        Calculation Formula Transparency
                      </p>
                      <p className="text-[#D8E2E8]">
                        <span className="text-[#78958F]">Cargo Value:</span>{" "}
                        {activeResult.calculationFormula.cargoValueFormula}
                      </p>
                      <p className="text-[#D8E2E8]">
                        <span className="text-[#78958F]">Insured Value:</span>{" "}
                        {activeResult.calculationFormula.insuredValueFormula}
                      </p>
                      <p className="text-[#35BFC3]">
                        <span className="text-[#78958F]">Indicative Premium:</span>{" "}
                        {activeResult.calculationFormula.premiumFormula}
                      </p>
                    </div>

                    {/* Historical Evidence Details */}
                    <div className="rounded-lg border border-[#24485C] bg-[#15364A]/20 p-3 text-xs space-y-2">
                      <p className="text-[10px] font-bold uppercase font-mono tracking-wider text-[#F2B653]">
                        Verified Calibration Evidence
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div>
                          <span className="text-[#78958F]">Comparable Slips:</span>{" "}
                          <span className="text-[#F3EEE5] font-bold">
                            {activeResult.comparableRecordsCount} verified
                          </span>
                        </div>
                        <div>
                          <span className="text-[#78958F]">Median Rate:</span>{" "}
                          <span className="text-[#35BFC3] font-bold">
                            {activeResult.medianRatePct?.toFixed(3)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[#78958F]">Rate Range:</span>{" "}
                          <span className="text-[#F3EEE5]">
                            {activeResult.rateRangeMinPct?.toFixed(3)}% –{" "}
                            {activeResult.rateRangeMaxPct?.toFixed(3)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-[#78958F]">Most Recent Slip:</span>{" "}
                          <span className="text-[#F2B653]">
                            {activeResult.mostRecentRecordDate
                              ? fmtDate(activeResult.mostRecentRecordDate)
                              : "—"}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-[#78958F] pt-1 leading-snug">
                        {activeResult.matchingExplanation}
                      </p>
                    </div>
                  </div>
                )}

                {/* Save Estimate Button */}
                {!activeResult.isInsufficientData && onSaveEstimate && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => onSaveEstimate(activeResult)}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#24485C] bg-[#15364A] hover:bg-[#24485C] py-2 text-xs font-semibold text-[#F3EEE5] transition"
                    >
                      <BookmarkPlus className="size-3.5 text-[#F2B653]" />
                      <span>Save Estimate to History</span>
                    </button>
                  </div>
                )}
              </BentoCard>

              {/* Mandatory Statutory Disclaimer Card */}
              <div className="rounded-xl border border-[#24485C]/80 bg-[#081827] p-4 text-[11px] text-[#78958F] space-y-1.5">
                <div className="flex items-center gap-1.5 text-[#D8E2E8] font-bold font-mono">
                  <Info className="size-3.5 text-[#35BFC3]" />
                  <span>Important Operational Disclaimer</span>
                </div>
                <p className="leading-relaxed">
                  This is an indicative estimate derived from comparable historical insurance records.
                  It is not a live insurer quotation, a binding offer, confirmation of coverage or a
                  guarantee of policy terms. Final premiums and coverage must be confirmed by an
                  authorized insurer or broker.
                </p>
              </div>
            </div>
          ) : (
            /* Empty State */
            <BentoCard glowColor="teal" className="p-8 text-center space-y-4">
              <div className="size-12 rounded-2xl bg-[#15364A] border border-[#24485C] flex items-center justify-center mx-auto text-[#35BFC3]">
                <Shield className="size-6" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h4 className="text-sm font-bold text-[#F3EEE5]">Awaiting Cargo Particulars</h4>
                <p className="text-xs text-[#78958F] leading-relaxed">
                  Fill in the cargo quantity, valuation, transit corridor, and policy clause on the left,
                  then click <strong>Calculate Insurance Estimate</strong> to benchmark historical rates.
                </p>
              </div>
            </BentoCard>
          )}
        </div>
      </div>
    </div>
  );
}

