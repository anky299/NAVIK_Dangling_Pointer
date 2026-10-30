/**
 * NAVIK Nirnay Maritime Decision Assistant Workspace.
 *
 * Professional analyst's decision-support workspace.
 * Interrogates NAVIK's calculation engines (Charter, Feasibility, Market,
 * Scenario Lab, Strategic Portfolio) and delivers grounded, explainable
 * responses with traceable evidence, operational impacts, and next actions.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  Anchor,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Copy,
  Cpu,
  ExternalLink,
  FileText,
  Filter,
  FlaskConical,
  Fuel,
  HelpCircle,
  Info,
  Layers,
  LineChart,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  ShieldAlert,
  Ship,
  Sliders,
  Sparkles,
  Terminal,
  Trash2,
  Waypoints,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CARGO_LABELS,
  CONTRACT_LABELS,
  DISTANCES_NM,
  ORIGINS,
  PORTS,
  VESSEL_CLASSES,
  originById,
  portByCode,
  vesselById,
} from "@/lib/api/reference";
import type {
  AssistantActionLink,
  AssistantEvidenceItem,
  ChatMessage,
  OriginRegion,
  PortCode,
  StructuredAnswer,
  VesselClassId,
} from "@/lib/api/types";
import {
  CATEGORIZED_PROMPTS,
  DEFAULT_ASSISTANT_CONTEXT,
  SUGGESTED_PROMPTS,
  type AssistantContext,
  type AssistantIntent,
} from "@/lib/sim/assistant";
import { askAssistant } from "@/lib/api/services";
import { fmtDateTime, fmtInt, fmtRate, fmtTonnes, fmtUsd } from "@/lib/format";
import { DemoTag, Eyebrow, PageHeader, PanelHeader, RiskBadge } from "./primitives";
import { BentoCard, BentoGrid } from "./Bento";

/* ═══════════════════════════════════════════════
   Context Presets for Desk Analyst
   ═══════════════════════════════════════════════ */

interface ContextPreset {
  id: string;
  name: string;
  description: string;
  context: AssistantContext;
}

const CONTEXT_PRESETS: ContextPreset[] = [
  {
    id: "qld-prdp-cape",
    name: "Queensland → Paradip (Capesize 160k t)",
    description: "Met coal stem with part-laden draft limits at Paradip.",
    context: {
      origin: "AUS_QLD",
      destination: "PRDP",
      cargoTonnes: 160_000,
      cargoType: "COKING_COAL",
      vesselClass: "CAPESIZE",
      contractPreference: "SPOT",
    },
  },
  {
    id: "qld-hlda-lighter",
    name: "Queensland → Haldia (Riverine draft)",
    description: "Shallow Hooghly draft requiring Sandheads lightering.",
    context: {
      origin: "AUS_QLD",
      destination: "HLDA",
      cargoTonnes: 160_000,
      cargoType: "COKING_COAL",
      vesselClass: "PANAMAX",
      contractPreference: "SPOT",
    },
  },
  {
    id: "nsw-ggvm-newcastle",
    name: "NSW → Gangavaram (Newcastlemax 205k t)",
    description: "Deepest east-coast draft (21.0 m) with high-speed discharge.",
    context: {
      origin: "AUS_NSW",
      destination: "GGVM",
      cargoTonnes: 205_000,
      cargoType: "COKING_COAL",
      vesselClass: "NEWCASTLEMAX",
      contractPreference: "SPOT",
    },
  },
  {
    id: "kal-vizg-supra",
    name: "Kalimantan → Vizag (Supramax 58k t)",
    description: "Short-haul Indonesian thermal coal / limestone import.",
    context: {
      origin: "IDN_KAL",
      destination: "VIZG",
      cargoTonnes: 58_000,
      cargoType: "THERMAL_COAL",
      vesselClass: "SUPRAMAX",
      contractPreference: "SPOT",
    },
  },
];

