"""
Gallery endpoints.

POST   /api/admin/gallery                 → add entry (JSON: admin_token, title, team, index)
DELETE /api/admin/gallery/{entry_id}      → remove entry (JSON: admin_token)
GET    /api/gallery                       → list all entries (public)
GET    /api/gallery/{id}/video   → stream the mp4 (public)
"""

from fastapi import APIRouter, Cookie, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import gallery as gallery_store
from routers import resolve_admin_token

router = APIRouter()


# ── Public ─────────────────────────────────────────────────────────────────────

@router.get("/gallery")
def list_gallery():
    """Return all curated gallery entries."""
    return {"entries": gallery_store.list_entries()}


@router.get("/gallery/{entry_id}/video")
def stream_gallery_video(entry_id: str):
    """Stream a gallery entry's video file."""
    path = gallery_store.entry_video_path(entry_id)
    if path is None:
        raise HTTPException(404, "Gallery entry not found.")
    return FileResponse(str(path), media_type="video/mp4")


# ── Admin ──────────────────────────────────────────────────────────────────────

class AddEntryBody(BaseModel):
    admin_token: str = ""
    title: str = ""
    team: str = Field(..., pattern="^(red|blue)$")
    index: int = Field(..., ge=1)


class AdminActionBody(BaseModel):
    admin_token: str = ""


@router.post("/admin/gallery")
def add_gallery_entry(body: AddEntryBody, session: str | None = Cookie(default=None)):
    """
    Admin: copy a published pattern into the gallery.

    The video must already exist on the server (i.e. the pattern was published
    during the competition). The server copies it to gallery/ — no upload needed.
    """
    effective_token = resolve_admin_token(session, body.admin_token)
    if effective_token is None:
        raise HTTPException(401, "Invalid admin token.")
    entry = gallery_store.add_entry_from_slot(
        effective_token,
        body.title,
        body.team,
        body.index,
    )
    if entry is None:
        raise HTTPException(401, "Invalid admin token.")
    if entry is False:
        raise HTTPException(
            404,
            f"No published video found for {body.team}-{body.index}. "
            "Has that slot rendered and published?",
        )
    return {"ok": True, "entry": entry}


@router.delete("/admin/gallery/{entry_id}")
def delete_gallery_entry(entry_id: str, body: AdminActionBody, session: str | None = Cookie(default=None)):
    """
    Admin: remove a gallery entry by id.
    """
    effective_token = resolve_admin_token(session, body.admin_token)
    if effective_token is None:
        raise HTTPException(401, "Invalid admin token.")
    result = gallery_store.delete_entry(effective_token, entry_id)
    if result is None:
        raise HTTPException(401, "Invalid admin token.")
    if result is False:
        raise HTTPException(404, "Gallery entry not found.")
    return {"ok": True}
