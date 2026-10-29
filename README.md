# Navik Freight Compass

Build a complete, visually stunning frontend prototype for NAVIK, an intelligent freight forecasting and vessel chartering decision-support platform for Smart India Hackathon 2026. This is frontend-only. Do not add Supabase, Firebase, a database, or a new backend. Create a clean frontend API adapter with a configurable backend base URL and typed service functions so a teammate can connect the existing Python backend later. Until then, use realistic, clearly labeled demo fixture data, and make the UI honest about demo/simulated data.

CRITICAL ART DIRECTION: The user explicitly chose CINEMATIC MARITIME, not a plain white dashboard. Aim for an award-winning premium editorial maritime intelligence product: atmospheric deep charcoal / midnight ocean / ink backgrounds, photographic bulk-carrier imagery, subtle warm copper / rust / brass accents, muted sea-glass greens, high-contrast typography, beautiful layered map/route visuals, carefully composed asymmetrical layouts, large cinematic visual moments, tasteful gradients derived from ocean light, fine grain and contour-line texture, restrained glass only where it adds depth. Avoid generic AI SaaS styling, default blue neon, purple gradients, glowing cyan borders, repeated same-size cards, robot iconography, bland template layouts and excessive rounded cards. Use sophisticated warm white/ivory only for selected content surfaces and contrast, not as a plain all-white theme. Visual identity should feel like an international maritime intelligence house / luxury shipping terminal / cinematic data newsroom.

Make motion a signature: smooth page transitions, scroll-triggered reveals, animated shipping route paths and moving vessel markers, subtle parallax on the hero ship/globe, chart transitions, hover depth, responsive nav transitions, micro-interactions on inputs, elegant loading sequences, animated progress across the decision pipeline, and polished scenario comparison transitions. Keep animation performant and purposeful, honor prefers-reduced-motion, and don't make everything pulse. Use Framer Motion and, where feasible without hurting reliability, a lightweight Three.js/React Three Fiber maritime globe or 3D scene. Prefer strong, high-quality maritime imagery plus custom SVG/canvas route visuals over an unfinished heavy 3D scene. Must work on desktop and mobile.

PRODUCT / INFORMATION ARCHITECTURE:

1. Public landing page /: cinematic full-viewport hero with large bulk carrier at sea, subtle animated route arcs between Australia and East Coast of India, labels for Paradip, Visakhapatnam, Gangavaram, Dhamra and Haldia, compact data overlays clearly marked as demo, headline “Predict. Optimize. Navigate.”, supporting line “Turning global maritime complexity into smarter, faster charter decisions.” Primary CTA “Enter Command Center”, secondary “Explore the Intelligence”. Then sections showing workflow (Forecast → Assess Risk → Validate Feasibility → Optimize → Decide), capabilities, and a final CTA. Make the landing page art-directed, dramatic and immersive, with strong composition and responsive typography.
2. Main application shell at /dashboard with collapsible sidebar, slim top bar, NAVIK brand, compact environment/status indicator and user avatar placeholder. Routes: /dashboard, /charter, /market, /feasibility, /scenarios, /strategy, /assistant, /contracts, /audit. All navigation must work. No real authentication implementation required; don't invent backend auth.
3. Dashboard: elegant command center with strong headline, New Charter Analysis CTA, asymmetric KPI strip, market snapshot, interactive freight trend chart, atmospheric route map / route canvas, risk alerts, and recent decisions demo list. Mark fixture-backed content with a discreet DEMO DATA or SIMULATED label.
4. Charter Decision Workspace /charter: core user journey. Cargo intake form with cargo tonnage, origin region, destination port, delivery deadline and contract preference. Create a guided flow and interactive validation. After submit, animate through stages: Freight Forecast, Disruption Risk, Vessel/Port Feasibility, Logistics Cost, Optimization. Then render a polished decision report: CHARTER_NOW / WAIT / SPLIT recommendation, vessel/route/port when available, estimated freight, total cost, risk level, confidence and forecast range, feasibility and rejected vessel reasons, split percentage when relevant, reasoning and key risk drivers. Demo output must clearly say “Simulated demo result — not a live backend prediction.” Structure types and API adapter so backend wiring later is easy. Do not claim actual model inference occurs.
5. Freight Market /market: filterable historical freight chart with origin selector, timeframe controls, trend, bunker prices, congestion indicators and data-source/freshness labels. Use interactive charts, tooltips, chart transitions. Use plausible illustrative fixture values labeled demo.
6. Fleet & Port Feasibility /feasibility: vessel-class comparison table, capacity/specs, port constraints, suitability/feasibility status, reasons for rejection, port detail drawer. No fabricated live AIS positions.
7. Scenario Lab /scenarios: functional controls for freight-rate shock, congestion, bunker fuel price and fleet availability; presets such as Base / Cost Pressure / Port Disruption if mapped to illustrative simulation; run scenario; compare baseline and simulated result with clear delta visualizations and updated simulated recommendation. Preserve baseline and never call simulated results real backend outputs.
8. Portfolio & Repositioning /strategy: conservative/balanced/aggressive risk preference presets, allocation chart for spot/short-term/medium-term, expected cost, variance, vessel idle time and opportunity lanes; demo labels.
9. Nirnay assistant /assistant: polished specialist maritime analyst chat UI with working local demo replies and suggested prompts, clearly label local demo assistant until backend is connected.
10. Contract records /contracts: functional frontend-only contract entry form and demo records. Label local demo mode. Mention role enforcement will be handled by backend once connected.
11. Audit /audit: filterable demo audit table with timestamp, action, entity and actor; mark demo. Do not imply real audit records.

