/**
 * NAVIK Contracts Workspace.
 *
 * Freight commitment register, commercial term summaries, laycan conflict detection,
 * deadline monitoring, outstanding nautical/commercial checks, and contract drawer.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Anchor,
  ArrowRight,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck,
  FilePlus2,
  FileSignature,
  FileText,
  Filter,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  Ship,
  Sliders,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CARGO_LABELS,
  CONTRACT_LABELS,
  ORIGINS,
  PORTS,
  VESSEL_CLASSES,
  originById,
  portByCode,
  vesselById,
} from "@/lib/api/reference";
import type {
  CargoType,
  ContractDeadline,
  ContractRecord,
  ContractStatus,
  ContractType,
  NewContract,
  OutstandingCheck,
  PortCode,
  VerificationStatus,
  VesselClassId,
} from "@/lib/api/types";
import {
  detectCommercialRisks,
  detectLaycanConflicts,
  filterContracts,
  formatLaycanRange,
  summarizeCommercialPortfolio,
  validateContractInput,
  type CommercialRiskItem,
  type LaycanConflict,
} from "@/lib/sim/contracts";
import {
  createContract,
  listContracts,
  resetContractStore,
  updateContract,
  verifyContractCheck,
} from "@/lib/api/services";
import { fmtDate, fmtInt, fmtRate, fmtTonnes, fmtUsd } from "@/lib/format";
import { DemoTag, Eyebrow, Metric, PageHeader, PanelHeader } from "./primitives";

/* ═══════════════════════════════════════════════
   Contracts Workspace Component
   ═══════════════════════════════════════════════ */

