"""
Identity / session management.

Each player claims a (team, index) slot, e.g. ("red", 7).
A random session token is issued and stored in a cookie.

Sessions are persisted to data/sessions.json so server restarts
(e.g. from uvicorn --reload) don't log everyone out mid-event.
"""

import json
import secrets
import threading
from pathlib import Path
from typing import Optional

from config import DATA_DIR

_SESSIONS_FILE = DATA_DIR / "sessions.json"

# ── In-memory state (loaded from disk at import time) ──────────────────────────
# "red-7"  →  session_token
_claimed: dict[str, str] = {}
# session_token  →  "red-7"
_sessions: dict[str, str] = {}
_lock = threading.Lock()


def _load() -> None:
    """Load persisted sessions from disk into memory."""
    global _claimed, _sessions
    if not _SESSIONS_FILE.exists():
        return
    try:
        data = json.loads(_SESSIONS_FILE.read_text(encoding="utf-8"))
        _claimed  = data.get("claimed", {})
        _sessions = data.get("sessions", {})
    except Exception:
        pass  # corrupted file → start fresh


def _save() -> None:
    """Persist current sessions to disk."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _SESSIONS_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps({"claimed": _claimed, "sessions": _sessions}, indent=2), encoding="utf-8")
    tmp.replace(_SESSIONS_FILE)


# Load on import (happens once when the server starts)
_load()


# ── Public API ─────────────────────────────────────────────────────────────────

def slot_key(team: str, index: int) -> str:
    return f"{team}-{index}"


def claim(team: str, index: int) -> Optional[str]:
    """
    Claim a slot. Returns the new session token, or None if the slot is taken.
    """
    with _lock:
        key = slot_key(team, index)
        if key in _claimed:
            return None
        token = secrets.token_hex(24)
        _claimed[key] = token
        _sessions[token] = key
        _save()
        return token


def get_slot(token: str) -> Optional[str]:
    """Return 'team-index' for a session token, or None if unknown."""
    with _lock:
        return _sessions.get(token)


def parse_slot(token: str) -> Optional[tuple[str, int]]:
    """Return (team, index) tuple, or None if unknown."""
    with _lock:
        key = _sessions.get(token)
    if key is None:
        return None
    team, idx = key.rsplit("-", 1)
    return team, int(idx)


def get_all_claimed() -> dict[str, list[int]]:
    """Return {"red": [1, 3, 7], "blue": [2]} of claimed slots."""
    result: dict[str, list[int]] = {"red": [], "blue": []}
    with _lock:
        keys = list(_claimed.keys())
    for key in keys:
        team, idx = key.rsplit("-", 1)
        result.setdefault(team, []).append(int(idx))
    return result


def reset(team: str, index: int) -> bool:
    """Admin: free a claimed slot. Returns True if it existed."""
    with _lock:
        key = slot_key(team, index)
        if key not in _claimed:
            return False
        token = _claimed.pop(key)
        _sessions.pop(token, None)
        _save()
        return True
