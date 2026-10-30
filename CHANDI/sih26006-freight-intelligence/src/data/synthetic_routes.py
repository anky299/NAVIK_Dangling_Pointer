"""Synthetic Route-Level Freight Rate Generator (SIH26006 / SAIL).

Methodology & Problem Pitch:
-----------------------------
SAIL requires bulk procurement of coking coal from overseas suppliers (Australia,
USA, Mozambique, Russia, Indonesia) transported to eastern Indian ports (Visakhapatnam,
Paradip, Gangavaram, Haldia, Dhamra, Krishnapatnam). Because public markets only quote
aggregate dry-bulk indices (BDI, BCI, BPI, BSI, BHSI) rather than direct route-specific
freight contracts ($/MT), this module bridges the macro-to-micro gap in two transparent stages:

1. Stage A (Sub-index Harmonization & Linear Share Decomposition):
   Genuine sub-index series (BCI, BPI, BSI, BHSI) terminate on 2019-07-31, whereas the
   composite Baltic Dry Index (BDI) extends up to October 2026. Because the Baltic Exchange
   formally revised the BDI weighting formula on 1 March 2018 (40% Capesize, 30% Panamax,
   30% Supramax, and completely removed Handysize), we calibrate an OLS model without intercept
   on the post-formula overlap period (2018-03-01 to 2019-07-31):
       BDI = a * BCI + b * BPI + c * BSI
   For all dates after 2019-07-31, BDI is decomposed into the three component sub-indices
   using their historical average contribution shares:
       sub_i = share_i * BDI / coef_i
   Handysize (BHSI), which is absent from post-2018 BDI, is derived via the long-run median
   ratio BHSI / BSI across the entire 2012-2019 real data period.
   All estimated post-2019 records carry `is_derived=True`.

   IMPORTANT LIMITATION: Because derived sub-indices move proportionally with BDI under
   fixed historical shares, real post-2019 market divergences between vessel classes are
   not captured.

2. Stage B (Voyage Charter Economics & Route Rates):
   Weekly market rates ($/MT) are generated for each eligible route and vessel class using
   standard maritime voyage charter economics:
     - Daily Time Charter Equivalent (TCE) Hire: Derived from vessel sub-indices using
       official multiplier conversions from config/routes.yaml.
     - Voyage Duration: Direct sailing time based on nautical distance and vessel speed
       (with ballast return leg doubled if round_trip=True) plus loading and discharging port days.
     - Fuel & Bunker Costs: Voyage fuel consumption multiplied by the prevailing VLSFO price
       (modeled as a crack-spread factor over weekly Brent crude).
     - Port Tariffs: Standard port dues and handling fees per call.
     - Realistic Market Dynamics: Multiplicative seasonal adjustments and subtle AR(1)
       volatility noise (3-5%) with fixed random seeds, strictly flagged with `is_synthetic=True`.
"""

import logging
import os
import re
import sys
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_CONFIG_PATH = os.path.join(PROJECT_ROOT, "config", "routes.yaml")
PROCESSED_DIR = os.path.join(PROJECT_ROOT, "data", "processed")


