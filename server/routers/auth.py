"""
Auth / identity endpoints.

POST /api/claim                   → claim a slot with team token, receive session cookie
POST /api/admin/reset-slot        → admin: free a claimed slot
GET  /api/me                      → check current session identity
GET  /api/phase                   → current phase state (public)
POST /api/admin/set-phase         → admin: switch to 'code' or 'gauntlet (grace period in both directions)
POST /api/admin/reset-phase       → admin: immediately reset to 'code'
POST /api/admin/skip-grace      → admin: skip the current grace period
POST /api/admin/overview          → admin: full dashboard snapshot
GET  /api/admin/slot-video/{t}/{i} → admin: stream a slot's output.mp4
"""

import time

from fastapi import APIRouter, Cookie, Request, Response, HTTPException
from pydantic import BaseModel, Field

import gallery as gallery_store
import identity
import phase
import scores
from config import DATA_DIR, TEAM_SIZE, TEAMS, ADMIN_TOKEN
from responses import media_file_response
from routers import resolve_admin_token

router = APIRouter()


class ClaimBody(BaseModel):
    token: str = Field(..., min_length=1)


class ResetBody(BaseModel):
    admin_token: str = ""
    team: str = Field(..., pattern="^(red|blue)$")
    index: int = Field(..., ge=1, le=TEAM_SIZE)


class SetPhaseBody(BaseModel):
    admin_token: str = ""
    phase: str = Field(..., pattern="^(code|gauntlet)$")
    grace_seconds: int = 60


class AdminTokenBody(BaseModel):
    admin_token: str = ""


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
        samesite="strict",
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
    """Admin: switch phase. Grace period applies in both directions."""
    effective_token = resolve_admin_token(session, body.admin_token)
    if effective_token is None:
        raise HTTPException(401, "Invalid admin token.")
    result = phase.set_phase(effective_token, body.phase, grace_seconds=body.grace_seconds)
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


@router.post("/admin/skip-grace")
def skip_grace(body: AdminTokenBody, session: str | None = Cookie(default=None)):
    """Admin: skip the current grace period, making the target phase active immediately."""
    effective_token = resolve_admin_token(session, body.admin_token)
    if effective_token is None:
        raise HTTPException(401, "Invalid admin token.")
    result = phase.skip_grace(effective_token)
    if result is None:
        raise HTTPException(401, "Invalid admin token.")
    return {"ok": True, **phase.get_phase()}


class SetTimerBody(BaseModel):
    admin_token: str = ""
    duration_seconds: int = Field(..., ge=0, le=3600)


@router.post("/admin/set-timer")
def set_timer_api(body: SetTimerBody, session: str | None = Cookie(default=None)):
    """Admin: set the reference timer (or clear if 0)."""
    effective_token = resolve_admin_token(session, body.admin_token)
    if effective_token is None:
        raise HTTPException(401, "Invalid admin token.")
    
    if body.duration_seconds > 0:
        result = phase.set_timer(effective_token, body.duration_seconds)
    else:
        result = phase.clear_timer(effective_token)
        
    if result is None:
        raise HTTPException(401, "Invalid admin token.")
    return {"ok": True, **phase.get_phase()}


# ── Admin overview ──────────────────────────────────────────────────────────────

class OverviewBody(BaseModel):
    admin_token: str = ""


@router.post("/admin/overview")
def admin_overview(body: OverviewBody, session: str | None = Cookie(default=None)):
    """
    Return a full dashboard snapshot: slots, phase, gallery, leaderboard.
    """
    if not resolve_admin_token(session, body.admin_token):
        raise HTTPException(401, "Invalid admin token.")

    now = time.time()

    slots = []
    for team in TEAMS:
        for idx in range(1, TEAM_SIZE + 1):
            key = f"{team}-{idx}"
            slot_dir = DATA_DIR / team / str(idx)

            claimed = identity.is_claimed(key)
            last_seen = identity.get_last_seen(key) if claimed else None

            assets = []
            assets_dir = slot_dir / "assets"
            if assets_dir.is_dir():
                assets = [p.name for p in sorted(assets_dir.iterdir()) if p.is_file()]

            has_output = (slot_dir / "output.mp4").is_file()
            has_published = (slot_dir / "published.mp4").is_file()

            slot_scores = scores.get_slot_scores(team, idx) if claimed else None

            slots.append({
                "slot_key": key,
                "team": team,
                "index": idx,
                "claimed": claimed,
                "last_seen": last_seen,
                "online": (last_seen is not None and (now - last_seen) < 30),
                "asset_count": len(assets),
                "assets": assets[:20],  # limit to 20 entries
                "has_output": has_output,
                "has_published": has_published,
                "scores": slot_scores,
            })

    return {
        "phase": phase.get_phase(),
        "slots": slots,
        "gallery": gallery_store.list_entries(),
        "leaderboard": scores.get_leaderboard(),
    }


# ── Admin logout ─────────────────────────────────────────────────────────────────


@router.post("/admin/logout")
def admin_logout(response: Response, session: str | None = Cookie(default=None)):
    """Clear the admin session cookie and invalidate the session server-side."""
    if not resolve_admin_token(session):
        raise HTTPException(401, "Invalid admin token.")
    identity.remove_session(session)
    response.delete_cookie(key="session")
    return {"ok": True}


# ── Admin slot video ────────────────────────────────────────────────────────────

@router.get("/admin/slot-video/{team}/{index}")
def admin_slot_video(team: str, index: int, request: Request, session: str | None = Cookie(default=None)):
    """
    Stream a slot's output.mp4 for admin preview.
    Authenticated via admin session cookie (GET has no body for token).
    """
    if not resolve_admin_token(session):
        raise HTTPException(401, "Admin authentication required.")
    if team not in TEAMS or index < 1 or index > TEAM_SIZE:
        raise HTTPException(400, "Invalid team or index.")

    path = DATA_DIR / team / str(index) / "output.mp4"
    if not path.exists():
        raise HTTPException(404, "No output video for this slot.")

    return media_file_response(request, path, "video/mp4", cache_public=False)
