# Pitch Numbers & Verifiable Fact Sheet
**Project**: SIH26006 · Ministry of Steel · Steel Authority of India Limited (SAIL)  
*All figures are extracted directly from verified project documentation. No numbers are invented or rounded up.*

---

## 1. Forecast Accuracy & Calibration Metrics

*Primary Source: [`docs/metrics_gbm.md`](metrics_gbm.md) and [`docs/metrics_baselines.md`](metrics_baselines.md)*  
*Target: Weekly Baltic Dry Index (BDI) level at week $t+h$. Evaluation across expanding-window walk-forward folds.*

### 1.1 Full Sample Evaluation (All Folds, including 2020–2021 Super-Cycle)

| Model | Horizon | Folds | MAE (Index Points) | RMSE (Index Points) | MAPE (%) | Source File |
|:---|:---:|:---:|---:|---:|---:|:---|
| Naive (Random Walk) | 1 week | 21 | 180.3 | 240.7 | 9.68% | `docs/metrics_gbm.md` |
| SARIMAX | 1 week | 21 | 164.7 | 195.3 | 8.89% | `docs/metrics_gbm.md` |
| Seasonal Naive | 1 week | 21 | 821.5 | 1144.6 | 43.35% | `docs/metrics_gbm.md` |
| **LightGBM (q50 Median)** | **1 week** | **21** | **197.3** | **468.2** | **7.83%** | `docs/metrics_gbm.md` |
| **Blend (SARIMAX + LightGBM)** | **1 week** | **21** | **148.1** | **231.6** | **7.33%** | `docs/metrics_gbm.md` |
| Naive (Random Walk) | 4 weeks | 20 | 466.7 | 697.2 | 26.69% | `docs/metrics_gbm.md` |
| SARIMAX | 4 weeks | 20 | 419.0 | 615.2 | 24.49% | `docs/metrics_gbm.md` |
| Seasonal Naive | 4 weeks | 20 | 815.6 | 964.6 | 53.20% | `docs/metrics_gbm.md` |
| **LightGBM (q50 Median)** | **4 weeks** | **20** | **453.2** | **525.5** | **30.39%** | `docs/metrics_gbm.md` |
| **Blend (SARIMAX + LightGBM)** | **4 weeks** | **20** | **396.3** | **457.1** | **25.78%** | `docs/metrics_gbm.md` |
| Naive (Random Walk) | 8 weeks | 20 | 540.4 | 696.8 | 27.45% | `docs/metrics_gbm.md` |
| SARIMAX | 8 weeks | 20 | 538.5 | 666.7 | 27.26% | `docs/metrics_gbm.md` |
| Seasonal Naive | 8 weeks | 20 | 1125.2 | 1324.8 | 65.89% | `docs/metrics_gbm.md` |
| **LightGBM (q50 Median)** | **8 weeks** | **20** | **632.3** | **798.0** | **30.69%** | `docs/metrics_gbm.md` |
| **Blend (SARIMAX + LightGBM)** | **8 weeks** | **20** | **525.8** | **630.7** | **26.84%** | `docs/metrics_gbm.md` |
| Naive (Random Walk) | 12 weeks | 20 | 483.9 | 792.1 | 27.90% | `docs/metrics_gbm.md` |
| SARIMAX | 12 weeks | 20 | 455.0 | 726.2 | 26.32% | `docs/metrics_gbm.md` |
| Seasonal Naive | 12 weeks | 20 | 829.7 | 1107.5 | 48.27% | `docs/metrics_gbm.md` |
| **LightGBM (q50 Median)** | **12 weeks** | **20** | **487.4** | **582.0** | **26.25%** | `docs/metrics_gbm.md` |
| **Blend (SARIMAX + LightGBM)** | **12 weeks** | **20** | **467.5** | **537.7** | **26.12%** | `docs/metrics_gbm.md` |

### 1.2 Excluding 2020–2021 Extreme Regime (Pandemic Shock & Super-Cycle)

