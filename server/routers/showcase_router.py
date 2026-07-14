"""
Showcase endpoints.

GET    /api/showcase                  → sections with entries (public)
GET    /api/showcase/{id}/video       → stream mp4 (public)
POST   /api/admin/showcase            → replace sections layout (admin)
"""

from fastapi import APIRouter, Cookie, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import showcase as showcase_store
from routers import resolve_admin_token

router = APIRouter()


# ── Public ─────────────────────────────────────────────────────────────────────

@router.get("/showcase")
def list_showcase():
    """Return the full showcase sections structure."""
    return showcase_store.list_sections()


@router.get("/showcase/{entry_id}/video")
def stream_showcase_video(entry_id: str):
    """Stream a showcase entry's video file."""
    path = showcase_store.video_path(entry_id)
    if path is None:
        raise HTTPException(404, "Showcase entry not found.")
    return FileResponse(str(path), media_type="video/mp4",
                        headers={"Cache-Control": "public, max-age=2592000"})


# ── Admin ──────────────────────────────────────────────────────────────────────

class SetSectionsBody(BaseModel):
    admin_token: str = ""
    sections: list = []


@router.post("/admin/showcase")
def set_showcase_sections(body: SetSectionsBody, session: str | None = Cookie(default=None)):
    """
    Admin: replace the entire showcase layout.

    Body should contain:
      - admin_token: admin authentication token
      - sections: list of section objects, each with "name" and "entries" keys
    """
    effective_token = resolve_admin_token(session, body.admin_token)
    if effective_token is None:
        raise HTTPException(401, "Invalid admin token.")

    data = {"sections": body.sections}
    ok = showcase_store.set_sections(effective_token, data)
    if not ok:
        raise HTTPException(400, "Failed to save showcase sections.")
    return {"ok": True}
