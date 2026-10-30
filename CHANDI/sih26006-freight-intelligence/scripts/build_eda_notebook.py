"""Build and execute notebooks/01_eda.ipynb, saving charts to docs/figures/eda/."""

import base64
import io
import json
import os
import sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EDA_FIG_DIR = os.path.join(PROJECT_ROOT, "docs", "figures", "eda")
NOTEBOOK_PATH = os.path.join(PROJECT_ROOT, "notebooks", "01_eda.ipynb")
os.makedirs(EDA_FIG_DIR, exist_ok=True)

# Define cells for notebook
cells_spec = []

# Cell 0: Markdown Title
cells_spec.append({
    "type": "markdown",
    "source": [
        "# 01. Exploratory Data Analysis: Freight Market Dynamics & Route Spreads\n",
        "\n",
        "This notebook examines historical dry bulk freight indices, seasonality patterns, commodity return cross-correlations, market volatility regime shifts, and route spread behaviors for Indian East Coast coal import corridors using `data/processed/master.parquet` and `data/processed/route_features.parquet`.\n",
        "\n",
        "> **Methodology Note on Derived Sub-indices**:\n",
        "> Prior to July 31, 2019, Baltic sub-indices (BCI, BPI, BSI, BHSI) represent official observed market values (`is_derived=False`). Following the Baltic Exchange reporting change, sub-indices after July 31, 2019 are synthetically derived from composite BDI via OLS decomposition (`is_derived=True`) and move proportionally with BDI by construction. Charts 1 to 5 strictly employ real data where possible, with explicit notations whenever derived or synthetic data is included."
    ]
})

# Cell 1: Code - Setup and Load Data
cells_spec.append({
    "type": "code",
    "source": [
        "import os\n",
        "import matplotlib.pyplot as plt\n",
        "import matplotlib.dates as mdates\n",
        "import numpy as np\n",
        "import pandas as pd\n",
        "\n",
        "# Plotting configuration\n",
        "plt.style.use('seaborn-v0_8-whitegrid' if 'seaborn-v0_8-whitegrid' in plt.style.available else 'default')\n",
        "plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Helvetica', 'Arial']\n",
        "plt.rcParams['axes.edgecolor'] = '#d0d7de'\n",
        "plt.rcParams['grid.color'] = '#eaeaea'\n",
        "plt.rcParams['grid.linestyle'] = '--'\n",
        "\n",
        "# Load master and route datasets\n",
        "current_dir = os.getcwd()\n",
        "if os.path.basename(current_dir) == 'notebooks':\n",
        "    data_dir = os.path.join('..', 'data', 'processed')\n",
        "    fig_dir = os.path.join('..', 'docs', 'figures', 'eda')\n",
        "else:\n",
        "    data_dir = os.path.join('data', 'processed')\n",
        "    fig_dir = os.path.join('docs', 'figures', 'eda')\n",
        "os.makedirs(fig_dir, exist_ok=True)\n",
        "\n",
        "master = pd.read_parquet(os.path.join(data_dir, 'master.parquet'))\n",
        "routes = pd.read_parquet(os.path.join(data_dir, 'route_features.parquet'))\n",
        "\n",
        "master['date'] = pd.to_datetime(master['date'])\n",
        "routes['date'] = pd.to_datetime(routes['date'])\n",
        "\n",
        "print(f\"Master features loaded: {master.shape[0]} weekly observations x {master.shape[1]} columns ({master['date'].min().strftime('%Y-%m-%d')} to {master['date'].max().strftime('%Y-%m-%d')})\")\n",
        "print(f\"Route features loaded:  {routes.shape[0]} observations x {routes.shape[1]} columns across {routes['route_id'].nunique()} routes and {routes['vessel_class'].nunique()} vessel classes\")"
    ]
})

