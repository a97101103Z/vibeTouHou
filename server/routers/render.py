"""
Script submission and render-status endpoints.

POST /api/render              → submit script, start render job
GET  /api/render/status       → poll render job status
GET  /api/video/my            → stream user's own draft output.mp4
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

import renderer
import phase
from config import API_PREFIX
from responses import media_file_response, version_for
from routers import require_session

router = APIRouter()


class RenderBody(BaseModel):
    script: str


@router.post("/render")
def submit_render(body: RenderBody, slot: str = Depends(require_session)):
    if phase.is_locked():
        raise HTTPException(423, "Coding is locked — gauntlet is now active.")
    team, idx = slot.rsplit("-", 1)
    err = renderer.start_render(team, int(idx), body.script)
    if err:
        raise HTTPException(400, err)
    return {"ok": True, "status": "queued"}


@router.get("/render/status")
def render_status(slot: str = Depends(require_session)):
    team, idx = slot.rsplit("-", 1)
    status = renderer.get_status(team, int(idx))
    path = renderer.slot_dir(team, int(idx)) / "output.mp4"
    if path.exists():
        status = {**status, "video_url": f"{API_PREFIX}/video/my?v={version_for(path)}"}
    return status


@router.get("/video/my")
def get_my_video(request: Request, slot: str = Depends(require_session)):
    team, idx = slot.rsplit("-", 1)
    path = renderer.slot_dir(team, int(idx)) / "output.mp4"
    if not path.exists():
        raise HTTPException(404, "No rendered video yet. Submit your script first.")
    return media_file_response(request, path, "video/mp4")
