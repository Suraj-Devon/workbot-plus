#!/usr/bin/env python3
import sys
import os
import json
import math
import time
import warnings
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.metrics import silhouette_score

import chardet

warnings.filterwarnings("ignore")


# -----------------------------
# Constants / Tunables
# -----------------------------
MAX_ROWS_DEFAULT = 100_000          # hard cap for performance
SILHOUETTE_SAMPLE_MAX = 5_000       # silhouette can be expensive
CLUSTER_FEATURE_CAP = 25            # prevent huge feature spaces
ANOMALY_FEATURE_CAP = 30
CORR_FEATURE_CAP = 30
TOP_CATS = 5

RANDOM_SEED = 42


# -----------------------------
# JSON-safe conversion helpers
# -----------------------------
def _to_builtin(x: Any) -> Any:
    """Convert numpy/pandas types to pure Python JSON-serializable primitives."""
    if x is None:
        return None

    # numpy scalars
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.floating,)):
        return float(x)
    if isinstance(x, (np.bool_,)):
        return bool(x)

    # pandas timestamp/NaT
    if isinstance(x, (pd.Timestamp,)):
        if pd.isna(x):
            return None
        # ISO format
        return x.isoformat()

    # pandas NA / NaN
    if isinstance(x, float) and (math.isnan(x) or math.isinf(x)):
        return None

    return x