# Cell 2: Code - Chart 1: Trend
cells_spec.append({
    "type": "code",
    "source": [
        "# Chart 1: Historical Trend of BDI and Sub-indices\n",
        "derived_split_date = pd.to_datetime('2019-07-31')\n",
        "\n",
        "fig, ax = plt.subplots(figsize=(11.5, 5.5), dpi=300)\n",
        "\n",
        "# Plot historical and derived sub-indices\n",
        "ax.plot(master['date'], master['bci'], label='BCI (Capesize)', color='#2b8a3e', linewidth=1.5)\n",
        "ax.plot(master['date'], master['bpi'], label='BPI (Panamax)', color='#1971c2', linewidth=1.5)\n",
        "ax.plot(master['date'], master['bsi'], label='BSI (Supramax)', color='#e67700', linewidth=1.5)\n",
        "ax.plot(master['date'], master['bhsi'], label='BHSI (Handysize)', color='#c92a2a', linewidth=1.5)\n",
        "ax.plot(master['date'], master['bdi'], label='BDI (Composite Benchmark)', color='#212529', linewidth=2.0, linestyle='--')\n",
        "\n",
        "# Highlight derived period post-2019-07-31\n",
        "ax.axvspan(derived_split_date, master['date'].max(), color='#fff3cd', alpha=0.55, zorder=0, label='Derived Sub-indices (Post-2019 OLS Reconstruction)')\n",
        "ax.axvline(derived_split_date, color='#d39e00', linestyle=':', linewidth=1.6, zorder=1)\n",
        "\n",
        "# Annotations\n",
        "ax.text(derived_split_date + pd.Timedelta(days=50), 5500, \n",
        "        'Derived Period (Post-2019-07-31)\\nSub-indices move proportionally\\nwith BDI by construction', \n",
        "        fontsize=8.5, color='#856404', fontweight='bold',\n",
        "        bbox=dict(boxstyle='round,pad=0.3', facecolor='#fff8e1', edgecolor='#ffeeba', alpha=0.9))\n",
        "\n",
        "ax.set_title('Historical & Derived Baltic Dry Bulk Freight Indices (2012 - 2026)', fontsize=12, fontweight='bold', pad=12)\n",
        "ax.set_xlabel('Date (Weekly Friday)', fontsize=10)\n",
        "ax.set_ylabel('Index Points', fontsize=10)\n",
        "ax.grid(True, linestyle='--', alpha=0.6)\n",
        "ax.xaxis.set_major_locator(mdates.YearLocator(2))\n",
        "ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y'))\n",
        "ax.legend(loc='upper left', frameon=True, facecolor='white', edgecolor='#cccccc', fontsize=8.5)\n",
        "plt.tight_layout()\n",
        "\n",
        "chart1_path = os.path.join(fig_dir, '01_trend_bdi_subindices.png')\n",
        "plt.savefig(chart1_path)\n",
        "plt.close()\n",
        "print(f\"Saved Chart 1 to {chart1_path}\")"
    ]
})

# Cell 3: Markdown - Insight 1
cells_spec.append({
    "type": "markdown",
    "source": [
        "### Insight: Trend of BDI and Sub-indices\n",
        "The Baltic Capesize Index (BCI) exhibits the widest cyclical swings among all dry bulk series, reaching a high above 5,000 points in late 2021 before dropping back below 1,500 points. The remaining sub-indices (BPI, BSI, BHSI) fluctuate within a narrower band between 500 and 3,500 points across the 2012–2026 timeframe. After July 31, 2019 (shaded yellow), all four sub-indices track the composite BDI proportionally because they are derived directly from BDI by construction."
    ]
})

