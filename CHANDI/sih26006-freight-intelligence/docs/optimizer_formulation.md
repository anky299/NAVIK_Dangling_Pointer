# MILP Formulation — Steel Plant Raw-Material Shipping Optimizer
## SIH26006 · SAIL East Coast Procurement · Monthly Planning (Version 1)

> **Status**: Model formulation only. No solver code. All parameters marked **[synthetic]** or *(verify)* must be replaced with real SAIL operational data before production use.
>
> **Scope (v1)**: Coking coal and thermal coal only. Iron ore, limestone, and dolomite are deferred to §10 (Future Scope).
>
> **Rolling-horizon note**: All decisions are shared across scenarios (here-and-now). Only month-1 decisions are executed. The model re-runs with updated forecasts and realised inventory each month. Scenario-robustness disciplines the full plan; only the first month commits real resources.

---

## 0. Plain-English Summary

SAIL's blast furnaces on India's East Coast need a steady feed of coking coal and thermal coal sourced from multiple origins and delivered through six ports (Visakhapatnam, Paradip, Gangavaram, Haldia, Dhamra, Krishnapatnam). Every month, the planner must decide:

1. **How much** of each cargo to ship from each origin, and through which port.
2. **Which vessel class** to use on each route — constrained by port draft eligibility from `config/routes.yaml`.
3. **Charter mode per voyage**: spot (voyage cost charged per vessel call), COA (contracted rate per tonne, minimum volume commitment), or period (voyage cost is bunker + port only; hire is paid through the vessel-class pool variable $k_{v,t}$).
4. **How much inventory** to hold at each port so production is never starved but capital is not wasted.

Freight is charged per **voyage** for spot and period; per tonne for COA. The model is evaluated across three BDI scenarios (low / base / high); the default run minimises the scenario-weighted average cost. Only month-1 decisions are executed before re-running.

---

## 1. Sets

| Symbol | Description |
|--------|-------------|
| $\mathcal{C}$ | **Cargoes (v1)** — {coking\_coal, thermal\_coal} |
| $\mathcal{O}$ | **Origins** — see §1.1; cargo–origin eligibility enforced via $\mathcal{O}(c)$ |
| $\mathcal{P}$ | **Destination ports** — {Visakhapatnam, Paradip, Gangavaram, Haldia, Dhamra, Krishnapatnam} |
| $\mathcal{V}$ | **Vessel classes** — {Handysize, Supramax, Panamax, Capesize} |
| $\mathcal{T}$ | **Months** — $\{1, 2, \ldots, T\}$, planning horizon |
| $\mathcal{M}$ | **Charter modes** — {spot, COA, period} |
| $\mathcal{S}$ | **Freight scenarios** — {low, base, high} (BDI percentile bands from the GBM forecast) |
| $\mathcal{R}$ | **Feasible route triples** — $(o, p, v)$ where $v \in$ `eligible_vessel_classes` for route $(o,p)$ in `config/routes.yaml` and port draft is satisfied. $|\mathcal{R}| = 121$ (HMP\_HLD excluded — no eligible vessel class). |

### 1.1 Cargo–Origin Eligibility ($\mathcal{O}(c)$)

Sourcing restricted to pairs confirmed in `docs/02_scope.md`. Brazil and South Africa are listed as pending SAIL confirmation.

| Cargo $c$ | Eligible Origins $\mathcal{O}(c)$ | Notes |
|-----------|----------------------------------|-------|
| coking\_coal | Hay Point (AUS), Newcastle (AUS), Hampton Roads (USA), Nacala (MOZ), Beira (MOZ), Vanino (RUS) | Scope-confirmed. Brazil (Ponta da Madeira — metallurgical coal) and South Africa (Richards Bay — semi-soft coking coal) *(pending SAIL confirmation)*. |
| thermal\_coal | Newcastle (AUS), Samarinda/Taboneo (IDN) | Scope-confirmed. South Africa (Richards Bay — thermal coal) *(pending confirmation)*. |

### 1.2 Eligible-Triple Count by Vessel Class (from `config/routes.yaml`)

| Vessel Class | Eligible $(o,p,v)$ triples |
|---|:---:|
| Handysize | 25 |
| Supramax | 36 |
| Panamax | 30 |
| Capesize | 30 |
| **Total** $|\mathcal{R}|$ | **121** |

---

## 2. Parameters

### 2.1 Demand and Supply

| Symbol | Dimension | Description |
|--------|-----------|-------------|
| $d_{c,t}$ | $c \in \mathcal{C},\ t \in \mathcal{T}$ | Aggregate monthly demand for cargo $c$ in month $t$ (tonnes, all SAIL East Coast plants). **[synthetic]** |
| $\alpha_{c,p}$ | $c \in \mathcal{C},\ p \in \mathcal{P}$ | Fraction of total demand for cargo $c$ delivered through port $p$; $\sum_p \alpha_{c,p} = 1$ for each $c$. **[synthetic — decision for SAIL; see §8]** |
| $\text{supcap}_{o,c,t}$ | | Maximum tonnes procurable from origin $o$ for cargo $c$ in month $t$. **[synthetic]** |
| $\text{price}_{c,o,t}$ | | FOB cargo price (USD/tonne). **[synthetic — Argus/Platts proxy]** |
| $\text{qpen}_{c,o}$ | | Quality penalty (USD/tonne) relative to SAIL benchmark spec. **[synthetic]** |

