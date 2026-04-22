"""
Script submission and render-status endpoints.

POST /api/render              → submit script, start render job
GET  /api/render/status       → poll render job status
GET  /api/video/my            → stream user's own draft output.mp4
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import renderer
import identity
from routers import require_session

router = APIRouter()


class RenderBody(BaseModel):
    script: str


@router.post("/render")
def submit_render(body: RenderBody, slot: str = Depends(require_session)):
    team, idx = slot.rsplit("-", 1)
    err = renderer.start_render(team, int(idx), body.script)
    if err:
        raise HTTPException(400, err)
    return {"ok": True, "status": "queued"}


@router.get("/render/status")
def render_status(slot: str = Depends(require_session)):
    team, idx = slot.rsplit("-", 1)
    return renderer.get_status(team, int(idx))


@router.get("/video/my")
def get_my_video(slot: str = Depends(require_session)):
    team, idx = slot.rsplit("-", 1)
    path = renderer.slot_dir(team, int(idx)) / "output.mp4"
    if not path.exists():
        raise HTTPException(404, "No rendered video yet. Submit your script first.")
    return FileResponse(str(path), media_type="video/mp4")
