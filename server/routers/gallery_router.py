"""
Gallery endpoints.

POST   /api/admin/gallery        → add entry (JSON: admin_token, title, avg_hits, team, index)
DELETE /api/admin/gallery        → remove entry (JSON: admin_token, id)
GET    /api/gallery              → list all entries (public)
GET    /api/gallery/{id}/video   → stream the mp4 (public)
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import gallery as gallery_store

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
    admin_token: str
    title: str = ""
    avg_hits: float
    team: str = Field(..., pattern="^(red|blue)$")
    index: int = Field(..., ge=1)


class DeleteEntryBody(BaseModel):
    admin_token: str
    id: str


@router.post("/admin/gallery")
def add_gallery_entry(body: AddEntryBody):
    """
    Admin: copy a published pattern into the gallery.

    The video must already exist on the server (i.e. the pattern was published
    during the competition). The server copies it to gallery/ — no upload needed.

    curl.exe -X POST http://localhost:8000/api/admin/gallery ^
      -H "Content-Type: application/json" ^
      -d "{\\"admin_token\\":\\"ADMIN-TOKEN-DEV-K2M8N3PQ\\",\\"title\\":\\"RED-3\\",\\"avg_hits\\":2.4,\\"team\\":\\"red\\",\\"index\\":3}"
    """
    entry = gallery_store.add_entry_from_slot(
        body.admin_token,
        body.title,
        body.avg_hits,
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


@router.delete("/admin/gallery")
def delete_gallery_entry(body: DeleteEntryBody):
    """
    Admin: remove a gallery entry by id.

    curl.exe -X DELETE http://localhost:8000/api/admin/gallery ^
      -H "Content-Type: application/json" ^
      -d "{\\"admin_token\\":\\"ADMIN-TOKEN-DEV-K2M8N3PQ\\",\\"id\\":\\"abc123\\"}"
    """
    result = gallery_store.delete_entry(body.admin_token, body.id)
    if result is None:
        raise HTTPException(401, "Invalid admin token.")
    if result is False:
        raise HTTPException(404, "Gallery entry not found.")
    return {"ok": True}