def load_routes_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """Parse config/routes.yaml into a structured configuration dictionary.

    Supports PyYAML if installed; falls back to an internal regex parser.
    """
    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH

    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Routes configuration file not found at: {config_path}")

    try:
        import yaml
        with open(config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except ImportError:
        logger.info("PyYAML not installed. Using internal parser for '%s'.", config_path)

    with open(config_path, "r", encoding="utf-8") as f:
        text = f.read()

    config: Dict[str, Any] = {
        "vessel_classes": {},
        "ports": {},
        "routes": [],
        "bunker": {},
        "charter_options": {"round_trip": True},
        "index_to_hire": {},
    }

    # Extract bunker
    m_bunker = re.search(r"brent_to_vlsfo_factor:\s*([0-9.]+)", text)
    if m_bunker:
        config["bunker"]["brent_to_vlsfo_factor"] = float(m_bunker.group(1))

    # Extract charter options
    m_round = re.search(r"round_trip:\s*(true|false)", text, re.IGNORECASE)
    if m_round:
        config["charter_options"]["round_trip"] = m_round.group(1).lower() == "true"

    # Extract index_to_hire
    re_hire = re.findall(
        r"^\s{2}([a-z]{3,4}):.*?\n(?:^\s{4}.*?\n)*?^\s{4}factor:\s*([0-9.]+)",
        text,
        re.MULTILINE,
    )
    for idx_code, factor in re_hire:
        config["index_to_hire"][idx_code] = {"factor": float(factor)}

    # Extract vessel classes
    vessel_text = text[text.find("vessel_classes:") : text.find("ports:")]
    vessel_blocks = re.findall(
        r"^\s{2}([A-Za-z]+):\s*\n((?:^\s{4}.*?\n)+)",
        vessel_text,
        re.MULTILINE,
    )
    for v_name, block in vessel_blocks:
        v_dict = {}
        for line in block.splitlines():
            m = re.match(r"^\s{4}([a-z0-9_]+):\s*([^#\n]+)", line)
            if m:
                k = m.group(1).strip()
                v = m.group(2).strip().strip('"\'')
                try:
                    v_dict[k] = float(v) if "." in v else int(v)
                except ValueError:
                    v_dict[k] = v
        config["vessel_classes"][v_name] = v_dict

    # Extract ports
    port_text = text[text.find("ports:") : text.find("routes:")]
    port_blocks = re.findall(
        r"^\s{2}([A-Za-z /]+):\s*\n((?:^\s{4}.*?\n)+)",
        port_text,
        re.MULTILINE,
    )
    for p_name, block in port_blocks:
        p_dict = {}
        for line in block.splitlines():
            m = re.match(r"^\s{4}([a-z0-9_]+):\s*([^#\n]+)", line)
            if m:
                k = m.group(1).strip()
                v = m.group(2).strip().strip('"\'')
                try:
                    p_dict[k] = float(v) if "." in v else int(v)
                except ValueError:
                    p_dict[k] = v
        config["ports"][p_name.strip()] = p_dict

    # Extract routes
    routes_text = text[text.find("routes:") : text.find("bunker:")]
    current_route: Dict[str, Any] = {}
    for line in routes_text.splitlines():
        line_clean = line.strip()
        if not line_clean or line_clean.startswith("#"):
            continue
        m_id = re.search(r'route_id:\s*"([^"]+)"', line)
        if m_id:
            if current_route:
                config["routes"].append(current_route)
            current_route = {"route_id": m_id.group(1)}
        m_orig = re.search(r'origin_port:\s*"([^"]+)"', line)
        if m_orig:
            current_route["origin_port"] = m_orig.group(1)
        m_dest = re.search(r'destination_port:\s*"([^"]+)"', line)
        if m_dest:
            current_route["destination_port"] = m_dest.group(1)
        m_dist = re.search(r'distance_nm:\s*(\d+)', line)
        if m_dist:
            current_route["distance_nm"] = int(m_dist.group(1))
        m_vess = re.search(r'eligible_vessel_classes:\s*\[([^\]]+)\]', line)
        if m_vess:
            classes = [c.strip().strip('"\'') for c in m_vess.group(1).split(",")]
            current_route["eligible_vessel_classes"] = classes

    if current_route:
        config["routes"].append(current_route)

    return config


# ==============================================================================
# STAGE A: COMPLETE SUB-INDEX HISTORY VIA SHARE DECOMPOSITION
# ==============================================================================
def complete_subindices_history(
    output_path: Optional[str] = None,
) -> pd.DataFrame:
    """Stage A: Estimate BCI, BPI, BSI, BHSI from BDI for dates after 2019-07-31.

    Methodology:
      a) Fit BDI = a*BCI + b*BPI + c*BSI with OLS (no intercept) on 2018-03-01 to 2019-07-31.
      b) For post-2019 dates, split BDI into BCI, BPI, BSI using average historical contribution shares:
             share_i = mean(coef_i * sub_i / BDI)
             sub_i = share_i * BDI / coef_i
      c) Estimate BHSI from BSI using the median ratio BHSI/BSI over 2012-07 to 2019-07.
    """
    from src.data.loaders import load_baltic_subindices, load_bdi_daily

    if output_path is None:
        output_path = os.path.join(PROCESSED_DIR, "subindices_completed.parquet")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    df_sub = load_baltic_subindices()
    df_bdi = load_bdi_daily()

    if df_sub is None or df_bdi is None:
        raise ValueError("Could not load raw sub-indices or BDI data.")

    # 1. Real sub-indices up to 2019-07-31
    real_sub = df_sub[df_sub["date"] <= "2019-07-31"].copy()
    real_sub["is_derived"] = False

    # 2. Calibration overlap: 2018-03-01 to 2019-07-31
    merged = pd.merge(real_sub, df_bdi, on="date", how="inner")
    overlap = merged[(merged["date"] >= "2018-03-01") & (merged["date"] <= "2019-07-31")].dropna()

    print("\n" + "=" * 70)
    print("STAGE A: OLS DECOMPOSITION & AVERAGE SHARE RECONSTRUCTION")
    print(f"Calibration Overlap Period: 2018-03-01 to 2019-07-31 ({len(overlap)} trading sessions)")
    print("=" * 70)

    # a) OLS regression with no intercept: BDI = a*BCI + b*BPI + c*BSI
    X = overlap[["bci", "bpi", "bsi"]].values
    y = overlap["bdi"].values
    coef, _, _, _ = np.linalg.lstsq(X, y, rcond=None)
    a_bci, b_bpi, c_bsi = coef

    y_pred = X @ coef
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r2 = 1.0 - (ss_res / ss_tot)
    pct_errs = np.abs((y - y_pred) / y) * 100.0
    max_pct_err = np.max(pct_errs)
    mean_pct_err = np.mean(pct_errs)

    print("OLS Coefficients (No Intercept: BDI = a*BCI + b*BPI + c*BSI):")
    print(f"  a (BCI Capesize) : {a_bci:.6f}")
    print(f"  b (BPI Panamax)  : {b_bpi:.6f}")
    print(f"  c (BSI Supramax) : {c_bsi:.6f}")
    print(f"  R² Goodness-of-Fit: {r2:.6f}")
    print(f"  Max Absolute Error: {max_pct_err:.2f}% (Mean Error: {mean_pct_err:.2f}%)")
    print("-" * 70)

    # b) Average contribution share over overlap
    share_bci = float(np.mean(a_bci * overlap["bci"] / overlap["bdi"]))
    share_bpi = float(np.mean(b_bpi * overlap["bpi"] / overlap["bdi"]))
    share_bsi = float(np.mean(c_bsi * overlap["bsi"] / overlap["bdi"]))
    total_share = share_bci + share_bpi + share_bsi
    print("Historical Contribution Shares to BDI:")
    print(f"  share(BCI) = {share_bci:.4f} ({share_bci/total_share*100:.1f}%)")
    print(f"  share(BPI) = {share_bpi:.4f} ({share_bpi/total_share*100:.1f}%)")
    print(f"  share(BSI) = {share_bsi:.4f} ({share_bsi/total_share*100:.1f}%)")
    print("-" * 70)

    # c) Estimate BHSI from BSI using full real history (2012-07 to 2019-07)
    real_full = df_sub[(df_sub["date"] >= "2012-07-01") & (df_sub["date"] <= "2019-07-31")].dropna(
        subset=["bhsi", "bsi"]
    )
    bhsi_bsi_ratio_series = real_full["bhsi"] / real_full["bsi"]
    median_ratio = float(bhsi_bsi_ratio_series.median())
    p10_ratio = float(bhsi_bsi_ratio_series.quantile(0.10))
    p90_ratio = float(bhsi_bsi_ratio_series.quantile(0.90))

    print("Handysize (BHSI) Linkage (Full Real 2012-2019 History):")
    print(f"  Median BHSI / BSI Ratio: {median_ratio:.4f}")
    print(f"  10th - 90th Percentile Range: [{p10_ratio:.4f}, {p90_ratio:.4f}]")
    print("=" * 70 + "\n")

    # 3. Estimate post-2019 dates from BDI
    future_bdi = df_bdi[df_bdi["date"] > "2019-07-31"].copy()
    bdi_vals = future_bdi["bdi"].values

    future_df = pd.DataFrame({"date": future_bdi["date"]})
    future_df["bci"] = (share_bci * bdi_vals) / a_bci
    future_df["bpi"] = (share_bpi * bdi_vals) / b_bpi
    future_df["bsi"] = (share_bsi * bdi_vals) / c_bsi
    future_df["bhsi"] = future_df["bsi"] * median_ratio
    future_df["is_derived"] = True

    # Combine real historical + estimated derived
    cols_order = ["date", "bci", "bpi", "bsi", "bhsi", "is_derived"]
    completed = pd.concat([real_sub[cols_order], future_df[cols_order]], ignore_index=True)
    completed = completed.sort_values("date").drop_duplicates(subset=["date"]).reset_index(drop=True)

    completed.to_parquet(output_path, index=False)
    logger.info("Saved completed sub-indices to '%s' (%d rows).", output_path, len(completed))
    return completed


# ==============================================================================
# STAGE B: ROUTE-LEVEL FREIGHT RATES (USD/MT) GENERATOR
# ==============================================================================
def generate_synthetic_route_rates(
    subindices_df: Optional[pd.DataFrame] = None,
    config_path: Optional[str] = None,
    output_path: Optional[str] = None,
    seed: int = 42,
) -> pd.DataFrame:
    """Stage B: Generate weekly route freight rates for all eligible routes and vessels.

    Columns produced:
      date, route_id, vessel_class, rate_usd_per_mt, hire_usd_per_day,
      bunker_cost, port_costs, voyage_days, is_synthetic, hire_is_derived
    """
    from src.data.loaders import load_brent_daily

    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH
    if output_path is None:
        output_path = os.path.join(PROCESSED_DIR, "synthetic_route_rates.parquet")

    cfg = load_routes_config(config_path)

    if subindices_df is None:
        completed_path = os.path.join(PROCESSED_DIR, "subindices_completed.parquet")
        if os.path.exists(completed_path):
            subindices_df = pd.read_parquet(completed_path)
        else:
            subindices_df = complete_subindices_history(completed_path)

    df_brent = load_brent_daily()
    if df_brent is None:
        raise ValueError("Could not load brent_daily data.")

    # 1. Resample daily series to weekly (week-ending Friday mean)
    subindices_df["date"] = pd.to_datetime(subindices_df["date"])
    df_brent["date"] = pd.to_datetime(df_brent["date"])

    weekly_sub = (
        subindices_df.set_index("date")
        .resample("W-FRI")
        .agg({
            "bci": "mean",
            "bpi": "mean",
            "bsi": "mean",
            "bhsi": "mean",
            "is_derived": "max",
        })
        .dropna(subset=["bci", "bpi", "bsi", "bhsi"])
        .reset_index()
    )

    weekly_brent = (
        df_brent.set_index("date")
        .resample("W-FRI")
        .agg({"brent_crude": "mean"})
        .dropna()
        .reset_index()
    )

    market_weekly = pd.merge(weekly_sub, weekly_brent, on="date", how="inner").sort_values("date")
    market_weekly = market_weekly.reset_index(drop=True)

    # Configuration extraction
    vessel_cfg = cfg.get("vessel_classes", {})
    ports_cfg = cfg.get("ports", {})
    routes_list = cfg.get("routes", [])
    brent_factor = cfg.get("bunker", {}).get("brent_to_vlsfo_factor", 8.5)
    round_trip = cfg.get("charter_options", {}).get("round_trip", True)
    hire_mapping = cfg.get("index_to_hire", {})

    records: List[Dict[str, Any]] = []
    num_weeks = len(market_weekly)
    np.random.seed(seed)

    for r_idx, route in enumerate(routes_list):
        r_id = route["route_id"]
        orig_name = route["origin_port"]
        dest_name = route["destination_port"]
        dist_nm = float(route["distance_nm"])
        eligible_vessels = route.get("eligible_vessel_classes", [])

        orig_port = ports_cfg.get(orig_name, {})
        dest_port = ports_cfg.get(dest_name, {})
        load_days = float(orig_port.get("load_days", 3.5))
        discharge_days = float(dest_port.get("discharge_days", 3.5))
        port_days = load_days + discharge_days
        total_port_costs = float(orig_port.get("port_cost_usd", 75000)) + float(
            dest_port.get("port_cost_usd", 80000)
        )

        seasonal_phase = (r_idx * 1.618) % (2.0 * np.pi)
        seasonal_amplitude = 0.035

        for v_name in eligible_vessels:
            if v_name not in vessel_cfg:
                continue

            v_spec = vessel_cfg[v_name]
            parcel_mt = float(v_spec.get("parcel_size_mt", 70000))
            speed_laden = float(v_spec.get("speed_knots_laden", 13.0))
            speed_ballast = float(v_spec.get("speed_knots_ballast", 13.5))
            f_sea = float(v_spec.get("fuel_consumption_tpd", 30.0))
            f_port = float(v_spec.get("fuel_consumption_port_tpd", 4.0))
            hire_idx_key = str(v_spec.get("hire_index", "bpi")).lower()

            hire_factor = float(hire_mapping.get(hire_idx_key, {}).get("factor", 9.00))

            sailing_laden_days = dist_nm / (speed_laden * 24.0)
            sailing_ballast_days = (dist_nm / (speed_ballast * 24.0)) if round_trip else 0.0
            sailing_days = sailing_laden_days + sailing_ballast_days
            voyage_days = round(sailing_days + port_days, 2)

            fuel_cons_mt = (sailing_days * f_sea) + (port_days * f_port)

            # AR(1) noise process
            phi = 0.75
            sigma_noise = 0.035
            eps = np.random.normal(0.0, sigma_noise, size=num_weeks)
            noise_series = np.zeros(num_weeks)
            for t in range(num_weeks):
                prev = noise_series[t - 1] if t > 0 else 0.0
                noise_series[t] = phi * prev + np.sqrt(1.0 - phi**2) * eps[t]

            for t, row in market_weekly.iterrows():
                dt = row["date"]
                idx_points = float(row[hire_idx_key])
                hire_derived = bool(row["is_derived"])
                brent_price = float(row["brent_crude"])

                daily_hire = round(idx_points * hire_factor, 2)
                vlsfo_price = brent_price * brent_factor
                bunker_cost = round(fuel_cons_mt * vlsfo_price, 2)
                time_charter_cost = daily_hire * voyage_days

                total_cost = time_charter_cost + bunker_cost + total_port_costs
                base_rate = total_cost / parcel_mt

                woy = dt.isocalendar().week
                seasonality = 1.0 + seasonal_amplitude * np.sin(2.0 * np.pi * (woy / 52.0) + seasonal_phase)
                final_rate = base_rate * seasonality * (1.0 + noise_series[t])

                records.append({
                    "date": dt,
                    "route_id": r_id,
                    "vessel_class": v_name,
                    "rate_usd_per_mt": round(float(final_rate), 2),
                    "hire_usd_per_day": daily_hire,
                    "bunker_cost": bunker_cost,
                    "port_costs": total_port_costs,
                    "voyage_days": voyage_days,
                    "is_synthetic": True,
                    "hire_is_derived": hire_derived,
                })

    route_rates_df = pd.DataFrame(records)
    route_rates_df = route_rates_df.sort_values(["route_id", "vessel_class", "date"]).reset_index(drop=True)

    route_rates_df.to_parquet(output_path, index=False)
    logger.info("Saved synthetic route rates to '%s' (%d rows).", output_path, len(route_rates_df))
    return route_rates_df


def main() -> None:
    # Run Stage A
    subindices_df = complete_subindices_history()

    # Run Stage B
    rates_df = generate_synthetic_route_rates(subindices_df=subindices_df)

    # Print summary statistics
    print("\n" + "=" * 70)
    print("STAGE B: SYNTHETIC ROUTE RATES SUMMARY (SHARE DECOMPOSITION)")
    print(f"Total Shape: {rates_df.shape} (Rows: {len(rates_df):,}, Columns: {rates_df.shape[1]})")
    print("=" * 70)

    print("\nFreight Rate Statistics ($/MT) per Vessel Class:")
    print("-" * 70)
    stats = rates_df.groupby("vessel_class")["rate_usd_per_mt"].agg(["count", "min", "median", "max"])
    stats["count"] = stats["count"].astype(int)
    print(stats.to_string())
    print("-" * 70)

    print("\nTop 5 Highest Capesize Freight Rates:")
    capesize_top5 = rates_df[rates_df["vessel_class"] == "Capesize"].sort_values(
        "rate_usd_per_mt", ascending=False
    ).head(5)
    print(capesize_top5[["date", "route_id", "rate_usd_per_mt", "hire_usd_per_day", "voyage_days"]].to_string(index=False))
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
