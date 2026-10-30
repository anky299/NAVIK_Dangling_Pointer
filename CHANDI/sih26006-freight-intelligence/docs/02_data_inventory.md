# Data Inventory — SIH26006
**Intelligent Freight Forecasting Model · SAIL · Smart India Hackathon 2026**
*Last updated: 2026-10-26 · Status: Draft — verification in progress*

---

## 1. Purpose

Identify every dataset required to build the intelligent freight forecasting, vessel selection, port suitability, and chartering advisory system for SAIL. Every source must have a documented origin, access method, licensing status, update frequency, and fallback strategy before it is used in model training or evaluation.

---

## 2. Data Source Register

| ID | Category | Required Fields | Candidate Source | Status |
|---|---|---|---|---|
| D01 | Freight market indices | Date, index value, vessel class (BCI / BPI / BSI / BHSI) | Baltic Exchange; NASDAQ Data Link (Quandl) | ⚠️ Verification in progress |
| D02 | Historical chartering records | Contract date, origin port, destination port, vessel class, cargo quantity (MT), freight rate (USD/MT or lumpsum), contract duration | SAIL internal, subject to approval | ⏳ Pending SAIL |
| D03 | Port infrastructure | Max draft (m), max LOA (m), max beam (m), berth count, berth restrictions, cargo-handling capacity (MT/day) | Official port-authority websites; Indian Ports Association | ⚠️ Verification in progress |
| D04 | Port congestion | Port, date, vessel waiting time, queue length, congestion indicators | Indian Ports Association; MarineTraffic (public tier) | ⚠️ Verification in progress |
| D05 | Vessel specifications | Vessel class, DWT range, draft, LOA, beam | BIMCO published guidelines; IMO documents | ✅ Publicly documented standard ranges |
| D06 | Route distances | Origin port, destination port, sailing distance (nm), approximate transit days | sea-distances.org; searoutes.com | ✅ Free lookup; static reference table |
| D07 | Market & macro indicators | Date, iron ore price, bunker fuel price, China steel output, global PMI, seaborne trade volumes | World Bank Pink Sheet; IMF Primary Commodity Prices; FRED | ✅ Free, verified public datasets |
| D08 | Historical operating costs | Freight expenditure, demurrage cost, vessel waiting time, utilization rate | SAIL internal, subject to approval | ⏳ Pending SAIL |

---

## 3. Source Verification Record

---

### D01 — Freight Market Indices

**What is needed:** Daily or weekly time-series of BCI (Capesize), BPI (Panamax), BSI (Supramax), BHSI (Handysize), and BDI (composite benchmark). At least 5 years of history for model training.

#### Primary Candidate: Baltic Exchange

| Field | Detail |
|---|---|
| **Provider** | Baltic Exchange (London) |
| **URL** | https://www.balticexchange.com |
| **Data available** | BDI, BCI, BPI, BSI, BHSI — daily index values |
| **Historical coverage** | BDI from 1985; sub-indices from various start dates (BCI ~1999, BSI ~2004) |
| **Geographic coverage** | Global shipping routes; route-level TCE assessments per vessel class |
| **Format** | Proprietary; available via licensed data vendors |
| **Access method** | **Subscription required.** Baltic Exchange does not offer a public free API. Data is distributed through licensed terminal providers (Refinitiv Eikon, Bloomberg, Clarksons Sea) |
| **License** | Commercial license; redistribution restricted |
| **Update frequency** | Daily (London business days) |
| **Limitations** | Not freely accessible; significant subscription cost for full route-level data |
| **Fallback** | See alternatives below |
| **Verification status** | ⚠️ Not yet confirmed whether SAIL holds a subscription |

#### Fallback A: NASDAQ Data Link (formerly Quandl)

| Field | Detail |
|---|---|
| **Provider** | Nasdaq Data Link |
| **URL** | https://data.nasdaq.com/data/CHRIS — search "Baltic Dry Index" |
| **Data available** | BDI composite (daily); some sub-index series available through third-party publishers |
| **Historical coverage** | BDI from ~1985 on some series |
| **Format** | CSV download; REST API (JSON/CSV) |
| **Access method** | Free account required for basic access; API key provided on registration |
| **License** | Varies by dataset publisher. Verify individual dataset terms before use. |
| **Update frequency** | Typically daily with 1–2 day lag |
| **Limitations** | Sub-index granularity varies; some series are user-contributed and may have gaps; route-level TCE data not freely available |
| **Verification status** | ⚠️ Dataset availability and completeness must be verified by team before use |

#### Fallback B: Stooq (stooq.com)

