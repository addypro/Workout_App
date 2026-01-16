#!/usr/bin/env python3
"""
hevy_export_parser.py

Robust parser for Hevy "workouts export" CSVs.

Hevy's workout export is "one row per set" with a schema like:
"title","start_time","end_time","description","exercise_title","superset_id",
"exercise_notes","set_index","set_type","weight_lbs","reps","distance_miles",
"duration_seconds","rpe"

Notes:
- Hevy exports can vary by app language; some tools fail to parse non-English dates.
  This parser includes a month-name normalization layer (Spanish/French/German/etc.) to handle that.

Output JSON shape (schema_version=1):
{
  "schema_version": 1,
  "source": {"app":"hevy","export_type":"workouts"},
  "workouts": [
    {
      "workout_id": "...",
      "title": "...",
      "start_time": "ISO-8601",
      "end_time": "ISO-8601|None",
      "description": "str|None",
      "duration_seconds": int|None,
      "exercises": [
        {
          "exercise_title":"...",
          "superset_id": int|None,
          "exercise_notes":"str|None",
          "sets":[
            {
              "set_index": int|None,
              "set_type":"str|None",
              "weight":{"value":float,"unit":"lbs|kg"}|None,
              "reps": int|None,
              "distance":{"value":float,"unit":"miles|km"}|None,
              "duration_seconds": int|None,
              "rpe": float|None,
              "raw": { ... original row columns ... }
            }
          ]
        }
      ]
    }
  ]
}

Usage:
  python hevy_export_parser.py input.csv -o output.json
  python hevy_export_parser.py input1.csv input2.csv -o output.json
  python hevy_export_parser.py --write-fixture hevy_fixture.csv
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Optional dependency (usually present if you have python-dateutil installed)
try:
    from dateutil import parser as dateparser  # type: ignore
except Exception:  # pragma: no cover
    dateparser = None  # type: ignore

EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# Month aliases -> English month abbreviations (case-insensitive; accents handled).
MONTH_ALIASES: Dict[str, str] = {
    # Spanish
    "ene": "Jan",
    "enero": "Jan",
    "feb": "Feb",
    "febrero": "Feb",
    "mar": "Mar",
    "marzo": "Mar",
    "abr": "Apr",
    "abril": "Apr",
    "may": "May",
    "mayo": "May",
    "jun": "Jun",
    "junio": "Jun",
    "jul": "Jul",
    "julio": "Jul",
    "ago": "Aug",
    "agosto": "Aug",
    "sep": "Sep",
    "sept": "Sep",
    "septiembre": "Sep",
    "oct": "Oct",
    "octubre": "Oct",
    "nov": "Nov",
    "noviembre": "Nov",
    "dic": "Dec",
    "diciembre": "Dec",
    # French
    "janv": "Jan",
    "janvier": "Jan",
    "fevr": "Feb",
    "fevrier": "Feb",
    "févr": "Feb",
    "février": "Feb",
    "mars": "Mar",
    "avr": "Apr",
    "avril": "Apr",
    "mai": "May",
    "juin": "Jun",
    "juil": "Jul",
    "juillet": "Jul",
    "aout": "Aug",
    "août": "Aug",
    "septembre": "Sep",
    "octobre": "Oct",
    "novembre": "Nov",
    "decembre": "Dec",
    "décembre": "Dec",
    # German
    "jan": "Jan",
    "januar": "Jan",
    "februar": "Feb",
    "mär": "Mar",
    "maerz": "Mar",
    "märz": "Mar",
    "apr": "Apr",
    "april": "Apr",
    "mai": "May",
    "jun": "Jun",
    "juni": "Jun",
    "jul": "Jul",
    "juli": "Jul",
    "aug": "Aug",
    "august": "Aug",
    "sep": "Sep",
    "sept": "Sep",
    "september": "Sep",
    "okt": "Oct",
    "oktober": "Oct",
    "nov": "Nov",
    "november": "Nov",
    "dez": "Dec",
    "dezember": "Dec",
    # Portuguese
    "janeiro": "Jan",
    "fev": "Feb",
    "fevereiro": "Feb",
    "março": "Mar",
    "abril": "Apr",
    "maio": "May",
    "junho": "Jun",
    "julho": "Jul",
    "set": "Sep",
    "setembro": "Sep",
    "out": "Oct",
    "outubro": "Oct",
    "dezembro": "Dec",
    # Italian
    "gen": "Jan",
    "gennaio": "Jan",
    "febbraio": "Feb",
    "aprile": "Apr",
    "mag": "May",
    "maggio": "May",
    "giu": "Jun",
    "giugno": "Jun",
    "lug": "Jul",
    "luglio": "Jul",
    "settembre": "Sep",
    "ott": "Oct",
    "ottobre": "Oct",
    "dic": "Dec",
    "dicembre": "Dec",
    # Dutch
    "januari": "Jan",
    "februari": "Feb",
    "mrt": "Mar",
    "maart": "Mar",
    "mei": "May",
    "juni": "Jun",
    "juli": "Jul",
    "augustus": "Aug",
    "september": "Sep",
    "oktober": "Oct",
    "november": "Nov",
    "december": "Dec",
}

HEVY_REQUIRED_HEADERS = {"title", "start_time", "exercise_title", "set_index"}

DEFAULT_DT_FORMATS = [
    "%d %b %Y, %H:%M",
    "%d %b %Y, %H:%M:%S",
    "%d %B %Y, %H:%M",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
]


def read_text_with_fallbacks(path: Path) -> str:
    """
    Read a text file using common encodings. Hevy exports are usually UTF-8 but
    we handle BOMs and some legacy encodings.
    """
    data = path.read_bytes()
    for enc in ("utf-8-sig", "utf-8", "utf-16", "utf-16-le", "utf-16-be", "latin-1"):
        try:
            return data.decode(enc)
        except Exception:
            continue
    return data.decode("utf-8", errors="replace")


def sniff_dialect(sample: str) -> csv.Dialect:
    try:
        return csv.Sniffer().sniff(sample, delimiters=[",", ";", "\t", "|"])
    except Exception:
        class D(csv.Dialect):
            delimiter = ","
            quotechar = '"'
            doublequote = True
            skipinitialspace = True
            lineterminator = "\n"
            quoting = csv.QUOTE_MINIMAL
        return D()


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def normalize_months(dt_str: str) -> str:
    # quick exit: already contains English month abbreviations
    if any(m in dt_str for m in EN_MONTHS):
        return dt_str
    tokens = re.split(r"(\W+)", dt_str)
    out: List[str] = []
    for tok in tokens:
        key = strip_accents(tok).lower()
        out.append(MONTH_ALIASES.get(key, tok))
    return "".join(out)


def parse_dt(dt_str: Optional[str]) -> Optional[str]:
    """
    Parse a Hevy timestamp into ISO-8601 (naive / local time).
    Returns None if empty/unparseable.
    """
    if dt_str is None:
        return None
    s = str(dt_str).strip()
    if s == "" or s.lower() in {"none", "null", "nan"}:
        return None

    s = normalize_months(s)

    for fmt in DEFAULT_DT_FORMATS:
        try:
            return datetime.strptime(s, fmt).isoformat()
        except Exception:
            pass

    if dateparser is not None:
        try:
            return dateparser.parse(s, dayfirst=True).isoformat()
        except Exception:
            return None

    return None


def to_int(x: Any) -> Optional[int]:
    if x is None:
        return None
    s = str(x).strip()
    if s == "" or s.lower() in {"nan", "none", "null"}:
        return None
    try:
        return int(float(s))
    except Exception:
        return None


def to_float(x: Any) -> Optional[float]:
    if x is None:
        return None
    s = str(x).strip()
    if s == "" or s.lower() in {"nan", "none", "null"}:
        return None
    try:
        return float(s)
    except Exception:
        return None


def sha1_id(*parts: str) -> str:
    h = hashlib.sha1()
    h.update("|".join(parts).encode("utf-8"))
    return h.hexdigest()


def normalize_headers(fieldnames: List[str]) -> List[str]:
    # Preserve original spellings but strip whitespace/BOM oddities.
    return [(f or "").strip().lstrip("\ufeff") for f in fieldnames]


def detect_hevy_workouts_export(headers: List[str]) -> bool:
    hs = {h.strip().lower() for h in headers}
    return HEVY_REQUIRED_HEADERS.issubset(hs)


def parse_hevy_workouts_csv(path: Path) -> Dict[str, Any]:
    """
    Parse one Hevy workouts export CSV file -> JSON dict.
    """
    text = read_text_with_fallbacks(path)
    dialect = sniff_dialect(text[:4096])

    # Use StringIO so csv module can properly handle quoted newlines.
    f = io.StringIO(text, newline="")
    reader = csv.DictReader(f, dialect=dialect)
    if reader.fieldnames is None:
        raise ValueError("CSV appears to have no header row.")

    headers = normalize_headers(reader.fieldnames)
    reader.fieldnames = headers  # apply normalized headers

    if not detect_hevy_workouts_export(headers):
        raise ValueError(f"Not a Hevy workouts export (missing required columns). Found headers: {headers}")

    # Load rows
    rows: List[Dict[str, Any]] = []
    for row in reader:
        # Normalize empty strings to None
        cleaned = {k: (v if v != "" else None) for k, v in row.items()}
        rows.append(cleaned)

    # Group rows into workouts by (title, start_time)
    workouts_by_key: Dict[Tuple[str, Optional[str]], Dict[str, Any]] = {}
    workout_order: List[Tuple[str, Optional[str]]] = []

    for r in rows:
        title = r.get("title") or ""
        start_iso = parse_dt(r.get("start_time"))
        key = (title, start_iso)

        if key not in workouts_by_key:
            wid = sha1_id(title, start_iso or "")
            workouts_by_key[key] = {
                "workout_id": wid,
                "title": title or None,
                "start_time": start_iso,
                "end_time": parse_dt(r.get("end_time")),
                "description": r.get("description"),
                "duration_seconds": None,
                "exercises": [],
                "_rows": [],
            }
            workout_order.append(key)

        w = workouts_by_key[key]

        # Fill missing workout-level fields if later rows have them
        if w.get("end_time") is None and r.get("end_time") is not None:
            w["end_time"] = parse_dt(r.get("end_time"))
        if (w.get("description") is None or w.get("description") == "") and r.get("description"):
            w["description"] = r.get("description")

        w["_rows"].append(r)

    # Build exercise blocks (preserve file order)
    for key in workout_order:
        w = workouts_by_key[key]
        wrows = w.pop("_rows")

        blocks: List[Dict[str, Any]] = []
        current: Optional[Dict[str, Any]] = None

        for r in wrows:
            ex_title = r.get("exercise_title")
            superset_id_raw = r.get("superset_id")
            block_key = (ex_title, superset_id_raw)

            if current is None or current["_key"] != block_key:
                current = {
                    "_key": block_key,
                    "exercise_title": ex_title,
                    "superset_id": to_int(superset_id_raw) if superset_id_raw is not None else None,
                    "exercise_notes": (r.get("exercise_notes") or None),
                    "sets": [],
                }
                blocks.append(current)
            else:
                # If exercise_notes differ and exist, keep all unique notes
                note = r.get("exercise_notes")
                if note and note not in (current.get("exercise_notes") or ""):
                    current["exercise_notes"] = (
                        (current.get("exercise_notes") + "\n" + note)
                        if current.get("exercise_notes")
                        else note
                    )

            set_obj: Dict[str, Any] = {
                "set_index": to_int(r.get("set_index")),
                "set_type": r.get("set_type"),
                "weight": None,
                "reps": to_int(r.get("reps")),
                "distance": None,
                "duration_seconds": to_int(r.get("duration_seconds")),
                "rpe": to_float(r.get("rpe")),
                # Keep everything, unmodified, for zero-loss imports/debugging.
                "raw": dict(r),
            }

            # Weight can be lbs or kg depending on export
            w_lbs = to_float(r.get("weight_lbs"))
            w_kg = to_float(r.get("weight_kg")) if "weight_kg" in r else None
            if w_lbs is not None:
                set_obj["weight"] = {"value": w_lbs, "unit": "lbs"}
            elif w_kg is not None:
                set_obj["weight"] = {"value": w_kg, "unit": "kg"}

            # Distance can be miles or km depending on export
            d_mi = to_float(r.get("distance_miles"))
            d_km = to_float(r.get("distance_km")) if "distance_km" in r else None
            if d_mi is not None:
                set_obj["distance"] = {"value": d_mi, "unit": "miles"}
            elif d_km is not None:
                set_obj["distance"] = {"value": d_km, "unit": "km"}

            current["sets"].append(set_obj)

        # Compute workout duration if possible
        try:
            if w.get("start_time") and w.get("end_time"):
                dt1 = datetime.fromisoformat(w["start_time"])
                dt2 = datetime.fromisoformat(w["end_time"])
                w["duration_seconds"] = int((dt2 - dt1).total_seconds())
        except Exception:
            pass

        # Remove internal key
        for b in blocks:
            b.pop("_key", None)

        w["exercises"] = blocks

    return {
        "schema_version": 1,
        "source": {"app": "hevy", "export_type": "workouts", "file": str(path)},
        "workouts": [workouts_by_key[k] for k in workout_order],
    }


def merge_parsed_files(parsed_files: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Merge multiple parsed Hevy exports into one JSON document.
    Deduplicates workouts by workout_id.
    """
    merged: Dict[str, Any] = {
        "schema_version": 1,
        "source": {"app": "hevy", "export_type": "workouts", "files": []},
        "workouts": [],
    }
    seen = set()
    for pf in parsed_files:
        src = pf.get("source", {})
        if "file" in src:
            merged["source"]["files"].append(src["file"])
        for w in pf.get("workouts", []):
            wid = w.get("workout_id")
            if wid and wid not in seen:
                seen.add(wid)
                merged["workouts"].append(w)

    # Sort workouts by start_time when possible
    def sort_key(w: Dict[str, Any]) -> Tuple[int, str]:
        st = w.get("start_time")
        return (0, st) if isinstance(st, str) else (1, "")

    merged["workouts"].sort(key=sort_key)
    return merged