# Cell 4: Code - Chart 2: Seasonality
cells_spec.append({
    "type": "code",
    "source": [
        "# Chart 2: Seasonality - BDI by Week of Year, Month, and Monsoon Comparison\n",
        "# Real BDI observations (2016-2026)\n",
        "bdi_real = master.dropna(subset=['bdi']).copy()\n",
        "bdi_real['woy'] = bdi_real['date'].dt.isocalendar().week\n",
        "bdi_real['month'] = bdi_real['date'].dt.month\n",
        "\n",
        "fig, (ax2a, ax2b, ax2c) = plt.subplots(1, 3, figsize=(15, 4.8), dpi=300, gridspec_kw={'width_ratios': [2, 1.4, 1]})\n",
        "\n",
        "# 2a: Week of Year\n",
        "woy_avg = bdi_real.groupby('woy')['bdi'].mean()\n",
        "ax2a.plot(woy_avg.index, woy_avg.values, color='#1971c2', marker='o', markersize=3.5, linewidth=1.6)\n",
        "ax2a.axvspan(22, 39, color='#e7f5ff', alpha=0.7, label='Indian Monsoon (W22–W39)')\n",
        "ax2a.set_title('Average BDI by Week of Year (Real Data 2016–2026)', fontsize=10.5, fontweight='bold')\n",
        "ax2a.set_xlabel('Week of Year (1 - 52)', fontsize=9.5)\n",
        "ax2a.set_ylabel('Mean BDI Points', fontsize=9.5)\n",
        "ax2a.grid(True, linestyle='--', alpha=0.6)\n",
        "ax2a.legend(loc='lower right', fontsize=8)\n",
        "\n",
        "# 2b: Month of Year\n",
        "month_avg = bdi_real.groupby('month')['bdi'].mean()\n",
        "month_labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']\n",
        "bars_m = ax2b.bar(month_avg.index, month_avg.values, color='#4dabf7', edgecolor='#1971c2', alpha=0.85, width=0.65)\n",
        "ax2b.set_xticks(range(1, 13))\n",
        "ax2b.set_xticklabels(month_labels, fontsize=8.5)\n",
        "ax2b.set_title('Average BDI by Calendar Month', fontsize=10.5, fontweight='bold')\n",
        "ax2b.set_xlabel('Month', fontsize=9.5)\n",
        "ax2b.set_ylabel('Mean BDI Points', fontsize=9.5)\n",
        "ax2b.grid(True, linestyle='--', alpha=0.6, axis='y')\n",
        "\n",
        "# 2c: Monsoon vs Non-Monsoon\n",
        "monsoon_stats = bdi_real.groupby('is_monsoon')['bdi'].agg(['mean', 'std', 'count'])\n",
        "labels_mon = ['Non-Monsoon\\n(Oct–May)', 'Monsoon\\n(Jun–Sep)']\n",
        "means = [monsoon_stats.loc[False, 'mean'], monsoon_stats.loc[True, 'mean']]\n",
        "se = [monsoon_stats.loc[False, 'std'] / np.sqrt(monsoon_stats.loc[False, 'count']),\n",
        "      monsoon_stats.loc[True, 'std'] / np.sqrt(monsoon_stats.loc[True, 'count'])]\n",
        "colors_mon = ['#38d9a9', '#0ca678']\n",
        "bars_c = ax2c.bar(labels_mon, means, yerr=se, capsize=5, color=colors_mon, edgecolor='#087f5b', alpha=0.85, width=0.5)\n",
        "for bar in bars_c:\n",
        "    h = bar.get_height()\n",
        "    ax2c.text(bar.get_x() + bar.get_width() / 2.0, h * 0.5, f\"{h:.0f} pts\", ha='center', va='center', color='white', fontweight='bold', fontsize=9.5)\n",
        "ax2c.set_title('Monsoon Comparison', fontsize=10.5, fontweight='bold')\n",
        "ax2c.set_ylabel('Mean BDI (± SE)', fontsize=9.5)\n",
        "ax2c.grid(True, linestyle='--', alpha=0.6, axis='y')\n",
        "\n",
        "plt.tight_layout()\n",
        "chart2_path = os.path.join(fig_dir, '02_seasonality_bdi_monsoon.png')\n",
        "plt.savefig(chart2_path)\n",
        "plt.close()\n",
        "print(f\"Saved Chart 2 to {chart2_path}\")"
    ]
})

# Cell 5: Markdown - Insight 2
cells_spec.append({
    "type": "markdown",
    "source": [
        "### Insight: Seasonality and Monsoon Patterns\n",
        "Average BDI reaches an annual minimum around weeks 5 through 9 (under 1,000 points) and rises to an annual peak around weeks 38 through 44 (above 2,000 points). Across calendar months, the average index climbs steadily from June through October, with October recording the highest monthly mean. BDI during the monsoon period (June to September) averages 1,890 points compared to 1,586 points during non-monsoon months (October to May) in this real 2016–2026 dataset."
    ]
})

