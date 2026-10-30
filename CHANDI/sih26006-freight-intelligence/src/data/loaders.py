"""Data loaders for raw market and freight data files.

Each loader loads a raw file, parses dates, sorts ascending, drops duplicate dates,
and returns a DataFrame with clean column names and types without filling or interpolating missing data.
"""

import logging
import os
import re
import xml.etree.ElementTree as ET
import zipfile
from typing import Dict, Optional, Union

import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

DEFAULT_DATA_RAW_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "raw",
)


def _log_summary(name: str, df: pd.DataFrame, date_col: str = "date") -> None:
    """Log row count, date range, and missing values count per column."""
    row_count = len(df)
    if row_count > 0 and date_col in df.columns:
        min_date = df[date_col].min()
        max_date = df[date_col].max()
        date_range_str = f"{min_date} to {max_date}"
    else:
        date_range_str = "None"

    missing = df.isna().sum().to_dict()
    logger.info(
        "[%s] Loaded %d rows | Date range: %s | Missing values: %s",
        name,
        row_count,
        date_range_str,
        missing,
    )


def load_baltic_subindices(
    filepath: Optional[str] = None,
) -> Optional[pd.DataFrame]:
    """Load Baltic sub-indices (BHSI, BSI, BPI, BCI).

    Expected raw file: baltic_subindices_2012_2019.csv.
    Renames HSI->bhsi, SI->bsi, PI->bpi, CI->bci.
    Drops tanker indices (DTI, CTI) if present.
    Sorts ascending by date and drops duplicate dates.
    """
    if filepath is None:
        filepath = os.path.join(DEFAULT_DATA_RAW_DIR, "baltic_subindices_2012_2019.csv")

    if not os.path.exists(filepath):
        logger.warning("Baltic sub-indices file not found at '%s'. Skipping.", filepath)
        return None

    df = pd.read_csv(filepath)

    # Rename column mappings
    rename_map = {
        "Date": "date",
        "HSI": "bhsi",
        "SI": "bsi",
        "PI": "bpi",
        "CI": "bci",
    }
    df = df.rename(columns=rename_map)

    # Drop tanker indices if present
    drop_cols = [c for c in ["DTI", "CTI", "dti", "cti"] if c in df.columns]
    if drop_cols:
        df = df.drop(columns=drop_cols)

    # Parse date (handles formats like 'Jul 31, 2019' or '2019-07-31')
    def clean_date_str(s: Union[str, float]) -> str:
        s = str(s).strip()
        m = re.match(r"^([A-Za-z]+)(\d{1,2}),?\s*(\d{4})$", s)
        if m:
            return f"{m.group(1)} {m.group(2)}, {m.group(3)}"
        return s

    df["date"] = pd.to_datetime(df["date"].apply(clean_date_str), errors="coerce")

    for col in ["bhsi", "bsi", "bpi", "bci"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Keep required columns, sort ascending, drop duplicate dates
    cols = [c for c in ["date", "bhsi", "bsi", "bpi", "bci"] if c in df.columns]
    df = df[cols].sort_values("date", ascending=True).drop_duplicates(subset=["date"]).reset_index(drop=True)

    _log_summary("baltic_subindices", df)
    return df


def load_bdi_daily(
    filepath: Optional[str] = None,
) -> Optional[pd.DataFrame]:
    """Load daily Baltic Dry Index (BDI) from Investing.com.

    Expected raw file: bdi_daily.csv.
    Handles thousands separators in Price and dates like '10/23/2026' or 'Oct 26, 2026'.
    Sorts ascending by date and drops duplicate dates.
    """
    if filepath is None:
        filepath = os.path.join(DEFAULT_DATA_RAW_DIR, "bdi_daily.csv")

    if not os.path.exists(filepath):
        logger.warning("BDI daily file not found at '%s'. Skipping.", filepath)
        return None

    df = pd.read_csv(filepath)

    date_col = "Date" if "Date" in df.columns else df.columns[0]
    price_col = "Price" if "Price" in df.columns else df.columns[1]

    # Parse date
    df["date"] = pd.to_datetime(df[date_col].astype(str).str.strip(), errors="coerce")

    # Clean thousands separator and convert price
    cleaned_price = df[price_col].astype(str).str.replace(",", "", regex=False).str.strip()
    df["bdi"] = pd.to_numeric(cleaned_price, errors="coerce")

    df = df[["date", "bdi"]].sort_values("date", ascending=True).drop_duplicates(subset=["date"]).reset_index(drop=True)

    _log_summary("bdi_daily", df)
    return df


def load_brent_daily(
    filepath: Optional[str] = None,
) -> Optional[pd.DataFrame]:
    """Load daily Brent crude oil prices from FRED (DCOILBRENTEU).

    Expected raw file: brent_daily.csv.
    Missing / holiday values ('.' or blank) are treated as NaN without filling.
    Sorts ascending by date and drops duplicate dates.
    """
    if filepath is None:
        filepath = os.path.join(DEFAULT_DATA_RAW_DIR, "brent_daily.csv")

    if not os.path.exists(filepath):
        logger.warning("Brent daily file not found at '%s'. Skipping.", filepath)
        return None

    df = pd.read_csv(filepath, na_values=[".", "", " "])

    date_col = "observation_date" if "observation_date" in df.columns else df.columns[0]
    val_col = "DCOILBRENTEU" if "DCOILBRENTEU" in df.columns else df.columns[1]

    df["date"] = pd.to_datetime(df[date_col].astype(str).str.strip(), errors="coerce")
    df["brent_crude"] = pd.to_numeric(df[val_col], errors="coerce")

    df = df[["date", "brent_crude"]].sort_values("date", ascending=True).drop_duplicates(subset=["date"]).reset_index(drop=True)

    _log_summary("brent_daily", df)
    return df


def load_usdinr_daily(
    filepath: Optional[str] = None,
) -> Optional[pd.DataFrame]:
    """Load daily USD/INR foreign exchange rates from FRED (DEXINUS).

    Expected raw file: usdinr_daily.csv.
    Missing / holiday values ('.' or blank) are treated as NaN without filling.
    Sorts ascending by date and drops duplicate dates.
    """
    if filepath is None:
        filepath = os.path.join(DEFAULT_DATA_RAW_DIR, "usdinr_daily.csv")

    if not os.path.exists(filepath):
        logger.warning("USD/INR daily file not found at '%s'. Skipping.", filepath)
        return None

    df = pd.read_csv(filepath, na_values=[".", "", " "])

    date_col = "observation_date" if "observation_date" in df.columns else df.columns[0]
    val_col = "DEXINUS" if "DEXINUS" in df.columns else df.columns[1]

    df["date"] = pd.to_datetime(df[date_col].astype(str).str.strip(), errors="coerce")
    df["usd_inr"] = pd.to_numeric(df[val_col], errors="coerce")

    df = df[["date", "usd_inr"]].sort_values("date", ascending=True).drop_duplicates(subset=["date"]).reset_index(drop=True)

    _log_summary("usdinr_daily", df)
    return df


def load_worldbank_pinksheet_monthly(
    filepath: Optional[str] = None,
) -> Optional[pd.DataFrame]:
    """Load World Bank Pink Sheet monthly commodity prices.

    Extracts Coal Australian, Coal South African, and Iron ore from 'Monthly Prices'.
    Dates formatted as '1960M01' are converted to monthly period start dates ('1960-01-01').
    Sorts ascending by date and drops duplicate dates.
    """
    if filepath is None:
        filepath = os.path.join(DEFAULT_DATA_RAW_DIR, "worldbank_pinksheet_monthly.xlsx")

    if not os.path.exists(filepath):
        logger.warning("World Bank Pink Sheet file not found at '%s'. Skipping.", filepath)
        return None

    # Parse XML directly from xlsx package without requiring third-party openpyxl/xlrd
    z = zipfile.ZipFile(filepath)

    # 1. Locate 'Monthly Prices' worksheet
    wb_tree = ET.fromstring(z.read("xl/workbook.xml"))
    sheet_rel_id = None
    for s in wb_tree.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet"):
        if s.attrib.get("name") == "Monthly Prices":
            sheet_rel_id = s.attrib.get(
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            )
            break

    if not sheet_rel_id:
        logger.warning("'Monthly Prices' sheet not found in '%s'. Skipping.", filepath)
        return None

    rels_tree = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    sheet_target = None
    for r in rels_tree.iter("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship"):
        if r.attrib.get("Id") == sheet_rel_id:
            sheet_target = "xl/" + r.attrib.get("Target").lstrip("/")
            break

    # 2. Extract shared strings table
    sst = []
    if "xl/sharedStrings.xml" in z.namelist():
        s_tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in s_tree:
            text = "".join([t.text for t in si.iter() if t.tag.endswith("t") and t.text])
            sst.append(text)

    # 3. Parse sheet rows and find relevant column letters from row 5 header
    sheet_tree = ET.fromstring(z.read(sheet_target))
    col_mapping = {}  # col letter -> normalized field name
    data_records = []

    for row in sheet_tree.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
        r_idx = int(row.attrib.get("r", 0))
        cells = {}
        for c in row.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
            ref = c.attrib.get("r", "")
            col = "".join([ch for ch in ref if ch.isalpha()])
            t = c.attrib.get("t", "")
            v = c.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
            val = v.text if v is not None else ""
            if t == "s" and val != "":
                val = sst[int(val)]
            cells[col] = val

        if r_idx == 5:
            for col, val in cells.items():
                if val:
                    val_clean = val.replace("**", "").strip()
                    if "Coal, Australian" in val_clean:
                        col_mapping[col] = "coal_australian"
                    elif "Coal, South African" in val_clean:
                        col_mapping[col] = "coal_south_african"
                    elif "Iron ore" in val_clean:
                        col_mapping[col] = "iron_ore"
        elif r_idx >= 7:
            date_raw = cells.get("A", "").strip()
            if not date_raw or not re.match(r"^\d{4}M\d{2}$", date_raw):
                continue
            record = {"date_str": date_raw}
            for col, field_name in col_mapping.items():
                val_raw = cells.get(col, "").strip()
                # '…' or '.' represents missing data
                if val_raw in ("…", ".", ""):
                    record[field_name] = None
                else:
                    try:
                        record[field_name] = float(val_raw)
                    except ValueError:
                        record[field_name] = None
            data_records.append(record)

    df = pd.DataFrame(data_records)

    # Convert '1960M01' -> datetime '1960-01-01'
    df["date"] = pd.to_datetime(
        df["date_str"].str.replace("M", "-", regex=False) + "-01",
        format="%Y-%m-%d",
        errors="coerce",
    )

    expected_cols = ["date", "coal_australian", "coal_south_african", "iron_ore"]
    keep_cols = [c for c in expected_cols if c in df.columns]
    df = df[keep_cols].sort_values("date", ascending=True).drop_duplicates(subset=["date"]).reset_index(drop=True)

    _log_summary("worldbank_pinksheet_monthly", df)
    return df


def load_all(raw_dir: Optional[str] = None) -> Dict[str, pd.DataFrame]:
    """Load all raw data files and return a dictionary of DataFrames.

    Skips and warns clearly if any file is missing.
    """
    if raw_dir is None:
        raw_dir = DEFAULT_DATA_RAW_DIR

    datasets: Dict[str, pd.DataFrame] = {}

    loaders = [
        ("baltic_subindices", load_baltic_subindices, "baltic_subindices_2012_2019.csv"),
        ("bdi_daily", load_bdi_daily, "bdi_daily.csv"),
        ("brent_daily", load_brent_daily, "brent_daily.csv"),
        ("usdinr_daily", load_usdinr_daily, "usdinr_daily.csv"),
        ("worldbank_pinksheet_monthly", load_worldbank_pinksheet_monthly, "worldbank_pinksheet_monthly.xlsx"),
    ]

    for key, loader_fn, filename in loaders:
        path = os.path.join(raw_dir, filename)
        df = loader_fn(path)
        if df is not None:
            datasets[key] = df
        else:
            logger.warning("Dataset '%s' could not be loaded from '%s'.", key, path)

    return datasets


if __name__ == "__main__":
    results = load_all()
    print("\n--- Summary of Loaded Datasets ---")
    for name, df in results.items():
        min_date = df["date"].min().strftime("%Y-%m-%d") if "date" in df.columns and len(df) > 0 else "N/A"
        max_date = df["date"].max().strftime("%Y-%m-%d") if "date" in df.columns and len(df) > 0 else "N/A"
        missing_dict = df.isna().sum().to_dict()
        print(f"\nDataset: {name}")
        print(f"  Rows: {len(df)}")
        print(f"  Columns: {df.columns.tolist()}")
        print(f"  Date Range: {min_date} to {max_date}")
        print(f"  Missing Values: {missing_dict}")
        print(f"  Sample:\n{df.head(2)}")