DESIGN SYSTEM:

- Midnight ocean #101B1D / #121C1B; deep ink #18211F; muted sea green #637C6B; oxidized copper #BC704F; brass #C3A36B; warm fog #E9E4D9; off-white #F7F4ED; muted slate text. Avoid neon blue.
- Strong display typography (e.g. Manrope / DM Sans plus an editorial serif accent like DM Serif Display or Cormorant Garamond used selectively), clean UI sans, tabular numerals/mono for metrics.
- Strong typography, subtle borders, rich image crops, contrast, editorial captions, thin dividers, open space, non-uniform panel composition. Use cards only where they help hierarchy.
- Make dashboard and analytics visually rich and legible, with selected dark canvas panels and warm paper surfaces for forms/data tables. Keep contrast accessible.
- Build custom SVG route graphics with animated paths and markers, small maritime iconography, elegant chart treatments, rich but restrained transitions.
- Use Lucide icons. Use responsive desktop sidebar and mobile drawer/bottom nav appropriately.
- Avoid lorem ipsum. All copy should be polished and specific to maritime intelligence.
- Make all buttons, filters, selectors, tabs, modals and forms genuinely interactive, with useful empty/loading/error/success states. Use demo fixture adapters for the prototype; centralize fixtures and API calls in src/lib/api or equivalent.
- Add a Demo environment indicator and a clear configurable API base URL in the API client. Do not expose secrets. Keep backend integration straightforward.
- No backend source or model logic should be created.

IMPLEMENTATION QUALITY:

- Build all routes and shared shell, not just a landing-page mockup.
- Use TypeScript, reusable components, consistent design tokens and clean component structure.
- Charts must be interactive and have meaningful tooltips/labels/units.
- Ensure build succeeds, no missing imports, no dead buttons, no broken routes, no horizontal overflow at desktop/tablet/mobile sizes.
- Include reduced-motion support and keyboard-accessible interactions.
- Start by creating the design system and complete landing page + command center shell, then implement the charter workflow and all remaining routes. The output should be a highly polished working frontend prototype suitable for a hackathon demo, with a clean separation from the future backend.

## Development & Operations

### Prerequisites

- Node.js (>= 20.x recommended)
- npm or bun

### Setup

```sh
npm install
```

### Local Development

```sh
npm run dev
```

Starts the Vite development server with hot module replacement at `http://localhost:8080/`.

### Run Test Suite

```sh
npm run test
```

Executes the comprehensive Vitest test suite.

### Production Build

```sh
npm run build
```

Builds the client bundle and TanStack Start Nitro server output for production deployment.

### Lint & Formatting

```sh
npm run lint
npm run format
```
