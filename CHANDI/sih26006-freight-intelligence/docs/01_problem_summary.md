# Problem Summary — SIH26006
**Intelligent Freight Forecasting Model for Optimized Vessel Chartering and Bulk Cargo Procurement**
*Ministry of Steel · SAIL · Smart India Hackathon 2026*

---

## 1. Problem in Plain English

SAIL imports bulk cargo (primarily coking coal) from overseas origins — Australia, the USA, Mozambique, Russia, and Indonesia — and ships it to India's East Coast ports. International freight rates are highly volatile, driven by global supply-demand shifts, seasonal cycles, commodity prices, and trade-route dynamics. SAIL currently monitors the market daily and reacts to spot opportunities rather than forecasting ahead, which exposes it to unfavorable charter rates and prevents systematic procurement planning. Additionally, matching the right vessel class to a cargo parcel and a destination port's physical constraints (draft, LOA, beam, berthing capacity) is done manually, leading to avoidable operational delays, idle time, and cost overruns.

---

## 2. Who Is the User

**Role:** Logistics Manager / Vessel Chartering Officer at SAIL (Steel Authority of India Limited), reporting into supply-chain or procurement operations.

**Daily work:**
- Monitors live freight-rate markets (Baltic indices, broker reports) every day.
- Evaluates spot or short-term vessel-charter offers from shipbrokers across multiple routes.
- Matches cargo parcels to available vessel types while checking port infrastructure compatibility.
- Coordinates procurement schedules with steel-plant intake requirements at East Coast ports (Paradip, Vizag, Gangavaram, Gopalpur, Dhamra, Sagar-Sandheads, Haldia).
- Escalates chartering decisions that carry high cost exposure.

---

## 3. The Decision They Struggle With Today

**Core decision:** *When* to lock in a charter contract, *which vessel class* to use, and *on which route* — for each cargo parcel.

**Why it is hard:**

| Factor | Difficulty |
|---|---|
| **Rate volatility** | Freight rates fluctuate daily due to global economic conditions, seasonal demand, commodity prices, and trade-route dynamics — no single indicator predicts direction reliably. |
| **Long lead times** | Bulk cargo voyages from Australia, Mozambique, or the US Gulf span weeks; a wrong entry timing cannot be corrected quickly. |
| **Many vessel options** | Four vessel classes (Handysize, Supramax, Panamax, Capesize), each with different economics and physical footprints — not all fit every port. |
| **Port constraint matrix** | Seven Indian East Coast ports each have distinct draft, LOA, beam, berthing, and cargo-handling limits; a commercially attractive vessel may be operationally ineligible. |
| **Information fragmentation** | Market signals, port congestion data, seasonal trends, and vessel availability all come from separate sources with no unified view. |

Without forecasts, the manager cannot distinguish a temporarily low rate from the beginning of a sustained rise, so they default to reactive spot contracts at whatever the market offers today.

---

## 4. What the System Must Do
*(derived strictly from PS Section 4)*

- **Forecast freight rates** for different vessel types and shipping routes using AI/ML and time-series / regression techniques.
- **Recommend optimal market-entry windows** — suitable periods to secure short-term or medium-term charter contracts — to reduce freight expenses and avoid unfavorable contract timing.
- **Recommend vessel class** (Handysize / Supramax / Panamax / Capesize) based on cargo volume, origin–destination route, and physical port limitations at both loading and discharge ports.
- **Anticipate low-demand / idle periods** and suggest actions to minimize vessel idle time, including alternative cargo employment and efficient vessel positioning (avoid deadheading).
- **Deliver risk alerts and early warnings** for freight-market volatility, port congestion, and supply-chain disruptions so managers can evaluate alternatives before costs escalate.
- **Provide a user-facing dashboard** where managers can input cargo requirements, port pair, and contract duration, and receive freight forecasts, vessel recommendations, risk alerts, and chartering insights.
- **Ingest multiple data streams:** historical freight rates, global market indicators, seasonal trends, port congestion feeds, and port infrastructure data (draft, LOA, beam, berthing, cargo-handling rates) for both loading and discharge ports.

---

## 5. What Success Looks Like
*(measurable targets — ranges below are inferred from the PS intent; see Section 7 for caveats)*

| Metric | Target |
|---|---|
| **Freight-rate forecast accuracy** | MAPE ≤ 10 % on a 4-week-ahead horizon across key routes |
| **Contract-timing improvement** | Average charter cost per tonne lower than SAIL's trailing 12-month spot average |
| **Vessel idle time reduction** | Measurable decrease in vessel waiting / idle time reported at East Coast ports |
| **Decision speed** | Chartering recommendation generated within minutes of a manager submitting cargo parameters (vs. hours of manual research today) |
| **Spot-to-term contract shift** | Increase in proportion of multi-voyage / medium-term contracts relative to individual spot contracts |
| **Alert lead time** | Risk warnings issued with sufficient lead time for the manager to act (PS implies "before problems become costly"; we target ≥ 5 business days) |