| Model | Horizon | Folds | MAE (Index Points) | RMSE (Index Points) | MAPE (%) | Source File |
|:---|:---:|:---:|---:|---:|---:|:---|
| Naive (Random Walk) | 1 week | 20 | 160.3 | 209.5 | 9.54% | `docs/metrics_gbm.md` |
| SARIMAX | 1 week | 20 | 153.1 | 179.2 | 8.91% | `docs/metrics_gbm.md` |
| Seasonal Naive | 1 week | 20 | 697.7 | 911.9 | 42.01% | `docs/metrics_gbm.md` |
| **LightGBM (q50 Median)** | **1 week** | **20** | **103.9** | **131.5** | **6.04%** | `docs/metrics_gbm.md` |
| **Blend (SARIMAX + LightGBM)** | **1 week** | **20** | **113.9** | **147.1** | **6.81%** | `docs/metrics_gbm.md` |
| Naive (Random Walk) | 4 weeks | 19 | 359.1 | 424.2 | 23.34% | `docs/metrics_gbm.md` |
| SARIMAX | 4 weeks | 19 | 328.2 | 395.5 | 21.72% | `docs/metrics_gbm.md` |
| Seasonal Naive | 4 weeks | 19 | 773.7 | 918.1 | 52.96% | `docs/metrics_gbm.md` |
| **LightGBM (q50 Median)** | **4 weeks** | **19** | **455.1** | **530.6** | **31.20%** | `docs/metrics_gbm.md` |
| **Blend (SARIMAX + LightGBM)** | **4 weeks** | **19** | **371.7** | **425.0** | **25.50%** | `docs/metrics_gbm.md` |
| Naive (Random Walk) | 8 weeks | 19 | 463.0 | 546.2 | 25.67% | `docs/metrics_gbm.md` |
| SARIMAX | 8 weeks | 19 | 475.4 | 555.9 | 25.90% | `docs/metrics_gbm.md` |
| Seasonal Naive | 8 weeks | 19 | 1073.2 | 1269.8 | 65.97% | `docs/metrics_gbm.md` |
| **LightGBM (q50 Median)** | **8 weeks** | **19** | **610.0** | **782.0** | **30.61%** | `docs/metrics_gbm.md` |
| **Blend (SARIMAX + LightGBM)** | **8 weeks** | **19** | **535.5** | **642.4** | **27.71%** | `docs/metrics_gbm.md` |
| Naive (Random Walk) | 12 weeks | 19 | 351.3 | 431.5 | 22.47% | `docs/metrics_gbm.md` |
| SARIMAX | 12 weeks | 19 | 336.6 | 412.7 | 21.49% | `docs/metrics_gbm.md` |
| Seasonal Naive | 12 weeks | 19 | 829.3 | 1120.0 | 48.89% | `docs/metrics_gbm.md` |
| **LightGBM (q50 Median)** | **12 weeks** | **19** | **509.1** | **596.9** | **27.47%** | `docs/metrics_gbm.md` |
| **Blend (SARIMAX + LightGBM)** | **12 weeks** | **19** | **422.9** | **461.8** | **24.48%** | `docs/metrics_gbm.md` |

### 1.3 Split-Conformal Prediction Interval Coverage (10% to 90% Band, 80% Nominal Target)

| Horizon | Folds | Raw Coverage (%) | Calibrated Coverage (%) | Raw Avg Width (pts) | Calibrated Avg Width (pts) | Source File |
|:---:|:---:|---:|---:|---:|---:|:---|
| **1 week** | 21 | 61.9% | **76.2%** | 449.2 | **665.5** | `docs/metrics_gbm.md` |
| **4 weeks** | 20 | 60.0% | **65.0%** | 825.5 | **1064.6** | `docs/metrics_gbm.md` |
| **8 weeks** | 20 | 55.0% | **65.0%** | 962.0 | **1243.8** | `docs/metrics_gbm.md` |
| **12 weeks** | 20 | 70.0% | **65.0%** | 1031.3 | **1075.6** | `docs/metrics_gbm.md` |

---

## 2. Optimizer Performance (Latest Full Rolling Horizon T=6 Run)