def safe_jsonify(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {str(k): safe_jsonify(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [safe_jsonify(v) for v in obj]
    if isinstance(obj, tuple):
        return [safe_jsonify(v) for v in obj]
    return _to_builtin(obj)


# -----------------------------
# Encoding / file sniffing
# -----------------------------
def detect_encoding(file_path: str) -> Dict[str, Any]:
    """Detect file encoding with chardet, return encoding + confidence."""
    try:
        with open(file_path, "rb") as f:
            raw = f.read(20000)
        result = chardet.detect(raw) or {}
        enc = result.get("encoding") or "utf-8"
        conf = float(result.get("confidence") or 0.0)
        return {"encoding": enc, "confidence": conf}
    except Exception:
        return {"encoding": "utf-8", "confidence": 0.0}


def sniff_file_kind(file_path: str) -> str:
    """
    Decide between 'csv' and 'json' by extension + first non-whitespace char.
    """
    name = (os.path.basename(file_path) or "").lower()
    if name.endswith(".json") or name.endswith(".jsonl") or name.endswith(".ndjson"):
        return "json"

    # quick sniff
    try:
        with open(file_path, "rb") as f:
            chunk = f.read(4096)
        # remove BOM-ish bytes in a crude way
        text = chunk.decode("utf-8", errors="ignore").lstrip()
        if text.startswith("{") or text.startswith("["):
            return "json"
    except Exception:
        pass

    return "csv"


# -----------------------------
# Robust readers
# -----------------------------
def read_csv_robust(file_path: str) -> Tuple[Optional[pd.DataFrame], Dict[str, Any]]:
    enc_info = detect_encoding(file_path)
    detected = enc_info["encoding"]

    attempts = []
    # Put common "works in the wild" encodings first
    encodings_to_try = [
        detected,
        "utf-8-sig",
        "utf-8",
        "utf-16",
        "cp1252",
        "latin-1",
        "iso-8859-1",
    ]

    last_err = None
    for enc in encodings_to_try:
        if enc in attempts:
            continue
        attempts.append(enc)
        try:
            # pandas >= 1.3 supports encoding_errors; if not present, it will raise TypeError
            try:
                df = pd.read_csv(
                    file_path,
                    encoding=enc,
                    encoding_errors="replace",
                    low_memory=False,
                )
            except TypeError:
                df = pd.read_csv(file_path, encoding=enc, low_memory=False)

            # if it parsed but has 0 columns, treat as invalid
            if df is not None and df.shape[1] == 0:
                last_err = "Parsed CSV but found 0 columns."
                continue

            meta = {
                "file_kind": "csv",
                "file_encoding": enc,
                "encoding_confidence": enc_info.get("confidence", 0.0),
                "encoding_attempts": attempts,
            }
            return df, meta
        except Exception as e:
            last_err = str(e)
            continue

    return None, {
        "file_kind": "csv",
        "file_encoding": detected,
        "encoding_confidence": enc_info.get("confidence", 0.0),
        "encoding_attempts": attempts,
        "read_error": last_err or "Unknown CSV read error",
    }


def read_json_robust(file_path: str) -> Tuple[Optional[pd.DataFrame], Dict[str, Any]]:
    """
    Supports:
    - JSON array of objects: [{"a":1}, {"a":2}]
    - JSON object that is records-ish (fallback via json.loads)
    - JSON Lines (NDJSON): one JSON object per line
    """
    enc_info = detect_encoding(file_path)
    detected = enc_info["encoding"]

    # Try pandas fast paths first
    # 1) JSON lines
    try:
        df = pd.read_json(file_path, orient="records", lines=True)
        if df is not None and df.shape[1] > 0:
            return df, {
                "file_kind": "jsonl",
                "file_encoding": detected,
                "encoding_confidence": enc_info.get("confidence", 0.0),
                "read_mode": "pandas_read_json_lines",
            }
    except Exception:
        pass

    # 2) Regular JSON (records)
    try:
        df = pd.read_json(file_path, orient="records", lines=False)
        if df is not None and df.shape[1] > 0:
            return df, {
                "file_kind": "json",
                "file_encoding": detected,
                "encoding_confidence": enc_info.get("confidence", 0.0),
                "read_mode": "pandas_read_json_records",
            }
    except Exception:
        pass

    # 3) Fallback: manual load with encoding fallbacks (handles non-standard JSON)
    last_err = None
    encodings_to_try = [detected, "utf-8-sig", "utf-8", "cp1252", "latin-1"]
    tried = []
    for enc in encodings_to_try:
        if enc in tried:
            continue
        tried.append(enc)
        try:
            with open(file_path, "r", encoding=enc, errors="replace") as f:
                text = f.read().strip()
            if not text:
                return pd.DataFrame(), {
                    "file_kind": "json",
                    "file_encoding": enc,
                    "encoding_confidence": enc_info.get("confidence", 0.0),
                    "read_mode": "manual_empty",
                }

            data = json.loads(text)

            # if dict -> try to normalize
            if isinstance(data, dict):
                # common patterns: {"data": [...]}
                if "data" in data and isinstance(data["data"], list):
                    data = data["data"]
                else:
                    # dict-of-lists -> DataFrame
                    df = pd.DataFrame(data)
                    return df, {
                        "file_kind": "json",
                        "file_encoding": enc,
                        "encoding_confidence": enc_info.get("confidence", 0.0),
                        "read_mode": "manual_dict",
                    }

            # list of dicts
            if isinstance(data, list):
                df = pd.DataFrame(data)
                return df, {
                    "file_kind": "json",
                    "file_encoding": enc,
                    "encoding_confidence": enc_info.get("confidence", 0.0),
                    "read_mode": "manual_list",
                }

            last_err = "Unsupported JSON structure (not list/dict)."
        except Exception as e:
            last_err = str(e)

    return None, {
        "file_kind": "json",
        "file_encoding": detected,
        "encoding_confidence": enc_info.get("confidence", 0.0),
        "read_mode": "failed",
        "read_error": last_err or "Unknown JSON read error",
        "encoding_attempts": tried,
    }


# -----------------------------
# Core analysis helpers
# -----------------------------
def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        return df

    # If columns are missing / unnamed, create safe names
    cols = list(df.columns)
    new_cols = []
    seen = set()
    for i, c in enumerate(cols):
        name = str(c).strip() if c is not None else ""
        if not name or name.lower().startswith("unnamed"):
            name = f"col_{i+1}"
        # de-dupe
        base = name
        j = 2
        while name in seen:
            name = f"{base}_{j}"
            j += 1
        seen.add(name)
        new_cols.append(name)
    df.columns = new_cols
    return df


def sample_df(df: pd.DataFrame, max_rows: int = MAX_ROWS_DEFAULT) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    if df is None:
        return df, {"applied": False}

    n = len(df)
    if n <= max_rows:
        return df, {"applied": False, "original_rows": int(n), "rows_used": int(n)}

    df_s = df.sample(n=max_rows, random_state=RANDOM_SEED)
    return df_s, {
        "applied": True,
        "method": "random_sample",
        "original_rows": int(n),
        "rows_used": int(max_rows),
        "note": f"Dataset had {n:,} rows; sampled down to {max_rows:,} rows for speed.",
    }


def get_numeric_cols(df: pd.DataFrame) -> List[str]:
    if df is None or df.empty:
        return []
    return df.select_dtypes(include=[np.number]).columns.tolist()


def cap_columns_by_variance(df: pd.DataFrame, cols: List[str], cap: int) -> List[str]:
    if not cols or cap <= 0:
        return []
    if len(cols) <= cap:
        return cols

    try:
        variances = df[cols].var(numeric_only=True).sort_values(ascending=False)
        keep = variances.head(cap).index.tolist()
        return keep
    except Exception:
        return cols[:cap]


def calculate_data_quality_score(df: pd.DataFrame) -> Dict[str, Any]:
    if df is None or df.empty:
        return {"overall_score": 0.0, "completeness": 0.0, "numeric_columns": 0, "missing_values": 0}

    total_cells = int(df.shape[0] * df.shape[1]) if df.shape[1] > 0 else 0
    missing_cells = int(df.isna().sum().sum()) if total_cells > 0 else 0
    completeness = (1 - missing_cells / total_cells) * 100 if total_cells > 0 else 0.0

    numeric_cols = get_numeric_cols(df)
    numeric_bonus = (len(numeric_cols) / max(df.shape[1], 1)) * 10.0
    quality_score = min(100.0, float(completeness + numeric_bonus))

    return {
        "overall_score": round(quality_score, 1),
        "completeness": round(float(completeness), 1),
        "numeric_columns": int(len(numeric_cols)),
        "missing_values": int(missing_cells),
    }


def detect_domain(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Heuristic domain detection to pick narrative style and target metric.
    """
    cols = [c.lower() for c in (df.columns.tolist() if df is not None else [])]
    text = " ".join(cols)

    score_business = 0
    score_ops = 0

    for kw in ["mrr", "arr", "revenue", "sales", "profit", "gmv", "churn", "subscription", "invoice", "order", "amount", "price"]:
        if kw in text:
            score_business += 1

    for kw in ["sla", "latency", "throughput", "cycle", "lead_time", "duration", "downtime", "incidents", "tickets", "inventory", "fulfillment"]:
        if kw in text:
            score_ops += 1

    domain = "business" if score_business >= score_ops else "ops"
    confidence = abs(score_business - score_ops) / max(score_business + score_ops, 1)

    return {
        "domain": domain,
        "signals": {"business": score_business, "ops": score_ops},
        "confidence": round(float(confidence), 2),
    }


def pick_target_metric(df: pd.DataFrame, numeric_cols: List[str], domain: str) -> Optional[str]:
    if not numeric_cols:
        return None

    name_priority = []
    if domain == "business":
        name_priority = ["mrr", "arr", "revenue", "sales", "profit", "gmv", "amount", "price", "total"]
    else:
        name_priority = ["throughput", "sla", "latency", "duration", "lead", "cycle", "time", "inventory", "tickets", "incidents"]

    lowered = {c.lower(): c for c in numeric_cols}
    for kw in name_priority:
        for lc, orig in lowered.items():
            if kw in lc:
                return orig

    # fallback: choose the most "important" numeric by absolute sum
    try:
        sums = df[numeric_cols].abs().sum().sort_values(ascending=False)
        return str(sums.index[0]) if len(sums) else numeric_cols[0]
    except Exception:
        return numeric_cols[0]


def try_parse_datetime_series(s: pd.Series) -> Tuple[pd.Series, float]:
    """
    Returns parsed series and non-null ratio.
    """
    try:
        parsed = pd.to_datetime(s, errors="coerce", utc=False)
        ratio = float(parsed.notna().mean()) if len(parsed) else 0.0
        return parsed, ratio
    except Exception:
        return pd.Series([pd.NaT] * len(s)), 0.0


def detect_datetime_column(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Detect a likely datetime column based on parse success ratio and uniqueness.
    """
    if df is None or df.empty:
        return {"found": False}

    candidates = []
    for col in df.columns:
        # avoid numeric metrics (unless they look like timestamps)
        s = df[col]
        if pd.api.types.is_datetime64_any_dtype(s):
            parsed = s
            ratio = float(parsed.notna().mean())
            uniq = int(parsed.nunique(dropna=True))
            candidates.append((col, ratio, uniq))
            continue

        if pd.api.types.is_object_dtype(s) or pd.api.types.is_string_dtype(s):
            parsed, ratio = try_parse_datetime_series(s)
            uniq = int(parsed.nunique(dropna=True))
            candidates.append((col, ratio, uniq))
            continue

        # int timestamps sometimes
        if pd.api.types.is_integer_dtype(s) and s.notna().mean() > 0.9:
            # if magnitude suggests epoch seconds/ms
            try:
                v = s.dropna().astype(np.int64)
                if len(v) >= 10:
                    med = int(v.median())
                    # crude epoch check
                    if med > 1_000_000_000:
                        unit = "s" if med < 10_000_000_000 else "ms"
                        parsed = pd.to_datetime(s, errors="coerce", unit=unit)
                        ratio = float(parsed.notna().mean())
                        uniq = int(parsed.nunique(dropna=True))
                        candidates.append((col, ratio, uniq))
            except Exception:
                pass

    # Select best candidate with ratio >= 0.8 and uniq >= 10
    best = None
    for col, ratio, uniq in candidates:
        if ratio >= 0.8 and uniq >= 10:
            if best is None or (ratio, uniq) > (best[1], best[2]):
                best = (col, ratio, uniq)

    if best is None:
        return {"found": False}

    col, ratio, uniq = best
    parsed, _ = try_parse_datetime_series(df[col]) if not pd.api.types.is_datetime64_any_dtype(df[col]) else (df[col], ratio)

    return {
        "found": True,
        "column": col,
        "parse_success_rate": round(float(ratio), 3),
        "unique_dates": int(uniq),
        "parsed_preview": [x.isoformat() if isinstance(x, pd.Timestamp) and pd.notna(x) else None for x in parsed.dropna().head(3).tolist()],
    }


def infer_time_grain(dt: pd.Series) -> str:
    """
    Infer a reasonable resample grain from median time delta.
    """
    try:
        dt2 = dt.dropna().sort_values()
        if len(dt2) < 5:
            return "D"
        diffs = dt2.diff().dropna()
        if diffs.empty:
            return "D"
        med = diffs.median()
        days = med / np.timedelta64(1, "D")
        if days <= 1.5:
            return "D"
        if days <= 10:
            return "W"
        if days <= 45:
            return "M"
        return "Q"
    except Exception:
        return "D"


def compute_basic_stats(df: pd.DataFrame, numeric_cols: List[str]) -> Dict[str, Any]:
    stats: Dict[str, Any] = {}
    for col in numeric_cols:
        s = df[col]
        try:
            stats[col] = {
                "mean": float(s.mean(skipna=True)),
                "median": float(s.median(skipna=True)),
                "std": float(s.std(skipna=True)),
                "min": float(s.min(skipna=True)),
                "max": float(s.max(skipna=True)),
                "missing": int(s.isna().sum()),
            }
        except Exception:
            stats[col] = {
                "mean": 0.0,
                "median": 0.0,
                "std": 0.0,
                "min": 0.0,
                "max": 0.0,
                "missing": int(s.isna().sum()) if hasattr(s, "isna") else 0,
            }
    return stats


def compute_correlations(df: pd.DataFrame, numeric_cols: List[str]) -> Dict[str, float]:
    correlations: Dict[str, float] = {}
    if len(numeric_cols) < 2:
        return correlations

    cols = cap_columns_by_variance(df, numeric_cols, CORR_FEATURE_CAP)
    try:
        corr_matrix = df[cols].corr(numeric_only=True)
        for i, c1 in enumerate(cols):
            for c2 in cols[i + 1 :]:
                corr = float(corr_matrix.loc[c1, c2])
                if np.isfinite(corr) and abs(corr) >= 0.6:
                    correlations[f"{c1} vs {c2}"] = round(corr, 4)
    except Exception:
        return {}
    return correlations


def compute_trends_half_split(df: pd.DataFrame, numeric_cols: List[str]) -> Dict[str, str]:
    trends: Dict[str, str] = {}
    if df is None or df.empty:
        return trends
    for col in numeric_cols:
        values = df[col].dropna()
        if len(values) < 10:
            continue
        mid = len(values) // 2
        first = float(values.iloc[:mid].mean()) if mid > 0 else None
        second = float(values.iloc[mid:].mean()) if mid < len(values) else None
        if first is None or second is None:
            continue
        if first == 0:
            continue
        pct = ((second - first) / abs(first)) * 100.0
        if abs(pct) >= 5:
            trends[col] = f"{pct:+.1f}%"
    return trends


def compute_outliers_iqr(df: pd.DataFrame, numeric_cols: List[str]) -> Dict[str, int]:
    outliers: Dict[str, int] = {}
    for col in numeric_cols:
        s = df[col].dropna()
        if len(s) < 20:
            continue
        try:
            q1 = s.quantile(0.25)
            q3 = s.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                continue
            count = int(((s < q1 - 1.5 * iqr) | (s > q3 + 1.5 * iqr)).sum())
            if count > 0:
                outliers[col] = count
        except Exception:
            continue
    return outliers


def build_data_dictionary(df: pd.DataFrame, datetime_info: Dict[str, Any]) -> Dict[str, Any]:
    """
    UI-friendly column profiling for trust and usability.
    """
    if df is None:
        return {"columns": []}

    dt_col = datetime_info.get("column") if datetime_info.get("found") else None

    columns = []
    n = len(df) if df is not None else 0
    for col in df.columns:
        s = df[col]
        missing = int(s.isna().sum()) if hasattr(s, "isna") else 0
        missing_pct = (missing / max(n, 1)) * 100.0

        unique = int(s.nunique(dropna=True)) if hasattr(s, "nunique") else 0
        unique_pct = (unique / max(n, 1)) * 100.0

        inferred = "text"
        if pd.api.types.is_bool_dtype(s):
            inferred = "bool"
        elif pd.api.types.is_numeric_dtype(s):
            inferred = "numeric"
        elif pd.api.types.is_datetime64_any_dtype(s) or (dt_col == col):
            inferred = "datetime"
        else:
            inferred = "categorical" if unique_pct <= 20 else "text"

        # top categories for categoricals
        top_values = []
        if inferred in ("categorical",) and n > 0:
            try:
                vc = s.astype(str).replace("nan", np.nan).dropna().value_counts().head(TOP_CATS)
                top_values = [{"value": str(k), "count": int(v)} for k, v in vc.items()]
            except Exception:
                top_values = []

        # likely ID
        is_likely_id = bool(unique_pct > 98 and missing_pct < 5 and inferred in ("text", "categorical", "numeric"))
        # likely currency/amount
        lc = col.lower()
        is_currency_like = any(k in lc for k in ["revenue", "amount", "price", "cost", "sales", "mrr", "arr", "gmv", "profit"])

        columns.append(
            {
                "name": col,
                "inferred_type": inferred,
                "missing_pct": round(float(missing_pct), 2),
                "unique_pct": round(float(unique_pct), 2),
                "top_values": top_values,
                "flags": {
                    "likely_id": is_likely_id,
                    "likely_date": bool(dt_col == col),
                    "likely_currency": bool(is_currency_like and inferred == "numeric"),
                },
            }
        )

    return {"columns": columns}


def choose_k_silhouette(X_scaled: np.ndarray) -> Dict[str, Any]:
    """
    Choose k in [2..8] by best silhouette score.
    Returns dict with k and diagnostics.
    """
    n = X_scaled.shape[0]
    if n < 10:
        return {"enabled": False, "reason": "Too few rows for clustering.", "k": None}

    k_max = min(8, n - 1)
    if k_max < 2:
        return {"enabled": False, "reason": "Not enough rows for k>=2.", "k": None}

    best_k = None
    best_score = -1.0
    scores = {}

    # silhouette can be expensive; sample rows for evaluation
    rng = np.random.default_rng(RANDOM_SEED)
    idx = np.arange(n)
    if n > SILHOUETTE_SAMPLE_MAX:
        idx = rng.choice(idx, size=SILHOUETTE_SAMPLE_MAX, replace=False)
        X_eval = X_scaled[idx]
    else:
        X_eval = X_scaled

    for k in range(2, k_max + 1):
        try:
            km = KMeans(n_clusters=k, random_state=RANDOM_SEED, n_init=10)
            labels = km.fit_predict(X_eval)
            # if a cluster collapses, silhouette can fail
            if len(set(labels)) < 2:
                continue
            sc = float(silhouette_score(X_eval, labels))
            scores[str(k)] = round(sc, 4)
            if sc > best_score:
                best_score = sc
                best_k = k
        except Exception:
            continue

    if best_k is None:
        return {"enabled": False, "reason": "Silhouette selection failed.", "k": None, "scores": scores}

    return {"enabled": True, "k": int(best_k), "best_score": round(float(best_score), 4), "scores": scores}


def run_kmeans(df: pd.DataFrame, numeric_cols: List[str]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Returns (clusters, cluster_meta)
    """
    clusters: Dict[str, Any] = {}
    meta: Dict[str, Any] = {"enabled": False}

    if df is None or df.empty or not numeric_cols:
        return clusters, {"enabled": False, "reason": "No numeric data for clustering."}

    cols = cap_columns_by_variance(df, numeric_cols, CLUSTER_FEATURE_CAP)
    X = df[cols].copy()
    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.fillna(X.mean(numeric_only=True))

    if len(X) < 10:
        return {}, {"enabled": False, "reason": "Too few rows for clustering."}

    try:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        k_info = choose_k_silhouette(X_scaled)
        if not k_info.get("enabled"):
            return {}, {"enabled": False, "reason": k_info.get("reason", "k selection failed"), "k_selection": k_info}

        k = int(k_info["k"])
        km = KMeans(n_clusters=k, random_state=RANDOM_SEED, n_init=10)
        labels = km.fit_predict(X_scaled)

        # summary per cluster
        df_tmp = df.copy()
        df_tmp["_cluster"] = labels

        for cid in range(k):
            part = df_tmp[df_tmp["_cluster"] == cid]
            size = int(len(part))
            if size == 0:
                continue
            means = part[cols].mean(numeric_only=True).to_dict()
            clusters[f"Segment_{cid+1}"] = {
                "size": size,
                "pct": f"{(size / max(len(df_tmp), 1) * 100):.1f}%",
                "avg_metrics": {k2: float(v2) for k2, v2 in means.items()},
            }

        meta = {
            "enabled": True,
            "k": k,
            "features_used": cols,
            "k_selection": k_info,
        }
        return clusters, meta
    except Exception as e:
        return {"error": str(e)}, {"enabled": False, "reason": str(e)}


def run_isolation_forest(df: pd.DataFrame, numeric_cols: List[str]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Returns (anomalies, anomaly_meta)
    """
    anomalies: Dict[str, Any] = {}
    meta: Dict[str, Any] = {"enabled": False}

    if df is None or df.empty or len(numeric_cols) == 0:
        return {}, {"enabled": False, "reason": "No numeric data for anomaly detection."}

    if len(df) < 25:
        return {}, {"enabled": False, "reason": "Too few rows for anomaly detection."}

    cols = cap_columns_by_variance(df, numeric_cols, ANOMALY_FEATURE_CAP)
    X = df[cols].copy()
    X = X.replace([np.inf, -np.inf], np.nan)
    X = X.fillna(X.mean(numeric_only=True))

    # Use 'auto' when available; fallback otherwise
    contamination_used: Any = "auto"
    try:
        iso = IsolationForest(
            contamination="auto",
            random_state=RANDOM_SEED,
            n_estimators=200,
            max_samples="auto",
        )
        preds = iso.fit_predict(X)
        scores = iso.decision_function(X)  # higher = more normal
    except Exception:
        contamination_used = 0.05
        iso = IsolationForest(
            contamination=0.05,
            random_state=RANDOM_SEED,
            n_estimators=200,
            max_samples="auto",
        )
        preds = iso.fit_predict(X)
        try:
            scores = iso.decision_function(X)
        except Exception:
            scores = np.zeros(len(X), dtype=float)

    anomaly_idx = np.where(preds == -1)[0]
    anomaly_count = int(len(anomaly_idx))
    if anomaly_count == 0:
        return {}, {"enabled": True, "features_used": cols, "contamination": contamination_used, "total_count": 0}

    # pick top anomalies: lowest decision_function
    try:
        order = np.argsort(scores)  # ascending: most anomalous first
        top_idx = order[: min(5, len(order))]
    except Exception:
        top_idx = anomaly_idx[: min(5, len(anomaly_idx))]

    top_rows = []
    for ix in top_idx:
        row = {c: _to_builtin(df.iloc[ix][c]) for c in cols}
        row["_row_index"] = int(df.index[ix]) if hasattr(df.index, "__len__") else int(ix)
        top_rows.append(row)

    anomalies = {
        "total_count": anomaly_count,
        "pct": f"{(anomaly_count / max(len(df), 1) * 100):.2f}%",
        "top_3_anomalies": top_rows[:3],  # keep UI contract
        "top_5_anomalies": top_rows,
    }

    meta = {
        "enabled": True,
        "features_used": cols,
        "contamination": contamination_used,
        "note": "contamination controls expected outlier proportion; 'auto' adapts threshold based on fitted scores when supported.",
    }
    return anomalies, meta


def geo_detection(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Simple lat/lon detection for point maps. Returns sample points for UI rendering.
    """
    if df is None or df.empty:
        return {"detected": False}

    cols = {c.lower(): c for c in df.columns}
    lat_candidates = [cols.get(k) for k in ["lat", "latitude"] if cols.get(k)]
    lon_candidates = [cols.get(k) for k in ["lon", "lng", "long", "longitude"] if cols.get(k)]
    if not lat_candidates or not lon_candidates:
        return {"detected": False}

    lat_col = lat_candidates[0]
    lon_col = lon_candidates[0]

    try:
        lat = pd.to_numeric(df[lat_col], errors="coerce")
        lon = pd.to_numeric(df[lon_col], errors="coerce")
        ok = lat.notna() & lon.notna() & lat.between(-90, 90) & lon.between(-180, 180)
        if ok.mean() < 0.1:
            return {"detected": False, "reason": "Too few valid lat/lon rows."}

        pts = df.loc[ok, [lat_col, lon_col]].head(200).copy()
        points = [{"lat": float(r[lat_col]), "lon": float(r[lon_col])} for _, r in pts.iterrows()]
        return {"detected": True, "lat_col": lat_col, "lon_col": lon_col, "points_sample": points}
    except Exception as e:
        return {"detected": False, "reason": str(e)}


def compute_time_analysis(
    df: pd.DataFrame,
    datetime_info: Dict[str, Any],
    target_metric: Optional[str],
    numeric_cols: List[str],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Returns (time_analysis, forecast) where forecast stays compatible with UI.
    """
    time_analysis: Dict[str, Any] = {"enabled": False}
    forecast: Dict[str, Any] = {}

    if not datetime_info.get("found"):
        return time_analysis, forecast
    if df is None or df.empty:
        return time_analysis, forecast

    dt_col = datetime_info["column"]
    # parse (again) to ensure dtype
    dt, ratio = try_parse_datetime_series(df[dt_col]) if not pd.api.types.is_datetime64_any_dtype(df[dt_col]) else (df[dt_col], float(df[dt_col].notna().mean()))
    dt = pd.to_datetime(dt, errors="coerce")
    df2 = df.copy()
    df2["_dt"] = dt
    df2 = df2[df2["_dt"].notna()]
    if len(df2) < 20:
        return {"enabled": False, "reason": "Not enough valid datetime rows."}, forecast

    grain = infer_time_grain(df2["_dt"])
    domain = detect_domain(df2).get("domain", "business")

    # pick a target metric if missing
    if target_metric is None:
        target_metric = pick_target_metric(df2, numeric_cols, domain)

    if target_metric is None or target_metric not in df2.columns:
        return {"enabled": False, "reason": "No numeric target metric for time analysis."}, forecast

    # aggregate
    try:
        df2 = df2.sort_values("_dt")
        ts = df2.set_index("_dt")[target_metric].replace([np.inf, -np.inf], np.nan).dropna()

        if ts.empty or len(ts) < 10:
            return {"enabled": False, "reason": "Target metric too sparse for time analysis."}, forecast

        rule = {"D": "D", "W": "W", "M": "M", "Q": "Q"}.get(grain, "D")
        agg = ts.resample(rule).sum(min_count=1).dropna()

        if len(agg) < 6:
            # if resampling collapses too much, fallback to daily
            agg = ts.resample("D").sum(min_count=1).dropna()
            rule = "D"
            grain = "D"

        if len(agg) < 6:
            return {"enabled": False, "reason": "Too few periods after aggregation."}, forecast

        last = float(agg.iloc[-1])
        prev = float(agg.iloc[-2])
        delta = last - prev
        delta_pct = (delta / abs(prev) * 100.0) if prev != 0 else None

        time_analysis = {
            "enabled": True,
            "datetime_col": dt_col,
            "target_metric": target_metric,
            "grain": grain,
            "resample_rule": rule,
            "last_period_value": last,
            "prev_period_value": prev,
            "delta": delta,
            "delta_pct": round(float(delta_pct), 2) if delta_pct is not None else None,
            "periods": int(len(agg)),
            "latest_period": str(agg.index[-1].date()) if hasattr(agg.index[-1], "date") else str(agg.index[-1]),
        }

        # Forecast: simple linear regression on aggregated series index
        # (time-series-aware aggregation; still transparent and safe)
        y = agg.values.astype(float)
        x = np.arange(len(y), dtype=float)

        # require enough points
        if len(y) >= 8:
            try:
                coeff = np.polyfit(x, y, 1)  # slope, intercept
                future_x = np.array([len(y), len(y) + 1, len(y) + 2], dtype=float)
                future_y = np.polyval(coeff, future_x)

                slope = float(coeff[0])
                # normalize slope as "per period" change rate w.r.t. recent baseline
                baseline = float(np.mean(y[-3:])) if len(y) >= 3 else float(np.mean(y))
                slope_rate = (slope / abs(baseline)) if baseline != 0 else slope

                forecast[target_metric] = {
                    "next_3_periods": [float(v) for v in future_y.tolist()],
                    "slope": float(slope_rate),
                    "note": "Forecast is a simple trend projection on aggregated time series; interpret as directional, not guaranteed.",
                    "grain": grain,
                }
            except Exception:
                pass

        return time_analysis, forecast
    except Exception as e:
        return {"enabled": False, "reason": str(e)}, forecast


def generate_ai_insights(
    domain_info: Dict[str, Any],
    quality: Dict[str, Any],
    file_info: Dict[str, Any],
    target_metric: Optional[str],
    time_analysis: Dict[str, Any],
    clusters: Dict[str, Any],
    anomalies: Dict[str, Any],
    correlations: Dict[str, Any],
) -> List[str]:
    insights: List[str] = []

    # Data health
    if quality:
        insights.append(f"Data health score is {quality.get('overall_score', 0)} / 100 with {quality.get('completeness', 0)}% completeness.")

    # Executive: time movement
    if time_analysis.get("enabled"):
        dm = time_analysis.get("target_metric")
        dpct = time_analysis.get("delta_pct")
        if dpct is not None:
            direction = "up" if dpct > 0 else "down"
            insights.append(f"{dm} is {direction} {abs(dpct):.1f}% vs the previous {time_analysis.get('grain')} period.")
        else:
            insights.append(f"{dm} changed by {time_analysis.get('delta', 0):.2f} vs the previous {time_analysis.get('grain')} period.")

    # Segments
    if clusters and isinstance(clusters, dict):
        try:
            best = max(
                [(k, v) for k, v in clusters.items() if isinstance(v, dict) and "size" in v],
                key=lambda kv: kv[1]["size"],
                default=None,
            )
            if best:
                insights.append(f"{best[0]} is the largest segment ({best[1].get('pct')}, {best[1].get('size')} records).")
        except Exception:
            pass

    # Anomalies
    if anomalies and isinstance(anomalies, dict) and anomalies.get("total_count", 0) > 0:
        insights.append(f"Detected {anomalies.get('total_count')} anomalies ({anomalies.get('pct')}). Investigate to prevent hidden errors or losses.")

    # Correlations
    if correlations:
        top_pair = next(iter(correlations.items()))
        insights.append(f"Strong relationship found: {top_pair[0]} (corr={top_pair[1]}), useful for driver analysis.")

    # File scale note
    insights.append(f"Processed {file_info.get('rows', 0):,} rows and {file_info.get('columns', 0)} columns.")

    # keep it short
    return insights[:5]


def generate_recommendations(
    domain_info: Dict[str, Any],
    quality: Dict[str, Any],
    time_analysis: Dict[str, Any],
    anomalies: Dict[str, Any],
    clusters: Dict[str, Any],
) -> List[Dict[str, Any]]:
    recs: List[Dict[str, Any]] = []

    # High-priority: missingness
    if quality and quality.get("missing_values", 0) > 0:
        recs.append(
            {
                "priority": "HIGH",
                "action": f"Fix {quality.get('missing_values')} missing values (or document why they are missing).",
                "reason": "Missing data can distort segmenting, anomaly detection, and trend analysis.",
                "impact": "Higher trust in insights and more stable results.",
            }
        )

    # High-priority: anomalies
    if anomalies and isinstance(anomalies, dict) and anomalies.get("total_count", 0) > 0:
        recs.append(
            {
                "priority": "HIGH",
                "action": f"Review the top anomalies (sample shown) and confirm if they are real events or data errors.",
                "reason": f"{anomalies.get('pct')} of records look unusual compared to the rest of the dataset.",
                "impact": "Prevent revenue leakage, fraud, or operational issues.",
            }
        )

    # Medium: time trend action
    if time_analysis.get("enabled") and time_analysis.get("delta_pct") is not None:
        dpct = float(time_analysis["delta_pct"])
        metric = time_analysis.get("target_metric")
        grain = time_analysis.get("grain")
        if dpct < -5:
            recs.append(
                {
                    "priority": "MEDIUM",
                    "action": f"Investigate why {metric} dropped {abs(dpct):.1f}% vs last {grain}.",
                    "reason": "A sustained decline is often driven by a specific segment, region, or category.",
                    "impact": "Improve retention, reduce churn, or restore growth.",
                }
            )
        elif dpct > 5:
            recs.append(
                {
                    "priority": "MEDIUM",
                    "action": f"Scale what is driving the {metric} increase (+{dpct:.1f}% vs last {grain}).",
                    "reason": "Growth periods are the best time to identify winning segments and double down.",
                    "impact": "Accelerate growth with focused investment.",
                }
            )

    # Medium: segmentation
    if clusters and isinstance(clusters, dict) and len([k for k, v in clusters.items() if isinstance(v, dict) and "size" in v]) >= 2:
        recs.append(
            {
                "priority": "MEDIUM",
                "action": "Compare segments and tailor strategy by segment (pricing, targeting, operations).",
                "reason": "Different segments show measurably different metric averages.",
                "impact": "Higher conversion and better resource allocation.",
            }
        )

    return recs[:4]


def build_chart_specs(
    time_analysis: Dict[str, Any],
    target_metric: Optional[str],
    correlations: Dict[str, Any],
    geo: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Optional: UI can render these with any chart lib (ECharts/Plotly/Nivo).
    """
    specs: List[Dict[str, Any]] = []

    if time_analysis.get("enabled") and target_metric:
        specs.append(
            {
                "id": "ts_target_metric",
                "title": f"{target_metric} over time",
                "type": "line_time_series",
                "datetime_col": time_analysis.get("datetime_col"),
                "y_col": target_metric,
                "grain": time_analysis.get("grain"),
                "note": "Aggregate by period for readability.",
            }
        )

    if correlations:
        pair, corr = next(iter(correlations.items()))
        # "A vs B"
        parts = pair.split(" vs ")
        if len(parts) == 2:
            specs.append(
                {
                    "id": "corr_scatter",
                    "title": f"Relationship: {parts[0]} vs {parts[1]}",
                    "type": "scatter",
                    "x_col": parts[0],
                    "y_col": parts[1],
                    "note": f"corr={corr}",
                }
            )

    if geo.get("detected"):
        specs.append(
            {
                "id": "geo_points",
                "title": "Geo distribution (sample)",
                "type": "map_points",
                "lat_col": geo.get("lat_col"),
                "lon_col": geo.get("lon_col"),
                "note": "Uses a capped sample of points for performance.",
            }
        )

    return specs


# -----------------------------
# Main analysis orchestrator
# -----------------------------
def analyze_file(file_path: str, execution_id: str) -> Dict[str, Any]:
    start = time.time()

    base_response = {
        "success": False,
        "execution_id": execution_id,
        "file_encoding": "utf-8",
        "file_info": {"rows": 0, "columns": 0, "numeric_columns": []},
        "data_quality": {"overall_score": 0.0, "completeness": 0.0, "numeric_columns": 0, "missing_values": 0},
        "statistics": {},
        "correlations": {},
        "trends": {},
        "outliers": {},
        "clusters": {},
        "anomalies": {},
        "forecast": {},
        "ai_insights": [],
        "recommendations": [],
        "insights": [],
        "summary": "",
        # optional additions (UI-safe)
        "data_dictionary": {"columns": []},
        "time_analysis": {"enabled": False},
        "domain": {"domain": "business", "confidence": 0.0, "signals": {"business": 0, "ops": 0}},
        "run_notes": [],
        "sampling": {"applied": False},
        "chart_specs": [],
        "geo": {"detected": False},
        "ml_meta": {"clustering": {"enabled": False}, "anomalies": {"enabled": False}},
    }

    if not file_path or not os.path.exists(file_path):
        base_response["error"] = "Missing or invalid file path."
        base_response["summary"] = "Analysis failed: file not found."
        return base_response

    # Read
    kind = sniff_file_kind(file_path)
    df = None
    meta = {}
    if kind == "json":
        df, meta = read_json_robust(file_path)
    else:
        df, meta = read_csv_robust(file_path)

    base_response["file_encoding"] = meta.get("file_encoding", "utf-8")
    base_response["run_notes"].append(f"Detected input as {meta.get('file_kind', kind)}.")
    if "encoding_confidence" in meta:
        base_response["run_notes"].append(f"Encoding detection confidence: {meta.get('encoding_confidence'):.2f}.")

    if df is None:
        base_response["error"] = meta.get("read_error", "Failed to read file.")
        base_response["summary"] = f"Analysis failed: {base_response['error']}"
        base_response["run_notes"].append("Reader failed; returning a safe error response.")
        return base_response

    df = normalize_columns(df)

    # Empty dataset checks
    if df.empty or df.shape[1] == 0:
        base_response["success"] = False
        base_response["error"] = "The file contains no usable rows/columns."
        base_response["summary"] = "No usable data found."
        return base_response

    # Sampling
    df_used, sampling = sample_df(df, MAX_ROWS_DEFAULT)
    base_response["sampling"] = sampling
    if sampling.get("applied"):
        base_response["run_notes"].append(sampling.get("note", "Sampling applied."))

    # Basic info
    num_rows = int(len(df_used))
    num_cols = int(df_used.shape[1])
    numeric_cols_all = get_numeric_cols(df_used)

    base_response["file_info"] = {
        "rows": num_rows,
        "columns": num_cols,
        "numeric_columns": numeric_cols_all,
    }

    # Domain + target metric
    domain_info = detect_domain(df_used)
    base_response["domain"] = domain_info
    target_metric = pick_target_metric(df_used, numeric_cols_all, domain_info.get("domain", "business"))
    if target_metric:
        base_response["run_notes"].append(f"Target metric selected: {target_metric} (domain={domain_info.get('domain')}).")

    # Data quality
    quality = calculate_data_quality_score(df_used)
    base_response["data_quality"] = quality

    # Datetime detection + dictionary
    datetime_info = detect_datetime_column(df_used)
    base_response["run_notes"].append(
        "Datetime column detected." if datetime_info.get("found") else "No reliable datetime column detected."
    )
    base_response["data_dictionary"] = build_data_dictionary(df_used, datetime_info)

    # Stats, correlations, trends, outliers
    # Use all numeric columns for stats, but cap for correlations/outliers/trends if needed
    stats = compute_basic_stats(df_used, numeric_cols_all)
    base_response["statistics"] = stats

    correlations = compute_correlations(df_used, numeric_cols_all)
    base_response["correlations"] = correlations

    trends = compute_trends_half_split(df_used, numeric_cols_all)
    base_response["trends"] = trends

    outliers = compute_outliers_iqr(df_used, numeric_cols_all)
    base_response["outliers"] = outliers

    # Geo detection (optional)
    geo = geo_detection(df_used)
    base_response["geo"] = geo

    # Clustering + anomalies (only if numeric exists)
    clusters = {}
    cluster_meta = {"enabled": False, "reason": "Not run."}
    anomalies = {}
    anomaly_meta = {"enabled": False, "reason": "Not run."}

    if numeric_cols_all:
        clusters, cluster_meta = run_kmeans(df_used, numeric_cols_all)
        anomalies, anomaly_meta = run_isolation_forest(df_used, numeric_cols_all)

    base_response["clusters"] = clusters if clusters else {}
    base_response["anomalies"] = anomalies if anomalies else {}
    base_response["ml_meta"]["clustering"] = cluster_meta
    base_response["ml_meta"]["anomalies"] = anomaly_meta

    # Time analysis + forecasting
    time_analysis, forecast = compute_time_analysis(df_used, datetime_info, target_metric, numeric_cols_all)
    base_response["time_analysis"] = time_analysis
    base_response["forecast"] = forecast if forecast else {}

    # AI insights + recommendations
    ai_insights = generate_ai_insights(
        domain_info=domain_info,
        quality=quality,
        file_info=base_response["file_info"],
        target_metric=target_metric,
        time_analysis=time_analysis,
        clusters=clusters,
        anomalies=anomalies,
        correlations=correlations,
    )
    base_response["ai_insights"] = ai_insights

    recommendations = generate_recommendations(
        domain_info=domain_info,
        quality=quality,
        time_analysis=time_analysis,
        anomalies=anomalies,
        clusters=clusters,
    )
    base_response["recommendations"] = recommendations

    # Standard insights (keep existing behavior)
    insights = []
    insights.append(f"Analyzed {num_rows} rows and {num_cols} columns")
    insights.append(f"Found {len(numeric_cols_all)} numeric columns for analysis")
    if cluster_meta.get("enabled"):
        insights.append(f"KMeans found {cluster_meta.get('k')} segments (silhouette-selected)")
    if anomalies and anomalies.get("total_count") is not None:
        insights.append(f"Detected {anomalies.get('total_count')} anomalies ({anomalies.get('pct')})")
    if time_analysis.get("enabled"):
        insights.append(f"Time analysis enabled on {time_analysis.get('datetime_col')} ({time_analysis.get('grain')})")

    base_response["insights"] = insights
    base_response["summary"] = " | ".join(insights[:3]) if insights else "Analysis complete"

    # Chart specs (optional)
    base_response["chart_specs"] = build_chart_specs(time_analysis, target_metric, correlations, geo)

    # Final status
    base_response["success"] = True

    # Runtime note
    elapsed = time.time() - start
    base_response["run_notes"].append(f"Runtime: {elapsed:.2f}s (timeout budget: 60s).")

    return base_response


# -----------------------------
# CLI entrypoint
# -----------------------------
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing file path", "summary": "Missing file path"}))
        sys.exit(1)

    file_path = sys.argv[1]
    execution_id = sys.argv[2] if len(sys.argv) > 2 else "unknown"

    try:
        result = analyze_file(file_path, execution_id)
        result = safe_jsonify(result)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        # Never crash; always return a safe payload
        fallback = {
            "success": False,
            "execution_id": execution_id,
            "file_encoding": "utf-8",
            "file_info": {"rows": 0, "columns": 0, "numeric_columns": []},
            "data_quality": {"overall_score": 0.0, "completeness": 0.0, "numeric_columns": 0, "missing_values": 0},
            "statistics": {},
            "correlations": {},
            "trends": {},
            "outliers": {},
            "clusters": {},
            "anomalies": {},
            "forecast": {},
            "ai_insights": [],
            "recommendations": [],
            "insights": [],
            "summary": f"Analysis failed: {str(e)}",
            "error": str(e),
        }
        print(json.dumps(fallback, ensure_ascii=False))