| Field | Detail |
|---|---|
| **Provider** | Stooq.com |
| **URL** | https://stooq.com/q/d/l/?s=bdi.uk&i=d |
| **Data available** | BDI daily historical data (CSV direct download) |
| **Historical coverage** | ~2000 to present (check on access) |
| **Format** | CSV |
| **Access method** | Direct URL download; no registration required |
| **License** | Personal / non-commercial use; redistribution and commercial use restrictions — **verify terms before use** |
| **Limitations** | BDI only (not sub-indices); no route-level data |
| **Verification status** | ⚠️ Terms of use must be verified |

> **⚠️ Data Availability Rule D01:** Do not scrape Baltic Exchange or any licensed data provider without explicit written permission. Only use datasets whose terms of service permit the intended use (research / prototype development).

---

### D02 — Historical Chartering Records (SAIL Internal)

| Field | Detail |
|---|---|
| **Provider** | SAIL — internal logistics / chartering team |
| **Data available** | Historical vessel charter contracts executed by SAIL |
| **Requested fields** | Contract date, loading port, discharge port, vessel class, cargo quantity (MT), freight rate (USD/MT or lumpsum USD), laycan, contract duration / voyage count |
| **Historical coverage** | Minimum 3 years requested; 5+ years preferred for seasonal model training |
| **Format** | To be determined on receipt (expected: Excel / CSV) |
| **Access method** | Formal request to SAIL point of contact; subject to internal approval |
| **License** | Restricted to this project; not for redistribution |
| **Update frequency** | Static historical extract; supplemented periodically if approved |
| **Limitations** | May be incomplete, partially anonymized, or aggregated; route and vessel-class granularity unknown |
| **Fallback** | If unavailable: train on public Baltic Exchange / proxy data only; document explicitly that model was not trained on SAIL-specific rates |
| **Verification status** | ⏳ Pending SAIL confirmation |

---

### D03 — Port Infrastructure (Indian East Coast)

**Ports in scope:** Paradip, Visakhapatnam (Vizag), Gangavaram, Gopalpur, Dhamra, Sagar-Sandheads (Syama Prasad Mookerjee Port / Kolkata Port Authority), Haldia Dock Complex.

**Fields required per port:** Maximum permissible draft (m), maximum LOA (m), maximum beam (m), berth count, berth restrictions (vessel class, cargo type), cargo-handling rate (MT/day), last verified date, source.

#### Primary Candidates: Official Port Authority Websites

| Port | Authority | Official URL | Published Infra Data |
|---|---|---|---|
| Paradip | Paradip Port Authority | https://www.paradipport.gov.in | Port profile pages — verify field-level detail |
| Visakhapatnam | Visakhapatnam Port Authority | https://www.vizagport.com | Port information section — verify |
| Gangavaram | Gangavaram Port Ltd | https://www.gangavaram.com | Port specifications — verify |
| Gopalpur | Gopalpur Port Ltd | https://www.gopalpurports.com | Port profile — verify |
| Dhamra | Dhamra Port (Adani) | https://www.dhamraport.com | Port specifications — verify |
| Sagar-Sandheads | Syama Prasad Mookerjee Port (Kolkata) | https://www.kolkataporttrust.gov.in | Haldia and Sagar anchorage data — verify |
| Haldia | Syama Prasad Mookerjee Port (Kolkata) | https://www.kolkataporttrust.gov.in | Haldia Dock Complex specifications — verify |

#### Secondary Candidate: Indian Ports Association

| Field | Detail |
|---|---|
| **Provider** | Indian Ports Association |
| **URL** | https://www.ipa.nic.in |
| **Data available** | Port traffic statistics, infrastructure summaries, annual reports |
| **Format** | PDF reports; some tabular data |
| **Access method** | Public download |
| **License** | Government of India data; verify redistribution terms |
| **Limitations** | May not include vessel-dimension restrictions at berth level; data currency must be verified |

> **⚠️ Data Availability Rule D03:** Missing port constraints must be flagged explicitly in the reference table. Do not estimate or interpolate draft / LOA limits. Mark uncertain values with source and a `NEEDS_VERIFICATION` flag.

---

### D04 — Port Congestion Data

