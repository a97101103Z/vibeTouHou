"""
Auth / identity endpoints.

POST /api/claim               → claim a slot with team token, receive session cookie
POST /api/admin/reset-slot    → admin: free a claimed slot
GET  /api/me                  → check current session identity
GET  /api/phase               → current phase state (public)
POST /api/admin/set-phase     → admin: switch to 'code' or 'gauntlet' (60s grace)
POST /api/admin/reset-phase   → admin: immediately reset to 'code'
"""

from fastapi import APIRouter, Cookie, Response, HTTPException
from pydantic import BaseModel, Field

import identity
import phase
from config import TEAM_SIZE, ADMIN_TOKEN
from routers import resolve_admin_token

router = APIRouter()


class ClaimBody(BaseModel):
    token: str = Field(..., min_length=1)


class ResetBody(BaseModel):
    admin_token: str = Field(..., min_length=1)
    team: str = Field(..., pattern="^(red|blue)$")
    index: int = Field(..., ge=1, le=TEAM_SIZE)


class SetPhaseBody(BaseModel):
    admin_token: str = Field(..., min_length=1)
    phase: str = Field(..., pattern="^(code|gauntlet)$")


class AdminTokenBody(BaseModel):
    admin_token: str = Field(..., min_length=1)


@router.post("/claim")
def claim_slot(body: ClaimBody, response: Response):
    """Claim a slot using a team token. Returns assigned team-index.
    If the admin token is entered, creates an admin session instead."""
    token = body.token.strip()

    # Check for admin token first
    if token == ADMIN_TOKEN:
        session_token = identity.create_admin_session()
        response.set_cookie(
            key="session",
            value=session_token,
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 12,
        )
        return {"ok": True, "admin": True, "redirect": "/admin.html"}

    # Fall through to regular team token claim
    result = identity.claim(token)
    if result is None:
        raise HTTPException(401, "Invalid token.")
    if result == "team_full":
        raise HTTPException(409, "No slots remaining for this team.")

    session_token, slot_key = result

    response.set_cookie(
        key="session",
        value=session_token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 12,  # 12-hour cookie
    )
    return {"ok": True, "slot": slot_key}


@router.post("/admin/reset-slot")
def reset_slot(body: ResetBody, session: str | None = Cookie(default=None)):
    """Admin: remove a user from a slot. Frees the slot for new claims."""
    effective_token = resolve_admin_token(session, body.admin_token)
    if effective_token is None:
        raise HTTPException(401, "Invalid admin token.")
    result = identity.remove(effective_token, body.team, body.index)
    if result is False:
        raise HTTPException(404, "Slot not found.")
    return {"ok": True}


@router.get("/me")
def whoami(session: str | None = Cookie(default=None)):
    """Let the client check their current identity on page load."""
    return {"slot": identity.get_slot(session) if session else None}


# ── Phase endpoints ────────────────────────────────────────────────────────────

@router.get("/phase")
def get_phase():
    """Public: return current phase and when the lock becomes active."""
    return phase.get_phase()


@router.post("/admin/set-phase")
def set_phase(body: SetPhaseBody, session: str | None = Cookie(default=None)):
    """Admin: switch phase. Switching to 'gauntlet' starts a 60-second grace period."""
    effective_token = resolve_admin_token(session, body.admin_token)
    if effective_token is None:
        raise HTTPException(401, "Invalid admin token.")
    result = phase.set_phase(effective_token, body.phase)
    if result is None:
        raise HTTPException(401, "Invalid admin token.")
    return {"ok": True, **phase.get_phase()}


@router.post("/admin/reset-phase")
def reset_phase(body: AdminTokenBody, session: str | None = Cookie(default=None)):
    """Admin: immediately reset phase back to 'code'."""
    effective_token = resolve_admin_token(session, body.admin_token)
    if effective_token is None:
        raise HTTPException(401, "Invalid admin token.")
    result = phase.reset_phase(effective_token)
    if result is None:
        raise HTTPException(401, "Invalid admin token.")
    return {"ok": True, **phase.get_phase()}