def write_synthetic_fixture(path: Path) -> None:
    """
    Write a "fully filled" Hevy export-shaped CSV (synthetic) you can use for testing.
    """
    rows = [
        # Workout A: strength (weights+reps, notes, superset)
        {
            "title": "Upper A",
            "start_time": "28 Mar 2025, 17:29",
            "end_time": "28 Mar 2025, 18:52",
            "description": "Felt great today.",
            "exercise_title": "Bench Press (Barbell)",
            "superset_id": "",
            "exercise_notes": "Pause 1s on chest.",
            "set_index": "0",
            "set_type": "warmup",
            "weight_lbs": "135",
            "reps": "8",
            "distance_miles": "",
            "duration_seconds": "0",
            "rpe": "6",
        },
        {
            "title": "Upper A",
            "start_time": "28 Mar 2025, 17:29",
            "end_time": "28 Mar 2025, 18:52",
            "description": "Felt great today.",
            "exercise_title": "Bench Press (Barbell)",
            "superset_id": "",
            "exercise_notes": "Pause 1s on chest.",
            "set_index": "1",
            "set_type": "normal",
            "weight_lbs": "185",
            "reps": "5",
            "distance_miles": "",
            "duration_seconds": "0",
            "rpe": "8",
        },
        {
            "title": "Upper A",
            "start_time": "28 Mar 2025, 17:29",
            "end_time": "28 Mar 2025, 18:52",
            "description": "Felt great today.",
            "exercise_title": "Pull Up",
            "superset_id": "101",
            "exercise_notes": "Full ROM.",
            "set_index": "0",
            "set_type": "normal",
            "weight_lbs": "",
            "reps": "10",
            "distance_miles": "",
            "duration_seconds": "0",
            "rpe": "7.5",
        },
        {
            "title": "Upper A",
            "start_time": "28 Mar 2025, 17:29",
            "end_time": "28 Mar 2025, 18:52",
            "description": "Felt great today.",
            "exercise_title": "Dumbbell Curl",
            "superset_id": "101",
            "exercise_notes": "No swinging.",
            "set_index": "0",
            "set_type": "normal",
            "weight_lbs": "35",
            "reps": "12",
            "distance_miles": "",
            "duration_seconds": "0",
            "rpe": "7",
        },
        # Workout B: cardio (distance+duration, no weight)
        {
            "title": "Run",
            "start_time": "02 Apr 2025, 06:10",
            "end_time": "02 Apr 2025, 06:40",
            "description": "",
            "exercise_title": "Treadmill Run",
            "superset_id": "",
            "exercise_notes": "",
            "set_index": "0",
            "set_type": "normal",
            "weight_lbs": "",
            "reps": "",
            "distance_miles": "3.10",
            "duration_seconds": "1800",
            "rpe": "6",
        },
    ]
    headers = [
        "title",
        "start_time",
        "end_time",
        "description",
        "exercise_title",
        "superset_id",
        "exercise_notes",
        "set_index",
        "set_type",
        "weight_lbs",
        "reps",
        "distance_miles",
        "duration_seconds",
        "rpe",
    ]
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers, quoting=csv.QUOTE_MINIMAL)
        w.writeheader()
        for r in rows:
            w.writerow(r)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_files", nargs="*", help="Hevy workouts export CSV(s)")
    ap.add_argument("-o", "--out", help="Output JSON path. If omitted, prints to stdout.")
    ap.add_argument(
        "--write-fixture",
        help="Write a synthetic 'fully filled' Hevy export CSV fixture to this path, then exit.",
    )
    args = ap.parse_args()

    if args.write_fixture:
        write_synthetic_fixture(Path(args.write_fixture))
        print(f"Wrote synthetic fixture: {args.write_fixture}")
        return

    if not args.csv_files:
        ap.error("Provide at least one CSV file, or use --write-fixture")

    parsed = [parse_hevy_workouts_csv(Path(p)) for p in args.csv_files]
    merged = merge_parsed_files(parsed)

    out_text = json.dumps(merged, ensure_ascii=False, indent=2)
    if args.out:
        Path(args.out).write_text(out_text, encoding="utf-8")
        print(f"Wrote JSON: {args.out}")
    else:
        print(out_text)


if __name__ == "__main__":
    main()
