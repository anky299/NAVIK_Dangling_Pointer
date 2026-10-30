import { Link, createFileRoute } from "@tanstack/react-router";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight, Compass, ShieldAlert, Sparkles, Waves } from "lucide-react";
import { useRef, useState } from "react";

import heroCarrier from "@/assets/hero-carrier.jpg";
import portTerminal from "@/assets/port-terminal.jpg";
import aerialHolds from "@/assets/aerial-holds.jpg";
import bowNight from "@/assets/bow-night.jpg";
import { Logo } from "@/components/navik/Logo";
import { RouteMap } from "@/components/navik/RouteMap";
import { MaritimeCorridorHUD } from "@/components/navik/MaritimeCorridorHUD";
import { DemoTag, Eyebrow } from "@/components/navik/primitives";
import { BentoCard } from "@/components/navik/Bento";
import { Reveal } from "@/components/navik/Reveal";
import { PORTS } from "@/lib/api/reference";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NAVIK — Predict. Optimize. Navigate. | Charter intelligence" },
      {
        name: "description",
        content:
          "Freight forecasting, disruption risk and vessel-port feasibility in one charter decision for Australia–East Coast India bulk lanes.",
      },
      { property: "og:title", content: "NAVIK — Predict. Optimize. Navigate." },
      {
        property: "og:description",
        content: "Turning global maritime complexity into smarter, faster charter decisions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const WORKFLOW = [
  {
    n: "01",
    title: "Forecast",
    body: "Weekly freight curves for each origin lane with a P10–P90 band, so a fixture is priced against a range rather than a single guess.",
    out: "8-week freight band · $/t",
  },
  {
    n: "02",
    title: "Assess risk",
    body: "Anchorage queues, strait pilotage, cyclone climatology and rate volatility are weighted into one disruption score for the voyage.",
    out: "Risk score 0–100 · ranked drivers",
  },
  {
    n: "03",
    title: "Validate feasibility",
    body: "Every vessel class is tested against the discharge port's draft, length and beam limits — and against your delivery deadline.",
    out: "Feasible · conditional · rejected",
  },
  {
    n: "04",
    title: "Optimize",
    body: "Freight, bunkers, port dues, demurrage reserve and insurance are combined into landed cost per tonne for every viable option.",
    out: "Landed cost · liftings · utilisation",
  },
  {
    n: "05",
    title: "Decide",
    body: "One clear call — charter now, wait, or split the programme — with the reasoning, confidence and the risks that could change it.",
    out: "CHARTER_NOW · WAIT · SPLIT",
  },
];

const HERO_STATS = [
  { label: "Hay Point → Paradip", value: "$15.82", unit: "/t P50" },
  { label: "VLSFO Singapore", value: "$642", unit: "/t" },
  { label: "East-coast anchorage", value: "2.3", unit: "days avg" },
  { label: "Capesize availability", value: "74", unit: "%" },
];