/* ═══════════════════════════════════════════════
   Initial Conversation Starter
   ═══════════════════════════════════════════════ */

function getInitialMessages(): ChatMessage[] {
  return [
    {
      id: "init-nirnay-welcome",
      role: "assistant",
      createdAt: new Date().toISOString(),
      sources: ["NAVIK Charter Pipeline", "Fleet Feasibility Rules", "Market Intelligence Series"],
      intent: "charter_recommendation",
      content: `Welcome to **NIRNAY**, NAVIK's explainable maritime decision assistant.

I am connected directly to NAVIK's deterministic calculation engines. I evaluate vessel-to-port nautical compatibility, landed costs, bunker sensitivities, and procurement portfolios using actual math and reference fixtures.

Ask me any operational question about your voyage or select a suggested query below to begin.`,
      structured: {
        executive:
          "NIRNAY is standing by with access to 5 connected maritime calculation engines. Active context is set to Queensland → Paradip (160k t coking coal).",
        evidence: [
          { label: "Active Route", value: "Hay Point → Paradip", detail: "4,780 nm voyage" },
          { label: "Cargo Stem", value: "160k t Coking Coal", detail: "Spot charter intake" },
          {
            label: "Engines Ready",
            value: "5 Active Engines",
            detail: "Charter, Feasibility, Market, Scenario, Strategy",
          },
          { label: "Engine Mode", value: "Deterministic", detail: "Transparent math & fixtures" },
        ],
        impact:
          "You can question NAVIK's recommendations, compare vessel classes, stress test bunker prices, or analyze port constraints with full mathematical traceability.",
        risksAndAssumptions: [
          "Calculations use NAVIK analytical pipelines grounded in verified corridor parameters.",
          "Port wait times and bunker benchmarks reflect active session context.",
        ],
        recommendedStep:
          "Click one of the suggested inquiries below or type a custom question in the composer.",
      },
      followUps: [
        "Explain the current charter recommendation.",
        "Compare the two lowest-cost feasible vessel options.",
        "Identify the biggest drivers of landed cost.",
        "Explain why a vessel is conditional at Haldia.",
      ],
      actions: [
        { label: "Open Charter Workspace", to: "/charter" },
        { label: "Inspect Port Feasibility", to: "/feasibility" },
        { label: "Explore Scenario Lab", to: "/scenarios" },
      ],
    },
  ];
}

/* ═══════════════════════════════════════════════
   Main Workspace Component
   ═══════════════════════════════════════════════ */