export function ContractsWorkspace() {
  const [contractsList, setContractsList] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContractStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<ContractType | "ALL">("ALL");
  const [verifFilter, setVerifFilter] = useState<VerificationStatus | "ALL">("ALL");
  const [portFilter, setPortFilter] = useState<PortCode | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<"laycanStart" | "tonnage" | "rateUsdPerT" | "reference">(
    "laycanStart",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Drawer / Selection
  const [selectedContract, setSelectedContract] = useState<ContractRecord | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load contracts from service store
  const refreshContracts = async () => {
    setLoading(true);
    try {
      const data = await listContracts();
      setContractsList(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshContracts();
  }, []);

  // Filtered contracts
  const filtered = useMemo(() => {
    return filterContracts(contractsList, {
      search,
      status: statusFilter,
      type: typeFilter,
      verification: verifFilter,
      destination: portFilter,
      sortKey,
      sortDir,
    });
  }, [contractsList, search, statusFilter, typeFilter, verifFilter, portFilter, sortKey, sortDir]);

  // Derived summaries & risks
  const summary = useMemo(() => summarizeCommercialPortfolio(contractsList), [contractsList]);
  const laycanConflicts = useMemo(() => detectLaycanConflicts(contractsList), [contractsList]);
  const risks = useMemo(() => detectCommercialRisks(contractsList), [contractsList]);

  // Handle status update
  const handleStatusChange = async (contractId: string, newStatus: ContractStatus) => {
    try {
      const updated = await updateContract(contractId, { status: newStatus });
      setContractsList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelectedContract(updated);
      setActionSuccess(`Contract ${updated.reference} status updated to ${newStatus}.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle verification check
  const handleVerifyCheck = async (contractId: string, checkId: string) => {
    try {
      const updated = await verifyContractCheck(contractId, checkId);
      setContractsList((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setSelectedContract(updated);
      setActionSuccess(`Check marked as verified.`);
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Reset demo store
  const handleResetStore = () => {
    resetContractStore();
    refreshContracts();
    setSelectedContract(null);
    setActionSuccess("Contract register reset to default fixtures.");
    setTimeout(() => setActionSuccess(null), 3000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ── */}
      <PageHeader
        eyebrow="Desk 02 / Commercial Execution"
        title="Contract"
        accent="register."
        description="Freight commitment register, commercial term summaries, laycan conflict detection, and contractual risk monitoring."
        tag={<DemoTag kind="local" title="Local browser store & illustrative fixtures" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-copper px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-copper-soft transition-colors"
            >
              <Plus className="size-3.5" />
              <span>Draft Contract</span>
            </button>
            <Link
              to="/audit"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Clock className="size-3.5 text-brass" />
              <span>Audit Trail</span>
            </Link>
            <button
              type="button"
              onClick={handleResetStore}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              title="Reset store to default fixtures"
            >
              <RotateCcw className="size-3" />
            </button>
          </div>
        }
      />

      {/* ── Action Notification Toast ── */}
      {actionSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-4 py-2.5 text-xs text-success"
        >
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{actionSuccess}</span>
        </motion.div>
      )}

      {/* ── Commercial Summary KPI Strip ── */}
      <section
        aria-label="Commercial overview metrics"
        className="grid grid-cols-2 gap-3 sm:grid-cols-5"
      >
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
          <Metric
            label="Total Committed"
            value={fmtTonnes(summary.totalTonnage)}
            unit=""
            size="sm"
          />
          <p className="mt-1 text-[0.68rem] text-muted-foreground">
            {summary.activeFixturesCount} active fixtures
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
          <Metric
            label="Total Freight Spend"
            value={fmtUsd(summary.totalSpendUsd)}
            unit=""
            size="sm"
          />
          <p className="mt-1 text-[0.68rem] text-muted-foreground">
            Across {contractsList.length} total records
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
          <Metric
            label="Weighted Freight"
            value={`${fmtRate(summary.weightedRateUsdPerT)}`}
            unit="/t"
            size="sm"
          />
          <p className="mt-1 text-[0.68rem] text-muted-foreground">Voyage & TC volume-weighted</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
          <Metric
            label="Laycan Concurrency"
            value={`${laycanConflicts.length}`}
            unit="conflicts"
            size="sm"
          />
          <p className="mt-1 text-[0.68rem] text-muted-foreground">
            {laycanConflicts.length > 0 ? "Berth queue risk flagged" : "Normal spacing"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
          <Metric label="Commercial Risks" value={`${risks.length}`} unit="items" size="sm" />
          <p className="mt-1 text-[0.68rem] text-muted-foreground">
            {summary.unverifiedCount} unverified records
          </p>
        </div>
      </section>

      {/* ── Commercial Risk & Deadline Alert Strip ── */}
      {risks.length > 0 && (
        <section
          aria-label="Commercial risk alerts"
          className="flex flex-col gap-2.5 rounded-lg border border-border bg-ink/30 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-copper" />
              <h3 className="text-eyebrow text-xs text-foreground font-semibold">
                Commercial Risks, Laycan Overlaps & Upcoming Deadlines
              </h3>
            </div>
            <span className="font-mono text-[0.68rem] text-muted-foreground">
              {risks.length} Actionable Items
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {risks.slice(0, 3).map((risk) => (
              <div
                key={risk.id}
                onClick={() => {
                  const c = contractsList.find(
                    (item) =>
                      item.id === risk.contractId || item.reference === risk.contractReference,
                  );
                  if (c) setSelectedContract(c);
                }}
                className={cn(
                  "flex cursor-pointer flex-col justify-between rounded border p-3 text-xs transition-colors hover:border-copper/60 hover:bg-copper/5",
                  risk.severity === "HIGH"
                    ? "border-danger/40 bg-danger/5 text-foreground"
                    : risk.severity === "ELEVATED"
                      ? "border-copper/40 bg-copper/5 text-foreground"
                      : "border-border/70 bg-card/60 text-muted-foreground",
                )}
              >
                <div>
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-mono text-[0.65rem] font-semibold text-foreground">
                      {risk.contractReference}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 font-mono text-[0.6rem] uppercase",
                        risk.severity === "HIGH"
                          ? "bg-danger/15 text-danger font-semibold"
                          : risk.severity === "ELEVATED"
                            ? "bg-copper/15 text-copper"
                            : "bg-brass/15 text-brass",
                      )}
                    >
                      {risk.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  <h4 className="font-medium text-foreground text-[0.78rem]">{risk.title}</h4>
                  <p className="mt-1 line-clamp-2 text-[0.7rem] text-muted-foreground leading-relaxed">
                    {risk.detail}
                  </p>
                </div>

                <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-border/40 text-[0.68rem]">
                  <span className="text-muted-foreground">{risk.portName}</span>
                  <span className="font-mono font-medium text-copper-soft flex items-center gap-0.5">
                    {risk.actionLabel}
                    <ArrowRight className="size-2.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Search, Filters, and Table ── */}
      <section
        aria-label="Contracts register"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5 shadow-sm"
      >
        {/* Controls Bar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, vessel, counterparty, port, commodity..."
              className="w-full rounded-md border border-border/80 bg-background/80 py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-copper focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="FIXED">Fixed</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="DRAFT">Draft</option>
              <option value="COMPLETED">Completed</option>
            </select>

            {/* Type Select */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Contract Types</option>
              <option value="VOYAGE">Voyage Charter</option>
              <option value="TIME_CHARTER">Time Charter</option>
              <option value="COA">COA</option>
            </select>

            {/* Verification Select */}
            <select
              value={verifFilter}
              onChange={(e) => setVerifFilter(e.target.value as any)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Verification</option>
              <option value="VERIFIED">Verified</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="UNVERIFIED">Unverified</option>
            </select>

            {/* Destination Port Select */}
            <select
              value={portFilter}
              onChange={(e) => setPortFilter(e.target.value as any)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Discharge Ports</option>
              {PORTS.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Contract Register Table */}
        <div className="overflow-x-auto rounded border border-border/80">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-ink/40 font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Reference & Type</th>
                <th className="px-3 py-2.5 font-medium">Counterparty & Vessel</th>
                <th className="px-3 py-2.5 font-medium">Route</th>
                <th className="px-3 py-2.5 font-medium text-right">Cargo & Tonnage</th>
                <th className="px-3 py-2.5 font-medium text-right">Freight Rate</th>
                <th className="px-3 py-2.5 font-medium">Laycan Window</th>
                <th className="px-3 py-2.5 font-medium">Commercial Status</th>
                <th className="px-3 py-2.5 font-medium">Verification</th>
                <th className="px-3 py-2.5 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    <p className="text-sm">
                      No contract records match your active search and filter criteria.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("ALL");
                        setTypeFilter("ALL");
                        setVerifFilter("ALL");
                        setPortFilter("ALL");
                      }}
                      className="mt-2 text-xs font-mono text-copper hover:underline"
                    >
                      Reset all filters
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const port = portByCode(c.destination);
                  const origin = originById(c.origin);
                  const isSelected = selectedContract?.id === c.id;
                  const hasConflict = laycanConflicts.some(
                    (cf) => cf.contractA.id === c.id || cf.contractB.id === c.id,
                  );

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedContract(c)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-ink/30",
                        isSelected ? "bg-copper/10" : "",
                        hasConflict ? "bg-brass/5" : "",
                      )}
                    >
                      {/* Reference & Type */}
                      <td className="px-3 py-3 font-mono">
                        <div className="font-semibold text-foreground flex items-center gap-1.5">
                          <span>{c.reference}</span>
                          {c.isIllustrative && (
                            <span
                              className="rounded bg-muted px-1 py-0.2 text-[0.58rem] text-muted-foreground"
                              title="Illustrative demo fixture"
                            >
                              DEMO
                            </span>
                          )}
                        </div>
                        <span className="text-[0.65rem] text-muted-foreground uppercase tracking-wider">
                          {c.type.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Counterparty & Vessel */}
                      <td className="px-3 py-3">
                        <p className="font-medium text-foreground">{c.counterparty}</p>
                        <p className="font-mono text-[0.68rem] text-muted-foreground">
                          {c.vesselName} ({vesselById(c.vesselClass)?.name ?? c.vesselClass})
                        </p>
                      </td>

                      {/* Route */}
                      <td className="px-3 py-3">
                        <p className="text-foreground">
                          {origin?.shortName ?? c.origin} → {port?.name ?? c.destination}
                        </p>
                        <p className="font-mono text-[0.65rem] text-muted-foreground">
                          {port?.name} (Draft: {port?.maxDraftM.toFixed(1)}m)
                        </p>
                      </td>

                      {/* Cargo & Tonnage */}
                      <td className="px-3 py-3 text-right font-mono">
                        <p className="font-semibold text-foreground">{fmtTonnes(c.tonnage)}</p>
                        <p className="text-[0.65rem] text-muted-foreground">
                          {c.commodity ? CARGO_LABELS[c.commodity] : "Coking coal"}
                        </p>
                      </td>

                      {/* Freight Rate */}
                      <td className="px-3 py-3 text-right font-mono">
                        <p className="font-semibold text-foreground">{fmtRate(c.rateUsdPerT)}/t</p>
                        <p className="text-[0.65rem] text-muted-foreground">
                          Spend: {fmtUsd(c.tonnage * c.rateUsdPerT)}
                        </p>
                      </td>

                      {/* Laycan Window */}
                      <td className="px-3 py-3 font-mono text-[0.7rem]">
                        <div className="flex items-center gap-1">
                          <Calendar className="size-3 text-muted-foreground" />
                          <span>{formatLaycanRange(c.laycanStart, c.laycanEnd)}</span>
                        </div>
                        {hasConflict && (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[0.62rem] text-brass font-sans">
                            <AlertTriangle className="size-2.5" />
                            Overlapping laycan
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 font-mono text-[0.65rem] font-medium tracking-wide uppercase",
                            c.status === "FIXED"
                              ? "bg-copper text-primary-foreground"
                              : c.status === "UNDER_REVIEW"
                                ? "bg-brass/20 text-brass border border-brass/30"
                                : c.status === "COMPLETED"
                                  ? "bg-muted text-muted-foreground"
                                  : "border border-border text-muted-foreground",
                          )}
                        >
                          {c.status.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* Verification */}
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.62rem] font-mono",
                            c.verificationStatus === "VERIFIED"
                              ? "text-success border border-success/30 bg-success/5"
                              : c.verificationStatus === "PENDING_REVIEW"
                                ? "text-brass border border-brass/30 bg-brass/5"
                                : "text-muted-foreground border border-border",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1 rounded-full",
                              c.verificationStatus === "VERIFIED" ? "bg-success" : "bg-brass",
                            )}
                          />
                          {c.verificationStatus ?? "UNVERIFIED"}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedContract(c);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Open contract drawer"
                        >
                          <Eye className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Contract Detail Drawer (Modal / Slide-Over) ── */}
      <AnimatePresence>
        {selectedContract && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-background/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex h-full w-full max-w-xl flex-col justify-between border-l border-border bg-card shadow-2xl p-6 overflow-y-auto"
            >
              <div className="flex flex-col gap-5">
                {/* Drawer Header */}
                <div className="flex items-start justify-between border-b border-border/80 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileSignature className="size-5 text-copper" />
                      <h3 className="font-mono text-lg font-bold text-foreground">
                        {selectedContract.reference}
                      </h3>
                      {selectedContract.isIllustrative && (
                        <DemoTag kind="simulated" title="Illustrative fixture" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedContract.counterparty} · Created{" "}
                      {fmtDate(selectedContract.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedContract(null)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-5" />
                  </button>
                </div>

                {/* Status Transitions */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-ink/40 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Current Status:</span>
                    <span className="rounded bg-copper/20 px-2 py-0.5 font-mono text-xs font-semibold text-copper-soft">
                      {selectedContract.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    {selectedContract.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedContract.id, "UNDER_REVIEW")}
                        className="rounded bg-copper px-2.5 py-1 text-primary-foreground hover:bg-copper-soft"
                      >
                        Submit for Review
                      </button>
                    )}
                    {selectedContract.status === "UNDER_REVIEW" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedContract.id, "FIXED")}
                        className="rounded bg-success/80 px-2.5 py-1 text-primary-foreground hover:bg-success"
                      >
                        Fix Contract
                      </button>
                    )}
                    {selectedContract.status === "FIXED" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(selectedContract.id, "COMPLETED")}
                        className="rounded bg-muted px-2.5 py-1 text-foreground hover:bg-muted/80"
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>
                </div>

                {/* Commercial Terms Section */}
                <div className="flex flex-col gap-2 rounded-md border border-border/70 p-3.5 text-xs">
                  <h4 className="font-mono text-xs font-semibold uppercase text-brass">
                    Commercial Terms & Rate Particulars
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <span className="text-muted-foreground">Freight Rate:</span>
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {fmtRate(selectedContract.rateUsdPerT)}/t
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Spend Commitment:</span>
                      <p className="font-mono text-sm font-semibold text-foreground">
                        {fmtUsd(selectedContract.tonnage * selectedContract.rateUsdPerT)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Demurrage Rate:</span>
                      <p className="font-mono font-medium text-foreground">
                        {selectedContract.demurrageTerms
                          ? `$${fmtInt(selectedContract.demurrageTerms.rateUsdPerDay)}/day`
                          : "Not specified"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Despatch Terms:</span>
                      <p className="font-mono font-medium text-foreground">
                        {selectedContract.demurrageTerms?.despatchUsdPerDay
                          ? `$${fmtInt(selectedContract.demurrageTerms.despatchUsdPerDay)}/day`
                          : "Half demurrage"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Laytime Allowed:</span>
                      <p className="font-mono text-foreground">
                        {selectedContract.demurrageTerms?.laytimeTerms ??
                          `${selectedContract.demurrageTerms?.laytimeHours ?? 48} hrs`}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contract Type:</span>
                      <p className="font-mono text-foreground">
                        {CONTRACT_LABELS[selectedContract.type as any] ?? selectedContract.type}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Voyage Particulars */}
                <div className="flex flex-col gap-2 rounded-md border border-border/70 p-3.5 text-xs">
                  <h4 className="font-mono text-xs font-semibold uppercase text-brass">
                    Voyage Particulars & Vessel Specs
                  </h4>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-muted-foreground">Vessel Name:</span>
                      <p className="font-medium text-foreground">{selectedContract.vesselName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Vessel Class:</span>
                      <p className="font-mono text-foreground">
                        {vesselById(selectedContract.vesselClass)?.name ??
                          selectedContract.vesselClass}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Loading Port:</span>
                      <p className="text-foreground">
                        {originById(selectedContract.origin)?.loadPort} (
                        {originById(selectedContract.origin)?.shortName})
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Discharge Port:</span>
                      <p className="text-foreground">
                        {portByCode(selectedContract.destination)?.name} (
                        {selectedContract.destination})
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Laycan Range:</span>
                      <p className="font-mono text-foreground">
                        {formatLaycanRange(
                          selectedContract.laycanStart,
                          selectedContract.laycanEnd,
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Permissible Port Draft:</span>
                      <p className="font-mono font-semibold text-brass">
                        {portByCode(selectedContract.destination)?.maxDraftM.toFixed(1)} m
                      </p>
                    </div>
                  </div>
                </div>

                {/* Deadlines Checklist */}
                {selectedContract.deadlines && selectedContract.deadlines.length > 0 && (
                  <div className="flex flex-col gap-2 rounded-md border border-border/70 p-3.5 text-xs">
                    <h4 className="font-mono text-xs font-semibold uppercase text-brass">
                      Contractual Deadlines & Windows
                    </h4>
                    <div className="flex flex-col gap-1.5 pt-1">
                      {selectedContract.deadlines.map((dl) => (
                        <div
                          key={dl.id}
                          className="flex items-center justify-between rounded border border-border/50 bg-background/50 p-2"
                        >
                          <div>
                            <span className="font-medium text-foreground">{dl.label}</span>
                            <p className="font-mono text-[0.68rem] text-muted-foreground">
                              Due: {fmtDate(dl.dueDate)} ({dl.category})
                            </p>
                          </div>
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 font-mono text-[0.62rem]",
                              dl.isCompleted
                                ? "bg-success/20 text-success"
                                : "bg-brass/20 text-brass",
                            )}
                          >
                            {dl.isCompleted ? "Completed" : "Pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Outstanding Checks */}
                {selectedContract.outstandingChecks &&
                  selectedContract.outstandingChecks.length > 0 && (
                    <div className="flex flex-col gap-2 rounded-md border border-border/70 p-3.5 text-xs">
                      <h4 className="font-mono text-xs font-semibold uppercase text-brass">
                        Nautical & Commercial Verification Checks
                      </h4>
                      <div className="flex flex-col gap-1.5 pt-1">
                        {selectedContract.outstandingChecks.map((chk) => (
                          <div
                            key={chk.id}
                            className="flex items-center justify-between rounded border border-border/50 bg-background/50 p-2"
                          >
                            <div className="max-w-[75%]">
                              <span className="font-medium text-foreground">{chk.label}</span>
                              <p className="text-[0.68rem] text-muted-foreground">{chk.detail}</p>
                            </div>
                            {chk.status === "PASSED" ? (
                              <span className="rounded bg-success/15 px-2 py-0.5 font-mono text-[0.62rem] text-success">
                                Passed
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleVerifyCheck(selectedContract.id, chk.id)}
                                className="rounded bg-copper px-2 py-1 font-mono text-[0.65rem] text-primary-foreground hover:bg-copper-soft"
                              >
                                Verify Check
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Assumptions & Notes */}
                {selectedContract.notes && (
                  <div className="rounded-md border border-border/70 bg-ink/30 p-3 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Desk Notes:</span>{" "}
                    {selectedContract.notes}
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 mt-4">
                <div className="flex items-center gap-2">
                  <Link
                    to="/charter"
                    className="inline-flex items-center gap-1 rounded bg-muted/70 px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                  >
                    <Anchor className="size-3" />
                    <span>Charter Voyage</span>
                  </Link>
                  <Link
                    to="/feasibility"
                    className="inline-flex items-center gap-1 rounded bg-muted/70 px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                  >
                    <Ship className="size-3" />
                    <span>Port Limits</span>
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedContract(null)}
                  className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Draft New Contract Modal ── */}
      <DraftContractModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={async (newContract) => {
          const created = await createContract(newContract);
          setContractsList((prev) => [created, ...prev]);
          setSelectedContract(created);
          setShowCreateModal(false);
          setActionSuccess(`New contract ${created.reference} drafted successfully.`);
          setTimeout(() => setActionSuccess(null), 3000);
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Draft Contract Modal Form
   ═══════════════════════════════════════════════ */

interface DraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (contract: NewContract) => Promise<void>;
}

function DraftContractModal({ isOpen, onClose, onCreate }: DraftModalProps) {
  const [counterparty, setCounterparty] = useState("");
  const [vesselName, setVesselName] = useState("");
  const [vesselClass, setVesselClass] = useState<VesselClassId>("CAPESIZE");
  const [type, setType] = useState<ContractType>("VOYAGE");
  const [commodity, setCommodity] = useState<CargoType>("COKING_COAL");
  const [origin, setOrigin] = useState<OriginRegion>("AUS_QLD");
  const [destination, setDestination] = useState<PortCode>("PRDP");
  const [tonnage, setTonnage] = useState(160_000);
  const [rateUsdPerT, setRateUsdPerT] = useState(15.8);
  const [laycanStart, setLaycanStart] = useState("2026-11-15");
  const [laycanEnd, setLaycanEnd] = useState("2026-11-22");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload: Partial<NewContract> = {
      counterparty,
      vesselName,
      vesselClass,
      type,
      commodity,
      origin,
      destination,
      tonnage: Number(tonnage),
      rateUsdPerT: Number(rateUsdPerT),
      laycanStart,
      laycanEnd,
      status: "DRAFT",
      verificationStatus: "UNVERIFIED",
      notes,
    };

    const val = validateContractInput(payload);
    if (!val.isValid) {
      setErrors(val.errors);
      return;
    }

    setSubmitting(true);
    try {
      await onCreate({
        counterparty,
        vesselName,
        vesselClass,
        type,
        commodity,
        origin,
        destination,
        tonnage: Number(tonnage),
        rateUsdPerT: Number(rateUsdPerT),
        laycanStart,
        laycanEnd,
        status: "DRAFT",
        verificationStatus: "UNVERIFIED",
        isIllustrative: true,
        demurrageTerms: { rateUsdPerDay: 22_000, despatchUsdPerDay: 11_000, laytimeHours: 48 },
        notes,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <FilePlus2 className="size-5 text-copper" />
            <h3 className="font-serif text-xl font-bold text-foreground">
              Draft New Freight Contract
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Counterparty */}
            <div>
              <label className="text-muted-foreground">Counterparty Legal Entity *</label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="e.g. Oceanic Bulk Carriers Pte"
                className="mt-1 w-full rounded border border-border bg-background p-2 text-foreground focus:border-copper focus:outline-none"
              />
              {errors.counterparty && <span className="text-danger">{errors.counterparty}</span>}
            </div>

            {/* Vessel Name */}
            <div>
              <label className="text-muted-foreground">Vessel Name or Nomination *</label>
              <input
                type="text"
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                placeholder="e.g. MV Kalinga Star"
                className="mt-1 w-full rounded border border-border bg-background p-2 text-foreground focus:border-copper focus:outline-none"
              />
              {errors.vesselName && <span className="text-danger">{errors.vesselName}</span>}
            </div>

            {/* Vessel Class */}
            <div>
              <label className="text-muted-foreground">Vessel Class *</label>
              <select
                value={vesselClass}
                onChange={(e) => setVesselClass(e.target.value as any)}
                className="mt-1 w-full rounded border border-border bg-background p-2 text-foreground font-mono focus:border-copper focus:outline-none"
              >
                {VESSEL_CLASSES.map((vc) => (
                  <option key={vc.id} value={vc.id}>
                    {vc.name} ({fmtInt(vc.dwtMin)}–{fmtInt(vc.dwtMax)} DWT)
                  </option>
                ))}
              </select>
            </div>

            {/* Contract Type */}
            <div>
              <label className="text-muted-foreground">Contract Type *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="mt-1 w-full rounded border border-border bg-background p-2 text-foreground font-mono focus:border-copper focus:outline-none"
              >
                <option value="VOYAGE">Voyage Charter</option>
                <option value="TIME_CHARTER">Time Charter</option>
                <option value="COA">Contract of Affreightment (COA)</option>
              </select>
            </div>

            {/* Commodity */}
            <div>
              <label className="text-muted-foreground">Commodity</label>
              <select
                value={commodity}
                onChange={(e) => setCommodity(e.target.value as any)}
                className="mt-1 w-full rounded border border-border bg-background p-2 text-foreground focus:border-copper focus:outline-none"
              >
                <option value="COKING_COAL">Coking Coal</option>
                <option value="THERMAL_COAL">Thermal Coal</option>
                <option value="IRON_ORE">Iron Ore</option>
                <option value="LIMESTONE">Limestone</option>
              </select>
            </div>

            {/* Tonnage */}
            <div>
              <label className="text-muted-foreground">Cargo Quantity (Tonnes) *</label>
              <input
                type="number"
                value={tonnage}
                onChange={(e) => setTonnage(Number(e.target.value))}
                className="mt-1 w-full rounded border border-border bg-background p-2 font-mono text-foreground focus:border-copper focus:outline-none"
              />
              {errors.tonnage && <span className="text-danger">{errors.tonnage}</span>}
            </div>

            {/* Origin */}
            <div>
              <label className="text-muted-foreground">Origin Corridor *</label>
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value as any)}
                className="mt-1 w-full rounded border border-border bg-background p-2 text-foreground focus:border-copper focus:outline-none"
              >
                {ORIGINS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.loadPort})
                  </option>
                ))}
              </select>
            </div>

            {/* Destination */}
            <div>
              <label className="text-muted-foreground">Discharge Port *</label>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value as any)}
                className="mt-1 w-full rounded border border-border bg-background p-2 text-foreground focus:border-copper focus:outline-none"
              >
                {PORTS.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name} ({p.code}) — Max Draft {p.maxDraftM.toFixed(1)}m
                  </option>
                ))}
              </select>
            </div>

            {/* Freight Rate */}
            <div>
              <label className="text-muted-foreground">Agreed Freight Rate ($/t) *</label>
              <input
                type="number"
                step="0.01"
                value={rateUsdPerT}
                onChange={(e) => setRateUsdPerT(Number(e.target.value))}
                className="mt-1 w-full rounded border border-border bg-background p-2 font-mono text-foreground focus:border-copper focus:outline-none"
              />
              {errors.rateUsdPerT && <span className="text-danger">{errors.rateUsdPerT}</span>}
            </div>

            {/* Laycan Range */}
            <div>
              <label className="text-muted-foreground">Laycan Window *</label>
              <div className="mt-1 grid grid-cols-2 gap-1.5 font-mono">
                <input
                  type="date"
                  value={laycanStart}
                  onChange={(e) => setLaycanStart(e.target.value)}
                  className="rounded border border-border bg-background p-2 text-foreground"
                />
                <input
                  type="date"
                  value={laycanEnd}
                  onChange={(e) => setLaycanEnd(e.target.value)}
                  className="rounded border border-border bg-background p-2 text-foreground"
                />
              </div>
              {errors.laycanEnd && <span className="text-danger">{errors.laycanEnd}</span>}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-muted-foreground">Contractual Notes / Assumptions</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Laytime allowed 48 hours WWD SHINC. Part-laden draft confirmed at Paradip."
              className="mt-1 w-full rounded border border-border bg-background p-2 text-foreground focus:border-copper focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-copper px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-copper-soft disabled:opacity-50"
            >
              {submitting ? "Recording..." : "Create Contract Draft"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