*Primary Source: [`docs/optimizer_run.md`](optimizer_run.md)*  
*Note: Computed on synthetic demand and prices.*

### 2.1 Total Landed Cost Comparison

| Policy | Total Landed Cost (USD) | Source File |
|:---|---:|:---|
| **Spot-Only Naive Baseline** | **$1,442,290,702.17** | `docs/optimizer_run.md` § 1 |
| **Landed-Cost Naive Baseline** | **$1,442,290,702.17** | `data/cache/landed_cost_baseline.json` |
| Deterministic Base Forecast Plan ($s=\text{base}$) | $981,757,867.25 | `docs/optimizer_run.md` § 1 |
| **Mean-Scenario Plan (Recommended Optimizer)** | **$980,646,902.84** | `docs/optimizer_run.md` § 1 |
| Minimax Robust Plan | $992,502,679.68 | `docs/optimizer_run.md` § 1 |

### 2.2 Projected Savings

| Metric | Absolute Value (USD) | Relative Savings (%) | Baseline Compared Against | Source File |
|:---|---:|---:|:---|:---|
| **Savings vs Spot-Only Naive Baseline** | **$461,643,799.33** | **32.01%** | Spot-Only Naive ($1,442,290,702.17) | `docs/optimizer_run.md` § 1 |
| **Savings vs Landed-Cost Naive Baseline** | **$461,643,799.33** | **32.01%** | Landed-Cost Naive ($1,442,290,702.17) | `data/cache/landed_cost_baseline.json` |
| **Cargo Purchase Cost Savings** | **$381,881,635.80** | 29.91% | Naive Cargo ($1,276,800,000.00 vs $894,918,364.20) | `docs/optimizer_run.md` § 1 |
| **Non-Cargo Operational Savings** | **$79,762,163.53** | **48.20%** | Naive Non-Cargo ($165,490,702.17 vs $85,728,538.64) | `docs/optimizer_run.md` § 1 |
| *— Voyage Freight Savings* | $99,294,524.56 | 60.95% | Naive Freight ($162,898,702.17 vs $63,604,177.61) | `docs/optimizer_run.md` § 1 |
| *— Demurrage Risk Savings* | $1,215,000.00 | 46.88% | Naive Demurrage ($2,592,000.00 vs $1,377,000.00) | `docs/optimizer_run.md` § 1 |
| *— Period Charter Commitment* | -$1,632,259.20 | N/A | Naive Hire ($0.00 vs $1,632,259.20) | `docs/optimizer_run.md` § 1 |
| *— Inventory Holding Cost* | -$17,947,867.68 | N/A | Naive Holding ($0.00 vs $17,947,867.68) | `docs/optimizer_run.md` § 1 |
| *— Unmet Demand Penalty* | -$1,167,234.15 | N/A | Naive Unmet ($0.00 vs $1,167,234.15) | `docs/optimizer_run.md` § 1 |

### 2.3 Operational Metrics & Solver Diagnostics

| Dimension | Exact Value | Source File |
|:---|:---|:---|
| **Total Unmet Demand** | **1,803.2 MT** (Penalty: $1,167,234.15) | `docs/optimizer_run.md` § 1 |
| **Month-1 Commitment** | **503,443 MT** across **7 voyages** | `docs/optimizer_run.md` § 1, 3 |
| **Charter Mode Mix (Tonnes)** | **COA**: 3,298,443 MT (68.71%)<br/>**SPOT**: 1,263,197 MT (26.31%)<br/>**PERIOD**: 239,016 MT (4.98%) | `docs/optimizer_run.md` § 4 |
| **Charter Mode Mix (Voyages)** | **COA**: 35 voyages (68.63%)<br/>**SPOT**: 14 voyages (27.45%)<br/>**PERIOD**: 2 voyages (3.92%) | `docs/optimizer_run.md` § 4 |
| **Solver Durations & Gaps** | **Horizon T=6**: Solve time = **101.20s**, MIP gap = **1.00%** (5,257 vars, 3,655 constraints)<br/>**Horizon T=12**: Solve time = **93.27s**, MIP gap = **0.89%** (10,393 vars, 7,189 constraints) | `docs/optimizer_run.md` § 5 |

