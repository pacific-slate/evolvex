#!/usr/bin/env python3
"""Import a structured growth bundle into the append-only registry."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from evolution.growth_registry import import_bundle


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", help="Path to a JSON bundle file")
    parser.add_argument(
        "--replace-run",
        action="store_true",
        help="Replace the target run directory before importing",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    bundle_path = Path(args.bundle).expanduser().resolve()
    payload = json.loads(bundle_path.read_text(encoding="utf-8"))
    result = import_bundle(payload, replace_run=args.replace_run)
    print(
        json.dumps(
            {
                "run_id": result["run_id"],
                "counts": result["counts"],
                "latest_run_id": result["summary"]["run_id"],
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