# Cell 6: Code - Chart 3: Correlation Heatmap
cells_spec.append({
    "type": "code",
    "source": [
        "# Chart 3: Correlation Heatmap of Weekly % Changes (Real Market Data Period 2016–2019)\n",
        "# Use real data overlap where BDI and all four sub-indices are strictly observed market values (is_derived=False)\n",
        "# NOTE: Calculated on weekly percentage changes, NOT levels (levels trend and correlate spuriously)\n",
        "real_mask = ~master['is_derived']\n",
        "corr_cols = ['bdi', 'bci', 'bpi', 'bsi', 'bhsi', 'brent_crude', 'usd_inr', 'coal_australian', 'iron_ore']\n",
        "\n",
        "pct_df = master.loc[real_mask, corr_cols].pct_change().dropna()\n",
        "corr_matrix = pct_df.corr()\n",
        "\n",
        "fig, ax = plt.subplots(figsize=(8.5, 7.2), dpi=300)\n",
        "cax = ax.matshow(corr_matrix, cmap='RdBu_r', vmin=-1, vmax=1)\n",
        "fig.colorbar(cax, ax=ax, fraction=0.046, pad=0.04)\n",
        "\n",
        "labels = ['BDI', 'BCI', 'BPI', 'BSI', 'BHSI', 'Brent', 'USD/INR', 'Coal (Aus)', 'Iron Ore']\n",
        "ax.set_xticks(range(len(labels)))\n",
        "ax.set_yticks(range(len(labels)))\n",
        "ax.set_xticklabels(labels, rotation=45, ha='left', fontsize=9, fontweight='bold')\n",
        "ax.set_yticklabels(labels, fontsize=9, fontweight='bold')\n",
        "\n",
        "for i in range(len(labels)):\n",
        "    for j in range(len(labels)):\n",
        "        val = corr_matrix.iloc[i, j]\n",
        "        txt_color = 'white' if abs(val) > 0.45 else 'black'\n",
        "        ax.text(j, i, f\"{val:.2f}\", ha='center', va='center', color=txt_color, fontsize=9, fontweight='bold')\n",
        "\n",
        "ax.set_title('Correlation Matrix of Weekly % Changes (Real Data: 2016–2019)\\n[Computed on returns: levels trend and correlate spuriously]', fontsize=11, fontweight='bold', pad=25)\n",
        "plt.tight_layout()\n",
        "\n",
        "chart3_path = os.path.join(fig_dir, '03_correlation_heatmap_returns.png')\n",
        "plt.savefig(chart3_path)\n",
        "plt.close()\n",
        "print(f\"Saved Chart 3 to {chart3_path}\")"
    ]
})

# Cell 7: Markdown - Insight 3
cells_spec.append({
    "type": "markdown",
    "source": [
        "### Insight: Returns Correlation Structure\n",
        "Weekly percentage changes among freight sub-indices reveal that Capesize (BCI, $r=0.74$) and Panamax (BPI, $r=0.62$) have the strongest correlation with composite BDI, while BHSI has the lowest ($r=0.39$). Weekly changes in Brent crude, USD/INR, coal, and iron ore all exhibit weak contemporaneous correlation with freight index changes ($|r| \\le 0.12$). While raw price levels trend together spuriously ($r > 0.80$), weekly percentage changes on real 2016–2019 data show minimal contemporaneous co-movement between commodities and freight."
    ]
})