---

## 6. Ambiguities in the PS

| # | Question | Status |
|---|---|---|
| 1 | **Forecast horizon:** PS says "short-term or medium-term" without defining durations. | ✅ **Resolved** — 4-week primary horizon adopted (see Section 7). |
| 2 | **Specific freight indices:** No named data sources given. Which indices does SAIL subscribe to? | ⏳ **Pending SAIL confirmation.** Working assumption: BCI (Capesize), BPI (Panamax), BSI (Supramax), BHSI (Handysize) from Baltic Exchange. BDI used as composite benchmark only, not as a route-level forecast input. |
| 3 | **Historical data availability:** Will SAIL share internal chartering records? | ⏳ **Pending SAIL confirmation.** If provided, request fields: contract date, origin port, destination port, vessel class, cargo quantity (MT), freight rate (USD/MT or lumpsum), contract duration. MVP will not depend on receiving this data. |
| 4 | **Port infrastructure data format:** Is a structured dataset available or must we build one? | ⏳ **Pending SAIL confirmation.** If unavailable, we will build a reference table from verified port-authority sources. Required fields: max draft, max LOA, max beam, berth count/restrictions, cargo-handling capacity (MT/day), source, and verification date. Missing values will be flagged explicitly — never guessed. |
| 5 | **AIS / live vessel-tracking:** In scope or out? | ✅ **Resolved** — Out of scope for MVP. Future enhancement only. |
| 6 | **Decision authority:** Advisory vs. automated contract execution? | ✅ **Resolved** — Advisory only. All recommendations require human approval before any action. |
| 7 | **Idle-time ownership:** SAIL charters, not owns, vessels. Scope of "idle time" suggestions? | ⏳ **Open.** Interpreted as advisory contract-timing guidance (avoid chartering into known low-demand periods) rather than real-time fleet-dispatch optimization. |
| 8 | **Quantitative success criteria / baseline:** No KPIs or historical cost data provided. | ⏳ **Pending SAIL confirmation.** Request: historical freight expenditure, average freight cost per tonne or per voyage, demurrage records, and vessel-utilization metrics. Until confirmed, prototype will report forecast accuracy and *simulated* savings against a clearly defined public-data benchmark. Simulated savings ≠ actual SAIL savings. |
| 9 | **Geographic scope of loading ports:** No specific ports listed for origin countries. | ⏳ **Open.** Specific loading ports within Australia, USA, Mozambique, Russia, Indonesia to be identified during data-collection phase using verified port directories. |
| 10 | **Regulatory / contractual constraints:** Existing charter-party frameworks or procurement rules? | ⏳ **Open.** System will not encode procurement rules until SAIL confirms applicable constraints. |

---

## 7. Assumptions We Are Making to Proceed

### Finalized Scope (agreed)

1. **Forecast horizon:** **4-week primary horizon.** Longer-horizon views (8 weeks, 12 weeks) are a future enhancement, not MVP scope.
2. **Data sources:** Begin with legally accessible Baltic dry-bulk sub-indices (BCI, BPI, BSI, BHSI) and other verified public market data. SAIL internal chartering history will be integrated if provided, but the MVP is not dependent on it.
3. **System mode:** **Advisory only.** The system recommends chartering windows, vessel classes, and risk-mitigation actions. It does not execute or trigger contracts automatically.
4. **Vessel classes:** Exactly four, as specified in the PS — **Handysize, Supramax, Panamax, Capesize.** No others.
5. **East Coast ports:** Exactly seven, as named in the PS — **Paradip, Vizag, Gangavaram, Gopalpur, Dhamra, Sagar-Sandheads, Haldia.** No scope expansion.
6. **AIS / live vessel-tracking:** **Out of scope** for MVP. Revisit only if a suitable free/licensed feed becomes available.

### Pending SAIL Confirmation (blocking future work)

| Item | Impact if not resolved |
|---|---|
| Which freight indices SAIL uses | May miss route-relevant data; mitigated by using all four Baltic sub-indices as default. |
| Anonymized internal chartering history | Model will be trained on public data only; route-specific accuracy may be lower. |
| Port-infrastructure dataset | Team must build reference table manually from public sources; adds data-prep effort. |
| Historical cost / operational baseline | Cannot claim verified savings; prototype will report simulated savings with explicit caveats. |

### Permanent Caveats

- Any cost-saving figure produced by the prototype is a **simulation against a public-data benchmark**, not a verified reduction in SAIL's actual expenditure.
- Port-infrastructure values sourced from public port-authority data will carry an explicit **source and verification date**; gaps will be flagged, never estimated silently.
- Forecast accuracy targets (e.g., MAPE ≤ 10 % at 4 weeks) are design goals, subject to the quality and coverage of available training data.
