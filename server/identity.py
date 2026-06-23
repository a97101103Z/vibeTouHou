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
import shutil
import threading
import time
from typing import Literal

import scores
from config import DATA_DIR, TEAM_SIZE, ADMIN_TOKEN, TEAM_TOKENS

_SESSIONS_FILE = DATA_DIR / "sessions.json"

# ── In-memory state (loaded from disk at import time) ──────────────────────────
# "red-7" → session_token
_claimed: dict[str, str] = {}
# session_token → {"slot": "red-7", "last_seen": float | None}
_sessions: dict[str, dict] = {}
_lock = threading.Lock()


def _load() -> None:
    """Load persisted sessions from disk into memory."""
    global _claimed, _sessions
    if not _SESSIONS_FILE.exists():
        return
    try:
        data = json.loads(_SESSIONS_FILE.read_text(encoding="utf-8"))
        _claimed = data.get("claimed", {})
        raw_sessions = data.get("sessions", {})
        # Migrate old string-format sessions to dict format
        _sessions = {}
        for token, val in raw_sessions.items():
            if isinstance(val, str):
                _sessions[token] = {"slot": val, "last_seen": None}
            else:
                _sessions[token] = val
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


def _get_next_index(team: str) -> int | None:
    """Find the next available index for a team (1-TEAM_SIZE). Returns None if full."""
    for i in range(1, TEAM_SIZE + 1):
        if f"{team}-{i}" not in _claimed:
            return i
    return None


def claim(team_token: str) -> tuple[str, str] | Literal["team_full"] | None:
    """
    Claim a slot using a team token.

    Returns:
        (session_token, slot_key) — on success
        "team_full" — team is at capacity
        None — token is invalid
    """
    team = TEAM_TOKENS.get(team_token)
    if team is None:
        return None

    with _lock:
        index = _get_next_index(team)
        if index is None:
            return "team_full"

        key = f"{team}-{index}"
        session_token = secrets.token_hex(24)
        _claimed[key] = session_token
        _sessions[session_token] = {"slot": key, "last_seen": None}
        _save()
        return session_token, key


def create_admin_session() -> str:
    """
    Create an admin session and return the session token.

    Admin sessions use a sentinel slot key of "admin".
    """
    session_token = secrets.token_hex(24)
    with _lock:
        _sessions[session_token] = {"slot": "admin", "last_seen": None}
        _save()
    return session_token


def get_slot(token: str) -> str | None:
    """Return 'team-index' for a session token, or None if unknown."""
    with _lock:
        info = _sessions.get(token)
        if info is None:
            return None
        return info["slot"]


def update_last_seen(token: str) -> None:
    """Record that this session was recently active."""
    with _lock:
        info = _sessions.get(token)
        if info is not None:
            info["last_seen"] = time.time()
            # Don't save to disk on every poll — in-memory is fine


def remove(admin_token: str, team: str, index: int) -> bool | None:
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
        scores.clear(team, index)
        user_dir = DATA_DIR / team / str(index)
        if user_dir.exists():
            if user_dir.is_dir():
                shutil.rmtree(user_dir)
            else:
                user_dir.unlink()
        _save()
        return True
