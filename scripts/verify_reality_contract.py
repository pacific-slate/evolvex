#!/usr/bin/env python3
"""Verify the repo-backed reality contract and refresh registry claim checks."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from evolution.reality_contract import verify_reality_contract


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", help="Existing growth run to refresh. Defaults to the latest run.")
    parser.add_argument("--contract", help="Override the reality contract path.")
    parser.add_argument(
        "--append",
        action="store_true",
        help="Append claim checks instead of replacing the existing claim check family for the target run.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    result = verify_reality_contract(
        run_id=args.run_id,
        replace_existing=not args.append,
        contract_path=args.contract,
    )
    print(
        json.dumps(
            {
                "run_id": result["run_id"],
                "total": result["total"],
                "landed": result["landed"],
                "unsupported": result["unsupported"],
                "contract_path": result["contract_path"],
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