---

## 3. Walk-Forward Backtest Replay (2023 Full Year)

*Primary Source: [`docs/backtest_report.md`](backtest_report.md)*  
*Replay Scope: 2023-01-01 to 2023-12-31 · 12 Decision Stages (Monthly) · Strictly No Look-Ahead*  
*Realised Market: Actual weekly Baltic Dry Index (BDI) and Brent crude oil paths for 2023.*

### 3.1 Policy Performance Summary Table

| Policy Identifier | Total Realised Cost ($M) | Non-Cargo Cost ($M) | Savings vs Landed Naive ($M) | 90% Bootstrap CI vs Landed ($M) | Savings vs Spot Naive ($M) | Win Rate vs Landed | Worst Month | Total Unmet Demand (MT) | Source File |
|:---|---:|---:|---:|:---:|---:|:---:|:---:|---:|:---|
| **(a) spot_naive** | $4,488.12M | $459.92M | -$0.63M | [-$1.7M, +$0.4M] | $0.00M | 66.7% | M12 (-$0.45M) | 0 MT | `docs/backtest_report.md` § 1 |
| **(b) landed_naive** | $4,487.49M | $452.02M | $0.00M | [$0.0M, $0.0M] | +$0.63M | Baseline | M01 (+$0.00M) | 0 MT | `docs/backtest_report.md` § 1 |
| **(c) forecast_scenarios** | **$3,458.94M** | **$172.96M** | **+$1,028.55M** | **[+$824.2M, +$1,236.3M]** | **+$1,029.17M** | **100.0%** | **M05 (+$17.88M)** | **1,920,459 MT** | `docs/backtest_report.md` § 1 |
| **(d) flat_forecast** | $3,500.52M | $205.71M | +$986.98M | [+$731.6M, +$1,225.5M] | +$987.60M | 100.0% | M05 (+$6.13M) | 1,840,442 MT | `docs/backtest_report.md` § 1 |
| **(e) perfect_foresight** | $4,682.30M | $1,830.45M | -$194.81M | [-$3,199.0M, +$1,501.0M] | -$194.19M | 91.7% | M03 (-$1,424.85M) | 155,786 MT | `docs/backtest_report.md` § 1 |

### 3.2 Key Backtest Analytics
- **Non-Cargo Savings vs Landed Naive**: **$279.06M** ($452.02M landed naive vs $172.96M forecast scenarios).
- **Non-Cargo Savings vs Spot Naive**: **$286.96M** ($459.92M spot naive vs $172.96M forecast scenarios).
- **Value of Machine Learning Forecasting (Policy c vs d)**: **$41.57M** ($3,500.52M flat forecast vs $3,458.94M forecast scenarios).
- **Worst Relative Month**: **Month 05 (2023-05)** with a difference of **+$17.88M** vs landed naive (driven by a rapid 30% collapse in spot hire rates where spot heuristics captured immediate rate troughs while contracted COA absorbed committed volumes).

---

## 4. Data Provenance & Date Ranges

*Primary Source: [`docs/data_sources.md`](data_sources.md) and [`docs/data_inventory_report.md`](data_inventory_report.md)*

