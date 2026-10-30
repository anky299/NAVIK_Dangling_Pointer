# Data Sources Register — SIH26006
**Intelligent Freight Forecasting Model for Optimized Vessel Chartering and Bulk Cargo Procurement**  
*Ministry of Steel · Steel Authority of India Limited (SAIL) · Smart India Hackathon 2026*

---

## 1. Data Source Inventory

The following table records every dataset ingested by the data loading pipeline. All date ranges and row characteristics reflect verified figures extracted directly from the raw files via [`src/data/loaders.py`](file:///Users/shadow/Desktop/CHANDI/sih26006-freight-intelligence/src/data/loaders.py).

| Dataset | Raw File | Source Name & URL | Frequency | Date Range (Loaded Data) | Licence / Usage Note | Real or Synthetic |
|---|---|---|---|---|---|---|
| **Baltic Dry Index (BDI)** | `data/raw/bdi_daily.csv` | Investing.com Baltic Dry Index Historical Data<br>[investing.com/indices/baltic-dry-historical-data](https://www.investing.com/indices/baltic-dry-historical-data) *(verify)* | Daily | **2016-10-26 to 2026-10-23** | Free public website export; non-commercial / hackathon prototype use only *(verify)* | Real |
| **Baltic Sub-indices (BCI, BPI, BSI, BHSI)** | `data/raw/baltic_subindices_2012_2019.csv` | Baltic Exchange / Academic & Market Data Repositories *(verify)*<br>[balticexchange.com](https://www.balticexchange.com) *(verify)* | Daily | **2012-07-01 to 2019-07-31** | Proprietary Baltic Exchange benchmark series; restricted to academic / hackathon demonstration only *(verify)* | Real (Historical) |
| **Brent Crude Oil** | `data/raw/brent_daily.csv` | Federal Reserve Bank of St. Louis (FRED)<br>[fred.stlouisfed.org/series/DCOILBRENTEU](https://fred.stlouisfed.org/series/DCOILBRENTEU) | Daily | **2012-01-03 to 2026-10-20** | Open public data (US Government / FRED terms of use); free for research & operational use | Real |
| **USD / INR FX Rate** | `data/raw/usdinr_daily.csv` | Federal Reserve Bank of St. Louis (FRED)<br>[fred.stlouisfed.org/series/DEXINUS](https://fred.stlouisfed.org/series/DEXINUS) | Daily | **2012-01-03 to 2026-10-16** | Open public data (US Government / FRED terms of use); free for research & operational use | Real |
| **World Bank Pink Sheet (Australian Coal, South African Coal, Iron Ore)** | `data/raw/worldbank_pinksheet_monthly.xlsx` | World Bank Group Commodity Markets ("The Pink Sheet", Oct 2026 release)<br>[worldbank.org/en/research/commodity-markets](https://www.worldbank.org/en/research/commodity-markets) | Monthly | **1960-01-01 to 2026-09-01** | Creative Commons Attribution 4.0 International (CC BY 4.0); free open access with attribution | Real |
| **Route-Level Freight Rates (Planned)** | `data/processed/synthetic/route_rates_synthetic.parquet` | Derived via mathematical decomposition: Baltic index $\times$ distance factor $\times$ seasonal factor $+$ noise | Weekly | Derived from index windows | Synthetic simulation strictly flagged `is_synthetic=True` | Synthetic |

---

## 2. Dataset Limitations & Proxy Assumptions

The prototype operates under the following documented constraints and methodological approximations:

1. **Prototype License Restriction:**
   Baltic Exchange data (both aggregate BDI and individual vessel sub-indices) is incorporated strictly for hackathon prototyping, academic exploration, and demonstration purposes. Production deployment requires an enterprise commercial subscription from the Baltic Exchange or authorized redistributors.

2. **Truncated Sub-indices & Derived Estimation:**
   The genuine sub-index series (`bci`, `bpi`, `bsi`, `bhsi`) end on **`2019-07-31`**. Any sub-index values required beyond July 2019 are statistically estimated from the composite BDI (which spans up to October 2026) using historical vessel-class share regressions, and are explicitly labelled as **`derived`**.

3. **Coal Proxy (Thermal vs. Coking Coal):**
   The World Bank Pink Sheet reports benchmark thermal coal prices (Australian Newcastle thermal coal and South African Richards Bay thermal coal), but does not publish a standalone coking/metallurgical coal index. Because coking coal and thermal coal are strongly co-integrated through international energy markets and mining economics, Australian and South African thermal coal series serve as proxy indicators for coking coal procurement cost trends.

4. **Bunker Fuel Proxy:**
   In the absence of a direct spot bunker fuel index (VLSFO / IFO 380 at Singapore or Fujairah bunkering ports), daily Brent crude oil prices (`brent_daily.csv`) are utilized as a macro proxy for marine vessel fuel expenditure.

5. **Synthetic Route Rates:**
   SAIL internal fixture history has not yet been furnished. Consequently, route-level spot freight rates for specific origin-destination pairs (e.g., Hay Point $\rightarrow$ Paradip, Hampton Roads $\rightarrow$ Vizag) are generated synthetically from vessel sub-indices and nautical distance factors. Every generated route rate record carries the explicit column flag **`is_synthetic=True`**.

6. **Reporting Latency on Macro Indicators:**
   Daily FRED series (`brent_daily.csv` and `usdinr_daily.csv`) exhibit a publication lag of approximately 1 to 2 weeks relative to live spot transactions. Feature engineering and forecasting pipelines accommodate this reporting latency to avoid lookahead bias.

7. **Approximation in Baltic Index-to-Hire Conversion:**
   Baltic Exchange sub-indices (BCI, BPI, BSI, BHSI) are published in index points rather than currency. Historical daily Time Charter Equivalent (TCE) hire values are converted using standard linear multipliers (BCI: 9.07, BPI: 9.00, BSI: 12.64, BHSI: 18.00 USD/day per point). These multipliers represent an analytical assumption derived from historical benchmark averages; actual historical spot hire values are approximate and will be calibrated against SAIL charter contracts when internal fixture records become available.

8. **Proportional Post-2019 Derived Sub-indices:**
   Because sub-indices after July 2019 are derived via fixed historical contribution shares from the aggregate Baltic Dry Index (BDI), all derived sub-indices move proportionally with BDI. Consequently, real-world post-2019 market divergences between vessel classes (such as Capesize supply shocks decoupling from Panamax/Supramax rates) are not captured in the derived series.
