#!/usr/bin/env python3
"""Reset one or more claimed slots via /api/admin/reset-slot."""

from __future__ import annotations

import argparse
import getpass
import json
import urllib.error
import urllib.request


TEAM_SIZE = 12


def _prompt_team() -> list[str]:
    while True:
        value = input("Team (red/blue/both): ").strip().lower()
        if value == "both":
            return ["red", "blue"]
        if value in ("red", "blue"):
            return [value]
        print("Please enter 'red', 'blue', or 'both'.")


def _prompt_index() -> list[int]:
    while True:
        raw = input("Index (1+ / comma-separated / all): ").strip().lower()
        if raw == "all":
            return list(range(1, TEAM_SIZE + 1))

        parts = [p.strip() for p in raw.split(",")]
        indices: list[int] = []
        for part in parts:
            try:
                value = int(part)
            except ValueError:
                print(f"Invalid number: '{part}'")
                break
            if value < 1:
                print(f"Index must be 1 or greater, got {value}.")
                break
            indices.append(value)
        else:
            return indices


def _reset_slot(url: str, admin_token: str, team: str, index: int) -> bool:
    payload = json.dumps(
        {"admin_token": admin_token, "team": team, "index": index}
    ).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request) as response:
            body = response.read().decode("utf-8").strip()
        print(f"  {team}-{index}  OK: {body or '{"ok": true}'}")
        return True
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8").strip()
        print(f"  {team}-{index}  FAILED ({exc.code}): {detail or exc.reason}")
        return False
    except urllib.error.URLError as exc:
        print(f"  {team}-{index}  FAILED: {exc.reason}")
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset one or more claimed slots.")
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="Base server URL (default: http://localhost:8000)",
    )
    args = parser.parse_args()

    admin_token = getpass.getpass("Admin token: ").strip()
    if not admin_token:
        print("Admin token is required.")
        return 2

    teams = _prompt_team()
    indices = _prompt_index()

    url = args.url.rstrip("/") + "/api/admin/reset-slot"
    failures = 0
    for team in teams:
        for index in indices:
            if not _reset_slot(url, admin_token, team, index):
                failures += 1

    if failures:
        print(f"\n{failures} reset(s) failed.")
        return 1
    print("\nAll resets succeeded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
