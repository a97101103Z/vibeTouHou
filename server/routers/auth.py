"""
Auth / identity endpoints.

GET  /api/slots          → list of claimed slots (public)
POST /api/claim          → claim a slot, receive session cookie
POST /admin/reset-slot   → host-only: free a claimed slot
"""

from fastapi import APIRouter, Cookie, Response, HTTPException
from pydantic import BaseModel, Field

import identity
from config import TEAMS, TEAM_SIZE

router = APIRouter()


class ClaimBody(BaseModel):
    team:  str = Field(..., pattern="^(red|blue)$")
    index: int = Field(..., ge=1, le=12)


class ResetBody(BaseModel):
    team:  str = Field(..., pattern="^(red|blue)$")
    index: int = Field(..., ge=1, le=12)


@router.get("/slots")
def get_slots():
    """Return which slots are already claimed so the login screen can grey them out."""
    return identity.get_all_claimed()


@router.post("/claim")
def claim_slot(body: ClaimBody, response: Response):
    if body.index < 1 or body.index > TEAM_SIZE:
        raise HTTPException(400, f"Index must be 1–{TEAM_SIZE}.")

    token = identity.claim(body.team, body.index)
    if token is None:
        raise HTTPException(409, f"Slot {body.team}-{body.index} is already taken.")

    response.set_cookie(
        key="session",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 12,  # 12-hour cookie
    )
    return {"ok": True, "slot": f"{body.team}-{body.index}"}


@router.post("/admin/reset-slot")
def reset_slot(body: ResetBody):
    ok = identity.reset(body.team, body.index)
    if not ok:
        raise HTTPException(404, "Slot was not claimed.")
    return {"ok": True}


@router.get("/me")
def whoami(session: str | None = Cookie(default=None)):
    """Let the client check their current identity on page load."""
    return {"slot": identity.get_slot(session) if session else None}