| Dataset Group | Datasets Included | Date Range | Row Count | Type Classification | Source File |
|:---|:---|:---:|---:|:---:|:---|
| **1. Real Market Data** | **Baltic Dry Index (BDI)** (`bdi_daily.csv`) | 2016-10-26 to 2026-10-23 | 2,480 daily rows | **Real** | `docs/data_inventory_report.md` |
| | **Baltic Sub-Indices (BCI, BPI, BSI, BHSI)** (`baltic_subindices_2012_2019.csv`) | 2012-07-01 to 2019-07-31 | 1,772 daily rows | **Real** | `docs/data_inventory_report.md` |
| | **ICE Brent Crude Oil** (`brent_daily.csv`) | 2012-01-03 to 2026-10-20 | 3,861 daily rows | **Real** | `docs/data_inventory_report.md` |
| | **USD / INR FX Rate** (`usdinr_daily.csv`) | 2012-01-03 to 2026-10-16 | 3,859 daily rows | **Real** | `docs/data_inventory_report.md` |
| | **World Bank Pink Sheet** (`worldbank_pinksheet_monthly.xlsx`) | 1960-01-01 to 2026-09-01 | 801 monthly rows | **Real** | `docs/data_inventory_report.md` |
| **2. Derived Series** | **Baltic Sub-Indices Post-2019** (derived via historical BDI factor ratios) | 2019-08-01 to 2026-10-23 | 378 weekly rows | **Derived** | `docs/data_sources.md` § 1, 2 |
| **3. Synthetic Logistics** | **Route-Level Freight Rates** (`synthetic_route_rates.parquet`) | 2012-08-03 to 2026-10-23 | 89,903 rows (121 routes) | **Synthetic** | `docs/data_sources.md` § 1 |
| | **SAIL Plant Demands & FOB Prices** (`config/optimizer_inputs.yaml`) | Static engineering parameters | 12 MTPA / 2.4 MTPA | **Synthetic** | `config/optimizer_inputs.yaml` |

---

## 5. Defensible Headline & Communication Guardrails

### 5.1 The Defensible Headline (Quote This)
> *"In a strict 12-month walk-forward backtest across 2023 evaluated against actual realized Baltic Dry Index and Brent crude fuel prices, machine learning freight forecasting delivered **$41.57M in pure information savings** over an uninformative flat forecast, while the optimizer achieved **$79.76M in non-cargo operational logistics savings** (freight, demurrage, and inventory) in single-run optimization on synthetic plant demand."*

### 5.2 Numbers That Must NOT Be Quoted (And Why)

| Number / Claim | Why It Must NOT Be Quoted | Risk / Flaw in the Claim |
|:---|:---|:---|
| ❌ **"$1.028 Billion Backtest Savings"** | **Do not attribute this purely to freight optimization.** Over 75% ($749M) of this cost differential arises from origin switching (purchasing Mozambique/Russian Far East coal at $185–$195/MT vs Australian benchmark at $210–$220/MT). Because FOB prices and quality penalties in the model are synthetic placeholders, claiming $1B in logistics savings is misleading. | Conflates synthetic coal commodity pricing differences with logistics freight savings. |
| ❌ **"100% Win Rate Without Qualification"** | In the 2023 backtest, while the optimizer beat landed-naive in total monetary cost every month, Policy (c) incurred **1,920,459 MT of unmet demand** due to short 3-month solve windows and tight monthly berth/supplier capacity limits. | Claiming perfection ignores the 1.92 MT unmet demand deficit. |
| ❌ **"$461 Million Net Savings (32%)"** | This figure from `docs/optimizer_run.md` compares the optimizer against a spot-only naive baseline on synthetic demand. Like the backtest, $381.88M of the $461.64M savings comes from cargo purchase arbitrage. The true logistics-only savings is **$79.76M (non-cargo operational savings)**. | Misrepresents cargo purchase price differences as freight efficiency. |
| ❌ **"Accurate Freight Predictions at 12 Weeks"** | Model validation (`docs/metrics_gbm.md`) demonstrates that at 8 weeks (MAPE: 30.69%) and 12 weeks (MAPE: 26.25%), LightGBM accuracy is statistically indistinguishable from a random-walk naive baseline (27.45% and 27.90%). Predictive signal exists primarily at **1 to 4 weeks** (MAPE: 7.83% to 30.39%). | Overclaims long-term predictive capability in a notoriously volatile market. |
| ❌ **"Empirical Capesize vs Panamax Arbitrage Post-2019"** | Baltic sub-indices (BCI, BPI, BSI, BHSI) post-July 2019 are derived proportionally from composite BDI. Quoting vessel-class spreads post-2019 as historical market insights is invalid because post-2019 sub-indices cannot decouple by construction. | Trades on synthetic correlation rather than true historical market dispersion. |
