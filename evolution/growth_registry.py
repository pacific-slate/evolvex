"""Append-only growth registry helpers."""

from __future__ import annotations

import json
import os
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from shutil import rmtree

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


def list_run_ids() -> list[str]:
    root = registry_root()
    if not root.exists():
        return []
    return sorted(item.name for item in root.iterdir() if item.is_dir())


def _latest_recorded_at(records: dict[str, list[dict]]) -> str | None:
    timestamps = [
        str(item.get("recorded_at"))
        for family_records in records.values()
        for item in family_records
        if item.get("recorded_at")
    ]
    if not timestamps:
        return None
    return max(timestamps)


def list_run_summaries(limit: int | None = None) -> list[dict]:
    run_ids = list_run_ids()
    if limit is not None and limit > 0:
        run_ids = run_ids[-limit:]

    summaries: list[dict] = []
    for run_id in reversed(run_ids):
        records = read_run(run_id)
        summary = summarize_run(run_id)
        summaries.append(
            {
                "run_id": summary["run_id"],
                "counts": summary["counts"],
                "latest_statuses": summary["latest_statuses"],
                "top_candidate": summary["top_candidate"],
                "updated_at": _latest_recorded_at(records),
            }
        )
    return summaries


def list_promotion_candidates(limit: int | None = None) -> list[dict]:
    queue: list[dict] = []
    for run_id in reversed(list_run_ids()):
        artifacts = {
            item["id"]: item
            for item in read_family(run_id, "growth_artifacts")
            if isinstance(item, dict) and item.get("id")
        }
        candidates = read_family(run_id, "promotion_candidates")
        for candidate in reversed(candidates):
            item = dict(candidate)
            artifact = artifacts.get(str(item.get("artifact_id", "")))
            if artifact:
                item["artifact_path"] = artifact.get("artifact_path")
                item["artifact_status"] = artifact.get("status")
                item["artifact_type"] = artifact.get("artifact_type")
            queue.append(item)

    queue.sort(key=lambda item: str(item.get("recorded_at", "")), reverse=True)
    if limit is not None and limit > 0:
        return queue[:limit]
    return queue


def clear_run(run_id: str) -> None:
    path = run_dir(run_id)
    if path.exists():
        rmtree(path)
    latest = read_latest_summary()
    if latest.get("latest_run_id") == normalize_run_id(run_id):
        latest_path = latest_index_path()
        if latest_path.exists():
            latest_path.unlink()


def import_bundle(bundle: dict, *, replace_run: bool = False) -> dict:
    if not isinstance(bundle, dict):
        raise ValueError("bundle must be a dict")

    run_id = normalize_run_id(str(bundle.get("run_id", "")))
    records = bundle.get("records")
    if not isinstance(records, dict):
        raise ValueError("bundle records must be a dict keyed by record family")

    if replace_run:
        clear_run(run_id)

    imported_counts = empty_counts()
    for family in RECORD_FILES:
        family_records = records.get(family, [])
        if family_records is None:
            continue
        if not isinstance(family_records, list):
            raise ValueError(f"{family} records must be a list")
        for record in family_records:
            normalized = dict(record)
            normalized.setdefault("run_id", run_id)
            append_record(family, normalized)
            imported_counts[family] += 1

    return {
        "run_id": run_id,
        "counts": imported_counts,
        "summary": read_run_bundle(run_id),
    }


def _genesis_run_id() -> str:
    return f"genesis-{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')}"


def register_genesis_completion(
    *,
    files_created: list[str],
    final_assessment: dict | None,
    total_cost_usd: float | None,
    pricing_known: bool | None,
    workspace_root: str,
    run_id: str | None = None,
) -> dict:
    normalized_run_id = normalize_run_id(run_id or _genesis_run_id())
    artifact_id = f"{normalized_run_id}-workspace"
    safe_files = [str(path) for path in files_created if str(path).strip()]
    overall = int(final_assessment.get("overall", 0)) if isinstance(final_assessment, dict) else 0
    artifact_status = "validated" if safe_files else "empty"
    evidence = [
        f"files={len(safe_files)}",
        f"overall={overall}",
        f"cost_usd={float(total_cost_usd or 0.0):.4f}",
        "pricing_known=true" if pricing_known is not False else "pricing_known=false",
    ]

    artifact_record = append_record(
        "growth_artifacts",
        {
            "id": artifact_id,
            "run_id": normalized_run_id,
            "name": "Genesis workspace snapshot",
            "artifact_path": workspace_root,
            "derived_from_signal_ids": [],
            "artifact_type": "genesis-run",
            "repo_gap": "Genesis outputs are ephemeral unless promoted into the growth registry.",
            "smallest_test": "Complete a Genesis run and verify a durable growth record appears.",
            "status": artifact_status,
            "owner": "genesis",
        },
    )

    candidate_record = append_record(
        "promotion_candidates",
        {
            "id": f"{normalized_run_id}-promotion",
            "run_id": normalized_run_id,
            "title": "Genesis workspace snapshot",
            "artifact_id": artifact_id,
            "why_it_matters": "Captures autonomous build output as a durable review artifact.",
            "evidence": ", ".join(evidence),
            "public_safe_as_is": False,
            "required_scrub": "Review generated files before upstreaming or publication.",
            "promotion_state": "review",
        },
    )

    return {
        "run_id": normalized_run_id,
        "artifact": artifact_record,
        "promotion_candidate": candidate_record,
        "summary": read_run_bundle(normalized_run_id),
    }
