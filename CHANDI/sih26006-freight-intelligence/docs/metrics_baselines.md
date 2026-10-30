# Baseline Forecast Metrics — Weekly BDI

**Target**: BDI level at week t+h, forecast from features known at week t.  
**Series**: all weekly BDI observations (real history + synthetically derived post-2019).  
**CV scheme**: expanding window, min 5 years training, 13-week step, h-week gap.  
**Horizons**: 1, 4, 8, 12 weeks.

> **Regime note**: 2020-2021 is an extreme volatility regime.  
> 2020: COVID-19 demand collapse. 2021: dry-bulk super-cycle (BDI > 5,600 pts).  
> Metrics are reported with and without this period so regime sensitivity is visible.

---

## All Folds (including 2020–2021 extreme regime)

| model | horizon weeks | n folds | MAE | RMSE | MAPE |
| --- | --- | --- | --- | --- | --- |
| naive | 1 | 21 | 180.3 | 240.7 | 9.68% |
| sarimax | 1 | 21 | 164.7 | 195.3 | 8.89% |
| seasonal_naive | 1 | 21 | 821.5 | 1144.6 | 43.35% |
| naive | 4 | 20 | 466.7 | 697.2 | 26.69% |
| sarimax | 4 | 20 | 419.0 | 615.2 | 24.49% |
| seasonal_naive | 4 | 20 | 815.6 | 964.6 | 53.20% |
| naive | 8 | 20 | 540.4 | 696.8 | 27.45% |
| sarimax | 8 | 20 | 538.5 | 666.7 | 27.26% |
| seasonal_naive | 8 | 20 | 1125.2 | 1324.8 | 65.89% |
| naive | 12 | 20 | 483.9 | 792.1 | 27.90% |
| sarimax | 12 | 20 | 455.0 | 726.2 | 26.32% |
| seasonal_naive | 12 | 20 | 829.7 | 1107.5 | 48.27% |

---

## Excluding 2020–2021 Extreme Regime

| model | horizon weeks | n folds | MAE | RMSE | MAPE |
| --- | --- | --- | --- | --- | --- |
| naive | 1 | 20 | 160.3 | 209.5 | 9.54% |
| sarimax | 1 | 20 | 153.1 | 179.2 | 8.91% |
| seasonal_naive | 1 | 20 | 697.7 | 911.9 | 42.01% |
| naive | 4 | 19 | 359.1 | 424.2 | 23.34% |
| sarimax | 4 | 19 | 328.2 | 395.5 | 21.72% |
| seasonal_naive | 4 | 19 | 773.7 | 918.1 | 52.96% |
| naive | 8 | 19 | 463.0 | 546.2 | 25.67% |
| sarimax | 8 | 19 | 475.4 | 555.9 | 25.90% |
| seasonal_naive | 8 | 19 | 1073.2 | 1269.8 | 65.97% |
| naive | 12 | 19 | 351.3 | 431.5 | 22.47% |
| sarimax | 12 | 19 | 336.6 | 412.7 | 21.49% |
| seasonal_naive | 12 | 19 | 829.3 | 1120.0 | 48.89% |

---

## Notes
- **naive**: predicts BDI(t+h) = BDI(t). Equivalent to a random-walk forecast.
- **seasonal_naive**: predicts the same week one year ago.
- **sarimax**: SARIMA(1,1,1)(1,0,0,4) with exogenous regressors
  `brent_crude_lag_1w` and `is_monsoon`.
  A separate model is fitted per fold using only training data (direct multi-step).
- MAPE is in percent. MAE and RMSE are in BDI index points.