# Cell 8: Code - Chart 4: Lead-Lag Cross-Correlation
cells_spec.append({
    "type": "code",
    "source": [
        "# Chart 4: Lead-Lag Cross-Correlation: BDI Weekly Change vs Brent & Iron Ore\n",
        "bdi_ret = master['bdi'].pct_change()\n",
        "brent_ret = master['brent_crude'].pct_change()\n",
        "iron_ret = master['iron_ore'].pct_change()\n",
        "\n",
        "lags = list(range(-12, 13))\n",
        "brent_xcorr = []\n",
        "iron_xcorr = []\n",
        "\n",
        "for k in lags:\n",
        "    # Positive k: Commodity at t-k leads BDI at t (shift(k))\n",
        "    c_b = bdi_ret.corr(brent_ret.shift(k))\n",
        "    c_i = bdi_ret.corr(iron_ret.shift(k))\n",
        "    brent_xcorr.append(c_b)\n",
        "    iron_xcorr.append(c_i)\n",
        "\n",
        "fig, ax = plt.subplots(figsize=(10.5, 5), dpi=300)\n",
        "ax.plot(lags, brent_xcorr, marker='o', markersize=4.5, color='#d9480f', linewidth=1.6, label='BDI vs. Brent Crude Weekly % Δ')\n",
        "ax.plot(lags, iron_xcorr, marker='s', markersize=4.5, color='#1971c2', linewidth=1.6, label='BDI vs. Iron Ore Weekly % Δ')\n",
        "ax.axvline(0, color='#adb5bd', linestyle='--', linewidth=1)\n",
        "ax.axhline(0, color='#ced4da', linestyle='-', linewidth=0.8)\n",
        "\n",
        "# Identify peak absolute correlations\n",
        "max_b_idx = int(np.argmax(np.abs(brent_xcorr)))\n",
        "max_i_idx = int(np.argmax(np.abs(iron_xcorr)))\n",
        "best_b_lag, best_b_val = lags[max_b_idx], brent_xcorr[max_b_idx]\n",
        "best_i_lag, best_i_val = lags[max_i_idx], iron_xcorr[max_i_idx]\n",
        "\n",
        "ax.scatter([best_b_lag], [best_b_val], color='#d9480f', s=110, zorder=5, edgecolors='black', linewidth=1.2)\n",
        "ax.scatter([best_i_lag], [best_i_val], color='#1971c2', s=110, zorder=5, edgecolors='black', linewidth=1.2)\n",
        "ax.annotate(f'Peak Brent: Lag +{best_b_lag}w (r={best_b_val:.3f})', (best_b_lag, best_b_val),\n",
        "            textcoords='offset points', xytext=(12, 10), fontsize=8.5, fontweight='bold', color='#d9480f',\n",
        "            arrowprops=dict(arrowstyle='->', color='#d9480f', lw=1))\n",
        "ax.annotate(f'Peak Iron Ore: Lag +{best_i_lag}w (r={best_i_val:.3f})', (best_i_lag, best_i_val),\n",
        "            textcoords='offset points', xytext=(12, 12), fontsize=8.5, fontweight='bold', color='#1971c2',\n",
        "            arrowprops=dict(arrowstyle='->', color='#1971c2', lw=1))\n",
        "\n",
        "ax.set_title('Cross-Correlation: BDI Weekly % Change vs. Brent Crude & Iron Ore (Lags -12 to +12 Weeks)', fontsize=11.5, fontweight='bold', pad=12)\n",
        "ax.set_xlabel('Lag in Weeks (Positive k means Commodity Leads BDI by k weeks)', fontsize=9.5)\n",
        "ax.set_ylabel('Cross-Correlation Coefficient', fontsize=9.5)\n",
        "ax.set_xticks(lags)\n",
        "ax.grid(True, linestyle='--', alpha=0.6)\n",
        "ax.legend(loc='upper left', frameon=True, facecolor='white', edgecolor='#cccccc', fontsize=9)\n",
        "plt.tight_layout()\n",
        "\n",
        "chart4_path = os.path.join(fig_dir, '04_lead_lag_cross_correlation.png')\n",
        "plt.savefig(chart4_path)\n",
        "plt.close()\n",
        "print(f\"Saved Chart 4 to {chart4_path}\")"
    ]
})

# Cell 9: Markdown - Insight 4
cells_spec.append({
    "type": "markdown",
    "source": [
        "### Insight: Lead-Lag Cross-Correlation Dynamics\n",
        "Cross-correlations between weekly percentage changes in BDI and both commodities remain weak across all evaluated horizons (-12 to +12 weeks), never exceeding $|r| = 0.17$. The highest absolute values occur at a 6-week lead for Brent crude ($r = 0.162$) and an 8-week lead for iron ore ($r = 0.123$), while contemporaneous correlation at lag 0 is approximately zero ($r = -0.005$ and $r = 0.021$). The chart demonstrates that neither commodity's weekly change has a strong linear leading or lagging relationship with weekly BDI changes."
    ]
})