### 2.2 Freight and Vessel

| Symbol | Dimension | Description |
|--------|-----------|-------------|
| $H_{v,t,s}$ | $v \in \mathcal{V},\ t \in \mathcal{T},\ s \in \mathcal{S}$ | **Daily spot hire rate** (USD/day) derived from GBM BDI forecast via index-to-hire factors in `config/routes.yaml`. Scenario-specific. |
| $F_{o,p,v,t,s}$ | $(o,p,v) \in \mathcal{R}$ | **Bunker cost per voyage** (USD): $\text{fuel\_tpd}_v \times D_{o,p,v} \times \text{bunker\_price}_{t,s}$. Scenario-specific via bunker price. |
| $\Pi_{o,p}$ | | **Port cost per voyage** (USD): sum of load and discharge port costs from `config/routes.yaml`. Scenario-invariant. |
| $D_{o,p,v}$ | $(o,p,v) \in \mathcal{R}$ | **Round-trip voyage days**: $2 \times \frac{\text{distance\_nm}_{o,p}}{\text{speed\_knots}_v \times 24} + \text{load\_days}_o + \text{discharge\_days}_p$. *(verify)* |
| $Q_v$ | $v \in \mathcal{V}$ | Parcel size (tonnes): Handysize 30,000 · Supramax 52,000 · Panamax 70,000 · Capesize 155,000. *(verify)* |
| $\text{draft\_ok}_{p,v}$ | | Binary: 1 if vessel class $v$ satisfies max permissible draft at port $p$. Defines $\mathcal{R}$. |
| $\text{lt}_{o,p,v}$ | | **Lead time** (whole months, ceiling): $\lceil \text{distance\_nm}_{o,p} / (\text{speed\_knots}_v \times 24 \times 30) \rceil$. *(verify)* |
| $\text{berthcap}_{p,t}$ | | Max discharge throughput at port $p$ in month $t$ (tonnes). **[synthetic]** |

### 2.3 Voyage Cost (Per Voyage, Not Per Tonne)

The **all-in spot voyage cost** for one vessel call on route $(o,p,v)$ in month $t$ under scenario $s$:

$$
\text{VC}^{\text{spot}}_{o,p,v,t,s} = H_{v,t,s} \times D_{o,p,v} + F_{o,p,v,t,s} + \Pi_{o,p}
$$

The **period voyage cost** excludes hire (hire is paid via $Z_{\text{period}}$ through $k_{v,t}$):

$$
\text{VC}^{\text{period}}_{o,p,v,t,s} = F_{o,p,v,t,s} + \Pi_{o,p}
$$

For reporting only, the **per-tonne freight rate** is:

$$
\text{fr}_{o,p,v,t,s} = \frac{\text{VC}^{\text{spot}}_{o,p,v,t,s}}{Q_v} \quad \text{(reporting only — not in the objective)}
$$

### 2.4 Charter Rates

| Symbol | Description |
|--------|-------------|
| $H^{\text{spot}}_{v,t,s}$ | Spot daily hire rate under scenario $s$; equals $H_{v,t,s}$ from §2.2. |
| $H^{\text{period}}_{v,t}$ | Period time-charter daily hire rate locked in at month $t$ for vessel class $v$. Defined as the trailing 12-week average of the combined hire-rate series: actual historical rates for weeks already elapsed, and the base-forecast GBM rates for any remaining weeks within the 12-week window that fall in future months. No discount applied by default. Any discount is a planner-supplied scenario input, not a baseline assumption. **[synthetic — derived from BDI forecast output]** |
| $r^{\text{COA}}_{o,p,v}$ | COA lumpsum freight rate (USD/tonne). Set to the trailing 12-week average per-tonne spot voyage cost $\overline{\text{fr}}_{o,p,v}$ at decision time (same anchoring method as $H^{\text{period}}$). No COA discount in baseline; any discount is a scenario input. **[synthetic]** |
| $\text{vol}^{\text{COA,min}}_{o,p,v}$ | Minimum total volume per COA contract over the planning horizon (tonnes). **[synthetic]** |
| $\Delta^{\text{period}}_v$ | Minimum period charter duration for vessel class $v$ (months). **[synthetic]** — assume 3 months. |

### 2.5 In-Transit Cargo and Terminal Inventory Requirements

