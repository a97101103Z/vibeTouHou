"""
Score persistence.

Stored as data/scores.json.  Structure:
{
    "red": {
        "1": {
            "scores": {
                "1": {"best_hits": 1},
                "2": {"best_hits": 0}
            }
        }
    },
    "blue": { ... }
}

- scores: opponent pattern index -> {"best_hits": int | None}
  null means not yet attempted.  best_hits is the fewest hits achieved.
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
    """Return raw per-team scores dict."""
    with _lock:
        return _load()


def get_slot_scores(team: str, index: int) -> dict | None:
    """Return the slot's full scores dict, or None if not found."""
    with _lock:
        data = _load()
        return data.get(team, {}).get(str(index))


def submit_pattern(team: str, index: int, pattern_index: int, hits: int) -> dict:
    """Record a single pattern result.  Updates best_hits for the pattern.

    Returns the updated slot dict.
    """
    with _lock:
        data = _load()
        slot_id = str(index)
        slot = data.setdefault(team, {}).get(slot_id)
        if slot is None:
            slot = {"scores": {}}
            data[team][slot_id] = slot
        slot.setdefault("scores", {})

        scores = slot["scores"]
        pidx = str(pattern_index)
        current_best = scores.get(pidx, {}).get("best_hits")
        if current_best is None or hits < current_best:
            scores[pidx] = {"best_hits": hits}

        _save(data)
        return dict(slot)


def clear(team: str, index: int) -> None:
    """Remove a slot's scores entirely (used when resetting a slot)."""
    with _lock:
        data = _load()
        slot_id = str(index)
        data.setdefault(team, {}).pop(slot_id, None)
        _save(data)
