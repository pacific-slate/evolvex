"""Tests for the growth registry and read APIs."""

from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

from evolution import growth_registry


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
        run = client.get(f"/api/growth/runs/{run_id}")
        missing = client.get("/api/growth/runs/does-not-exist")

    assert latest.status_code == 200
    assert latest.json()["latest_run_id"] == run_id
    assert latest.json()["counts"]["frontier_signals"] == 1

    assert run.status_code == 200
    assert run.json()["run_id"] == run_id
    assert run.json()["records"]["promotion_candidates"][0]["title"] == "Verified Growth Registry"

    assert missing.status_code == 404