| Symbol | Description |
|--------|-------------|
| $\text{transit}_{c,p,t}$ | Tonnes of cargo $c$ already at sea and scheduled to arrive at port $p$ in month $t$, where $t \leq \max_{(o,p,v) \in \mathcal{R}} \text{lt}_{o,p,v}$. Fixed parameter from existing fixture records. Default (prototype): set to the steady-state pipeline implied by demand — i.e., $\alpha_{c,p} \times d_{c, t-\text{lt}}$ using a representative lead time, scaled so arrivals match prior-month demand. **[synthetic — must be replaced with SAIL fixture data before production use]** |
| $I^{\min}_{c,p,T}$ | Terminal inventory floor at port $p$, end of horizon: $I^{\min}_{c,p,T} = \tfrac{30}{30.5} \times \alpha_{c,p} \times d_{c,T}$. Prevents end-of-horizon drawdown. |

### 2.6 Inventory and Risk

| Symbol | Description |
|--------|-------------|
| $h_c$ | Inventory holding cost (USD/tonne/month). **[synthetic]** |
| $\text{invcap}_{c,p}$ | Maximum inventory at port $p$ for cargo $c$ (tonnes). **[synthetic]** |
| $I_{c,p,0}$ | Initial inventory at port $p$ for cargo $c$ at start of horizon. **[synthetic]** |
| $\text{dem}$ | Demurrage cost rate (USD/day). *(verify)* — placeholder USD 18,000/day. |
| $\delta_{o,p,v}$ | Expected delay days per voyage. **[synthetic]** — placeholder 1.5 days. |
| $\text{railcost}_{p,\text{plant}}$ | **Optional**: rail/road transport cost (USD/tonne) from port $p$ to plant. **[synthetic — decision for SAIL; see §8]** |

### 2.7 Route-Specific Bounds (replacing global Big-M)

| Bound | Formula | Used in |
|-------|---------|---------|
| $N^{\max}_{c,o,p,v,t}$ | $\lceil \text{supcap}_{o,c,t} / Q_v \rceil$ — max voyages for cargo $c$ on route given supply cap | §5.3, §5.6 |
| $X^{\max}_{c,o,p,v,t}$ | $N^{\max}_{c,o,p,v,t} \times Q_v$ — max tonnes of cargo $c$ on route | §5.3, §5.6 |
| $K^{\max}_{v}$ | $\lceil \max_t(\sum_{c,o,p:(o,p,v)\in\mathcal{R}} N^{\max}_{c,o,p,v,t}) \times \overline{D}_v / 30 \rceil$ — max period-chartered vessels of class $v$, where $\overline{D}_v$ is the mean round-trip duration across all routes for class $v$ | §5.4 |

---

## 3. Decision Variables

Mode-specific tonnes and voyage counts replace the previous $y/z/\nu/\xi$ auxiliary structure. All variables are defined for each mode $m \in \mathcal{M}$, cargo $c \in \mathcal{C}$ with $o \in \mathcal{O}(c)$, route $(o,p,v) \in \mathcal{R}$, and month $t \in \mathcal{T}$.

| Variable | Type | Description |
|----------|------|-------------|
| $x_{m,c,o,p,v,t}$ | Continuous $\geq 0$ | Tonnes of cargo $c$ shipped on route $(o,p,v)$ in month $t$ under charter mode $m$. |
| $n_{m,c,o,p,v,t}$ | Integer $\geq 0$ | Number of voyages of vessel class $v$ carrying cargo $c$ on route $(o,p)$ in month $t$ under mode $m$. |
| $k_{v,t}$ | Integer $\geq 0$ | Number of period time-chartered vessels of class $v$ held in month $t$ (vessel-class pool, not route-specific). |
| $I_{c,p,t}$ | Continuous $\geq 0$ | Inventory of cargo $c$ at port $p$ at end of month $t$ (tonnes). |
| $u_{c,p,t}$ | Continuous $\geq 0$ | Unmet demand for cargo $c$ at port $p$ in month $t$. Penalized heavily. |
| $\psi_{o,p,v}$ | Binary | 1 if a COA is active at any point for route $(o,p,v)$ over the horizon. |

Total tonnes shipped on route $(o,p,v)$ for cargo $c$ in month $t$ (used in §5.1, §5.2, §5.5):

$$
x_{c,o,p,v,t} \;=\; \sum_{m \in \mathcal{M}} x_{m,c,o,p,v,t}
$$

---

## 4. Objective Function

### 4.1 Scenario Cost $Z(s)$

For a given scenario $s$, total landed cost is:

$$
Z(s) = Z_{\text{cargo}} + Z_{\text{freight}}(s) + Z_{\text{period}}(s) + Z_{\text{demurrage}} + Z_{\text{inventory}} + Z_{\text{unmet}}
$$

**Cargo purchase cost** (scenario-invariant):

$$
Z_{\text{cargo}} = \sum_{c,t} \sum_{(o,p,v) \in \mathcal{R},\, o \in \mathcal{O}(c)} \bigl(\text{price}_{c,o,t} + \text{qpen}_{c,o}\bigr) \sum_{m} x_{m,c,o,p,v,t}
$$