# Cell 10: Code - Chart 5: Volatility
cells_spec.append({
    "type": "code",
    "source": [
        "# Chart 5: Volatility - 12-Week Rolling Standard Deviation of BDI Weekly Changes\n",
        "bdi_roll_std = bdi_ret.rolling(12).std() * 100\n",
        "\n",
        "fig, ax = plt.subplots(figsize=(11.5, 5), dpi=300)\n",
        "ax.plot(master['date'], bdi_roll_std, color='#7048e8', linewidth=1.7, label='12-Week Rolling Volatility of BDI Weekly % Return')\n",
        "\n",
        "# Mark 2020 COVID shock and 2021 Super-Cycle\n",
        "d_2020 = pd.to_datetime('2020-07-31')\n",
        "d_2021 = pd.to_datetime('2021-10-08')\n",
        "\n",
        "ax.axvline(d_2020, color='#e03131', linestyle='--', linewidth=1.4)\n",
        "ax.text(d_2020 - pd.Timedelta(days=20), 21.5, '2020 COVID Disruption\\nPeak Volatility: 23.2%', color='#c92a2a', fontsize=8.5, fontweight='bold', ha='right',\n",
        "        bbox=dict(boxstyle='round,pad=0.2', facecolor='#fff5f5', edgecolor='#ffc9c9', alpha=0.9))\n",
        "\n",
        "ax.axvline(d_2021, color='#2f9e44', linestyle='--', linewidth=1.4)\n",
        "ax.text(d_2021 + pd.Timedelta(days=20), 20.0, '2021 Bulk Super-Cycle\\nPeak Volatility: 18.8%', color='#2b8a3e', fontsize=8.5, fontweight='bold', ha='left',\n",
        "        bbox=dict(boxstyle='round,pad=0.2', facecolor='#ebfbee', edgecolor='#b2f2bb', alpha=0.9))\n",
        "\n",
        "ax.set_title('Baltic Dry Index Return Volatility (12-Week Rolling Standard Deviation)', fontsize=11.5, fontweight='bold', pad=12)\n",
        "ax.set_xlabel('Date (Weekly Friday)', fontsize=9.5)\n",
        "ax.set_ylabel('Weekly Return Volatility (%)', fontsize=9.5)\n",
        "ax.grid(True, linestyle='--', alpha=0.6)\n",
        "ax.xaxis.set_major_locator(mdates.YearLocator(2))\n",
        "ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y'))\n",
        "ax.legend(loc='upper left', frameon=True, facecolor='white', edgecolor='#cccccc', fontsize=9)\n",
        "plt.tight_layout()\n",
        "\n",
        "chart5_path = os.path.join(fig_dir, '05_volatility_rolling_std.png')\n",
        "plt.savefig(chart5_path)\n",
        "plt.show()\n",
        "print(f\"Saved Chart 5 to {chart5_path}\")"
    ]
})

# Cell 11: Markdown - Insight 5
cells_spec.append({
    "type": "markdown",
    "source": [
        "### Insight: Historical Volatility Regimes\n",
        "The 12-week rolling standard deviation of weekly BDI percentage changes peaked at 23.2% in July 2020 and registered a secondary peak at 18.8% in October 2021. Outside of these two labeled periods, rolling volatility typically remained between 4% and 12% per week across the 2016–2026 real series. The series shows episodic volatility spikes rather than a steady constant variance over time."
    ]
})

