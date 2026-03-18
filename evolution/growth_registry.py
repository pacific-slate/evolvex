"""Append-only growth registry helpers."""

from __future__ import annotations

import json
import os
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_REGISTRY_ROOT = REPO_ROOT / "ops" / "nightly" / "registry"
RUN_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]+$")

RECORD_FILES = {
    "frontier_signals": "frontier_signals.jsonl",
    "growth_artifacts": "growth_artifacts.jsonl",
    "claim_checks": "claim_checks.jsonl",
    "promotion_candidates": "promotion_candidates.jsonl",
}

REQUIRED_FIELDS = {
    "frontier_signals": (
        "id",
        "run_id",
        "title",
        "source_url",
        "source_class",
        "accessed_at",
        "claim",
        "why_it_matters",
        "maps_to",
        "confidence",
        "public_safety_notes",
    ),
    "growth_artifacts": (
        "id",
        "run_id",
        "name",
        "artifact_path",
        "derived_from_signal_ids",
        "artifact_type",
        "repo_gap",
        "smallest_test",
        "status",
        "owner",
    ),
    "claim_checks": (
        "id",
        "run_id",
        "claim",
        "source",
        "local_repo_mapping",
        "status",
        "notes",
    ),
    "promotion_candidates": (
        "id",
        "run_id",
        "title",
        "artifact_id",
        "why_it_matters",
        "evidence",
        "public_safe_as_is",
        "required_scrub",
        "promotion_state",
    ),
}

STATUS_FIELDS = {
    "growth_artifacts": "status",
    "claim_checks": "status",
    "promotion_candidates": "promotion_state",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def registry_root() -> Path:
    root = os.getenv("EVOLVEX_GROWTH_REGISTRY_ROOT")
    return Path(root) if root else DEFAULT_REGISTRY_ROOT


def latest_index_path() -> Path:
    return registry_root() / "latest.json"


def normalize_run_id(run_id: str) -> str:
    value = str(run_id).strip()
    if not value:
        raise ValueError("run_id is required")
    if not RUN_ID_PATTERN.fullmatch(value):
        raise ValueError("run_id must contain only letters, numbers, dot, underscore, dash, or colon")
    return value


def run_dir(run_id: str) -> Path:
    return registry_root() / normalize_run_id(run_id)


def record_path(run_id: str, family: str) -> Path:
    if family not in RECORD_FILES:
        raise ValueError(f"unknown record family: {family}")
    return run_dir(run_id) / RECORD_FILES[family]


def empty_counts() -> dict[str, int]:
    return {family: 0 for family in RECORD_FILES}


def empty_statuses() -> dict[str, dict[str, int]]:
    return {family: {} for family in STATUS_FIELDS}


def validate_record(family: str, record: dict) -> dict:
    if family not in REQUIRED_FIELDS:
        raise ValueError(f"unknown record family: {family}")
    if not isinstance(record, dict):
        raise ValueError("record must be a dict")

    normalized = dict(record)
    normalized["run_id"] = normalize_run_id(str(normalized.get("run_id", "")))

    missing: list[str] = []
    for field in REQUIRED_FIELDS[family]:
        if field not in normalized:
            missing.append(field)
            continue
        value = normalized[field]
        if isinstance(value, str) and not value.strip():
            missing.append(field)
    if missing:
        raise ValueError(f"{family} missing required fields: {', '.join(missing)}")

    normalized.setdefault("recorded_at", utc_now_iso())
    return normalized


def append_record(family: str, record: dict) -> dict:
    normalized = validate_record(family, record)
    path = record_path(normalized["run_id"], family)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(normalized, sort_keys=True))
        handle.write("\n")
    write_latest_index(normalized["run_id"])
    return normalized


def read_family(run_id: str, family: str) -> list[dict]:
    path = record_path(run_id, family)
    if not path.exists():
        return []
    rows: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        rows.append(json.loads(line))
    return rows


def read_run(run_id: str) -> dict[str, list[dict]]:
    current = run_dir(run_id)
    if not current.exists():
        raise FileNotFoundError(f"unknown growth run: {run_id}")
    return {family: read_family(run_id, family) for family in RECORD_FILES}


def summarize_run(run_id: str) -> dict:
    records = read_run(run_id)
    counts = {family: len(items) for family, items in records.items()}
    latest_statuses: dict[str, dict[str, int]] = {}
    for family, status_field in STATUS_FIELDS.items():
        counter = Counter(str(item.get(status_field, "unknown")) for item in records[family] if item.get(status_field) is not None)
        latest_statuses[family] = dict(counter)
    promotions = records["promotion_candidates"]
    top_candidate = None
    if promotions:
        top = promotions[-1]
        top_candidate = {
            "title": top.get("title"),
            "artifact_id": top.get("artifact_id"),
            "promotion_state": top.get("promotion_state"),
            "public_safe_as_is": top.get("public_safe_as_is"),
        }
    return {
        "run_id": normalize_run_id(run_id),
        "counts": counts,
        "latest_statuses": latest_statuses,
        "top_candidate": top_candidate,
    }


def read_latest_summary() -> dict:
    index_path = latest_index_path()
    if index_path.exists():
        data = json.loads(index_path.read_text(encoding="utf-8"))
        data["root"] = str(registry_root())
        return data

    root = registry_root()
    if not root.exists():
        return {
            "latest_run_id": None,
            "counts": empty_counts(),
            "latest_statuses": empty_statuses(),
            "top_candidate": None,
            "root": str(root),
        }

    run_ids = sorted(item.name for item in root.iterdir() if item.is_dir())
    if not run_ids:
        return {
            "latest_run_id": None,
            "counts": empty_counts(),
            "latest_statuses": empty_statuses(),
            "top_candidate": None,
            "root": str(root),
        }

    latest_run_id = run_ids[-1]
    write_latest_index(latest_run_id)
    data = json.loads(index_path.read_text(encoding="utf-8"))
    data["root"] = str(root)
    return data


def write_latest_index(run_id: str) -> dict:
    summary = summarize_run(run_id)
    payload = {
        "latest_run_id": summary["run_id"],
        "counts": summary["counts"],
        "latest_statuses": summary["latest_statuses"],
        "top_candidate": summary["top_candidate"],
        "updated_at": utc_now_iso(),
    }
    path = latest_index_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    return payload


def read_run_bundle(run_id: str) -> dict:
    summary = summarize_run(run_id)
    records = read_run(run_id)
    return {
        "run_id": summary["run_id"],
        "counts": summary["counts"],
        "latest_statuses": summary["latest_statuses"],
        "top_candidate": summary["top_candidate"],
        "records": records,
        "root": str(registry_root()),
    }
