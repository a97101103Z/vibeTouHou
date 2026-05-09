#!/usr/bin/env python3
"""Reset a claimed slot via /api/admin/reset-slot."""

from __future__ import annotations

import argparse
import getpass
import json
import urllib.error
import urllib.request


def _prompt_team() -> str:
    while True:
        value = input("Team (red/blue): ").strip().lower()
        if value in ("red", "blue"):
            return value
        print("Please enter 'red' or 'blue'.")


def _prompt_index() -> int:
    while True:
        raw = input("Index (1+): ").strip()
        try:
            value = int(raw)
        except ValueError:
            print("Please enter a number.")
            continue
        if value >= 1:
            return value
        print("Index must be 1 or greater.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset a claimed slot.")
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

    team = _prompt_team()
    index = _prompt_index()

    payload = json.dumps(
        {"admin_token": admin_token, "team": team, "index": index}
    ).encode("utf-8")
    url = args.url.rstrip("/") + "/api/admin/reset-slot"
    request = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request) as response:
            body = response.read().decode("utf-8").strip()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8").strip()
        print(f"Request failed ({exc.code}): {detail or exc.reason}")
        return 1
    except urllib.error.URLError as exc:
        print(f"Request failed: {exc.reason}")
        return 1

    print(f"OK: {body or '{"ok": true}'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
