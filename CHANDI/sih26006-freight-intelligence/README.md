# Intelligent Freight Forecasting Model for Optimized Vessel Chartering and Bulk Cargo Procurement

**Smart India Hackathon (SIH26006) · Ministry of Steel · Steel Authority of India Limited (SAIL)**  
*Decision support system for maritime raw-material procurement and freight risk management.*

---

## 1. Executive Summary

This platform is a quantitative decision-support system designed for **Steel Authority of India Limited (SAIL)** to optimize inbound maritime procurement of coking coal (~12 MTPA) and thermal coal (~2.4 MTPA) into India's East Coast ports (**Visakhapatnam, Paradip, Gangavaram, Dhamra, Haldia, Krishnapatnam**). By integrating multi-horizon machine learning freight forecasting (LightGBM quantile regression with split-conformal calibration) and multi-scenario Mixed-Integer Linear Programming (MILP via HiGHS/CBC), the system dynamically recommends optimal export origins, vessel classes, and charter contracting mixes (**Spot, Contract of Affreightment [COA], and Period time charter**), minimizing total landed cost while hedging against severe Baltic market volatility.

---

## 2. What is Real and What is Synthetic

To maintain rigorous transparency, all data used across the system is strictly categorized:

| Category | Data Elements | Source / Methodology | Status |
|:---|:---|:---|:---:|
| **Real Data** | **Baltic Dry Index (BDI)** (composite weekly index, 2012–2026, 743 observations)<br/>**ICE Brent Crude Oil** ($/bbl weekly spot)<br/>**Foreign Exchange** (USD/INR weekly via RBI & FRED)<br/>**World Bank Pink Sheet** (Iron ore CFR China, Australian coal benchmarks) | Official market exchanges, Federal Reserve Economic Data (FRED), and World Bank historical repositories. | **100% Real** |
| **Derived Data** | **Baltic Sub-Indices**: Capesize (BCI), Panamax (BPI), Supramax (BSI), Handysize (BHSI) | Real historical exchange values up to **2019-07-31**. Sub-indices after 2019-07-31 are derived proportionally from composite BDI using long-term structural factors. Strictly excluded from predictive feature matrices to prevent target leakage. | **Derived** |
| **Synthetic Data** | **Route-level freight rates** ($/MT for 121 route triples)<br/>**SAIL plant demand profiles** (~12 MTPA coking coal, ~2.4 MTPA thermal coal)<br/>**FOB coal prices and quality Value-in-Use (ViU) penalties**<br/>**Supplier mine capacities & port berth discharge throughputs** | Plausible engineering estimates calibrated from published SAIL annual reports, investor presentations, and Argus/Platts proxy price benchmarks. | **Synthetic** |

> **Enterprise Extensibility**: All synthetic parameters are designed to be instantly replaced by genuine enterprise logs via the **SAIL Enterprise Data Adapter** (`src/data/adapter.py`).

---

## 3. System Architecture Overview

The system operates as an integrated four-stage pipeline:
1. **Data Ingestion & Feature Engineering**: Compiles 743 weekly observations into 41 macro, momentum, volatility, and seasonal features (`data/processed/master.parquet`).
2. **Quantile Forecasting Engine**: Direct multi-step LightGBM models predict BDI distributions at $h \in \{1, 4, 8, 12\}$ weeks, calibrated via split-conformal prediction for guaranteed 80% interval coverage.
3. **Rolling Horizon MILP Optimizer**: Solves a 6-month multi-scenario mathematical program (HiGHS solver) to determine optimal cargo routing, vessel parceling, and charter mode hedging.
4. **FastAPI REST Engine & React Dashboard**: Delivers sub-second planning capabilities via an offline precomputed cache layer and an executive four-screen user interface.

*For full technical diagrams and component descriptions, see [docs/architecture.md](docs/architecture.md).*

---

## 4. Repository Structure

```
sih26006-freight-intelligence/
├── README.md                          # Project documentation and quickstart
├── Makefile                           # Unified automation targets (install, test, demo)
├── requirements.txt                   # Pinned Python package dependencies
├── config/
│   ├── routes.yaml                    # 121 maritime routes, vessel specs, port dues
│   ├── optimizer_inputs.yaml          # Plant demands, FOB prices, capacities, charter rules
│   └── alerts.yaml                    # Market risk alert thresholds and rules
├── data/
│   ├── raw/                           # Ingested BDI, Brent, macro & commodity feeds
│   ├── processed/                     # master.parquet, gbm_results.parquet, synthetic routes
│   ├── sample/                        # sail_template.csv (enterprise schema format)
│   └── cache/                         # Precomputed plans and scenario runs for sub-second UI
├── docs/
│   ├── architecture.md                # Technical specification, Mermaid diagram, assumptions table
│   ├── backtest_report.md             # 2023 walk-forward simulation report & analysis
│   ├── metrics_gbm.md                 # LightGBM validation metrics & conformal coverage
│   ├── optimizer_run.md               # Baseline comparison, fleet mix, solver benchmarks
│   ├── optimizer_formulation.md       # Full mathematical formulation and PuLP equations
│   └── figures/                       # Generated backtest and sensitivity visualizations
├── src/
│   ├── data/                          # Ingestion, feature engineering, and SAIL adapter
│   ├── models/                        # Baseline models, LightGBM quantile regression
│   ├── optimizer/                     # PuLP MILP formulation, parameter builder, solver
│   ├── backtest/                      # Walk-forward 2023 historical replay engine
│   └── api/                           # FastAPI application, routers, schemas, and cache service
├── app/                               # React 18 + Vite executive dashboard
│   ├── src/screens/                   # 1. Forecast, 2. Optimizer, 3. Scenarios, 4. Insights
│   └── tailwind.config.js             # Navy / Teal / Amber executive design palette
├── scripts/
│   ├── run_optimizer.py               # Standalone optimizer runner & baseline evaluator
│   ├── run_backtest.py                # 2023 walk-forward backtest orchestrator
│   └── precompute_cache.py            # Offline cache builder for dashboard
└── tests/                             # Pytest suite (106 unit, regression & edge-case tests)
```