function Landing() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.06, 1.16]);
  const mapY = useTransform(scrollYProgress, [0, 1], ["0%", "-22%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 40));

  return (
    <div className="landing-page relative bg-[#071522] text-[#EAF1F6]">
      {/* ---------- Nav ---------- */}
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500",
          scrolled
            ? "border-b border-[#263D50] bg-[#071522]/90 backdrop-blur-md"
            : "border-b border-transparent bg-[#071522]/30 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none",
        )}
      >
        <div className="mx-auto flex h-20 sm:h-22 lg:h-24 max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
          {/* Brand lockup */}
          <div className="flex shrink-0 items-center min-w-0">
            <Link to="/" aria-label="NAVIK home" className="flex items-center group">
              <Logo size="nav" />
            </Link>
          </div>

          {/* Navigation links */}
          <nav
            aria-label="Landing"
            className="hidden items-center gap-8 text-[0.82rem] font-medium text-[#A8BAC8] md:flex"
          >
            <a href="#intelligence" className="transition-colors hover:text-[#F7FAFC]">
              Workflow
            </a>
            <a href="#capabilities" className="transition-colors hover:text-[#F7FAFC]">
              Capabilities
            </a>
            <a href="#ports" className="transition-colors hover:text-[#F7FAFC]">
              Ports
            </a>
          </nav>

          {/* Action button */}
          <div className="flex shrink-0 items-center">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-md border border-[#263D50] bg-[#102A40]/80 px-3.5 py-2 text-xs font-semibold text-[#EAF1F6] backdrop-blur-sm transition-colors hover:border-[#35C9D0] hover:text-[#F7FAFC] hover:bg-[#18384F]"
            >
              Command Center <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section ref={heroRef} className="grain relative h-[100svh] min-h-[700px] overflow-hidden">
        <motion.div
          style={{ y: imgY, scale: imgScale }}
          className="absolute inset-0 will-change-transform"
        >
          <img
            src={heroCarrier}
            alt="Laden bulk carrier pushing through a dark swell at dusk"
            className="size-full object-cover object-[30%_center]"
            fetchPriority="high"
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#071522]/80 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-[70%] bg-horizon" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#071522]/70 via-transparent to-transparent md:from-[#071522]/50" />

        {/* Route canvas over the sky */}
        <motion.div
          style={{ y: mapY }}
          className="pointer-events-none absolute right-[-4%] top-[9%] hidden w-[54%] max-w-[820px] md:block lg:right-[1%] lg:w-[46%]"
        >
          <RouteMap
            title="Indicative sea lanes from Australia and Kalimantan to five East Coast India ports"
            labelScale={1.15}
            delay={0.9}
            theme="dark"
          />
        </motion.div>

        <motion.div
          style={{ opacity: fade }}
          className="relative z-10 mx-auto flex h-full max-w-[1440px] flex-col justify-end px-5 pb-16 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 1 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-[#35BFC3]/40 bg-[#0D2233]/85 px-3.5 py-1 font-mono text-[0.65rem] tracking-widest text-[#35BFC3] backdrop-blur-md shadow-sm font-semibold">
              <span className="size-1.5 rounded-full bg-[#35BFC3] animate-pulse shadow-[0_0_8px_rgba(53,191,195,0.8)]" />
              MARITIME DECISION INTELLIGENCE
            </span>
          </motion.div>

          <h1 className="text-display-hero mt-8 max-w-5xl">
            <motion.span
              className="block text-[2.8rem] sm:text-[4.5rem] lg:text-[6.4rem] tracking-tight text-[#F3EEE5] font-extrabold"
              initial={{ opacity: 0, y: "0.4em" }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            >
              Predict. <span className="text-[#F2B653] font-semibold">Optimize.</span>
            </motion.span>
            <motion.span
              className="serif-accent text-gradient-brass block text-[3.4rem] font-normal sm:text-[5.2rem] lg:text-[7.4rem] leading-[0.95]"
              initial={{ opacity: 0, y: "0.4em" }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
              Navigate.
            </motion.span>
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-10 max-w-xl lg:mt-14"
          >
            <p className="text-body-lead text-[#F3EEE5]/90 font-medium">
              Turning global maritime complexity into smarter, faster charter decisions for
              Australia–East Coast India supply lines.
            </p>
            <div className="mt-8 flex flex-wrap gap-3.5">
              <Link
                to="/dashboard"
                className="group inline-flex items-center gap-2 rounded-md bg-[#F2B653] px-6 py-3.5 text-sm font-bold text-[#081827] shadow-[0_4px_20px_rgba(242,182,83,0.35)] transition-all hover:bg-[#F5C26B] hover:shadow-[0_6px_24px_rgba(242,182,83,0.5)] active:scale-[0.98]"
              >
                Enter Command Center
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#corridor-console"
                className="inline-flex items-center gap-2 rounded-md border border-[#24485C] bg-[#15364A]/80 px-6 py-3.5 text-sm font-semibold text-[#F3EEE5] backdrop-blur-md transition-all hover:border-[#F2B653] hover:text-[#F3EEE5] hover:bg-[#1f435b] active:scale-[0.98]"
              >
                <Compass className="size-4 text-[#F2B653]" />
                Explore Maritime Corridor
              </a>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ---------- Market ticker ---------- */}
      <section className="border-b border-[#24485C] bg-gradient-to-r from-[#081827] via-[#0D2233] to-[#081827] py-6 sm:py-8">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {HERO_STATS.map((s, i) => {
              const config = [
                { glow: "teal", labelColor: "text-[#35BFC3]" },
                { glow: "amber", labelColor: "text-[#F2B653]" },
                { glow: "violet", labelColor: "text-[#A78BFA]" },
                { glow: "orange", labelColor: "text-[#E87945]" },
              ][i % 4];
              return (
                <Reveal key={s.label} delay={i * 0.06} y={10}>
                  <BentoCard glowColor={config.glow as any} className="p-4 sm:p-5 bg-[#15364A] border-[#24485C]">
                    <p className={cn("text-eyebrow truncate text-[0.62rem] font-semibold", config.labelColor)}>
                      {s.label}
                    </p>
                    <p className="font-tabular mt-2 font-mono text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[#F3EEE5]">
                      {s.value}
                      <span className="ml-1.5 font-sans text-[0.65rem] sm:text-xs font-medium text-[#D8E2E8]">
                        {s.unit}
                      </span>
                    </p>
                  </BentoCard>
                </Reveal>
              );
            })}
          </div>
          <p className="flex items-center gap-2 pt-4 text-[0.68rem] text-[#D8E2E8]/70">
            Operational market indicators — calibrated for East Coast India intake corridors.
          </p>
        </div>
      </section>

      {/* ---------- Tactical Corridor Intelligence Console ---------- */}
      <section
        id="corridor-console"
        className="relative border-b border-[#24485C] bg-[#081827] py-20 lg:py-28"
      >
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <Reveal className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Eyebrow index="CONSOLE">Interactive Maritime Corridor Simulator</Eyebrow>
              <h2 className="text-display mt-4 text-[2.2rem] sm:text-4xl lg:text-[2.8rem] text-[#F3EEE5]">
                Australia & Indonesia →{" "}
                <span className="serif-accent font-normal text-[#F2B653]">East Coast India</span>
              </h2>
              <p className="text-body-lead mt-3 max-w-2xl text-[#D8E2E8] text-sm sm:text-base">
                Click any discharge terminal to test permissible nautical draft depth, distance, and
                transit margins against Capesize and Panamax bulk carrier specifications.
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-xs text-[#35BFC3]">
              <span className="flex size-2 rounded-full bg-[#35BFC3] animate-pulse shadow-[0_0_8px_rgba(53,191,195,0.8)]" />
              <span>MARITIME TELEMETRY PIPELINE ACTIVE</span>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <MaritimeCorridorHUD />
          </Reveal>
        </div>
      </section>

      {/* ---------- Thesis ---------- */}
      <section className="contour-field relative border-b border-[#24485C] bg-[#0D2233]">
        <div className="mx-auto grid max-w-[1440px] gap-16 px-5 py-28 sm:px-8 md:py-36 lg:grid-cols-12 lg:gap-12 lg:px-12">
          <Reveal className="lg:col-span-7">
            <Eyebrow index="00">The problem</Eyebrow>
            <p className="mt-10 text-[1.8rem] font-medium leading-[1.2] tracking-tight sm:text-[2.4rem] lg:text-[3rem] text-[#F3EEE5]">
              Every fixture is a bet on the market, the weather and the queue at the berth.{" "}
              <span className="serif-accent text-[#F2B653]">NAVIK makes the bet visible.</span>
            </p>
          </Reveal>
          <Reveal delay={0.15} className="flex flex-col justify-end lg:col-span-4 lg:col-start-9">
            <p className="text-body-lead text-[#D8E2E8]">
              East Coast India steel and power plants import coal and ore through five ports with
              very different draft limits. Chartering desks juggle freight swings, monsoon
              disruption and ship-to-port fit by spreadsheet. NAVIK brings those signals into one
              explainable recommendation.
            </p>
            <div className="mt-12 grid grid-cols-3 gap-6 border-t border-[#24485C] pt-8">
              {[
                { v: "5", l: "discharge ports" },
                { v: "6", l: "vessel classes" },
                { v: "4", l: "origin lanes" },
              ].map((s) => (
                <div key={s.l}>
                  <p className="font-tabular font-mono text-3xl text-[#F3EEE5] font-bold">{s.v}</p>
                  <p className="mt-1 text-xs text-[#D8E2E8]/70">{s.l}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <Workflow />
      <Capabilities />
      <Ports />

      {/* ---------- CTA ---------- */}
      <section className="grain relative overflow-hidden">
        <img
          src={bowNight}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#081827] via-[#081827]/85 to-[#081827]/40" />
        <div className="relative z-10 mx-auto max-w-[1440px] px-5 py-32 sm:px-8 md:py-44 lg:px-12">
          <Reveal className="max-w-3xl">
            <Eyebrow>Command Center</Eyebrow>
            <h2 className="text-display mt-8 text-[2.4rem] sm:text-5xl lg:text-[3.8rem] text-[#F3EEE5]">
              Fix the right ship,{" "}
              <span className="serif-accent text-[#F2B653] font-normal">at the right moment.</span>
            </h2>
            <p className="text-body-lead mt-8 max-w-xl text-[#D8E2E8]">
              Run a complete charter analysis — cargo intake to explainable recommendation in under a
              minute.
            </p>
            <div className="mt-12 flex flex-wrap gap-3">
              <Link
                to="/charter"
                className="group inline-flex items-center gap-2 rounded-md bg-[#F2B653] px-5 py-3 text-sm font-bold text-[#081827] shadow-[0_4px_16px_rgba(242,182,83,0.35)] transition-colors hover:bg-[#F5C26B]"
              >
                Start a charter analysis{" "}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-md border border-[#24485C] bg-[#15364A]/80 px-5 py-3 text-sm font-semibold text-[#F3EEE5] transition-colors hover:border-[#F2B653] hover:bg-[#1f435b]"
              >
                Enter Command Center
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[#24485C] bg-[#081827]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 py-12 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <Logo size="nav" />
          <p className="max-w-xl text-xs leading-relaxed text-[#D8E2E8]/70">
            NAVIK Maritime Freight Intelligence. Operational decision support for dry-bulk intake
            across Indian East Coast discharge ports. Sea lanes are schematic and indicative.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Workflow() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="intelligence" className="relative scroll-mt-16 border-b border-[#24485C] bg-[#081827]">
      <div className="mx-auto grid max-w-[1440px] gap-16 px-5 py-28 sm:px-8 md:py-36 lg:grid-cols-12 lg:px-12">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <Reveal>
              <Eyebrow index="01">The decision pipeline</Eyebrow>
              <h2 className="text-display mt-8 text-[2.4rem] sm:text-5xl lg:text-[3.4rem] text-[#F3EEE5]">
                Five stages.{" "}
                <span className="serif-accent font-normal text-[#F2B653]">One call.</span>
              </h2>
              <p className="text-body-lead mt-8 max-w-sm text-[#D8E2E8]">
                Each stage hands a structured result to the next, and every number in the final
                report can be traced back to the stage that produced it.
              </p>
            </Reveal>
          </div>
        </div>
        <div ref={ref} className="relative lg:col-span-7 lg:col-start-6">
          <div className="absolute bottom-4 left-[1.15rem] top-4 w-px bg-[#24485C]" />
          <motion.div
            style={{ scaleY }}
            className="absolute bottom-4 left-[1.15rem] top-4 w-[2px] origin-top bg-gradient-to-b from-[#35BFC3] via-[#F2B653] to-[#E87945]"
          />
          <ol className="space-y-16">
            {WORKFLOW.map((s, i) => {
              const stepColors = [
                {
                  border: "border-[#35BFC3]/70",
                  text: "text-[#35BFC3]",
                  bg: "bg-[#15364A]",
                  out: "text-[#35BFC3]",
                },
                {
                  border: "border-[#E87945]/70",
                  text: "text-[#E87945]",
                  bg: "bg-[#15364A]",
                  out: "text-[#E87945]",
                },
                {
                  border: "border-[#78958F]/70",
                  text: "text-[#78958F]",
                  bg: "bg-[#15364A]",
                  out: "text-[#78958F]",
                },
                {
                  border: "border-[#24485C]",
                  text: "text-[#D8E2E8]",
                  bg: "bg-[#15364A]",
                  out: "text-[#D8E2E8]",
                },
                {
                  border: "border-[#F2B653]",
                  text: "text-[#081827]",
                  bg: "bg-[#F2B653] shadow-[0_0_14px_rgba(242,182,83,0.4)]",
                  out: "text-[#F2B653] font-bold",
                },
              ][i];

              return (
                <Reveal key={s.n} delay={i * 0.04}>
                  <li className="relative grid grid-cols-[2.3rem_1fr] gap-6 group">
                    <span
                      className={cn(
                        "relative z-10 flex size-[2.3rem] items-center justify-center rounded-full border font-mono text-[0.72rem] font-bold shadow-md transition-all duration-300 group-hover:scale-110",
                        stepColors.border,
                        stepColors.text,
                        stepColors.bg,
                      )}
                    >
                      {s.n}
                    </span>
                    <div className="pt-1">
                      <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl text-[#F3EEE5] group-hover:text-[#F2B653] transition-colors">
                        {s.title}
                      </h3>
                      <p className="mt-3 max-w-xl leading-relaxed text-[#D8E2E8]">
                        {s.body}
                      </p>
                      <p
                        className={cn("text-eyebrow mt-5 text-[0.62rem] font-mono", stepColors.out)}
                      >
                        → {s.out}
                      </p>
                    </div>
                  </li>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

const CAPS = [
  {
    t: "Freight forecasting",
    d: "Lane-level weekly curves with honest uncertainty bands, not single-point predictions.",
    to: "/market",
  },
  {
    t: "Disruption risk",
    d: "Anchorage queues, pilotage windows and cyclone seasons combined into a ranked driver list.",
    to: "/dashboard",
  },
  {
    t: "Scenario lab",
    d: "Shock freight, bunkers, congestion and fleet supply — and watch the recommendation move.",
    to: "/scenarios",
  },
  {
    t: "Portfolio strategy",
    d: "Balance spot, short- and medium-term cover against cost variance and idle days.",
    to: "/strategy",
  },
  {
    t: "Nirnay assistant",
    d: "A specialist analyst you can question in plain language about any lane or decision.",
    to: "/assistant",
  },
  {
    t: "Contracts & audit",
    d: "Fixture records and a decision trail ready for role-based controls from the backend.",
    to: "/contracts",
  },
];

function Capabilities() {
  return (
    <section id="capabilities" className="scroll-mt-16 border-b border-[#24485C] bg-[#0D2233]">
      <div className="mx-auto max-w-[1440px] px-5 py-28 sm:px-8 md:py-36 lg:px-12">
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow index="02">Capabilities</Eyebrow>
            <h2 className="text-display mt-8 max-w-3xl text-[2.4rem] sm:text-5xl lg:text-[3.4rem] text-[#F3EEE5]">
              A chartering desk,{" "}
              <span className="serif-accent font-normal text-[#F2B653]">instrumented.</span>
            </h2>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#F2B653] hover:text-[#F5C26B]"
          >
            Open the Command Center <ArrowRight className="size-4" />
          </Link>
        </Reveal>

        <div className="mt-20 grid gap-4 lg:grid-cols-12">
          <Reveal className="group relative min-h-[420px] overflow-hidden rounded-md lg:col-span-7 lg:row-span-2 lg:min-h-[560px]">
            <img
              src={portTerminal}
              alt="Coal discharge terminal under sodium lights at night"
              loading="lazy"
              className="absolute inset-0 size-full object-cover transition-transform duration-[1.6s] ease-out group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#081827] via-[#081827]/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10">
              <p className="text-eyebrow text-[#35BFC3]">Vessel / port feasibility</p>
              <p className="mt-4 max-w-md text-2xl font-semibold tracking-tight sm:text-3xl text-[#F3EEE5]">
                Know which ship fits the berth before you fix it.
              </p>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[#D8E2E8]/85">
                Draft, LOA, beam and DWT limits checked for six classes at five ports — with
                lightering costed where it's the only way in.
              </p>
            </div>
          </Reveal>
          <Reveal
            delay={0.1}
            className="relative min-h-[300px] overflow-hidden rounded-md lg:col-span-5"
          >
            <img
              src={aerialHolds}
              alt="Aerial view of open cargo holds loaded with coal"
              loading="lazy"
              className="absolute inset-0 size-full object-cover object-[50%_35%]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#081827]/90 to-transparent" />
            <div className="relative p-8 sm:p-10">
              <p className="text-eyebrow text-[#F2B653]">Landed cost</p>
              <p className="mt-4 max-w-[16rem] text-2xl font-semibold tracking-tight text-[#F3EEE5]">
                Every dollar per tonne, itemised.
              </p>
            </div>
          </Reveal>
          <Reveal
            delay={0.15}
            className="surface-ink rounded-md p-8 sm:p-10 lg:col-span-5 border-[#24485C] bg-[#15364A]"
          >
            <p className="text-eyebrow text-[#35BFC3]">Decision output</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Charter now", "Wait", "Split 60 / 40"].map((d, i) => (
                <span
                  key={d}
                  className={cn(
                    "text-eyebrow rounded-sm px-2.5 py-1 text-[0.65rem] font-bold tracking-wider",
                    i === 0
                      ? "bg-[#F2B653] text-[#081827] shadow-[0_2px_8px_rgba(242,182,83,0.35)]"
                      : i === 1
                        ? "bg-[#15364A] border border-[#24485C] text-[#F3EEE5]"
                        : "bg-[#35BFC3] text-[#081827] shadow-sm",
                  )}
                >
                  {d}
                </span>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-[#D8E2E8]">
              Recommendation, confidence, forecast range and the risks that would change it — in one
              report a desk lead can sign.
            </p>
          </Reveal>
        </div>

        <div className="mt-20 grid gap-4 border-t border-[#24485C] pt-14 sm:grid-cols-2 lg:grid-cols-3">
          {CAPS.map((c, i) => {
            return (
              <Reveal key={c.t} delay={(i % 3) * 0.08}>
                <Link
                  to={c.to}
                  className="group flex flex-col justify-between h-full rounded-lg border border-[#24485C] bg-[#15364A] p-6 transition-all duration-300 hover:border-[#F2B653] hover:shadow-deep"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[0.7rem] font-bold px-2 py-0.5 rounded border border-[#F2B653]/40 bg-[#0D2233] text-[#F2B653]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <ArrowUpRight className="size-4 text-[#D8E2E8] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#F2B653]" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold tracking-tight text-[#F3EEE5] group-hover:text-[#F2B653] transition-colors">
                      {c.t}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-[#D8E2E8]">{c.d}</p>
                  </div>
                  <div className="mt-6 flex items-center gap-1.5 font-mono text-[0.68rem] text-[#F2B653] font-semibold opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span>Open workspace</span>
                    <ArrowRight className="size-3" />
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Ports() {
  return (
    <section id="ports" className="scroll-mt-16 border-b border-[#24485C] bg-[#081827]">
      <div className="mx-auto max-w-[1440px] px-5 py-28 sm:px-8 md:py-36 lg:px-12">
        <div className="grid gap-16 lg:grid-cols-12">
          <Reveal className="lg:col-span-5">
            <Eyebrow index="03">East Coast India</Eyebrow>
            <h2 className="text-display mt-8 text-[2.4rem] sm:text-5xl lg:text-[3.4rem] text-[#F3EEE5]">
              Five ports,{" "}
              <span className="serif-accent font-normal text-[#F2B653]">five constraints.</span>
            </h2>
            <p className="text-body-lead mt-8 max-w-md text-[#D8E2E8]">
              From Gangavaram's 21 m deep-water berths to Haldia's riverine dock on the Hooghly, the
              port decides the ship as much as the cargo does.
            </p>
            <div className="mt-8 flex items-center gap-2 text-xs text-[#D8E2E8]/70">
              Terminal specifications — permissible draft limits subject to port tidal notices.
            </div>
          </Reveal>
          <Reveal delay={0.1} className="lg:col-span-7">
            <div className="surface-ink overflow-hidden rounded-md p-2 sm:p-4 border-[#24485C] bg-[#0D2233]">
              <RouteMap
                title="Discharge ports on the East Coast of India"
                viewBox="230 50 220 160"
                showOriginLabels={false}
                showGraticule={false}
                vessels={false}
                labelScale={0.62}
                lanes={[
                  { origin: "AUS_QLD", port: "PRDP" },
                  { origin: "AUS_NSW", port: "GGVM" },
                  { origin: "IDN_KAL", port: "HLDA" },
                ]}
              />
            </div>
          </Reveal>
        </div>
        <div className="no-scrollbar -mx-5 mt-16 flex snap-x gap-px overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
          {PORTS.map((p, i) => {
            const isShallow = p.maxDraftM < 10;
            const isDeep = p.maxDraftM >= 17.5;
            const barPct = Math.min(100, Math.round((p.maxDraftM / 20) * 100));

            return (
              <Reveal
                key={p.code}
                delay={i * 0.06}
                className="min-w-[240px] snap-start border-l border-[#24485C] pl-5 sm:min-w-0 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[0.65rem] text-[#D8E2E8]/70">{p.code}</p>
                    <span
                      className={cn(
                        "font-mono text-[0.58rem] px-1.5 py-0.5 rounded uppercase border font-medium",
                        isShallow
                          ? "border-[#E87945]/50 bg-[#E87945]/15 text-[#E87945]"
                          : isDeep
                            ? "border-[#35BFC3]/60 bg-[#35BFC3]/20 text-[#35BFC3]"
                            : "border-[#24485C] bg-[#15364A] text-[#F3EEE5]",
                      )}
                    >
                      {isShallow ? "Lightering" : isDeep ? "Cape Direct" : "Tidal / Shortload"}
                    </span>
                  </div>

                  <p className="mt-2 text-lg font-semibold text-[#F3EEE5]">{p.name}</p>
                  <p className="text-xs text-[#D8E2E8]/70">{p.state}</p>

                  {/* Waterline visualizer */}
                  <div className="mt-4 space-y-1">
                    <div className="flex justify-between text-[0.62rem] font-mono text-[#D8E2E8]">
                      <span>Permissible Draft</span>
                      <span className="font-semibold text-[#F3EEE5]">
                        {p.maxDraftM.toFixed(1)} m
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-[#0D2233] rounded-full overflow-hidden border border-[#24485C]">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          isShallow ? "bg-[#E87945]" : isDeep ? "bg-[#35BFC3]" : "bg-[#F2B653]",
                        )}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>

                  <dl className="mt-5 space-y-2 font-mono text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#D8E2E8]/70">Max DWT</dt>
                      <dd className="text-[#F3EEE5]">{fmtInt(p.maxDwt / 1000)}k</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#D8E2E8]/70">Discharge</dt>
                      <dd className="text-[#F3EEE5]">{fmtInt(p.dischargeRateTpd / 1000)}k t/d</dd>
                    </div>
                  </dl>

                  <p className="mt-4 pr-4 text-xs leading-relaxed text-[#D8E2E8]/70">
                    {p.notes}
                  </p>
                </div>

                <div className="pt-6">
                  <Link
                    to="/feasibility"
                    className="inline-flex items-center gap-1 font-mono text-[0.65rem] text-[#35BFC3] hover:text-[#50D5D9] transition"
                  >
                    <span>Inspect clearance checks</span>
                    <ArrowUpRight className="size-3" />
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
