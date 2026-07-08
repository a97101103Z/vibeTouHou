"""
History endpoints.

GET  /api/history               → list render history for current slot
GET  /api/video/history/{id}    → stream a history video
"""

from fastapi import APIRouter, Depends, HTTPException, Request

import history
import renderer
from responses import media_file_response
from routers import require_session

router = APIRouter()


@router.get("/history")
def get_history(slot: str = Depends(require_session)):
    """Return the render history for the requesting slot, newest-first."""
    team, idx = slot.rsplit("-", 1)
    return history.get_entries(team, int(idx))


@router.get("/video/history/{entry_id}")
def get_history_video(
    entry_id: str,
    request: Request,
    slot: str = Depends(require_session),
):
    """Stream a specific history video for the requesting slot."""
    team, idx = slot.rsplit("-", 1)
    path = history.get_video_path(team, int(idx), entry_id)
    if path is None:
        raise HTTPException(404, "History video not found.")
    return media_file_response(request, path, "video/mp4", cache_public=True)