*Every tonne purchased incurs an FOB cost and quality penalty regardless of charter mode.*

---

**Voyage freight cost** — charged per voyage (spot, period) or per tonne (COA), scenario-specific through $\text{VC}^{\text{spot}}$ and $\text{VC}^{\text{period}}$:

$$
Z_{\text{freight}}(s) = \sum_{t} \sum_{(o,p,v) \in \mathcal{R}} \sum_{c:\, o \in \mathcal{O}(c)} \Bigl[
  \text{VC}^{\text{spot}}_{o,p,v,t,s} \cdot n_{\text{spot},c,o,p,v,t}
  \;+\;
  r^{\text{COA}}_{o,p,v} \cdot x_{\text{COA},c,o,p,v,t}
  \;+\;
  \text{VC}^{\text{period}}_{o,p,v,t,s} \cdot n_{\text{period},c,o,p,v,t}
\Bigr]
$$

where:
- $\text{VC}^{\text{spot}}_{o,p,v,t,s} = H_{v,t,s} \times D_{o,p,v} + F_{o,p,v,t,s} + \Pi_{o,p}$ (full voyage cost per vessel call)
- $\text{VC}^{\text{period}}_{o,p,v,t,s} = F_{o,p,v,t,s} + \Pi_{o,p}$ (bunker + port only; hire covered by $Z_{\text{period}}$)
- COA is charged per tonne under the pre-agreed rate $r^{\text{COA}}_{o,p,v}$

*Spot freight: fixed cost per vessel call. Period freight: only variable costs per call (hire already paid in the pool). COA freight: per-tonne contracted rate applied to actual tonnes shipped.*

---

**Period charter hire cost** (vessel-class pool, scenario-specific hire rate):

$$
Z_{\text{period}}(s) = \sum_{v,t} H^{\text{period}}_{v,t} \times 30 \times k_{v,t}
$$

Note: $H^{\text{period}}_{v,t}$ is derived from the trailing 12-week average combining historical actuals and base-forecast weeks (§2.4). It does not vary by scenario — only spot hire $H_{v,t,s}$ is scenario-specific. If scenario-dependent period rates are desired, supply discount factors per scenario as inputs.

*Each period-chartered vessel costs 30 hire days per month regardless of utilisation. The model must deploy period vessels fully or avoid taking them on.*

---

**Demurrage risk cost** (scenario-invariant):

$$
Z_{\text{demurrage}} = \sum_{(o,p,v) \in \mathcal{R}} \sum_{c:\, o \in \mathcal{O}(c)} \sum_{t} \text{dem} \cdot \delta_{o,p,v} \cdot \sum_{m} n_{m,c,o,p,v,t}
$$

---

**Inventory holding cost** (port-level):

$$
Z_{\text{inventory}} = \sum_{c,p,t} h_c \cdot I_{c,p,t}
$$

---

**Unmet-demand penalty**:

$$
Z_{\text{unmet}} = \sum_{c,p,t} \text{pen}^u_c \cdot u_{c,p,t}
$$

where the penalty is computed as a formula before each solve:

$$
\text{pen}^u_c = 3 \times \max_{\substack{o \in \mathcal{O}(c),\, (o,p,v) \in \mathcal{R} \\ t \in \mathcal{T},\, s \in \mathcal{S}}} \Bigl(\text{price}_{c,o,t} + \text{qpen}_{c,o} + \text{fr}_{o,p,v,t,s}\Bigr)
$$

Three times the maximum observed landed cost over the entire horizon and all scenarios. Recalculated each run; not a fixed constant.

---

### 4.2 Optimisation Objectives

**Deterministic base run** (single scenario $s = \text{base}$):

$$
\min \quad Z(\text{base})
$$

**Mean-across-scenarios** (risk-neutral weighted average):

$$
\min \quad \sum_{s \in \mathcal{S}} w_s \cdot Z(s), \qquad w_{\text{low}} = 0.25,\; w_{\text{base}} = 0.50,\; w_{\text{high}} = 0.25 \quad \textbf{[synthetic]}
$$

**Worst-case minimax** (risk-averse):

$$
\min \; \eta \qquad \text{s.t.} \quad \eta \geq Z(s) \quad \forall\, s \in \mathcal{S}
$$

Scenario-dependence enters through $H_{v,t,s}$ (spot hire) and $F_{o,p,v,t,s}$ (bunker); cargo prices and demurrage are scenario-invariant in v1.

---

## 5. Constraints

### 5.1 Port-Level Demand Satisfaction with Inventory Balance

$$
I_{c,p,t-1}
+ \text{transit}_{c,p,t}
+ \sum_{\substack{o:\, o \in \mathcal{O}(c) \\ v:\, (o,p,v) \in \mathcal{R}}} x_{c,o,p,v,\, t - \text{lt}_{o,p,v}}
= \alpha_{c,p} \cdot d_{c,t} - u_{c,p,t} + I_{c,p,t}
\qquad \forall\, c \in \mathcal{C},\; p \in \mathcal{P},\; t \in \mathcal{T}
$$

