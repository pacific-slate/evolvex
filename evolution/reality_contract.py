"""Repo-backed reality contract verification helpers."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from evolution import growth_registry

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONTRACT_PATH = REPO_ROOT / "ops" / "nightly" / "contracts" / "reality_contract.json"
ROUTE_PATTERN = re.compile(r'@app\.(get|post|put|patch|delete)\("([^"]+)"')


def _utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def _resolve_repo_root(repo_root: str | Path | None) -> Path:
    return Path(repo_root) if repo_root else REPO_ROOT


def _resolve_path(repo_root: Path, raw_path: str | Path) -> Path:
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate
    return repo_root / candidate


def load_contract(*, contract_path: str | Path | None = None, repo_root: str | Path | None = None) -> dict:
    root = _resolve_repo_root(repo_root)
    path = _resolve_path(root, contract_path or DEFAULT_CONTRACT_PATH)
    payload = json.loads(path.read_text(encoding="utf-8"))
    claims = payload.get("claims")
    if not isinstance(claims, list) or not claims:
        raise ValueError("reality contract must define a non-empty claims list")
    payload["path"] = str(path)
    return payload


def collect_api_routes(*, repo_root: str | Path | None = None, api_path: str | Path = "api.py") -> set[tuple[str, str]]:
    root = _resolve_repo_root(repo_root)
    source = _resolve_path(root, api_path).read_text(encoding="utf-8")
    return {(match.group(1).upper(), match.group(2)) for match in ROUTE_PATTERN.finditer(source)}


def _coerce_patterns(spec: dict) -> list[str]:
    patterns = spec.get("patterns")
    if isinstance(patterns, list):
        values = [str(item) for item in patterns if str(item).strip()]
    else:
        values = [str(spec.get("pattern", "")).strip()]
    values = [item for item in values if item]
    if not values:
        raise ValueError("text_contains checks require pattern or patterns")
    return values


def _claim_notes(claim: dict, *, passed: bool, detail: str) -> str:
    preferred = claim.get("notes_if_pass" if passed else "notes_if_fail")
    if isinstance(preferred, str) and preferred.strip():
        return preferred.strip()
    notes = claim.get("notes")
    if isinstance(notes, str) and notes.strip():
        return notes.strip()
    return detail


def evaluate_claim(
    claim: dict,
    *,
    repo_root: str | Path | None = None,
    api_routes: set[tuple[str, str]] | None = None,
) -> dict:
    if not isinstance(claim, dict):
        raise ValueError("claim entries must be objects")

    root = _resolve_repo_root(repo_root)
    check = claim.get("check")
    if not isinstance(check, dict):
        raise ValueError("each claim requires a check object")

    claim_id = str(claim.get("id", "")).strip()
    claim_text = str(claim.get("claim", "")).strip()
    source = str(claim.get("source", DEFAULT_CONTRACT_PATH.relative_to(REPO_ROOT))).strip()
    local_repo_mapping = str(claim.get("local_repo_mapping", "")).strip()
    if not claim_id or not claim_text or not source:
        raise ValueError("each claim requires id, claim, and source")

    check_type = str(check.get("type", "")).strip()
    passed = False
    detail = "claim check did not run"

    if check_type == "fastapi_route":
        routes = api_routes if api_routes is not None else collect_api_routes(repo_root=root)
        method = str(check.get("method", "GET")).upper()
        path = str(check.get("path", "")).strip()
        if not path:
            raise ValueError("fastapi_route checks require a path")
        passed = (method, path) in routes
        detail = f"verified {method} {path}" if passed else f"missing {method} {path}"
        local_repo_mapping = local_repo_mapping or "api.py"
    elif check_type == "text_contains":
        target = _resolve_path(root, str(check.get("path", "")).strip())
        patterns = _coerce_patterns(check)
        if not target.exists():
            detail = f"missing file {target.relative_to(root)}"
        else:
            contents = target.read_text(encoding="utf-8")
            missing = [pattern for pattern in patterns if pattern not in contents]
            passed = not missing
            detail = (
                f"verified {target.relative_to(root)}"
                if passed
                else f"missing text in {target.relative_to(root)}: {', '.join(missing)}"
            )
        local_repo_mapping = local_repo_mapping or str(target.relative_to(root))
    elif check_type == "path_exists":
        target = _resolve_path(root, str(check.get("path", "")).strip())
        passed = target.exists()
        detail = f"verified path {target.relative_to(root)}" if passed else f"missing path {target.relative_to(root)}"
        local_repo_mapping = local_repo_mapping or str(target.relative_to(root))
    else:
        raise ValueError(f"unsupported reality contract check type: {check_type}")

    return {
        "id": claim_id,
        "claim": claim_text,
        "source": source,
        "local_repo_mapping": local_repo_mapping or "repo",
        "status": "landed" if passed else "unsupported",
        "notes": _claim_notes(claim, passed=passed, detail=detail),
    }


def verify_reality_contract(
    *,
    run_id: str | None = None,
    replace_existing: bool = True,
    contract_path: str | Path | None = None,
    repo_root: str | Path | None = None,
) -> dict:
    root = _resolve_repo_root(repo_root)
    contract = load_contract(contract_path=contract_path, repo_root=root)
    routes = collect_api_routes(repo_root=root)

    latest_run_id = growth_registry.read_latest_summary().get("latest_run_id")
    target_run_id = growth_registry.normalize_run_id(run_id or latest_run_id or f"reality-contract-{_utc_stamp()}")

    records = []
    for claim in contract["claims"]:
        record = evaluate_claim(claim, repo_root=root, api_routes=routes)
        record["run_id"] = target_run_id
        records.append(record)

    if replace_existing:
        growth_registry.replace_family(target_run_id, "claim_checks", records)
    else:
        for record in records:
            growth_registry.append_record("claim_checks", record)

    summary = growth_registry.read_run_bundle(target_run_id)
    statuses = summary["latest_statuses"].get("claim_checks", {})
    return {
        "run_id": target_run_id,
        "total": len(records),
        "landed": int(statuses.get("landed", 0)),
        "unsupported": int(statuses.get("unsupported", 0)),
        "contract_path": contract["path"],
        "records": summary["records"]["claim_checks"],
        "summary": summary,
    }
