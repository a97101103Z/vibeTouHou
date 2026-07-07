"""
Score persistence.

Stored as data/scores.json.  Structure:
{
    "red":  { "1": {"best_hits": 3}, ... },
    "blue": { "1": {"best_hits": 0}, ... }
}

best_hits=null  → slot has not completed the gauntlet yet
"""

import json
import threading
from pathlib import Path

from config import DATA_DIR

_SCORES_FILE = DATA_DIR / "scores.json"
_lock = threading.Lock()


def _load() -> dict:
    if _SCORES_FILE.exists():
        return json.loads(_SCORES_FILE.read_text(encoding="utf-8"))
    return {"red": {}, "blue": {}}


def _save(data: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _SCORES_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(_SCORES_FILE)


def get_leaderboard() -> dict:
    with _lock:
        return _load()


def get_slot_scores(team: str, index: int) -> dict | None:
    with _lock:
        data = _load()
        return data.get(team, {}).get(str(index))


def submit(team: str, index: int, hits: int) -> None:
    """
    Record a run result, keeping only the best score per slot (fewer hits wins).
    """
    with _lock:
        data = _load()
        slot_id = str(index)
        current = data.setdefault(team, {}).get(slot_id, {"best_hits": None})

        if current["best_hits"] is None or hits < current["best_hits"]:
            data[team][slot_id] = {"best_hits": hits}

        _save(data)


def clear(team: str, index: int) -> None:
    """Remove a slot's scores entirely (used when resetting a slot)."""
    with _lock:
        data = _load()
        slot_id = str(index)
        data.setdefault(team, {}).pop(slot_id, None)
        _save(data)