where $x_{c,o,p,v,\tau} = \sum_m x_{m,c,o,p,v,\tau}$ are total tonnes (all modes) departing in month $\tau$.

Notes:
- $I_{c,p,0}$ is the given initial port inventory (parameter).
- $x_{c,o,p,v,\tau} = 0$ for $\tau < 1$; deliveries pre-dating the horizon are captured in $\text{transit}_{c,p,t}$.
- $\text{transit}_{c,p,t}$ appears once outside the sum over routes — it is a port-level parameter, not route-disaggregated.

*Port inventory at end of last month, plus arriving in-transit cargo (a fixed parameter), plus all planned shipments whose departure month $\tau = t - \text{lt}$ falls within the horizon, equals the port's share of demand plus ending inventory. Unmet demand absorbs any gap.*

**Terminal inventory floor**:

$$
I_{c,p,T} \geq I^{\min}_{c,p,T} = \tfrac{30}{30.5} \cdot \alpha_{c,p} \cdot d_{c,T}
\qquad \forall\, c \in \mathcal{C},\; p \in \mathcal{P}
$$

---

### 5.2 Supplier Capacity

$$
\sum_{\substack{p,v:\, (o,p,v) \in \mathcal{R}}} x_{c,o,p,v,t} \leq \text{supcap}_{o,c,t}
\qquad \forall\, c \in \mathcal{C},\; o \in \mathcal{O}(c),\; t \in \mathcal{T}
$$

where $x_{c,o,p,v,t} = \sum_m x_{m,c,o,p,v,t}$.

---

### 5.3 Parcel Size — Linking Tonnes to Voyages (Per Cargo, Per Mode)

$$
x_{m,c,o,p,v,t} \leq Q_v \cdot n_{m,c,o,p,v,t}
\qquad \forall\, m \in \mathcal{M},\; c \in \mathcal{C},\; o \in \mathcal{O}(c),\; (o,p,v) \in \mathcal{R},\; t \in \mathcal{T}
$$

*Each voyage of mode $m$ carrying cargo $c$ on route $(o,p,v)$ carries at most $Q_v$ tonnes of that cargo. The per-voyage freight charge in $Z_{\text{freight}}$ naturally drives the model to fill each voyage; the integer constraint on $n_{m,\ldots}$ prevents fractional vessel calls.*

Upper bound: $n_{m,c,o,p,v,t} \leq N^{\max}_{c,o,p,v,t}$ (route- and cargo-specific, from §2.7).

---

### 5.4 Period Charter — Monthly Capacity Constraint

The total round-trip days consumed by period-chartered voyages of class $v$ in month $t$ cannot exceed the chartered fleet's available days:

$$
\sum_{\substack{c:\, o \in \mathcal{O}(c) \\ (o,p,v) \in \mathcal{R}}} D_{o,p,v} \cdot n_{\text{period},c,o,p,v,t} \leq 30 \cdot k_{v,t}
\qquad \forall\, v \in \mathcal{V},\; t \in \mathcal{T}
$$

*If $k_{v,t} = 2$ Capesize vessels are on period charter in month $t$, at most 60 round-trip days of Capesize period voyages can be scheduled. Routes with longer $D_{o,p,v}$ consume the pool faster.*

**Minimum period charter duration** (incremental constraint on $k$):

$$
k_{v,\tau} \geq k_{v,t} - k_{v,t-1}
\qquad \forall\, \tau \in \{t, \ldots, \min(t + \Delta^{\text{period}}_v - 1,\, T)\},\; v \in \mathcal{V},\; t \in \mathcal{T}
$$

*Once additional vessels are taken on charter, the increment must remain for at least $\Delta^{\text{period}}_v$ months.*

Upper bound: $k_{v,t} \leq K^{\max}_v$ (from §2.7).

---

### 5.5 Berth Capacity (Arrivals in Month $t$)

$$
\sum_{\substack{c,o,v:\, (o,p,v) \in \mathcal{R} \\ o \in \mathcal{O}(c)}} x_{c,o,p,v,\, t - \text{lt}_{o,p,v}}
\;+\; \text{transit}_{c,p,t}^\Sigma
\;\leq\; \text{berthcap}_{p,t}
\qquad \forall\, p \in \mathcal{P},\; t \in \mathcal{T}
$$

where $\text{transit}_{c,p,t}^\Sigma = \sum_c \text{transit}_{c,p,t}$ is total in-transit tonnes across all cargoes arriving at port $p$ in month $t$, and $x_{c,o,p,v,\tau} = \sum_m x_{m,c,o,p,v,\tau}$. Transit appears once at port level, outside the sum over routes.

*Total tonnes arriving at port $p$ in month $t$ — from planned shipments departed $\text{lt}$ months earlier and fixed in-transit cargo — must not exceed berth throughput capacity.*

---

### 5.6 COA Linking — Minimum Volume and Monthly Cap

