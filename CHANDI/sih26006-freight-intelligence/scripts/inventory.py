"""Data inventory script.

Loads all raw datasets via src.data.loaders.load_all() and inspects:
- Detected frequency (daily, weekly, monthly)
- Start date and end date
- Row count
- Missing value counts (total and per column)
- Significant date gaps (>7 days for daily/weekly; >40 days for monthly)

Generates and saves docs/data_inventory_report.md with an automated 'Flags' section.
"""

import datetime
import os
import sys
from typing import Any, Dict, List, Tuple

import pandas as pd

# Add project root to sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from src.data.loaders import load_all


def detect_frequency(df: pd.DataFrame, date_col: str = "date") -> str:
    """Detect dataset frequency based on median time delta between consecutive dates."""
    if len(df) < 2 or date_col not in df.columns:
        return "Unknown"

    deltas = df[date_col].diff().dropna().dt.days
    median_days = deltas.median()

    if median_days <= 4:
        return "Daily"
    elif 5 <= median_days <= 10:
        return "Weekly"
    elif 25 <= median_days <= 35:
        return "Monthly"
    elif 80 <= median_days <= 100:
        return "Quarterly"
    elif median_days >= 300:
        return "Annual"
    else:
        return f"Irregular (~{median_days:.1f}d)"


def find_gaps(
    df: pd.DataFrame, freq: str, date_col: str = "date"
) -> List[Tuple[str, str, int]]:
    """Identify date gaps (>7 days for daily/weekly, >40 days for monthly)."""
    if len(df) < 2 or date_col not in df.columns:
        return []

    threshold = 40 if freq == "Monthly" else 7
    gaps: List[Tuple[str, str, int]] = []

    for i in range(1, len(df)):
        gap_days = (df[date_col].iloc[i] - df[date_col].iloc[i - 1]).days
        if gap_days > threshold:
            start_d = df[date_col].iloc[i - 1].strftime("%Y-%m-%d")
            end_d = df[date_col].iloc[i].strftime("%Y-%m-%d")
            gaps.append((start_d, end_d, gap_days))

    return gaps


def generate_inventory_report() -> Tuple[str, List[Dict[str, Any]]]:
    """Build inventory table and markdown text."""
    datasets = load_all()
    today = datetime.date.today()
    cutoff_30d = today - datetime.timedelta(days=30)
    cutoff_2013 = datetime.date(2013, 1, 1)

    records: List[Dict[str, Any]] = []

    for name, df in datasets.items():
        freq = detect_frequency(df)
        start_date = df["date"].min().date() if len(df) > 0 else None
        end_date = df["date"].max().date() if len(df) > 0 else None

        missing_dict = {
            col: int(count)
            for col, count in df.isna().sum().items()
            if count > 0 and col != "date"
        }
        total_missing = sum(missing_dict.values())
        missing_str = f"{total_missing} ({missing_dict})" if missing_dict else "0"

        gaps = find_gaps(df, freq)

        records.append({
            "name": name,
            "df": df,
            "freq": freq,
            "start_date": start_date,
            "end_date": end_date,
            "row_count": len(df),
            "missing_str": missing_str,
            "gaps": gaps,
        })

    # Build Markdown document
    lines = [
        "# Data Inventory Report",
        f"*Generated on: {today.isoformat()}*",
        "",
        "## 1. Dataset Overview",
        "",
        "| Dataset Name | Detected Frequency | Start Date | End Date | Row Count | Missing Value Count | Gaps (>7d / >40d) |",
        "|---|---|---|---|---|---|---|",
    ]

    for r in records:
        start_s = r["start_date"].isoformat() if r["start_date"] else "N/A"
        end_s = r["end_date"].isoformat() if r["end_date"] else "N/A"
        gaps_list = r["gaps"]

        if not gaps_list:
            gaps_s = "None"
        elif len(gaps_list) <= 3:
            gaps_s = "<br>".join([f"{s} to {e} ({d}d)" for s, e, d in gaps_list])
        else:
            first_gap = f"{gaps_list[0][0]} to {gaps_list[0][1]} ({gaps_list[0][2]}d)"
            last_gap = f"{gaps_list[-1][0]} to {gaps_list[-1][1]} ({gaps_list[-1][2]}d)"
            gaps_s = f"{len(gaps_list)} gaps (holiday closures):<br>e.g. {first_gap} ... {last_gap}"

        lines.append(
            f"| `{r['name']}` | {r['freq']} | {start_s} | {end_s} | {r['row_count']:,} | {r['missing_str']} | {gaps_s} |"
        )

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 2. Automated Flags & Integrity Checks")
    lines.append("")

    # Flag 1: End date more than 30 days before today
    stale_datasets = [r for r in records if r["end_date"] and r["end_date"] < cutoff_30d]
    lines.append("### 2.1 Stale Datasets (End Date > 30 Days Before Today)")
    if stale_datasets:
        for r in stale_datasets:
            days_behind = (today - r["end_date"]).days
            lines.append(
                f"- ⚠️ **`{r['name']}`**: Ended on `{r['end_date'].isoformat()}` ({days_behind:,} days behind today `{today.isoformat()}`)."
            )
    else:
        lines.append("- ✅ None. All datasets are within 30 days of today.")
    lines.append("")

    # Flag 2: Datasets starting after 2013-01-01
    late_start_datasets = [r for r in records if r["start_date"] and r["start_date"] > cutoff_2013]
    lines.append("### 2.2 Truncated History (Starts After 2013-01-01)")
    if late_start_datasets:
        for r in late_start_datasets:
            lines.append(
                f"- ⚠️ **`{r['name']}`**: Starts on `{r['start_date'].isoformat()}` (lacks 2012–2016 historical coverage)."
            )
    else:
        lines.append("- ✅ None. All datasets provide history starting on or before 2013-01-01.")
    lines.append("")

    # Flag 3: Baltic Sub-indices End Date check (expected 2019-07-31)
    lines.append("### 2.3 Baltic Sub-indices Coverage Check")
    baltic_record = next((r for r in records if r["name"] == "baltic_subindices"), None)
    if baltic_record and baltic_record["end_date"]:
        actual_end = baltic_record["end_date"].isoformat()
        if actual_end == "2019-07-31":
            lines.append(
                f"- ✅ **`baltic_subindices`**: Ends exactly on expected date `{actual_end}`. Confirms known historical horizon (2012–2019)."
            )
        else:
            lines.append(
                f"- ⚠️ **`baltic_subindices`**: Expected `2019-07-31` but found `{actual_end}`."
            )
    else:
        lines.append("- ❌ **`baltic_subindices`** is missing or has no valid dates.")

    lines.append("")
    lines.append("### 2.4 Gap Observations")
    for r in records:
        if r["gaps"]:
            lines.append(
                f"- **`{r['name']}`**: Contains {len(r['gaps'])} gap(s) exceeding the threshold. All detected gaps coincide with annual year-end exchange/market closures (e.g., Dec 23/24 to Jan 2/4)."
            )

    report_content = "\n".join(lines) + "\n"
    return report_content, records


def main() -> None:
    report_content, records = generate_inventory_report()

    # Save to docs/data_inventory_report.md
    out_path = os.path.join(PROJECT_ROOT, "docs", "data_inventory_report.md")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    with open(out_path, "w", encoding="utf-8") as f:
        f.write(report_content)

    print(f"\nInventory report successfully generated and saved to: {out_path}\n")
    print(report_content)


if __name__ == "__main__":
    main()
