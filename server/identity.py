"""
Identity / session management.

Token-based claiming: each team has a predefined token. Users submit
a team token to be assigned the next available user number (1-TEAM_SIZE).
An admin token can remove registered users, freeing their slot.

Sessions are persisted to data/sessions.json so server restarts
(e.g. from uvicorn --reload) don't log everyone out mid-event.
"""

import json
import secrets
import threading
from pathlib import Path
from typing import Optional

from config import DATA_DIR, TEAM_SIZE, ADMIN_TOKEN, TEAM_TOKENS

_SESSIONS_FILE = DATA_DIR / "sessions.json"

# ── In-memory state (loaded from disk at import time) ──────────────────────────
# "red-7" → session_token
_claimed: dict[str, str] = {}
# session_token → "red-7"
_sessions: dict[str, str] = {}
_lock = threading.Lock()


def _load() -> None:
    """Load persisted sessions from disk into memory."""
    global _claimed, _sessions
    if not _SESSIONS_FILE.exists():
        return
    try:
        data = json.loads(_SESSIONS_FILE.read_text(encoding="utf-8"))
        _claimed = data.get("claimed", {})
        _sessions = data.get("sessions", {})
    except Exception:
        pass  # corrupted file → start fresh


def _save() -> None:
    """Persist current sessions to disk."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _SESSIONS_FILE.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps({"claimed": _claimed, "sessions": _sessions}, indent=2),
        encoding="utf-8",
    )
    tmp.replace(_SESSIONS_FILE)


# Load on import (happens once when the server starts)
_load()


# ── Public API ─────────────────────────────────────────────────────────────────


def _get_next_index(team: str) -> Optional[int]:
    """Find the next available index for a team (1-TEAM_SIZE). Returns None if full."""
    for i in range(1, TEAM_SIZE + 1):
        if f"{team}-{i}" not in _claimed:
            return i
    return None


def claim(team_token: str) -> Optional[tuple[str, str]]:
    """
    Claim a slot using a team token.

    Returns (session_token, slot_key) on success, or None if:
    - token is invalid, or
    - team is at capacity
    """
    team = TEAM_TOKENS.get(team_token)
    if team is None:
        return None

    with _lock:
        index = _get_next_index(team)
        if index is None:
            return None

        key = f"{team}-{index}"
        session_token = secrets.token_hex(24)
        _claimed[key] = session_token
        _sessions[session_token] = key
        _save()
        return session_token, key


def get_slot(token: str) -> Optional[str]:
    """Return 'team-index' for a session token, or None if unknown."""
    with _lock:
        return _sessions.get(token)


def remove(admin_token: str, team: str, index: int) -> Optional[bool]:
    """
    Admin: remove a user from a slot using the admin token.

    Returns:
      True  – user was removed successfully
      False – slot not found (valid admin token but slot is unclaimed)
      None  – invalid admin token
    """
    if admin_token != ADMIN_TOKEN:
        return None
    if team not in ("red", "blue"):
        return False

    with _lock:
        key = f"{team}-{index}"
        if key not in _claimed:
            return False

        token = _claimed.pop(key)
        _sessions.pop(token, None)
        _save()
        return True