If a COA is used at any point on route $(o,p,v)$, the trigger binary $\psi_{o,p,v} = 1$ and the total COA volume over the horizon must meet the contract minimum:

$$
\sum_{t,c} x_{\text{COA},c,o,p,v,t} \geq \text{vol}^{\text{COA,min}}_{o,p,v} \cdot \psi_{o,p,v}
\qquad \forall\, (o,p,v) \in \mathcal{R}
$$

Monthly COA shipments are bounded by the route maximum times the COA trigger:

$$
\sum_c x_{\text{COA},c,o,p,v,t} \leq X^{\max}_{c,o,p,v,t} \cdot \psi_{o,p,v}
\qquad \forall\, (o,p,v) \in \mathcal{R},\; t \in \mathcal{T}
$$

*If $\psi = 0$, no COA tonnes flow on that route. If $\psi = 1$, the contract minimum must be satisfied over the planning horizon.*

No bilinear products, no $y/z/\nu/\xi$ auxiliary variables required — the mode-indexed $x$ and $n$ variables carry the mode identity directly.

---

### 5.7 Inventory Capacity

$$
I_{c,p,t} \leq \text{invcap}_{c,p}
\qquad \forall\, c \in \mathcal{C},\; p \in \mathcal{P},\; t \in \mathcal{T}
$$

---

### 5.8 Non-negativity and Integrality

$$
x_{m,c,o,p,v,t} \geq 0, \quad I_{c,p,t} \geq 0, \quad u_{c,p,t} \geq 0
$$
$$
n_{m,c,o,p,v,t} \in \mathbb{Z}_{\geq 0}, \quad k_{v,t} \in \mathbb{Z}_{\geq 0}
$$
$$
\psi_{o,p,v} \in \{0,1\}
$$

---

## 6. Model Size

Exact counts from the variable/constraint definitions with $|\mathcal{C}| = 2$, $|\mathcal{M}| = 3$, $|\mathcal{R}| = 121$, $|\mathcal{V}| = 4$, $|\mathcal{P}| = 6$, $T = 12$.

| Variable type | Formula | Count |
|---|---|:---:|
| Continuous $x_{m,c,o,p,v,t}$ | $3 \times 2 \times 121 \times 12$ | 8,712 |
| Integer $n_{m,c,o,p,v,t}$ | $3 \times 2 \times 121 \times 12$ | 8,712 |
| Integer $k_{v,t}$ | $4 \times 12$ | 48 |
| Continuous $I_{c,p,t}$ | $2 \times 6 \times 12$ | 144 |
| Continuous $u_{c,p,t}$ | $2 \times 6 \times 12$ | 144 |
| Binary $\psi_{o,p,v}$ | $121$ | 121 |
| **Total variables** | | **17,881** |

| Constraint type | Formula | Count |
|---|---|:---:|
| Parcel linking $x_{m,c,o,p,v,t} \leq Q_v n_{m,\ldots}$ | $3 \times 2 \times 121 \times 12$ | 8,712 |
| Port demand balance $[c,p,t]$ | $2 \times 6 \times 12$ | 144 |
| Terminal inventory floor $[c,p]$ | $2 \times 6$ | 12 |
| Supplier capacity (8 origin–cargo combos $\times T$) | $8 \times 12$ | 96 |
| Berth capacity $[p,t]$ | $6 \times 12$ | 72 |
| Period capacity $[v,t]$ | $4 \times 12$ | 48 |
| Period min-duration $[v,t,\tau]$ ($\Delta=3$) | $4 \times 12 \times 3$ | 144 |
| COA min-volume + monthly cap | $121 \times 2$ | 242 |
| Inventory capacity $[c,p,t]$ | $2 \times 6 \times 12$ | 144 |
| **Total constraints** | | **9,614** |

The dominant hardness is the 8,712 integer voyage-count variables $n_{m,c,o,p,v,t}$. The binary set collapses to 121 $\psi$ variables (vs. the prior $y/z$ structure of ~4,356 binaries) — a significant reduction in combinatorial complexity.

---

## 7. Assumptions and Placeholders