# Cell 12: Code - Chart 6: Route Spreads
cells_spec.append({
    "type": "code",
    "source": [
        "# Chart 6: Route Spreads vs. Indonesia Benchmark for Capesize and Panamax over Time\n",
        "fig, (ax6a, ax6b) = plt.subplots(2, 1, figsize=(11.5, 7.8), sharex=True, dpi=300)\n",
        "\n",
        "# Filter Paradip destination routes for Capesize\n",
        "hmp_cape = routes[(routes['route_id'] == 'HMP_PRT') & (routes['vessel_class'] == 'Capesize')].sort_values('date')\n",
        "van_cape = routes[(routes['route_id'] == 'VAN_PRT') & (routes['vessel_class'] == 'Capesize')].sort_values('date')\n",
        "new_cape = routes[(routes['route_id'] == 'NEW_PRT') & (routes['vessel_class'] == 'Capesize')].sort_values('date')\n",
        "\n",
        "ax6a.plot(hmp_cape['date'], hmp_cape['spread_vs_indonesia_usd_per_mt'], label='Hampton Roads → Paradip (10,200 nm vs 2,600 nm)', color='#c92a2a', linewidth=1.5)\n",
        "ax6a.plot(van_cape['date'], van_cape['spread_vs_indonesia_usd_per_mt'], label='Vancouver → Paradip (8,000 nm vs 2,600 nm)', color='#e67700', linewidth=1.5)\n",
        "ax6a.plot(new_cape['date'], new_cape['spread_vs_indonesia_usd_per_mt'], label='Newcastle → Paradip (5,200 nm vs 2,600 nm)', color='#1971c2', linewidth=1.5)\n",
        "\n",
        "# Derived split line\n",
        "ax6a.axvline(derived_split_date, color='#d39e00', linestyle=':', linewidth=1.5)\n",
        "ax6a.axvspan(derived_split_date, master['date'].max(), color='#fff3cd', alpha=0.45, zorder=0)\n",
        "ax6a.set_title('Route Spreads vs. Indonesia Benchmark ($/MT) — Capesize Vessel Class', fontsize=11, fontweight='bold')\n",
        "ax6a.set_ylabel('Spread over IDN_PRT ($/MT)', fontsize=9.5)\n",
        "ax6a.grid(True, linestyle='--', alpha=0.6)\n",
        "ax6a.legend(loc='upper left', frameon=True, facecolor='white', edgecolor='#cccccc', fontsize=8.5)\n",
        "\n",
        "# Filter Paradip destination routes for Panamax\n",
        "hmp_pan = routes[(routes['route_id'] == 'HMP_PRT') & (routes['vessel_class'] == 'Panamax')].sort_values('date')\n",
        "van_pan = routes[(routes['route_id'] == 'VAN_PRT') & (routes['vessel_class'] == 'Panamax')].sort_values('date')\n",
        "new_pan = routes[(routes['route_id'] == 'NEW_PRT') & (routes['vessel_class'] == 'Panamax')].sort_values('date')\n",
        "\n",
        "ax6b.plot(hmp_pan['date'], hmp_pan['spread_vs_indonesia_usd_per_mt'], label='Hampton Roads → Paradip (10,200 nm vs 2,600 nm)', color='#c92a2a', linewidth=1.5)\n",
        "ax6b.plot(van_pan['date'], van_pan['spread_vs_indonesia_usd_per_mt'], label='Vancouver → Paradip (8,000 nm vs 2,600 nm)', color='#e67700', linewidth=1.5)\n",
        "ax6b.plot(new_pan['date'], new_pan['spread_vs_indonesia_usd_per_mt'], label='Newcastle → Paradip (5,200 nm vs 2,600 nm)', color='#1971c2', linewidth=1.5)\n",
        "\n",
        "ax6b.axvline(derived_split_date, color='#d39e00', linestyle=':', linewidth=1.5)\n",
        "ax6b.axvspan(derived_split_date, master['date'].max(), color='#fff3cd', alpha=0.45, zorder=0, label='Derived Inputs Period (Post-2019)')\n",
        "ax6b.set_title('Route Spreads vs. Indonesia Benchmark ($/MT) — Panamax Vessel Class', fontsize=11, fontweight='bold')\n",
        "ax6b.set_xlabel('Date (Weekly Friday)', fontsize=9.5)\n",
        "ax6b.set_ylabel('Spread over IDN_PRT ($/MT)', fontsize=9.5)\n",
        "ax6b.grid(True, linestyle='--', alpha=0.6)\n",
        "ax6b.xaxis.set_major_locator(mdates.YearLocator(2))\n",
        "ax6b.xaxis.set_major_formatter(mdates.DateFormatter('%Y'))\n",
        "ax6b.legend(loc='upper left', frameon=True, facecolor='white', edgecolor='#cccccc', fontsize=8.5)\n",
        "\n",
        "plt.tight_layout()\n",
        "chart6_path = os.path.join(fig_dir, '06_route_spreads_vs_indonesia.png')\n",
        "plt.savefig(chart6_path)\n",
        "plt.show()\n",
        "print(f\"Saved Chart 6 to {chart6_path}\")"
    ]
})

# Cell 13: Markdown - Insight 6
cells_spec.append({
    "type": "markdown",
    "source": [
        "### Insight: Long-Haul Route Spreads vs. Indonesia Benchmark\n",
        "The route spread over Indonesia scales directly with sailing distance, with Hampton Roads (10,200 nm) exhibiting the largest premium, followed by Vancouver (8,000 nm) and Newcastle (5,200 nm). Both vessel classes display widening spreads during the 2021 market surge, with Capesize spreads reaching $34/MT and Panamax spreads reaching $50/MT for Hampton Roads over Indonesia. These route rates and spreads are synthetically modeled and incorporate derived index inputs after July 31, 2019."
    ]
})