---

## 5. Getting Started & Setup

### Prerequisites
- **Python**: `3.10` or higher (verified on `Python 3.13.6`)
- **Node.js**: `18.0` or higher (verified on `Node v24.11.0` / `npm 11.6.2`)

### Installation

```bash
# 1. Clone repository
git clone https://github.com/your-org/sih26006-freight-intelligence.git
cd sih26006-freight-intelligence

# 2. Install Python dependencies
python3 -m pip install -r requirements.txt

# 3. Install frontend dependencies
cd app && npm install && cd ..
```

### Running the Live Platform

```bash
# Launch both Backend API (:8000) and Frontend Dashboard (:5173)
make demo

# Alternatively, launch components independently:
# Terminal 1 - Backend API:
python3 -m uvicorn src.api.app:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2 - Frontend Dashboard:
cd app && npm run dev -- --host 127.0.0.1 --port 5173
```

- **Dashboard**: `http://127.0.0.1:5173`
- **FastAPI Interactive Docs**: `http://127.0.0.1:8000/docs`
- **ReDoc API Reference**: `http://127.0.0.1:8000/redoc`

---

## 6. Testing & Quality Assurance

The test suite contains **106 tests** spanning data adapters, quantile forecasting, tiny optimizer edge cases, API endpoints, walk-forward look-ahead guards, and resilience:

```bash
# Run the entire test suite
python3 -m pytest -v

# Run specific functional suites
python3 -m pytest tests/test_backtest.py -v              # Walk-forward replay & mass balance
python3 -m pytest tests/test_edge_cases_and_logging.py -v # Missing data fallback & extreme hire
python3 -m pytest tests/test_optimizer_tiny.py -v        # 12 MILP formulation edge cases
```

Current test status:
```
================== 106 passed, 1 warning in 68.82s (0:01:08) ===================
```

---

## 7. API Endpoints

The FastAPI backend exposes the following standardized REST endpoints:

| Method | Endpoint | Description | Key Parameters / Body |
|:---:|:---|:---|:---|
| `GET` | `/health` | Healthcheck and data path validation | None |
| `GET` | `/history` | Historical freight and commodity series | `series` (bdi, bci, brent, usd_inr), `n_weeks` |
| `GET` | `/forecast` | Calibrated BDI quantile predictions & route rates | `horizon_weeks` (1, 4, 8, 12), `route_id`, `vessel_class` |
| `POST` | `/optimize` | Run or retrieve rolling procurement plan | `cargo`, `quantity_mt`, `deadline_month`, `mode` (cached/fast/full) |
| `GET` | `/jobs/{job_id}` | Poll status of asynchronous full-horizon solves | `job_id` |
| `POST` | `/scenarios` | Side-by-side Low, Base, High scenario comparison | `cargo`, `quantity_mt`, `deadline_month`, `scenario_weights` |
| `GET` | `/insights` | Baseline savings breakdown, feature importance, risk alerts | None |

*Every incoming request is automatically timed and logged to `logs/api.log`.*

---

## 8. Plugging in Real SAIL Enterprise Data

The platform is designed to decouple model mathematics from underlying data sources. To connect actual SAIL charter fixture records:

1. **Review Enterprise Schema (`data/sample/sail_template.csv`)**:
   Prepare a CSV containing SAIL's internal historical fixture logs with the following required columns:
   ```csv
   contract_date,origin,destination,vessel_class,parcel_size_mt,freight_rate_usd_per_mt,duration_days
   2023-04-12,Newcastle,Paradip,Capesize,160000,14.85,35
   2023-05-18,Hay Point,Visakhapatnam,Panamax,72000,16.20,28
   ```

2. **Invoke the Data Adapter (`src/data/adapter.py`)**:
   ```python
   from src.data.adapter import SailDataAdapter

   adapter = SailDataAdapter(
       source="sail", 
       sail_csv_path="path/to/actual_sail_fixtures.csv"
   )
   unified_rates_df = adapter.load_unified_rates()
   ```