| # | Item | Where Used | Status | What Is Needed |
|---|------|-----------|--------|----------------|
| 1 | Monthly demand $d_{c,t}$ — coking & thermal coal | §5.1 | **Synthetic** — proxy from SAIL annual reports; monthly split flat | SAIL actual procurement schedule |
| 2 | Port demand shares $\alpha_{c,p}$ | §2.1, §5.1 | **Synthetic — decision for SAIL** | Which plant receives which cargo through which port |
| 3 | Supplier capacity $\text{supcap}_{o,c,t}$ | §5.2 | **Synthetic** | Bilateral offtake contract allocations |
| 4 | FOB cargo prices $\text{price}_{c,o,t}$ | $Z_{\text{cargo}}$ | **Synthetic** — Argus/Platts proxy | SAIL's actual contract terms |
| 5 | Period charter rate $H^{\text{period}}_{v,t}$: trailing 12-week average of actual history + base-forecast weeks; no discount by default | §2.4, $Z_{\text{period}}$ | **Synthetic** — market-derived. Any discount is a scenario input, not a baseline constant | Actual period charter fixtures from SAIL chartering desk |
| 6 | COA rate $r^{\text{COA}}_{o,p,v}$: trailing 12-week average per-tonne spot voyage cost; no discount by default | §2.4, $Z_{\text{freight}}$ | **Synthetic** — same anchoring as period rate. Discount is a scenario input | Actual COA rates from SAIL chartering desk |
| 7 | COA minimum volume $\text{vol}^{\text{COA,min}}_{o,p,v}$ | §5.6 | **Synthetic** | Real COA contract terms |
| 8 | Period charter minimum duration $\Delta^{\text{period}}_v = 3$ months | §5.4 | **Synthetic** | SAIL charter party terms |
| 9 | Berth capacity $\text{berthcap}_{p,t}$ | §5.5 | **Synthetic** — estimated from published port throughput | Actual berth slot allocation from port authority |
| 10 | Lead times $\text{lt}_{o,p,v}$ | §5.1, §5.5 | *(verify)* — from routes.yaml distances and speeds; ignores canal routing and seasonal variation | Harbour Master / vessel operator confirmation |
| 11 | Expected delay $\delta_{o,p,v} = 1.5$ days | $Z_{\text{demurrage}}$ | **Synthetic** — flat across all routes | Per-terminal port congestion data |
| 12 | Demurrage rate $\text{dem}$ = USD 18,000/day | $Z_{\text{demurrage}}$ | *(verify)* | Actual SAIL charter party demurrage clause |
| 13 | In-transit cargo $\text{transit}_{c,p,t}$: default = steady-state pipeline ($\alpha_{c,p} \times d_{c,t-\overline{\text{lt}}}$, representative lead time) | §5.1, §5.5 | **Synthetic** — pipeline proxy; must be replaced with SAIL fixture register before production use | SAIL shipping fixture records |
| 14 | Initial port inventory $I_{c,p,0}$ | §5.1 | **Synthetic** — assumed 30 days of port-level demand | SAIL plant stockyard data per port |
| 15 | Terminal inventory minimum $I^{\min}_{c,p,T} = (30/30.5) \times \alpha_{c,p} \times d_{c,T}$ | §5.1 | **Synthetic** — 30-day buffer; adjust to SAIL safety stock policy | SAIL procurement policy |
| 16 | Inventory holding cost $h_c = 1.5\%$ of cargo value/month | $Z_{\text{inventory}}$ | **Synthetic** | SAIL's capital and insurance cost rate |
| 17 | Port inventory capacity $\text{invcap}_{c,p}$ | §5.7 | **Synthetic** — estimated from SAIL plant layouts | Actual stockyard capacity per port |
| 18 | Unmet-demand penalty $\text{pen}^u_c = 3 \times \max(\text{landed cost})$ | $Z_{\text{unmet}}$ | **Formula-driven** — recalculated each run from price and freight data; not a fixed constant | — |
| 19 | Scenario weights $w_s = (0.25, 0.50, 0.25)$ | §4.2 | **Synthetic** | SAIL risk preference |
| 20 | Parcel sizes $Q_v$ | §5.3 | *(verify)* — from routes.yaml | Actual charter party parcel ranges |
| 21 | Draft eligibility $\text{draft\_ok}_{p,v}$ | $\mathcal{R}$ | *(verify)* — from routes.yaml | Harbour Master tidal allowance confirmation |
| 22 | Rail/road cost $\text{railcost}_{p,\text{plant}}$ | Optional §8 | **Synthetic — decision for SAIL** | SAIL logistics cost data |
| 23 | Brazil (Ponta da Madeira) and South Africa (Richards Bay) as coking/thermal coal origins | §1.1 | **Pending confirmation** | SAIL procurement team |
| 24 | Scenario spread on period/COA rates | §2.4 | **Absent (= 0)** — period and COA rates fixed at trailing average; only spot hire and bunker vary by scenario | SAIL's view on contract rate scenarios |

---

## 8. Optional Extensions (Decision for SAIL)

### 8.1 Port-to-Plant Rail Routing

If SAIL provides rail tariffs, the port-level balance (§5.1) can be disaggregated to plant level. Add:

- Parameter: $\text{railcost}_{p,\text{plant}}$ (USD/tonne) **[synthetic]**
- Parameter: $d_{c,\text{plant},t}$ (plant-level demand) **[synthetic]**
- Parameter: $\alpha_{c,p,\text{plant}}$ (fraction of port $p$ discharge to each plant)

**Decision needed**: Confirm whether the optimizer should route cargo port-to-plant, or whether plant-level logistics is managed outside this model. Until confirmed, $\alpha_{c,p}$ is a fixed input and demand is aggregated at port level.

---

## 9. Naive Baseline Definition

### 9.1 Operational Naive Policy

