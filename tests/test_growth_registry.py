"""Tests for the growth registry and read APIs."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient
import pytest

from evolution import growth_registry
from evolution import reality_contract


def _frontier_signal(run_id: str) -> dict:
    return {
        "id": "signal-1",
        "run_id": run_id,
        "title": "Agent skills become portable infrastructure",
        "source_url": "https://github.com/agentskills/agentskills",
        "source_class": "GitHub",
        "accessed_at": "2026-03-18",
        "claim": "skills packaging is becoming a first-class agent primitive",
        "why_it_matters": "supports reusable capability promotion",
        "maps_to": "architecture",
        "confidence": "high",
        "public_safety_notes": "public source",
    }


def _growth_artifact(run_id: str) -> dict:
    return {
        "id": "artifact-1",
        "run_id": run_id,
        "name": "Verified Growth Registry",
        "artifact_path": "ops/nightly/artifacts/2026-03-18_PRIMARY_BUILD_PLAN.md",
        "derived_from_signal_ids": ["signal-1"],
        "artifact_type": "implementation-plan",
        "repo_gap": "no shipped growth schema exists",
        "smallest_test": "append JSONL record and expose read API",
        "status": "planned",
        "owner": "post-submission-dev",
    }


def _claim_check(run_id: str) -> dict:
    return {
        "id": "claim-1",
        "run_id": run_id,
        "claim": "housekeeping endpoints are shipped on current main",
        "source": "README.md",
        "local_repo_mapping": "api.py",
        "status": "unsupported",
        "notes": "README drifted ahead of code",
    }


def _promotion_candidate(run_id: str) -> dict:
    return {
        "id": "promotion-1",
        "run_id": run_id,
        "title": "Verified Growth Registry",
        "artifact_id": "artifact-1",
        "why_it_matters": "turns nightly research into durable records",
        "evidence": "multiple frontier sources converge on structured skills and tracing",
        "public_safe_as_is": False,
        "required_scrub": "remove private paths",
        "promotion_state": "candidate",
    }


def _bundle(run_id: str) -> dict:
    return {
        "run_id": run_id,
        "records": {
            "frontier_signals": [_frontier_signal(run_id)],
            "growth_artifacts": [_growth_artifact(run_id)],
            "claim_checks": [_claim_check(run_id)],
            "promotion_candidates": [_promotion_candidate(run_id)],
        },
    }


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_append_record_creates_jsonl_and_latest_index(monkeypatch, tmp_path):
    monkeypatch.setenv("EVOLVEX_GROWTH_REGISTRY_ROOT", str(tmp_path))
    run_id = "2026-03-18-run"

    growth_registry.append_record("frontier_signals", _frontier_signal(run_id))
    growth_registry.append_record("growth_artifacts", _growth_artifact(run_id))
    growth_registry.append_record("claim_checks", _claim_check(run_id))
    growth_registry.append_record("promotion_candidates", _promotion_candidate(run_id))

    summary = growth_registry.read_latest_summary()

    assert summary["latest_run_id"] == run_id
    assert summary["counts"] == {
        "frontier_signals": 1,
        "growth_artifacts": 1,
        "claim_checks": 1,
        "promotion_candidates": 1,
    }
    assert summary["latest_statuses"]["claim_checks"] == {"unsupported": 1}
    assert summary["top_candidate"]["title"] == "Verified Growth Registry"
    assert (tmp_path / run_id / "frontier_signals.jsonl").exists()
    assert (tmp_path / "latest.json").exists()


def test_append_record_rejects_missing_required_fields(monkeypatch, tmp_path):
    monkeypatch.setenv("EVOLVEX_GROWTH_REGISTRY_ROOT", str(tmp_path))

    with pytest.raises(ValueError, match="missing required fields"):
        growth_registry.append_record(
            "growth_artifacts",
            {
                "id": "artifact-1",
                "run_id": "2026-03-18-run",
            },
        )


def test_read_latest_summary_handles_empty_registry(monkeypatch, tmp_path):
    monkeypatch.setenv("EVOLVEX_GROWTH_REGISTRY_ROOT", str(tmp_path))

    summary = growth_registry.read_latest_summary()

    assert summary["latest_run_id"] is None
    assert summary["counts"] == {
        "frontier_signals": 0,
        "growth_artifacts": 0,
        "claim_checks": 0,
        "promotion_candidates": 0,
    }
    assert summary["top_candidate"] is None


def test_import_bundle_and_list_views(monkeypatch, tmp_path):
    monkeypatch.setenv("EVOLVEX_GROWTH_REGISTRY_ROOT", str(tmp_path))

    growth_registry.import_bundle(_bundle("2026-03-18-run-a"))
    growth_registry.import_bundle(
        {
            "run_id": "2026-03-18-run-b",
            "records": {
                "frontier_signals": [{**_frontier_signal("2026-03-18-run-b"), "id": "signal-2"}],
                "growth_artifacts": [{**_growth_artifact("2026-03-18-run-b"), "id": "artifact-2"}],
                "claim_checks": [{**_claim_check("2026-03-18-run-b"), "id": "claim-2"}],
                "promotion_candidates": [
                    {
                        **_promotion_candidate("2026-03-18-run-b"),
                        "id": "promotion-2",
                        "artifact_id": "artifact-2",
                        "title": "Growth HUD and Promotion Queue",
                    }
                ],
            },
        }
    )

    runs = growth_registry.list_run_summaries()
    queue = growth_registry.list_promotion_candidates()

    assert [run["run_id"] for run in runs] == ["2026-03-18-run-b", "2026-03-18-run-a"]
    assert queue[0]["run_id"] == "2026-03-18-run-b"
    assert queue[0]["artifact_path"] == "ops/nightly/artifacts/2026-03-18_PRIMARY_BUILD_PLAN.md"


def test_register_genesis_completion_creates_review_candidate(monkeypatch, tmp_path):
    monkeypatch.setenv("EVOLVEX_GROWTH_REGISTRY_ROOT", str(tmp_path))

    result = growth_registry.register_genesis_completion(
        files_created=["BUILD_LOG.md", "src/agent.py"],
        final_assessment={"overall": 82},
        total_cost_usd=1.2345,
        pricing_known=True,
        workspace_root="/tmp/evolvex-workspace",
        run_id="genesis-validated-run",
    )

    summary = growth_registry.read_run_bundle("genesis-validated-run")

    assert result["run_id"] == "genesis-validated-run"
    assert summary["counts"]["growth_artifacts"] == 1
    assert summary["counts"]["promotion_candidates"] == 1
    assert summary["records"]["promotion_candidates"][0]["promotion_state"] == "review"
    assert summary["records"]["growth_artifacts"][0]["artifact_path"] == "/tmp/evolvex-workspace"


def test_replace_family_rewrites_existing_claim_checks(monkeypatch, tmp_path):
    monkeypatch.setenv("EVOLVEX_GROWTH_REGISTRY_ROOT", str(tmp_path))
    run_id = "2026-03-18-run"

    growth_registry.import_bundle(_bundle(run_id))
    replaced = growth_registry.replace_family(
        run_id,
        "claim_checks",
        [
            {
                "id": "claim-replaced",
                "run_id": run_id,
                "claim": "growth latest route is shipped",
                "source": "README.md",
                "local_repo_mapping": "api.py",
                "status": "landed",
                "notes": "verified route",
            }
        ],
    )

    bundle = growth_registry.read_run_bundle(run_id)

    assert len(replaced) == 1
    assert bundle["counts"]["claim_checks"] == 1
    assert bundle["records"]["claim_checks"][0]["id"] == "claim-replaced"
    assert bundle["records"]["promotion_candidates"][0]["id"] == "promotion-1"


def test_verify_reality_contract_replaces_claim_family_on_existing_run(monkeypatch, tmp_path):
    registry_root = tmp_path / "registry"
    repo_root = tmp_path / "repo"
    contract_path = repo_root / "ops" / "nightly" / "contracts" / "reality_contract.json"

    monkeypatch.setenv("EVOLVEX_GROWTH_REGISTRY_ROOT", str(registry_root))

    growth_registry.import_bundle(_bundle("validated-run"))

    _write(
        repo_root / "api.py",
        '\n'.join(
            [
                '@app.get("/api/growth/latest")',
                "async def latest():",
                "    return {}",
                '@app.post("/api/growth/reality-contract/verify")',
                "async def verify():",
                "    return {}",
                "",
            ]
        ),
    )
    _write(repo_root / "dashboard" / "components" / "workbench-shell.tsx", "Claim Status\nPromotion Queue\n")
    _write(repo_root / "README.md", "# test\n")

    contract_path.parent.mkdir(parents=True, exist_ok=True)
    contract_path.write_text(
        json.dumps(
            {
                "claims": [
                    {
                        "id": "claim-route",
                        "claim": "growth latest route exists",
                        "source": "README.md",
                        "check": {"type": "fastapi_route", "method": "GET", "path": "/api/growth/latest"},
                    },
                    {
                        "id": "claim-console",
                        "claim": "console exposes claim status",
                        "source": "dashboard/components/workbench-shell.tsx",
                        "check": {
                            "type": "text_contains",
                            "path": "dashboard/components/workbench-shell.tsx",
                            "patterns": ["Claim Status", "Promotion Queue"],
                        },
                    },
                    {
                        "id": "claim-missing",
                        "claim": "promotion action exists",
                        "source": "dashboard/components/workbench-shell.tsx",
                        "check": {
                            "type": "text_contains",
                            "path": "dashboard/components/workbench-shell.tsx",
                            "pattern": "Promote Candidate",
                        },
                    },
                ]
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    result = reality_contract.verify_reality_contract(
        run_id="validated-run",
        contract_path=contract_path,
        repo_root=repo_root,
    )

    bundle = growth_registry.read_run_bundle("validated-run")

    assert result["run_id"] == "validated-run"
    assert result["landed"] == 2
    assert result["unsupported"] == 1
    assert bundle["counts"]["claim_checks"] == 3
    assert {item["id"] for item in bundle["records"]["claim_checks"]} == {
        "claim-route",
        "claim-console",
        "claim-missing",
    }


def test_growth_api_returns_latest_summary_and_run_records(monkeypatch, tmp_path):
    monkeypatch.setenv("EVOLVEX_GROWTH_REGISTRY_ROOT", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-5.4")

    run_id = "2026-03-18-run"
    growth_registry.append_record("frontier_signals", _frontier_signal(run_id))
    growth_registry.append_record("growth_artifacts", _growth_artifact(run_id))
    growth_registry.append_record("claim_checks", _claim_check(run_id))
    growth_registry.append_record("promotion_candidates", _promotion_candidate(run_id))

    from api import app

    with TestClient(app) as client:
        latest = client.get("/api/growth/latest")
        runs = client.get("/api/growth/runs")
        run = client.get(f"/api/growth/runs/{run_id}")
        queue = client.get("/api/growth/promotion-queue")
        missing = client.get("/api/growth/runs/does-not-exist")

    assert latest.status_code == 200
    assert latest.json()["latest_run_id"] == run_id
    assert latest.json()["counts"]["frontier_signals"] == 1

    assert runs.status_code == 200
    assert runs.json()["runs"][0]["run_id"] == run_id

    assert run.status_code == 200
    assert run.json()["run_id"] == run_id
    assert run.json()["records"]["promotion_candidates"][0]["title"] == "Verified Growth Registry"

    assert queue.status_code == 200
    assert queue.json()["total"] == 1
    assert queue.json()["candidates"][0]["title"] == "Verified Growth Registry"

    verify = client.post(
        "/api/growth/reality-contract/verify",
        json={"run_id": run_id, "replace_existing_claims": True},
    )
    assert verify.status_code == 200
    assert verify.json()["run_id"] == run_id
    assert verify.json()["total"] >= 1

    assert missing.status_code == 404