export function NirnayAssistantWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>(getInitialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showContextDrawer, setShowContextDrawer] = useState(false);

  // Active Desk Context
  const [context, setContext] = useState<AssistantContext>(DEFAULT_ASSISTANT_CONTEXT);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = useCallback((smooth = true) => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Submit question handler
  const handleSend = async (questionText?: string) => {
    const query = (questionText ?? input).trim();
    if (!query || loading) return;

    setError(null);
    setInput("");

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      const assistantMsg = await askAssistant(newHistory, query, context);
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to obtain assistant reply");
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "An error occurred while evaluating NAVIK calculation engines. Please try rephrasing your question or selecting one of the suggested prompts.",
          createdAt: new Date().toISOString(),
          sources: ["System Error Handler"],
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Keyboard shortcut: Enter to submit, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Clear conversation with confirmation
  const handleClearConversation = () => {
    setMessages(getInitialMessages());
    setShowClearConfirm(false);
    setError(null);
  };

  // Copy message content
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered suggested prompts
  const currentCategory = CATEGORIZED_PROMPTS.find((c) => c.title === activeTab);
  const displayedPrompts = currentCategory ? currentCategory.prompts : SUGGESTED_PROMPTS;

  const origin = originById(context.origin ?? "AUS_QLD");
  const port = portByCode(context.destination ?? "PRDP");
  const distance =
    DISTANCES_NM[context.origin ?? "AUS_QLD"]?.[context.destination ?? "PRDP"] ?? 4780;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Page Header ── */}
      <PageHeader
        eyebrow="Desk 01 / Operational Intelligence"
        title="NIRNAY"
        accent="maritime analyst."
        description="Explainable decision-support assistant interrogating NAVIK's chartering, vessel feasibility, market intelligence, scenario stress testing, and sourcing engines."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Engine Boundary Pill */}
            <div
              className="inline-flex items-center gap-2 rounded-md border border-border bg-ink/60 px-3 py-1.5 text-xs text-muted-foreground"
              title="NIRNAY runs deterministically against NAVIK's mathematical decision models with full audit traceability."
            >
              <Cpu className="size-3.5 text-copper" />
              <span className="font-mono text-[0.7rem] uppercase tracking-wider text-foreground">
                Deterministic Engine · NAVIK Core
              </span>
            </div>

            {/* Context Panel Toggle (Tablet/Mobile) */}
            <button
              type="button"
              onClick={() => setShowContextDrawer(!showContextDrawer)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted lg:hidden"
            >
              <Sliders className="size-3.5 text-brass" />
              <span>Active Context</span>
            </button>

            {/* Clear Conversation */}
            {showClearConfirm ? (
              <div className="flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/10 px-2 py-1">
                <span className="text-[0.72rem] text-danger">Reset conversation?</span>
                <button
                  type="button"
                  onClick={handleClearConversation}
                  className="rounded px-2 py-0.5 text-[0.7rem] font-semibold text-danger hover:bg-danger/20"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="rounded px-2 py-0.5 text-[0.7rem] text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-danger/40 hover:text-danger"
                title="Clear current session dialogue"
              >
                <Trash2 className="size-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        }
      />

      {/* ── Main Analyst Layout: Chat (Left) + Context (Right) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ── Chat Stream & Composer Column (8 cols on lg) ── */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          {/* ── Suggested Questions Carousel ── */}
          <BentoCard glowColor="brass" className="p-3 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 text-copper" />
                <span className="text-eyebrow text-xs text-muted-foreground">
                  Suggested Desk Inquiries
                </span>
              </div>

              {/* Category tabs */}
              <div className="flex flex-wrap items-center gap-1 text-[0.68rem]">
                {[
                  "All",
                  "Chartering & Timing",
                  "Vessel & Port Feasibility",
                  "Landed Cost & Scenarios",
                  "Procurement Strategy & Risks",
                ].map((cat) => {
                  const label = cat === "All" ? "All" : cat.split(" ")[0];
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveTab(cat)}
                      className={cn(
                        "rounded px-2 py-0.5 font-mono tracking-wider transition-colors",
                        activeTab === cat
                          ? "bg-copper/20 text-copper-soft border border-copper/30"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt Chips */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {displayedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSend(prompt)}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-left text-xs text-foreground/90 transition-all hover:border-copper/50 hover:bg-copper/10 hover:text-copper-soft disabled:opacity-50"
                >
                  <span className="truncate max-w-[280px] sm:max-w-none">{prompt}</span>
                  <ArrowRight className="size-3 shrink-0 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </BentoCard>

          {/* ── Conversation Stream ── */}
          <div
            className="flex min-h-[500px] flex-col gap-4 rounded-lg border border-border bg-ink/20 p-4 sm:p-5 shadow-inner"
            role="log"
            aria-live="polite"
          >
            {messages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                isCopied={copiedId === msg.id}
                onCopy={() => handleCopy(msg.id, msg.content)}
                onSelectFollowUp={(q) => handleSend(q)}
                disabled={loading}
              />
            ))}

            {/* Loading Indicator */}
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 rounded-lg border border-copper/30 bg-copper/5 p-4"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-copper/15 text-copper">
                  <Compass className="size-4 animate-spin" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-medium text-copper-soft">
                    Querying NAVIK calculation engines...
                  </p>
                  <p className="font-mono text-[0.7rem] text-muted-foreground">
                    Evaluating vessel specs, port constraints, freight curves & landed cost models
                  </p>
                </div>
              </motion.div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 rounded-md border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Restrained Message Composer ── */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-ink/40 p-3 shadow-md">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask NIRNAY (e.g. Why is Capesize preferred for Paradip? What drives landed cost?)"
                rows={2}
                disabled={loading}
                className="w-full resize-none rounded-md border border-border/80 bg-background/80 p-3 pr-24 font-sans text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-copper/60 focus:outline-none focus:ring-1 focus:ring-copper/40 disabled:opacity-60"
              />
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!input.trim() || loading}
                  onClick={() => handleSend()}
                  aria-label="Send query"
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-3 py-1.5 font-mono text-xs font-medium transition-colors",
                    input.trim() && !loading
                      ? "bg-copper text-primary-foreground hover:bg-copper-soft shadow-sm"
                      : "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
                  )}
                >
                  <Send className="mr-1.5 size-3.5" />
                  <span>Ask</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 text-[0.7rem] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Terminal className="size-3 text-brass/70" />
                <span>
                  Press{" "}
                  <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[0.65rem]">
                    ↵ Enter
                  </kbd>{" "}
                  to submit ·{" "}
                  <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[0.65rem]">
                    Shift+↵
                  </kbd>{" "}
                  for new line
                </span>
              </span>
              <span className="font-mono text-[0.68rem] text-muted-foreground/80">
                Grounding: NAVIK Simulation Pipelines
              </span>
            </div>
          </div>
        </div>

        {/* ── Active Context & Intelligence Sidebar (4 cols on lg) ── */}
        <aside className="flex flex-col gap-5 lg:col-span-4">
          {/* Active Context Card */}
          <BentoCard glowColor="coral" className="flex flex-col gap-4 p-4 shadow-sm">
            <PanelHeader
              title="Active Voyage Context"
              eyebrow="Desk Parameters"
              right={
                <span className="font-mono text-[0.65rem] uppercase text-brass">In-Memory</span>
              }
            />

            <div className="divide-y divide-border/60 text-xs">
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Corridor Route</span>
                <span className="font-medium text-foreground text-right">
                  {origin.shortName} → {port.name}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Load Port</span>
                <span className="font-mono text-foreground">{origin.loadPort}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Discharge Port</span>
                <span className="font-medium text-foreground">
                  {port.name} ({port.code})
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Sea Distance</span>
                <span className="font-mono text-foreground">{fmtInt(distance)} nm</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Cargo Intake</span>
                <span className="font-mono font-medium text-foreground">
                  {fmtTonnes(context.cargoTonnes ?? 160_000)} ·{" "}
                  {CARGO_LABELS[context.cargoType ?? "COKING_COAL"]}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Contract Basis</span>
                <span className="text-foreground">
                  {CONTRACT_LABELS[context.contractPreference ?? "SPOT"]}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Port Permissible Draft</span>
                <span className="font-mono font-semibold text-brass">
                  {port.maxDraftM.toFixed(1)} m
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Base Bunker (VLSFO)</span>
                <span className="font-mono text-foreground">$620/t</span>
              </div>
            </div>

            {/* Quick Context Switcher */}
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-eyebrow text-[0.65rem] text-muted-foreground">
                Apply Context Preset
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {CONTEXT_PRESETS.map((preset) => {
                  const isActive =
                    context.origin === preset.context.origin &&
                    context.destination === preset.context.destination;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setContext((prev) => ({ ...prev, ...preset.context }))}
                      className={cn(
                        "flex flex-col items-start rounded border p-2 text-left transition-all",
                        isActive
                          ? "border-copper/60 bg-copper/10 text-foreground"
                          : "border-border/70 bg-ink/30 text-muted-foreground hover:border-border hover:text-foreground",
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-mono text-[0.7rem] font-medium text-foreground">
                          {preset.name}
                        </span>
                        {isActive && <Check className="size-3 text-copper" />}
                      </div>
                      <span className="mt-0.5 line-clamp-1 text-[0.65rem] text-muted-foreground">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </BentoCard>

          {/* Model Boundary & Grounding Card */}
          <BentoCard glowColor="walnut" className="flex flex-col gap-3 p-4 text-xs">
            <div className="flex items-center gap-2 text-copper-soft">
              <Shield className="size-4" />
              <h3 className="font-semibold text-foreground">Model Boundary & Auditability</h3>
            </div>
            <p className="text-[0.78rem] leading-relaxed text-muted-foreground">
              NIRNAY answers are computed deterministically from NAVIK's simulation pipelines and
              reference data.
            </p>
            <ul className="flex flex-col gap-1.5 text-[0.72rem] text-muted-foreground/90">
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" />
                <span>Reuses verified vessel-class specs and port limits.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" />
                <span>Preserves exact cost formulas and fuel burn tables.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-success" />
                <span>Zero fabricated confidence scores or imaginary APIs.</span>
              </li>
            </ul>

            <div className="mt-2 pt-2 border-t border-border/60">
              <p className="text-[0.68rem] text-muted-foreground">Connected Workspaces:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link
                  to="/charter"
                  className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-1 text-[0.68rem] font-mono hover:bg-muted"
                >
                  <Anchor className="size-2.5" />
                  <span>Charter</span>
                </Link>
                <Link
                  to="/feasibility"
                  className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-1 text-[0.68rem] font-mono hover:bg-muted"
                >
                  <Ship className="size-2.5" />
                  <span>Feasibility</span>
                </Link>
                <Link
                  to="/scenarios"
                  className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-1 text-[0.68rem] font-mono hover:bg-muted"
                >
                  <FlaskConical className="size-2.5" />
                  <span>Scenarios</span>
                </Link>
                <Link
                  to="/strategy"
                  className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-1 text-[0.68rem] font-mono hover:bg-muted"
                >
                  <Waypoints className="size-2.5" />
                  <span>Strategy</span>
                </Link>
                <Link
                  to="/market"
                  className="inline-flex items-center gap-1 rounded bg-muted/60 px-2 py-1 text-[0.68rem] font-mono hover:bg-muted"
                >
                  <LineChart className="size-2.5" />
                  <span>Market</span>
                </Link>
              </div>
            </div>
          </BentoCard>
        </aside>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Chat Message Item Component
   ═══════════════════════════════════════════════ */

interface ChatMessageItemProps {
  message: ChatMessage;
  isCopied: boolean;
  onCopy: () => void;
  onSelectFollowUp: (q: string) => void;
  disabled: boolean;
}

function ChatMessageItem({
  message,
  isCopied,
  onCopy,
  onSelectFollowUp,
  disabled,
}: ChatMessageItemProps) {
  const isUser = message.role === "user";
  const s = message.structured;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg border border-border/80 bg-paper/10 p-3.5 text-sm text-foreground shadow-sm">
          <div className="flex items-center justify-between gap-4 pb-1 text-[0.68rem] text-muted-foreground">
            <span className="font-mono font-medium text-brass">Chartering Desk</span>
            <span>{fmtDateTime(message.createdAt)}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant Response Card
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/90 p-4 sm:p-5 shadow-sm">
      {/* ── Card Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded bg-copper/15 text-copper">
            <Compass className="size-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-serif font-semibold tracking-wide text-foreground">
              NIRNAY Decision Support
            </span>
            {message.intent && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.62rem] uppercase text-muted-foreground">
                {message.intent.replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[0.65rem] text-muted-foreground">
            {fmtDateTime(message.createdAt)}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Copy answer markdown"
          >
            {isCopied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Section 1: Executive Answer ── */}
      <div className="flex flex-col gap-1.5">
        <h4 className="text-eyebrow text-xs text-brass">Executive Answer</h4>
        <p className="font-serif text-[1.05rem] leading-relaxed text-foreground sm:text-[1.12rem]">
          {s?.executive ?? message.content}
        </p>
      </div>

      {/* ── Section 2: Supporting Evidence (Key Figures & Metrics) ── */}
      {s && s.evidence.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md border border-border/70 bg-ink/30 p-3">
          <h4 className="text-eyebrow text-[0.65rem] text-muted-foreground">
            Supporting Evidence & Technical Values
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {s.evidence.map((item) => (
              <div
                key={item.label}
                className="flex flex-col rounded border border-border/50 bg-background/50 p-2"
              >
                <span className="text-[0.65rem] text-muted-foreground">{item.label}</span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {item.value}
                </span>
                {item.detail && (
                  <span className="mt-0.5 line-clamp-1 text-[0.62rem] text-muted-foreground">
                    {item.detail}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 3: Cost or Operational Impact ── */}
      {s?.impact && (
        <div className="flex flex-col gap-1 text-xs">
          <h4 className="text-eyebrow text-[0.65rem] text-copper">Cost & Operational Impact</h4>
          <p className="leading-relaxed text-muted-foreground">{s.impact}</p>
        </div>
      )}

      {/* ── Section 4: Key Risks & Material Assumptions ── */}
      {s && s.risksAndAssumptions.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded border border-brass/30 bg-brass/5 p-3 text-xs">
          <div className="flex items-center gap-1.5 text-brass">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-wider">
              Risks & Material Assumptions
            </span>
          </div>
          <ul className="flex flex-col gap-1 pl-4 list-disc text-[0.72rem] text-muted-foreground/90">
            {s.risksAndAssumptions.map((r) => (
              <li key={r} className="leading-relaxed">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Section 5: Recommended Next Step ── */}
      {s?.recommendedStep && (
        <div className="flex flex-col gap-1 text-xs">
          <h4 className="text-eyebrow text-[0.65rem] text-success">Recommended Next Step</h4>
          <p className="leading-relaxed text-foreground font-medium">{s.recommendedStep}</p>
        </div>
      )}

      {/* ── Cross-Workspace Actions ── */}
      {message.actions && message.actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
          <span className="text-[0.68rem] text-muted-foreground font-mono">Workspace Actions:</span>
          {message.actions.map((act) => (
            <Link
              key={act.to + act.label}
              to={act.to as any}
              className="inline-flex items-center gap-1.5 rounded-md border border-copper/40 bg-copper/10 px-2.5 py-1 text-xs font-medium text-copper-soft transition-colors hover:bg-copper/20 hover:text-foreground"
              title={act.description}
            >
              <span>{act.label}</span>
              <ExternalLink className="size-3" />
            </Link>
          ))}
        </div>
      )}

      {/* ── Follow-Up Question Chips ── */}
      {message.followUps && message.followUps.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          <span className="text-[0.65rem] text-muted-foreground font-mono">Follow-up:</span>
          {message.followUps.map((fu) => (
            <button
              key={fu}
              type="button"
              disabled={disabled}
              onClick={() => onSelectFollowUp(fu)}
              className="rounded-full border border-border bg-ink/40 px-2.5 py-0.5 text-[0.7rem] text-muted-foreground transition-colors hover:border-copper/40 hover:text-foreground disabled:opacity-50"
            >
              {fu}
            </button>
          ))}
        </div>
      )}

      {/* ── Provenance Sources Footnote ── */}
      {message.sources && message.sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[0.62rem] text-muted-foreground/70 pt-1">
          <span className="font-mono">Sources:</span>
          {message.sources.map((src, i) => (
            <span key={src} className="rounded bg-muted/40 px-1.5 py-0.2 font-mono">
              {src}
              {i < message.sources!.length - 1 ? "" : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