> In every month $t$, for every cargo $c$ at every port $p$: procure exactly $\alpha_{c,p} \times d_{c,t}$ tonnes (no inventory buffering, no lead-time arbitrage, no in-transit awareness). Choose the **cheapest-FOB origin** $o^* = \arg\min_{o \in \mathcal{O}(c)}(\text{price}_{c,o,t} + \text{qpen}_{c,o})$. Use the **largest eligible vessel class** for route $(o^*, p)$. Charter **spot only**. Round up to whole voyages: $n^{\text{naive}} = \lceil \alpha_{c,p} \times d_{c,t} / Q_{v^*} \rceil$.

Baseline cost in month $t$ for cargo $c$ at port $p$:

$$
\text{BC}_{c,p,t} =
  \underbrace{(\text{price}_{c,o^*,t} + \text{qpen}_{c,o^*}) \cdot \alpha_{c,p} \cdot d_{c,t}}_{\text{cargo}}
  + \underbrace{\text{VC}^{\text{spot}}_{o^*,p,v^*,t,\text{base}} \cdot n^{\text{naive}}_{c,p,t}}_{\text{freight (per voyage)}}
  + \underbrace{\text{dem} \cdot \delta_{o^*,p,v^*} \cdot n^{\text{naive}}_{c,p,t}}_{\text{demurrage}}
$$

### 9.2 Historical Backtest Baseline

Evaluate the same naive policy using **realised BDI rates** from `data/processed/master.parquet`:

$$
\text{BC}^{\text{hist}}_{c,p,t} = \text{same formula, substituting realised } H^{\text{spot,actual}}_{v,t}
$$

Compare against the optimizer's plan re-evaluated at the same realised rates. The delta measures how much timing, vessel-class mix, and charter-mode selection would have saved historically.

### 9.3 What the Optimizer Gains Over Naive

| Mechanism | Naive | Optimizer |
|-----------|-------|-----------|
| Procurement timing | Buy exactly in demand month | Ship ahead when rates are low; build port inventory |
| Charter mode | Spot only | Spot, COA, and/or period — whichever minimises expected cost |
| Vessel class | Largest always | Mix classes to match draft, parcel, and rate |
| Port routing | Fixed $\alpha_{c,p}$ per port | Flexible allocation across ports within berth caps |
| Scenario hedging | Base-scenario only | Robust across low/base/high BDI scenarios |
| Voyage rounding | Always rounds up per cargo–port–month | Optimises voyage count across months to reduce parcel waste |

---

## 10. Future Scope (v2+)

| Item | Reason deferred |
|------|----------------|
| **Iron ore** | No seaborne origin confirmed for SAIL East Coast in `docs/02_scope.md`; may be domestic. |
| **Limestone** | Primarily domestic / short-sea; origin and transport mode TBC. |
| **Dolomite** | Same as limestone. |
| **Brazil** (Ponta da Madeira — Vale metallurgical coal) | Pending SAIL confirmation; add routes and draft eligibility in routes.yaml. |
| **South Africa** (Richards Bay — thermal and semi-soft coking coal) | Pending SAIL confirmation. |
| **Sagar-Sandheads transshipment / lighterage** | Significant operational complexity for draft-restricted Haldia supply chain. |
| **AIS-based congestion parameters** | Real-time $\delta_{o,p,v}$ from vessel tracking. |
| **Automated fixture integration** | SAIL broker system API for live in-transit cargo feed. |

---

## 11. How This Formulation Connects to the Rest of the System

```
BDI Forecast (Segment 3)
  ├─ H[v,t,s]              — scenario-specific daily spot hire rate
  ├─ H_period[v,t]         — trailing 12-week average (actuals + base forecast)
  └─ fr[o,p,v,t,s]         — per-tonne rate for reporting and pen^u calculation

config/routes.yaml
  ├─ D[o,p,v]              — round-trip voyage days
  ├─ Q[v]                  — parcel sizes
  ├─ eligible_vessel_classes → feasible set R (|R| = 121)
  └─ port draft limits     → draft_ok[p,v]

        ▼
  ┌──────────────────────────────────────┐
  │         MILP Optimizer (v1)          │
  │                                      │──► x[m,c,o,p,v,t]: shipment plan by mode
  │  Variables: x[m], n[m], k[v,t],     │──► n[m,c,o,p,v,t]: voyage schedule
  │             I[c,p,t], u[c,p,t],     │──► k[v,t]:          period fleet size
  │             psi[o,p,v]              │──► I[c,p,t]:         port inventory profile
  │                                      │──► Expected total landed cost by scenario
SAIL demand + alpha [synthetic] ────────►│
Cargo FOB prices    [synthetic] ────────►│
Supplier caps       [synthetic] ────────►│
In-transit fixtures [synthetic] ────────►│
  └──────────────────────────────────────┘
              │
              ▼
      Human planner review (all outputs advisory; no automated trade execution)
              │
              ▼
      Execute month-1 decisions → re-run next month (rolling horizon)
```
