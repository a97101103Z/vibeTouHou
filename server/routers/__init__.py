from fastapi import Cookie, HTTPException
from typing import Optional
import identity
from config import ADMIN_TOKEN

# ── Shared session dependency ──────────────────────────────────────────────────

def require_session(session: Optional[str] = Cookie(None)) -> str:
    """FastAPI dependency: returns 'team-index' or raises 401."""
    if not session:
        raise HTTPException(status_code=401, detail="Not logged in. Claim a slot first.")
    slot = identity.get_slot(session)
    if not slot:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    return slot


def verify_admin(session_token: str | None, body_admin_token: str | None = None) -> bool:
    """Check whether a request is admin-authenticated.

    Accepts either:
      - A valid admin session cookie (slot == "admin")
      - The correct admin_token in the request body
    Returns True if either method succeeds.
    """
    if body_admin_token and body_admin_token == ADMIN_TOKEN:
        return True
    if session_token:
        slot = identity.get_slot(session_token)
        if slot == "admin":
            return True
    return False


def resolve_admin_token(session_token: str | None, body_admin_token: str | None = None) -> str | None:
    """Return a valid admin token if either auth method succeeds, else None.

    Useful when the downstream library function needs the actual admin token
    (e.g. identity.remove(admin_token, ...) does an internal comparison).
    When the session cookie is valid this returns the canonical ADMIN_TOKEN.
    """
    if body_admin_token and body_admin_token == ADMIN_TOKEN:
        return body_admin_token
    if session_token:
        slot = identity.get_slot(session_token)
        if slot == "admin":
            return ADMIN_TOKEN
    return None
