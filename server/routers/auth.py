"""
Auth / identity endpoints.

POST /api/claim → claim a slot with team token, receive session cookie
POST /api/admin/reset-slot → admin: free a claimed slot
GET /api/me → check current session identity
"""

from fastapi import APIRouter, Cookie, Response, HTTPException
from pydantic import BaseModel, Field

import identity
from config import TEAM_SIZE

router = APIRouter()


class ClaimBody(BaseModel):
    token: str = Field(..., min_length=1)


class ResetBody(BaseModel):
    admin_token: str = Field(..., min_length=1)
    team: str = Field(..., pattern="^(red|blue)$")
    index: int = Field(..., ge=1, le=TEAM_SIZE)


@router.post("/claim")
def claim_slot(body: ClaimBody, response: Response):
    """Claim a slot using a team token. Returns assigned team-index."""
    result = identity.claim(body.token.strip())
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
def reset_slot(body: ResetBody):
    """Admin: remove a user from a slot. Frees the slot for new claims."""
    result = identity.remove(body.admin_token, body.team, body.index)
    if result is None:
        raise HTTPException(401, "Invalid admin token.")
    if result is False:
        raise HTTPException(404, "Slot not found.")
    return {"ok": True}


@router.get("/me")
def whoami(session: str | None = Cookie(default=None)):
    """Let the client check their current identity on page load."""
    return {"slot": identity.get_slot(session) if session else None}
