"""
Phase management — controls whether players are in coding or gauntlet mode.

Phase: "code" (default) | "gauntlet"

Grace periods apply on transitions in both directions:
  - code → gauntlet:  locks are enforced after the grace window
  - gauntlet → code:  locks remain enforced until the grace window passes
The active_at timestamp tells clients when the transition completes.

Public API:
    get_phase()           → {"phase": str, "active_at": float | None, "timer_at": float | None}
    set_phase(...)        → True on success, None on bad token
    reset_phase(...)      → True on success, None on bad token
    skip_grace(...)       → True on success, None on bad token
    set_timer(...)        → True on success, None on bad token
    clear_timer(...)      → True on success, None on bad token
    is_locked()           → True when coding/publishing should be blocked
"""

import json
import threading
import time
from pathlib import Path

from config import DATA_DIR, ADMIN_TOKEN

_PHASE_FILE = DATA_DIR / "phase.json"
_lock = threading.Lock()

# In-memory cache (populated from disk on first access)
_state: dict = None  # {"phase": str, "active_at": float | None, "timer_at": float | None}


def _default_state() -> dict:
    return {"phase": "code", "active_at": None, "timer_at": None}


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
            if "timer_at" not in _state:
                _state["timer_at"] = None
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
    A grace period is applied in both directions so that clients have time to
    react before the lock/unlock takes effect.
    """
    if admin_token != ADMIN_TOKEN:
        return None

    with _lock:
        state = dict(_load())
        state["phase"] = phase
        state["active_at"] = (time.time() + grace_seconds) if grace_seconds > 0 else None
        _save(state)

    return True


def reset_phase(admin_token: str) -> bool | None:
    """Convenience: reset back to code phase instantly."""
    return set_phase(admin_token, "code", grace_seconds=0)


def skip_grace(admin_token: str) -> bool | None:
    """
    Bypass any active grace period immediately.
    For code → gauntlet: locks now.
    For gauntlet → code: unlocks now.
    Returns None on bad token, True on success.
    """
    if admin_token != ADMIN_TOKEN:
        return None

    with _lock:
        state = dict(_load())
        state["active_at"] = None
        _save(state)

    return True


def set_timer(admin_token: str, duration_seconds: int) -> bool | None:
    """Set a reference timer that ends in duration_seconds."""
    if admin_token != ADMIN_TOKEN:
        return None

    with _lock:
        state = dict(_load())
        state["timer_at"] = time.time() + duration_seconds
        _save(state)

    return True


def clear_timer(admin_token: str) -> bool | None:
    """Clear the reference timer."""
    if admin_token != ADMIN_TOKEN:
        return None

    with _lock:
        state = dict(_load())
        state["timer_at"] = None
        _save(state)

    return True


def is_locked() -> bool:
    """
    True when coding/publishing should be blocked.

    code → gauntlet: locked once active_at passes (gauntlet grace expired).
    gauntlet → code: locked while active_at is still in the future (code
    grace has not yet finished).  Once the grace passes, locks release.
    """
    state = _load()
    active_at = state.get("active_at")
    if state["phase"] == "gauntlet":
        return active_at is None or time.time() >= active_at
    else:  # code
        return active_at is not None and time.time() < active_at
