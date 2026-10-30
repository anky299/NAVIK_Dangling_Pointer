# Project Scope — SIH26006
**Intelligent Freight Forecasting Model for Optimized Vessel Chartering and Bulk Cargo Procurement**  
*Ministry of Steel · Steel Authority of India Limited (SAIL) · Smart India Hackathon 2026*

---

## 1. Cargo Types

- **Primary Cargo:** Coking coal (vital raw material for SAIL blast furnace steelmaking operations).
- **Secondary / Proxy Cargoes (verify):** Thermal coal, PCI coal (pulverized coal injection), and iron ore (primarily referenced as correlated dry-bulk drivers).
  > *(Note: The problem statement explicitly centers on coking coal and bulk cargo procurement for steel production).*

---

## 2. Origin Countries & Loading Ports

The problem statement specifies 5 origin countries. Specific loading ports are identified from major bulk export terminals and marked *(verify)* pending SAIL confirmation:

| Country | Candidate Loading Port(s) | Status | Primary Cargo Handled |
|---|---|---|---|
| **Australia** | Hay Point (QLD), Dalrymple Bay (QLD), Gladstone (QLD), Newcastle (NSW) | *(verify)* | Coking coal, thermal coal |
| **United States** | Hampton Roads (Norfolk / Newport News, VA) | *(verify)* | Metallurgical coking coal |
| **Mozambique** | Nacala, Beira | *(verify)* | Coking coal |
| **Russia** | Vanino (Far East), Murmansk, Ust-Luga | *(verify)* | Metallurgical coal, coking coal |
| **Indonesia** | Taboneo / Banjarmasin anchorage, Samarinda, Balikpapan (Kalimantan) | *(verify)* | Thermal coal, metallurgical coal blends |

---

## 3. East Coast Destination Ports & Draft Limits

The problem statement explicitly restricts scope to 7 ports along the East Coast of India. Permissible draft and LOA constraints are collated from published port profiles and marked *(verify)*:

| Port Name | Port Authority / Operator | Max Permissible Draft (m) | Max Permissible LOA (m) | Berthing / Cargo Handling Notes |
|---|---|---|---|---|
| **Paradip** | Paradip Port Authority | ~14.5 – 16.0 m *(verify)* | ~230 – 260 m *(verify)* | Dedicated mechanized coal berths; handles Panamax and geared Capesize *(verify)*. |
| **Visakhapatnam (Vizag)** | Visakhapatnam Port Authority | ~14.5 – 18.1 m *(verify)* | ~230 – 300 m *(verify)* | Outer Harbour handles Capesize (~18.1 m draft); Inner Harbour restricted to Panamax (~14.5 m draft) *(verify)*. |
| **Gangavaram** | Gangavaram Port Ltd (Adani) | ~16.5 – 19.5 m *(verify)* | Up to ~300 m *(verify)* | Deep-water port capable of handling fully laden Capesize and Baby-Cape vessels *(verify)*. |
| **Gopalpur** | Gopalpur Ports Ltd | ~12.5 – 14.5 m *(verify)* | ~225 m *(verify)* | Primarily handles Handysize, Supramax, and geared Panamax *(verify)*. |
| **Dhamra** | Dhamra Port Company Ltd (Adani) | ~17.5 – 18.0 m *(verify)* | Up to ~300 m *(verify)* | Deep-water port with mechanized bulk berths; Capesize capable *(verify)*. |
| **Sagar-Sandheads** | Syama Prasad Mookerjee Port (Kolkata) | Deep-water anchorage / ~9.0 – 11.5 m *(verify)* | Transshipment / lighterage | Offshore lighterage and transshipment zone for lightening deep-draft vessels prior to riverine transit *(verify)*. |
| **Haldia** | Haldia Dock Complex (SMP Kolkata) | ~7.5 – 8.5 m (riverine tidal) *(verify)* | ~230 m *(verify)* | Severe draft restrictions due to Hooghly river navigation; requires parcel lightening or Handysize/Supramax vessels *(verify)*. |

---

## 4. Vessel Classes

Four standard bulk carrier classes specified in the problem statement:

| Vessel Class | Deadweight Tonnage (DWT) | Typical LOA | Typical Beam | Typical Max Draft | Suitability Summary |
|---|---|---|---|---|---|
| **Handysize** | 10,000 – 40,000 MT | 150 – 200 m | 23 – 32 m | 9.0 – 11.0 m | High maneuverability; suitable for restricted ports like Haldia or regional origins. |
| **Supramax** | 40,000 – 65,000 MT | 180 – 200 m | 30 – 34 m | 11.0 – 13.0 m | Geared vessels; highly flexible across all 7 destination ports. |
| **Panamax** | 65,000 – 100,000 MT | 215 – 230 m | 32.2 m | 12.0 – 14.5 m | Workhorse for international coking coal; berths at Paradip, Vizag, Gangavaram, Dhamra. |
| **Capesize** | 100,000 – 180,000+ MT | 230 – 300 m | 43 – 50 m | 16.0 – 18.5 m | Lowest unit transport cost; restricted to deep-water ports (Gangavaram, Dhamra, Vizag Outer) or lighterage at Sagar-Sandheads. |

---

## 5. Decisions Output by the System

The system operates strictly as an **advisory intelligence tool** and produces the following recommendations:

1. **Market Entry Timing:** Recommended calendar windows (e.g., immediate spot entry vs. forward multi-week charter lock-in) to minimize rate volatility exposure.
2. **Contract Structure:** Advisory comparison between single-voyage spot chartering vs. short-to-medium term multi-voyage contracts.
3. **Vessel Class Selection:** Recommended vessel category (Handysize, Supramax, Panamax, Capesize) based on cargo parcel size, origin handling facilities, and destination port draft/berth constraints.
4. **Port Allocation & Route Compatibility:** Port feasibility screening flagging physical non-compliance (draft, LOA, beam) and demurrage/waiting risk.
5. **Idle & Positioning Advisory:** Warnings on low-demand cycles and deadheading avoidance strategies.
6. **Risk Mitigation Alerts:** Early warnings on market volatility spikes and destination port congestion.

---

## 6. Forecast Horizons

- **Primary Horizon (MVP):** **4 weeks ahead** (weekly granularity), aligned with typical procurement lead time and laycan booking windows.
- **Secondary Views (Post-MVP / Future enhancement):** **8 weeks** and **12 weeks** forward outlooks for quarterly budgeting and medium-term contract planning *(verify with SAIL)*.

---

## 7. Out-of-Scope Items

1. **Automated Trade Execution:** No automated contract placement, electronic signing, or broker bidding execution; all actions require human approval.
2. **Real-time AIS Vessel Fleet Tracking:** Live AIS satellite positions, individual vessel tracking, or dynamic sea-route recalculations are excluded from the MVP.
3. **Internal Fleet Operations:** SAIL does not own commercial bulk carrier fleets; operational vessel maintenance, crew management, and mechanical ship operations are excluded.
4. **Ports Outside the East Coast of India:** West Coast ports (e.g., JNPT, Kandla, Mumbai) and international non-origin transshipment hubs are excluded.
5. **Non-Dry-Bulk Cargoes:** Liquid cargo (crude oil, LNG), containerized freight, and breakbulk cargo are excluded.
6. **Commercial Guarantee of Cost Reductions:** Simulated cost savings from historical benchmarks will not be represented as guaranteed real-world financial gains without validated SAIL operational records.