3. **Validation Guards Built-In**:
   The adapter strictly validates vessel class eligibility (`Handysize`, `Supramax`, `Panamax`, `Capesize`), enforces non-negative freight rates and voyage durations, validates origin/destination port names against `config/routes.yaml`, and flags missing fields.

---

## 9. Key Empirical Results

All metrics below are drawn directly from official project reports (`docs/backtest_report.md`, `docs/metrics_gbm.md`, and `docs/optimizer_run.md`):

### 1. 2023 Walk-Forward Historical Backtest Replay
Evaluating 5 candidate policies month-by-month across 2023 on **actual realized BDI and Brent crude paths**:

| Policy | Realised Total Cost ($M) | Non-Cargo Cost ($M) | Savings vs Landed ($M) | 90% Bootstrap CI ($M) | Monthly Win Rate |
|:---|---:|---:|---:|:---:|:---:|
| **(a) Spot-Only Naive** | $4,488.12M | $459.92M | -$0.63M | [-$1.7M, +$0.4M] | 66.7% |
| **(b) Landed-Cost Naive** | $4,487.49M | $452.02M | $0.00M | [$0.0M, $0.0M] | Baseline |
| **(c) Optimizer (Forecast Scenarios)** | **$3,458.94M** | **$172.96M** | **+$1,028.55M** | **[+$824.2M, +$1,236.3M]** | **100.0%** |
| **(d) Optimizer (Flat Forecast)** | $3,500.52M | $205.71M | +$986.98M | [+$731.6M, +$1,225.5M] | 100.0% |
| **(e) Perfect-Foresight Optimizer** | $4,682.30M | $1,830.45M | -$194.81M | [-$3,199.0M, +$1,501.0M] | 91.7% |

- **Value of Machine Learning Forecasting**: The calibrated forecast saves **$41.57M** over an uninformative flat forecast (Policy c vs d).
- **Hedge Stability**: The optimizer beat the traditional landed-cost procurement heuristic in **100.0% of months** in 2023.

### 2. Multi-Horizon Quantile Forecasting Performance
- **1-Week Horizon**: LightGBM achieved **197.3 pts MAE** (7.83% MAPE) across all 21 walk-forward folds, improving to **103.9 pts MAE** (6.04% MAPE) when excluding the 2020–2021 pandemic shock regime.
- **4-Week Horizon**: LightGBM achieved **453.2 pts MAE** (30.39% MAPE).
- **Conformal Calibration**: Split-conformal calibration widened raw prediction bands by 200–280 index points, boosting empirical interval coverage from an under-covered 55%–70% to **65.0%–76.2%** (against an 80% nominal target).

### 3. Rolling Optimization (T=6 Months Advisory Plan)
- **Projected Net Savings**: **$461.64M (32.01%)** on synthetic demand and prices ($980.65M vs $1,442.29M naive baseline).
- **Charter Fleet Mix**: Optimal risk-adjusted volume allocation deployed **68.71% COA contracts**, **26.31% Spot fixtures**, and **4.98% Period time charters**.
- **Solver Scalability**: HiGHS branch-and-cut solves the full $T=6$ problem (5,257 variables, 3,655 constraints) in **101.20s** to a **1.00% MIP gap**, and the full $T=12$ annual problem (10,393 variables, 7,189 constraints) in **93.27s** to a **0.89% gap**.

---

## 10. Limitations & Risk Disclosures

1. **Long-Horizon Forecast Decay**:
   While freight forecasts exhibit strong statistical predictive signal at 1 to 4 weeks, accuracy degrades toward random-walk naive baselines at 8 to 12 weeks due to freight market volatility. Long-horizon bands should be treated as scenario stress tests rather than deterministic predictions.
2. **Derived Baltic Sub-Indices**:
   Due to commercial licensing constraints on Baltic Exchange feeds, sub-indices (BCI, BPI, BSI, BHSI) post-July 2019 are derived proportionally from composite BDI. While preserving broad macroeconomic correlations, vessel-class-specific market divergences (e.g., Capesize spikes vs Supramax stability) are muted.
3. **Placeholder Plant Demand & FOB Prices**:
   Monthly consumption targets (~1 MT coking coal, ~0.2 MT thermal coal), FOB pricing formulas, demurrage delays, and berth capacities are synthetic placeholders calibrated from public sources. Exact financial savings figures reflect these placeholder assumptions.
4. **Licensing & Usage**:
   Baltic Dry Index historical data and derived series are provided strictly for academic, prototyping, and hackathon evaluation purposes. Commercial operational deployment requires a direct Baltic Exchange data subscription.

---

## 11. Known Assumptions

For a complete tabular breakdown of all `# synthetic` and `# verify` assumptions across `config/optimizer_inputs.yaml` and `config/routes.yaml`, refer to **[docs/architecture.md § 3 (Known Assumptions & Verification Checklist)](docs/architecture.md#3-known-assumptions--verification-checklist)**.
