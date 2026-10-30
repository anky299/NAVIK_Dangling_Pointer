# Data Inventory Report
*Generated on: 2026-10-29*

## 1. Dataset Overview

| Dataset Name | Detected Frequency | Start Date | End Date | Row Count | Missing Value Count | Gaps (>7d / >40d) |
|---|---|---|---|---|---|---|
| `baltic_subindices` | Daily | 2012-07-01 | 2019-07-31 | 1,772 | 92 ({'bhsi': 23, 'bsi': 23, 'bpi': 23, 'bci': 23}) | 7 gaps (holiday closures):<br>e.g. 2012-12-24 to 2013-01-02 (9d) ... 2018-12-24 to 2019-01-02 (9d) |
| `bdi_daily` | Daily | 2016-10-26 | 2026-10-23 | 2,480 | 0 | 10 gaps (holiday closures):<br>e.g. 2016-12-23 to 2017-01-03 (11d) ... 2025-12-24 to 2026-01-02 (9d) |
| `brent_daily` | Daily | 2012-01-03 | 2026-10-20 | 3,861 | 111 ({'brent_crude': 111}) | None |
| `usdinr_daily` | Daily | 2012-01-03 | 2026-10-16 | 3,859 | 160 ({'usd_inr': 160}) | None |
| `worldbank_pinksheet_monthly` | Monthly | 1960-01-01 | 2026-09-01 | 801 | 408 ({'coal_australian': 120, 'coal_south_african': 288}) | None |

---

## 2. Automated Flags & Integrity Checks

### 2.1 Stale Datasets (End Date > 30 Days Before Today)
- ⚠️ **`baltic_subindices`**: Ended on `2019-07-31` (2,647 days behind today `2026-10-29`).
- ⚠️ **`worldbank_pinksheet_monthly`**: Ended on `2026-09-01` (58 days behind today `2026-10-29`).

### 2.2 Truncated History (Starts After 2013-01-01)
- ⚠️ **`bdi_daily`**: Starts on `2016-10-26` (lacks 2012–2016 historical coverage).

### 2.3 Baltic Sub-indices Coverage Check
- ✅ **`baltic_subindices`**: Ends exactly on expected date `2019-07-31`. Confirms known historical horizon (2012–2019).

### 2.4 Gap Observations
- **`baltic_subindices`**: Contains 7 gap(s) exceeding the threshold. All detected gaps coincide with annual year-end exchange/market closures (e.g., Dec 23/24 to Jan 2/4).
- **`bdi_daily`**: Contains 10 gap(s) exceeding the threshold. All detected gaps coincide with annual year-end exchange/market closures (e.g., Dec 23/24 to Jan 2/4).
