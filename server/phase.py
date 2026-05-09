"""
Phase management — controls whether players are in coding or gauntlet mode.

Phase: "code" (default) | "gauntlet"

When switching to gauntlet, a grace period (default 60s) is applied before
locks are enforced. The active_at timestamp tells clients when the lock kicks in.

Public API:
    get_phase()           → {"phase": str, "active_at": float | None}
    set_phase(...)        → True on success, None on bad token
    reset_phase(...)      → True on success, None on bad token
    is_locked()           → True if gauntlet is active AND grace period has passed
"""

import json
import threading
import time
from pathlib import Path

from config import DATA_DIR, ADMIN_TOKEN

_PHASE_FILE = DATA_DIR / "phase.json"
_lock = threading.Lock()

# In-memory cache (populated from disk on first access)
_state: dict = None  # {"phase": str, "active_at": float | None}


def _default_state() -> dict:
    return {"phase": "code", "active_at": None}


def _load() -> dict:
    global _state
    if _state is not None:
        return _state
    with _lock:
        # Double-checked inside lock
        if _state is not None:
            return _state
        try:
            _state = json.loads(_PHASE_FILE.read_text())
        except (FileNotFoundError, json.JSONDecodeError, KeyError):
            _state = _default_state()
    return _state


def _save(state: dict) -> None:
    global _state
    _state = state
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _PHASE_FILE.write_text(json.dumps(state))


def get_phase() -> dict:
    """Return current phase state: {"phase": str, "active_at": float | None}"""
    return dict(_load())


def set_phase(admin_token: str, phase: str, grace_seconds: int = 60) -> bool | None:
    """
    Switch to the given phase.
    Returns None on bad token, True on success.
    When switching to 'gauntlet', active_at is set to now + grace_seconds.
    When switching to 'code', active_at is cleared immediately.
    """
    if admin_token != ADMIN_TOKEN:
        return None

    with _lock:
        state = dict(_load())
        if phase == "gauntlet":
            state["phase"] = "gauntlet"
            state["active_at"] = time.time() + grace_seconds
        else:
            state["phase"] = "code"
            state["active_at"] = None
        _save(state)

    return True


def reset_phase(admin_token: str) -> bool | None:
    """Convenience: reset back to code phase instantly."""
    return set_phase(admin_token, "code", grace_seconds=0)


def is_locked() -> bool:
    """
    True when the gauntlet phase is fully active (grace period has expired).
    During the grace period this returns False so renders/publishes still work.
    """
    state = _load()
    if state["phase"] != "gauntlet":
        return False
    active_at = state.get("active_at")
    if active_at is None:
        return True  # no grace period set, locked immediately
    return time.time() >= active_at
