from __future__ import annotations

import csv
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ----------------------------
# Robust parsing utilities
# ----------------------------

def _read_text_best_effort(path: Path) -> Tuple[str, str]:
    """Return (text, encoding_used)."""
    for enc in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return path.read_text(encoding=enc), enc
        except Exception:
            continue
    data = path.read_bytes()
    return data.decode("utf-8", errors="ignore"), "utf-8(ignore)"


def sniff_dialect(sample: str) -> csv.Dialect:
    try:
        return csv.Sniffer().sniff(sample, delimiters=[",", ";", "\t", "|"])
    except Exception:
        # default to comma
        class D(csv.Dialect):
            delimiter = ","
            quotechar = '"'
            doublequote = True
            escapechar = None
            lineterminator = "\n"
            quoting = csv.QUOTE_MINIMAL
            skipinitialspace = False
        return D()


def normalize_header(h: str) -> str:
    h = (h or "").strip()
    h = h.replace("\ufeff", "")  # BOM
    h = re.sub(r"\s+", " ", h)
    return h


def header_key(h: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", h.strip().lower()).strip("_")


# Canonical field map: canonical -> possible header keys
FIELD_SYNONYMS = {
    "date": {"date", "workout_date", "start_time", "timestamp"},
    "workout_name": {"workout_name", "workout"},
    "duration": {"duration", "workout_duration", "session_duration"},
    "exercise_name": {"exercise_name", "exercise"},
    "set_order": {"set_order", "set", "set_number", "set_no"},
    "weight": {"weight", "kg", "lb", "weight_kg", "weight_lb"},
    "reps": {"reps", "rep", "repetitions"},
    "distance": {"distance", "meters", "miles", "km"},
    "seconds": {"seconds", "time", "time_seconds", "duration_seconds"},
    "rpe": {"rpe", "effort", "rir"},
    "notes": {"notes", "set_notes", "exercise_notes", "note"},
    "workout_notes": {"workout_notes", "session_notes", "notes_workout"},
    "rest_timer": {"rest_timer", "rest", "rest_seconds", "rest_time", "rest_timer_seconds"},
}


def build_header_mapping(headers: List[str]) -> Dict[str, str]:
    """
    Returns mapping: canonical_field -> actual_header (original header string).
    Unknown headers are not mapped (they remain in row['extra']).
    """
    hk_to_orig = {header_key(normalize_header(h)): normalize_header(h) for h in headers}
    mapping = {}
    for canon, synonyms in FIELD_SYNONYMS.items():
        for s in synonyms:
            if s in hk_to_orig:
                mapping[canon] = hk_to_orig[s]
                break
    return mapping


def detect_variant(headers: List[str]) -> Dict[str, Any]:
    hk = {header_key(normalize_header(h)) for h in headers}
    has_notes = any(k in hk for k in FIELD_SYNONYMS["notes"])
    has_workout_notes = any(k in hk for k in FIELD_SYNONYMS["workout_notes"])
    has_rest = any(k in hk for k in FIELD_SYNONYMS["rest_timer"])

    if has_notes and has_rest:
        variant = "notes_and_rest"
    elif has_notes:
        variant = "notes_only"
    elif has_rest:
        variant = "rest_only"
    else:
        variant = "base"

    return {
        "variant": variant,
        "has_notes": has_notes,
        "has_workout_notes": has_workout_notes,
        "has_rest_timer": has_rest,
    }


def parse_iso_datetime(s: str) -> Optional[str]:
    s = (s or "").strip()
    if not s:
        return None

    fmts = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y %H:%M:%S", "%m/%d/%Y"]
    for fmt in fmts:
        try:
            dt = datetime.strptime(s, fmt)
            if fmt in ("%Y-%m-%d", "%m/%d/%Y"):
                return dt.date().isoformat()
            return dt.isoformat()
        except Exception:
            pass

    return s  # fallback raw


_DURATION_TOKEN = re.compile(
    r"(?P<num>\d+(?:\.\d+)?)\s*(?P<unit>h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)\b",
    re.I,
)


def parse_duration_to_seconds(d: str) -> Optional[float]:
    d = (d or "").strip()
    if not d:
        return None

    total = 0.0
    found = False
    for m in _DURATION_TOKEN.finditer(d):
        found = True
        num = float(m.group("num"))
        unit = m.group("unit").lower()
        if unit.startswith("h"):
            total += num * 3600
        elif unit.startswith("m"):
            total += num * 60
        else:
            total += num

    if found:
        return total

    try:
        return float(d)  # assume seconds
    except Exception:
        return None


def parse_number(s: str) -> Optional[float]:
    s = (s or "").strip()
    if s == "":
        return None
    s2 = s.replace(",", "")
    try:
        return float(s2)
    except Exception:
        return None


def stable_workout_id(date_iso: Optional[str], workout_name: Optional[str]) -> str:
    base = f"{date_iso or ''}||{workout_name or ''}"
    return hashlib.sha1(base.encode("utf-8")).hexdigest()


# ----------------------------
# CSV -> Rows
# ----------------------------

def read_csv_rows(path: str) -> Dict[str, Any]:
    p = Path(path)
    text, enc = _read_text_best_effort(p)
    sample = "\n".join(text.splitlines()[:50])
    dialect = sniff_dialect(sample)

    rows: List[Dict[str, str]] = []
    with p.open("r", encoding=enc if "ignore" not in enc else "utf-8", errors="ignore", newline="") as f:
        reader = csv.reader(f, dialect)
        try:
            headers = next(reader)
        except StopIteration:
            return {"path": str(p), "encoding": enc, "headers": [], "rows": []}

        headers = [normalize_header(h) for h in headers]

        for r in reader:
            # Pad or trim to header length
            if len(r) < len(headers):
                r = r + [""] * (len(headers) - len(r))
            elif len(r) > len(headers):
                r = r[:len(headers)]

            rows.append({headers[i]: r[i] for i in range(len(headers))})

    return {"path": str(p), "encoding": enc, "headers": headers, "rows": rows}


# ----------------------------
# Rows -> Strong workouts JSON
# ----------------------------

def parse_strong_workouts(csv_blob: Dict[str, Any]) -> Dict[str, Any]:
    headers = csv_blob["headers"]
    rows = csv_blob["rows"]
    mapping = build_header_mapping(headers)
    variant_info = detect_variant(headers)

    required = ["date", "workout_name", "exercise_name"]
    missing_required = [r for r in required if r not in mapping]
    if missing_required:
        return {
            "file": csv_blob["path"],
            "detected": {"file_type": "unknown", "missing_required": missing_required, **variant_info},
            "workouts": [],
            "unparsed_rows": rows[:50],
        }

    workouts: Dict[str, Any] = {}
    unparsed: List[Dict[str, Any]] = []

    for row in rows:
        extra: Dict[str, Any] = {}
        for h in headers:
            if h in mapping.values():
                continue
            extra[h] = row.get(h, "")

        date_raw = row.get(mapping["date"], "")
        wk_name = row.get(mapping["workout_name"], "")
        ex_name = row.get(mapping["exercise_name"], "")

        date_iso = parse_iso_datetime(date_raw)
        wk_id = stable_workout_id(date_iso, wk_name)

        if wk_id not in workouts:
            dur_raw = row.get(mapping.get("duration", ""), "") if mapping.get("duration") else None
            workouts[wk_id] = {
                "workout_id": wk_id,
                "date_raw": date_raw,
                "date": date_iso,
                "workout_name": wk_name,
                "duration_raw": dur_raw,
                "duration_seconds": parse_duration_to_seconds(dur_raw) if dur_raw else None,
                "workout_notes": None,
                "exercises": [],
                "source_rows": 0,
            }

        wk = workouts[wk_id]
        wk["source_rows"] += 1

        # workout notes aggregation
        if mapping.get("workout_notes"):
            wn = (row.get(mapping["workout_notes"], "") or "").strip()
            if wn:
                if wk["workout_notes"] is None:
                    wk["workout_notes"] = wn
                elif wn not in wk["workout_notes"]:
                    wk["workout_notes"] = wk["workout_notes"] + "\n---\n" + wn

        # preserve exercise order: start new block when exercise name changes
        if not wk["exercises"] or wk["exercises"][-1]["exercise_name"] != ex_name:
            wk["exercises"].append({
                "exercise_block_index": len(wk["exercises"]),
                "exercise_name": ex_name,
                "sets": [],
                "exercise_notes": None,
            })

        ex = wk["exercises"][-1]

        set_order_raw = row.get(mapping.get("set_order", ""), "") if mapping.get("set_order") else ""
        weight_raw = row.get(mapping.get("weight", ""), "") if mapping.get("weight") else ""
        reps_raw = row.get(mapping.get("reps", ""), "") if mapping.get("reps") else ""
        dist_raw = row.get(mapping.get("distance", ""), "") if mapping.get("distance") else ""
        sec_raw = row.get(mapping.get("seconds", ""), "") if mapping.get("seconds") else ""
        rpe_raw = row.get(mapping.get("rpe", ""), "") if mapping.get("rpe") else ""
        notes_raw = row.get(mapping.get("notes", ""), "") if mapping.get("notes") else ""
        rest_raw = row.get(mapping.get("rest_timer", ""), "") if mapping.get("rest_timer") else ""

        set_order_num = parse_number(set_order_raw)
        is_set_like = (
            set_order_num is not None
            or any(v.strip() for v in [weight_raw, reps_raw, dist_raw, sec_raw, rpe_raw, rest_raw])
        )

        if is_set_like:
            set_obj = {
                "set_index": len(ex["sets"]),
                "set_order_raw": set_order_raw if set_order_raw != "" else None,
                "set_order": int(set_order_num) if set_order_num is not None else None,
                "weight_raw": weight_raw if weight_raw != "" else None,
                "weight": parse_number(weight_raw),
                "reps_raw": reps_raw if reps_raw != "" else None,
                "reps": parse_number(reps_raw),
                "distance_raw": dist_raw if dist_raw != "" else None,
                "distance": parse_number(dist_raw),
                "seconds_raw": sec_raw if sec_raw != "" else None,
                "seconds": parse_number(sec_raw),
                "rpe_raw": rpe_raw if rpe_raw != "" else None,
                "rpe": parse_number(rpe_raw),
                "rest_timer_raw": rest_raw if rest_raw != "" else None,
                "rest_timer_seconds": parse_duration_to_seconds(rest_raw) if rest_raw else None,
                "notes": notes_raw if notes_raw != "" else None,
                "extra": extra if extra else None,
            }
            ex["sets"].append(set_obj)
        else:
            # note-only row; attach to exercise_notes if present
            if notes_raw.strip():
                if ex["exercise_notes"] is None:
                    ex["exercise_notes"] = notes_raw.strip()
                elif notes_raw.strip() not in ex["exercise_notes"]:
                    ex["exercise_notes"] = ex["exercise_notes"] + "\n---\n" + notes_raw.strip()
            else:
                unparsed.append({"workout_id": wk_id, "row": row, "reason": "not_set_like_and_no_notes"})

    return {
        "file": csv_blob["path"],
        "detected": {"file_type": "strong_workouts_export", **variant_info},
        "columns": headers,
        "workouts": list(workouts.values()),
        "unparsed_rows": unparsed,
    }


def merge_workouts(parsed_files: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Merge workouts across multiple files by workout_id, enriching missing fields.
    Assumes row ordering is identical across exports for the same workout.
    """
    merged: Dict[str, Any] = {}

    for pf in parsed_files:
        for wk in pf.get("workouts", []):
            wid = wk["workout_id"]
            if wid not in merged:
                merged[wid] = wk
                merged[wid]["sources"] = [pf["file"]]
                continue

            target = merged[wid]
            if pf["file"] not in target["sources"]:
                target["sources"].append(pf["file"])

            # workout notes
            if (not target.get("workout_notes")) and wk.get("workout_notes"):
                target["workout_notes"] = wk["workout_notes"]
            elif wk.get("workout_notes") and wk["workout_notes"] not in (target.get("workout_notes") or ""):
                target["workout_notes"] = (target.get("workout_notes") or "") + "\n---\n" + wk["workout_notes"]

            # duration
            if (target.get("duration_raw") in (None, "", "None")) and wk.get("duration_raw"):
                target["duration_raw"] = wk["duration_raw"]
            if target.get("duration_seconds") is None and wk.get("duration_seconds") is not None:
                target["duration_seconds"] = wk["duration_seconds"]

            # merge exercises/sets order-based
            for ex in wk.get("exercises", []):
                idx = ex["exercise_block_index"]
                while len(target["exercises"]) <= idx:
                    target["exercises"].append({
                        "exercise_block_index": len(target["exercises"]),
                        "exercise_name": ex["exercise_name"],
                        "sets": [],
                        "exercise_notes": None,
                    })
                tex = target["exercises"][idx]
                if tex["exercise_name"] != ex["exercise_name"]:
                    tex["exercise_name"] = tex["exercise_name"] + " / " + ex["exercise_name"]

                if (not tex.get("exercise_notes")) and ex.get("exercise_notes"):
                    tex["exercise_notes"] = ex["exercise_notes"]
                elif ex.get("exercise_notes") and ex["exercise_notes"] not in (tex.get("exercise_notes") or ""):
                    tex["exercise_notes"] = (tex.get("exercise_notes") or "") + "\n---\n" + ex["exercise_notes"]

                for s in ex.get("sets", []):
                    sidx = s["set_index"]
                    while len(tex["sets"]) <= sidx:
                        tex["sets"].append({
                            "set_index": len(tex["sets"]),
                            "set_order_raw": None, "set_order": None,
                            "weight_raw": None, "weight": None,
                            "reps_raw": None, "reps": None,
                            "distance_raw": None, "distance": None,
                            "seconds_raw": None, "seconds": None,
                            "rpe_raw": None, "rpe": None,
                            "rest_timer_raw": None, "rest_timer_seconds": None,
                            "notes": None,
                            "extra": None,
                        })
                    ts = tex["sets"][sidx]

                    # merge fields
                    for k, v in s.items():
                        if k == "extra":
                            if v:
                                if ts.get("extra") is None:
                                    ts["extra"] = v
                                else:
                                    for ek, ev in v.items():
                                        if ek not in ts["extra"] or ts["extra"][ek] in ("", None):
                                            ts["extra"][ek] = ev
                            continue

                        if ts.get(k) in (None, "", "None") and v not in (None, "", "None"):
                            ts[k] = v

                    if s.get("notes") and s["notes"] not in (ts.get("notes") or ""):
                        ts["notes"] = (ts.get("notes") or "") + ("\n---\n" if ts.get("notes") else "") + s["notes"]

    return sorted(merged.values(), key=lambda w: (w.get("date") or ""))


# ----------------------------
# Public API
# ----------------------------

def parse_strong_csv_files(csv_paths: List[str], merge_duplicates: bool = True) -> Dict[str, Any]:
    parsed_files = []
    for path in csv_paths:
        blob = read_csv_rows(path)
        parsed_files.append(parse_strong_workouts(blob))

    workouts = merge_workouts(parsed_files) if merge_duplicates else [
        wk for pf in parsed_files for wk in pf.get("workouts", [])
    ]

    return {
        "source": "STRONG",
        "schema_version": "1.0",
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "files": [
            {
                "file": pf["file"],
                "detected": pf["detected"],
                "columns": pf.get("columns", []),
                "workout_count": len(pf.get("workouts", [])),
                "unparsed_count": len(pf.get("unparsed_rows", [])),
            }
            for pf in parsed_files
        ],
        "workouts": workouts,
        "workout_count": len(workouts),
    }


if __name__ == "__main__":
    # Example usage:
    # python strong_csv_parser.py "/path/to/strong_workouts.csv" "/path/to/another.csv"
    import sys

    in_files = sys.argv[1:]
    if not in_files:
        raise SystemExit("Pass one or more STRONG workouts CSV paths.")

    out = parse_strong_csv_files(in_files, merge_duplicates=True)
    print(json.dumps(out, indent=2, ensure_ascii=False))