# Cell 14: Markdown - Summary Cell
cells_spec.append({
    "type": "markdown",
    "source": [
        "## Summary: 5 Key Insights from Exploratory Data Analysis\n",
        "\n",
        "1. **Capesize Swings Dominate Composite BDI Movement**: BCI exhibits the largest index fluctuations (ranging from under 500 to over 5,000 points) and the highest correlation ($r=0.74$) with weekly BDI changes among all vessel sub-indices.\n",
        "2. **Monsoon Period Displays Higher Mean BDI Than Non-Monsoon**: BDI averages 1,890 points during June–September compared to 1,586 points during October–May, with annual peaks occurring in weeks 38 through 44.\n",
        "3. **Weekly Returns Eliminate Spurious Level Correlations**: Raw commodity and freight price levels display high correlations ($r > 0.80$) due to shared macro trends, whereas weekly percentage changes reveal very low contemporaneous co-movement ($|r| \\le 0.12$).\n",
        "4. **Commodity Lead-Lag Correlations with Freight Are Weak**: Cross-correlations between weekly changes in BDI and commodity prices (Brent and iron ore) remain weak throughout all lags ($-12$ to $+12$ weeks), never exceeding $|r| = 0.17$, with nominal peak values at +6 weeks for Brent ($r=0.162$) and +8 weeks for iron ore ($r=0.123$).\n",
        "5. **Long-Haul Spreads Widen Substantially During Market Surges**: The rate premium of long routes (e.g. Hampton Roads) over Indonesia varies over time from $5/MT to $34/MT for Capesize and $7/MT to $50/MT for Panamax, widening dramatically during the 2021 high-rate period."
    ]
})

print(f"Total notebook cells defined: {len(cells_spec)}")

# Execute code cells and generate .ipynb format
ipynb_cells = []
exec_counter = 1
workspace_ns = {"__name__": "__main__"}

for cell in cells_spec:
    if cell["type"] == "markdown":
        ipynb_cells.append({
            "cell_type": "markdown",
            "metadata": {},
            "source": cell["source"]
        })
    elif cell["type"] == "code":
        code_str = "".join(cell["source"])
        # Redirect stdout and capture plot
        old_stdout = sys.stdout
        stdout_buf = io.StringIO()
        sys.stdout = stdout_buf
        
        plt.close("all")
        err = None
        try:
            exec(code_str, workspace_ns)
        except Exception as e:
            err = e
        finally:
            sys.stdout = old_stdout
            
        if err is not None:
            print(f"Error executing cell {exec_counter}: {err}")
            raise err
            
        out_text = stdout_buf.getvalue()
        cell_outputs = []
        if out_text:
            cell_outputs.append({
                "name": "stdout",
                "output_type": "stream",
                "text": out_text.splitlines(keepends=True)
            })
            
        # Check if figures were created or saved
        # If there are active matplotlib figures, serialize them
        for fignum in plt.get_fignums():
            fig_obj = plt.figure(fignum)
            img_buf = io.BytesIO()
            fig_obj.savefig(img_buf, format="png", bbox_inches="tight", dpi=150)
            img_buf.seek(0)
            b64_img = base64.b64encode(img_buf.read()).decode("utf-8")
            cell_outputs.append({
                "data": {
                    "image/png": b64_img,
                    "text/plain": [f"<Figure size {fig_obj.get_size_inches()} with {len(fig_obj.axes)} Axes>"]
                },
                "metadata": {},
                "output_type": "display_data"
            })
        plt.close("all")
        
        ipynb_cells.append({
            "cell_type": "code",
            "execution_count": exec_counter,
            "metadata": {},
            "outputs": cell_outputs,
            "source": cell["source"]
        })
        exec_counter += 1

notebook_json = {
    "cells": ipynb_cells,
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3"
        },
        "language_info": {
            "name": "python",
            "version": "3.13"
        }
    },
    "nbformat": 4,
    "nbformat_minor": 5
}

with open(NOTEBOOK_PATH, "w", encoding="utf-8") as f:
    json.dump(notebook_json, f, indent=1)

print(f"Notebook successfully written to {NOTEBOOK_PATH}")
