# Data Requirements — SIH26006
**Intelligent Freight Forecasting & Chartering Advisory System · SAIL**
*Last updated: 2026-10-26 · All "Free source" claims must be individually verified before use (see Data Availability Rules in `docs/02_data_inventory.md`)*

---

## Dataset Register

| Dataset | Why needed | Frequency | Free source (verify) | Fallback if unavailable | Priority |
|---|---|---|---|---|---|
| **Baltic Dry Index (BDI)** | Composite dry-bulk benchmark; market-direction signal; evaluation reference | Daily | [Stooq](https://stooq.com/q/d/l/?s=bdi.uk&i=d) (CSV direct download — verify terms); [NASDAQ Data Link](https://data.nasdaq.com) search "BDI" | Synthetic composite from sub-indices | **High** |
| **Baltic Capesize Index (BCI)** | Primary forecasting target for Capesize vessel class | Daily | [NASDAQ Data Link](https://data.nasdaq.com) — search "Baltic Capesize"; verify dataset publisher terms | Derive from BDI using historical BCI/BDI ratio; label `[SYNTHETIC]` | **High** |
| **Baltic Panamax Index (BPI)** | Primary forecasting target for Panamax vessel class | Daily | [NASDAQ Data Link](https://data.nasdaq.com) — search "Baltic Panamax" | Derive from BDI; label `[SYNTHETIC]` | **High** |
| **Baltic Supramax Index (BSI)** | Primary forecasting target for Supramax vessel class | Daily | [NASDAQ Data Link](https://data.nasdaq.com) — search "Baltic Supramax" | Derive from BDI; label `[SYNTHETIC]` | **High** |
| **Baltic Handysize Index (BHSI)** | Primary forecasting target for Handysize vessel class | Daily | [NASDAQ Data Link](https://data.nasdaq.com) — search "Baltic Handysize" | Derive from BDI; label `[SYNTHETIC]` | **High** |
| **Coking coal price (USD/MT)** | SAIL's primary imported commodity; strong driver of chartering demand and freight market | Monthly | [World Bank Pink Sheet](https://www.worldbank.org/en/research/commodity-markets) — "Coking Coal, Australian" series; [IMF Primary Commodity Prices](https://www.imf.org/en/Research/commodity-prices) | World Bank Pink Sheet archive; label source clearly | **High** |
| **Thermal coal price (USD/MT)** | Correlated commodity; shares shipping routes and vessel demand with coking coal | Monthly | [World Bank Pink Sheet](https://www.worldbank.org/en/research/commodity-markets) — "Coal, Australian" series | IMF commodity price data | **Medium** |
| **Iron ore price (USD/MT)** | Key demand driver for Capesize freight; iron ore and coking coal shipping cycles are correlated | Monthly | [FRED — PIORECRUSDM](https://fred.stlouisfed.org/series/PIORECRUSDM) (World Bank via FRED); [World Bank Pink Sheet](https://www.worldbank.org/en/research/commodity-markets) | IMF commodity prices | **High** |
| **Brent crude oil price (USD/bbl)** | Proxy for global economic activity; correlated with freight rate cycles | Daily | [FRED — DCOILBRENTEU](https://fred.stlouisfed.org/series/DCOILBRENTEU) (EIA via FRED — free API) | World Bank Pink Sheet (monthly) | **High** |
| **Bunker fuel price proxy (VLSFO/IFO380, USD/MT)** | Voyage operating cost input for optimization engine; affects vessel-class economics | Daily / Weekly | [Ship & Bunker](https://shipandbunker.com/prices) historical (free web, bulk access unverified); [EIA No. 2 Fuel Oil via FRED](https://fred.stlouisfed.org/series/WFUELUSGULF) as proxy | EIA Gulf Coast Residual Fuel Oil price (FRED) — label as proxy `[PROXY]` | **High** |
| **USD/INR exchange rate** | Converts USD freight costs to INR for SAIL reporting; affects procurement cost in local currency | Daily | [FRED — EXINUS](https://fred.stlouisfed.org/series/EXINUS) (RBI/Fed via FRED — free API); [RBI DBIE](https://dbie.rbi.org.in) | Yahoo Finance historical download (verify terms) | **Medium** |
| **India crude steel production (MT/month)** | Indicator of domestic steel demand driving coking coal import volumes | Monthly | [World Steel Association](https://www.worldsteel.org/steel-by-topic/statistics) — monthly crude steel production (registration may be required); [Joint Plant Committee India](http://www.jpcindia.org) | World Steel Association annual yearbook (PDF parse) | **Medium** |
| **China crude steel production (MT/month)** | Largest single driver of global dry-bulk demand and BCI/BPI movements | Monthly | [World Steel Association](https://www.worldsteel.org/steel-by-topic/statistics); [National Bureau of Statistics China](https://data.stats.gov.cn/english) — free, English interface | World Steel Association annual data | **High** |
| **Port congestion / waiting time (Indian East Coast)** | Feature for risk-alert module; port congestion increases turnaround time and freight cost | Monthly | [Indian Ports Association — traffic statistics](https://www.ipa.nic.in/traffic-statistics) (pre-berthing waiting time in annual/monthly reports) | Manual extraction from IPA PDF reports; aggregate annual proxy | **Medium** |
| **Vessel supply / fleet count by class** | Oversupply of vessels depresses freight rates; fleet growth is a medium-term rate driver | Quarterly / Annual | [BIMCO fleet reports](https://www.bimco.org/market-analysis) (some free); [UNCTAD Review of Maritime Transport](https://unctad.org/rmt) (free, annual) | UNCTAD annual figures; label as annual interpolated `[INTERPOLATED]` | **Low** |

---

## Priority Summary

| Priority | Datasets | Rationale |
|---|---|---|
| **High** (needed for MVP) | BDI, BCI, BPI, BSI, BHSI, coking coal price, iron ore price, Brent crude, bunker fuel proxy, China steel output | Direct forecasting inputs and optimization cost drivers |
| **Medium** (improves model; needed before evaluation) | Thermal coal price, USD/INR, India steel production, port congestion | Exogenous regressors; risk-alert features |
| **Low** (useful; not blocking) | Vessel fleet supply data | Useful for medium-term rate regime detection; annual frequency limits ML utility |

---

## Synthetic Data Plan

### Purpose

The four Baltic sub-indices (BCI, BPI, BSI, BHSI) report vessel-class rates at the global market level — they are **not route-specific**. SAIL needs route-level freight rate estimates (e.g., Hay Point → Paradip for a Capesize vessel). Until SAIL provides internal chartering records (D02), these route-level rates must be synthesized from real index values.

All synthetic values will be stored in `data/processed/synthetic/` and labeled `[SYNTHETIC]` in every output, dashboard, and evaluation report. They must never be presented as actual SAIL rates or verified market rates.

---

### Generation Method

Route-level freight rate for vessel class *v* on route *r* at week *t* is estimated as:

```
route_rate(v, r, t) = index(v, t) × distance_factor(r, v) × seasonality(t) × (1 + noise(t))
```

**Term definitions:**

| Term | Description | How derived |
|---|---|---|
| `index(v, t)` | Real Baltic sub-index value for vessel class *v* at week *t* | BCI / BPI / BSI / BHSI from verified public source |
| `distance_factor(r, v)` | Adjusts the index for route distance relative to a reference route | `distance_nm(r) / reference_nm(v)` — reference distances from BIMCO typical voyage assumptions (e.g., BCI reference ≈ 5,200 nm Hay Point → Qingdao) |
| `seasonality(t)` | Multiplicative seasonal adjustment | Fitted STL decomposition on the vessel-class index (3-year history); captures Q1 peak and Q3 trough typical of dry-bulk markets |
| `noise(t)` | Random residual representing route-level variation not explained by the index | Sampled from N(0, σ²) where σ = historical standard deviation of residuals from a regression of known charter rates on the index; σ set conservatively at 8–12 % if no calibration data available |

**Reference routes and distance factors (illustrative — verify against sea-distances.org):**

| Origin | Destination | Distance (nm) | Vessel class | Distance factor (vs. baseline 5,200 nm) |
|---|---|---|---|---|
| Hay Point, Australia | Paradip, India | ~4,800 | Capesize | 0.92 |
| Newcastle, Australia | Paradip, India | ~5,200 | Panamax / Supramax | 1.00 |
| Hampton Roads, USA | Paradip, India | ~10,200 | Panamax / Supramax | 1.96 |
| Nacala, Mozambique | Paradip, India | ~3,400 | Handysize / Supramax | 0.65 |
| Beira, Mozambique | Paradip, India | ~3,300 | Handysize / Supramax | 0.63 |
| Vanino, Russia | Paradip, India | ~5,700 | Panamax / Capesize | 1.10 |
| Samarinda / Taboneo, Indonesia | Paradip, India | ~2,600 | Handysize / Supramax | 0.50 |

*All distances are approximate and normalized against Newcastle–Paradip (5,200 nm) as the 1.00 baseline. Verify against sea-distances.org before use in the model. Factors will be updated once verified distances are confirmed.*

---

### Implementation

```
src/features/generate_synthetic_routes.py
  Input:  data/processed/indices_weekly.parquet
          data/raw/route_distances_reference.csv
  Output: data/processed/synthetic/route_rates_synthetic.parquet
  Flags:  column "is_synthetic" = True on all rows
          column "synthetic_method" = "index_x_distance_x_seasonal"
```

The synthetic dataset will be used only for:
- Model development and debugging
- Dashboard demonstrations during the prototype phase
- Scenario analysis clearly marked as simulated

It will be **replaced** by SAIL internal chartering data (D02) if and when that becomes available, without requiring changes to downstream model or API code.