| Field | Detail |
|---|---|
| **Primary candidate** | Indian Ports Association — monthly/annual traffic reports |
| **URL** | https://www.ipa.nic.in/traffic-statistics |
| **Data available** | Port throughput, vessel turnaround time, pre-berthing waiting time (aggregate, not real-time) |
| **Format** | PDF / Excel statistical releases |
| **Access method** | Public download |
| **Historical coverage** | Annual reports available ~10 years back; monthly data varies |
| **Limitations** | Aggregate port-level; not vessel-class-specific; not real-time |
| **Secondary candidate** | Ministry of Ports, Shipping and Waterways — Sagarmala data portal |
| **URL** | https://sagarmala.gov.in |
| **Limitations** | Coverage and granularity to be verified |
| **Commercial option** | MarineTraffic (https://www.marinetraffic.com) — port congestion API available on paid plans; free tier is view-only |
| **Fallback** | If real-time congestion data is unavailable, use IPA aggregate waiting-time statistics as a seasonal proxy indicator. Document limitation explicitly. |
| **Verification status** | ⚠️ Granularity and machine-readable access to be verified |

---

### D05 — Vessel Class Specifications

**Note:** These are published industry-standard dimensional ranges, not vessel-specific data. A static reference table is sufficient.

| Vessel Class | DWT Range | Typical LOA | Typical Beam | Typical Max Draft | Source |
|---|---|---|---|---|---|
| Handysize | 10,000 – 40,000 MT | 150 – 200 m | 23 – 32 m | 9 – 11 m | BIMCO / IMO |
| Supramax | 40,000 – 65,000 MT | 180 – 200 m | 30 – 34 m | 11 – 13 m | BIMCO / IMO |
| Panamax | 65,000 – 100,000 MT | 215 – 230 m | 32 m (canal) | 12 – 14 m | BIMCO / IMO |
| Capesize | 100,000 – 180,000+ MT | 230 – 300 m | 43 – 50 m | 16 – 18 m | BIMCO / IMO |

| Field | Detail |
|---|---|
| **Primary source** | BIMCO (Baltic and International Maritime Council) |
| **URL** | https://www.bimco.org |
| **Access method** | Some publications are publicly accessible; others require member access |
| **Secondary source** | Published IMO guidelines and industry references (Lloyd's Register, ClassNK) |
| **Format** | Static reference table (maintained in `data/raw/vessel_specs_reference.csv`) |
| **Update frequency** | Static — vessel class definitions change rarely; review annually |
| **Verification status** | ✅ Standard industry ranges confirmed from published sources |

---

### D06 — Route Distances

**Routes in scope:** Approximate port pairs from each origin country to each Indian East Coast port.

| Origin Country | Representative Loading Port | Approx. Distance to Paradip (nm) |
|---|---|---|
| Australia | Hay Point (QLD) | ~4,800 |
| Australia | Newcastle (NSW) | ~5,200 |
| USA | Hampton Roads (VA) | ~10,200 |
| Mozambique | Nacala | ~3,400 |
| Mozambique | Beira | ~3,300 |
| Russia | Vanino (Far East) | ~5,700 |
| Indonesia | Samarinda / Taboneo | ~2,600 |

*Distances are approximate and must be verified against a route calculator.*

| Field | Detail |
|---|---|
| **Primary source** | sea-distances.org |
| **URL** | https://sea-distances.org |
| **Data available** | Port-to-port great-circle and Suez/Cape routing distances |
| **Format** | Web lookup; results to be manually extracted into a static reference table |
| **Access method** | Free public web tool; no API for bulk use — extract port pairs manually |
| **License** | Free for informational use; verify redistribution terms |
| **Secondary source** | searoutes.com — route-based calculations including canal options |
| **URL** | https://www.searoutes.com |
| **Format** | Web + API (free tier available) |
| **Deliverable** | Static CSV `data/raw/route_distances_reference.csv` with columns: origin_port, destination_port, routing, distance_nm, transit_days_estimate, source, verified_date |
| **Update frequency** | Static — sailing distances do not change; canal constraints updated if routing changes |
| **Verification status** | ✅ Free lookup tools confirmed accessible |

---

### D07 — Market and Macroeconomic Indicators

| Indicator | Source | URL | Format | Coverage | Access | Update Freq. |
|---|---|---|---|---|---|---|
| Iron ore price (USD/MT) | World Bank Commodity Prices (Pink Sheet) | https://www.worldbank.org/en/research/commodity-markets | Excel / CSV monthly | 1960 – present | Free public download | Monthly |
| Crude oil price (USD/bbl, Brent) | World Bank Pink Sheet / FRED | https://fred.stlouisfed.org/series/DCOILBRENTEU | CSV / API | 1987 – present | Free, API key optional | Daily |
| Bunker fuel price (IFO380, VLSFO) | Ship & Bunker (historical) | https://shipandbunker.com/prices | Web; limited free history | ~2010 – present | Free web; no bulk API confirmed | Daily |
| Global Manufacturing PMI | JP Morgan / S&P Global (via FRED or IMF) | https://fred.stlouisfed.org | CSV / API | ~2007 – present | Free | Monthly |
| China crude steel output (MT/month) | World Steel Association | https://www.worldsteel.org/steel-by-topic/statistics | Excel / PDF | 2000 – present | Free (registration may be required) | Monthly |
| Seaborne dry bulk trade volumes | UNCTAD Review of Maritime Transport | https://unctad.org/rmt | PDF / Excel | Annual; ~2000 – present | Free public download | Annual |
| Coal export volumes by country | UN Comtrade | https://comtradeplus.un.org | CSV / API | ~2000 – present | Free (API key for bulk access) | Monthly/Annual |

> **Note:** Bunker fuel price is a key input to voyage-cost calculations. Verify that Ship & Bunker's historical data is accessible in bulk; if not, use EIA US Gulf Coast Bunker prices from FRED as a proxy.

| **Verification status** | ✅ All primary sources confirmed as free and publicly accessible |

---

### D08 — Historical Operating Costs (SAIL Internal)

| Field | Detail |
|---|---|
| **Provider** | SAIL — finance / logistics / procurement teams |
| **Data available** | Historical freight expenditure per voyage or period, demurrage charges, vessel waiting time at Indian ports, vessel utilization rates |
| **Requested fields** | Period, port, freight cost (USD or INR), demurrage cost, waiting days, cargo quantity, vessel class |
| **Historical coverage** | Minimum 3 years requested |
| **Format** | To be determined on receipt |
| **Access method** | Formal request to SAIL; subject to internal approval |
| **License** | Restricted to this project |
| **Fallback** | If unavailable: prototype will benchmark against public BDI spot-rate proxy. **Simulated cost savings are not equivalent to verified SAIL savings.** Document with explicit caveat in all outputs. |
| **Verification status** | ⏳ Pending SAIL confirmation |

---

## 4. Data Availability Rules

1. Do not mark a source as **Available** until a team member has confirmed access and downloaded a sample.
2. Do not assume that a public website provides a free API or permission to redistribute its data. Check terms of use explicitly.
3. SAIL internal data (D02, D08) is optional during prototype development. Build data-loading modules to accept it when provided without requiring a rebuild.
4. Use clearly labeled proxy or synthetic data only where necessary for development and demonstration. Every synthetic value must be flagged `[SYNTHETIC]` in outputs and dashboards.
5. Never represent simulated savings or proxy-data-derived forecasts as verified SAIL operational results.
6. Record units, currency, timestamps, port names, and vessel-class labels consistently using the reference tables established in D05 and D06.

---

## 5. Data Readiness Gate

Before any dataset is used for model training or evaluation, confirm:

- [ ] **Provenance** — source, URL, download date documented
- [ ] **License** — permitted use confirmed (research / prototype)
- [ ] **Completeness** — missing-value rate assessed and documented
- [ ] **Historical coverage** — sufficient depth for intended model (minimum 3 years weekly for time-series models)
- [ ] **Suitability** — correct granularity (vessel class, route, port) for the intended forecast
- [ ] **Train/test split** — training data ends before evaluation period; no future data leakage

---

## 6. Outstanding Dependencies

| Dependency | Blocks | Owner |
|---|---|---|
| SAIL confirms freight-index subscriptions (D01) | Selection of primary index feed; may unlock Baltic Exchange access | SAIL PoC |
| SAIL approves historical chartering records (D02) | Route-specific model training; charter-rate accuracy improvement | SAIL PoC |
| SAIL approves historical operating costs (D08) | Verified cost-savings baseline | SAIL PoC |
| Port-authority websites verified for field-level infrastructure data (D03) | Port-constraint reference table build | Team — data lead |
| IPA / port congestion data granularity confirmed (D04) | Congestion feature engineering | Team — data lead |
| Baltic sub-index free-access dataset confirmed (D01) | MVP data pipeline build | Team — data lead |

---

## 7. Exit Criteria

The inventory is ready for data-pipeline design when:

- [ ] Every data category (D01–D08) has either a **verified accessible source** or an **explicitly documented fallback** with limitations stated.
- [ ] All port-infrastructure fields for all seven East Coast ports are populated or flagged `NEEDS_VERIFICATION`.
- [ ] The route-distance reference table is complete for all in-scope origin–destination pairs.
- [ ] Licensing and access terms have been confirmed for every source used in model training.
- [ ] The SAIL data dependency status (D02, D08) has been formally communicated to the team.

---

*Document owner: Team · Next review: after SAIL data-access decision and port-data verification*
