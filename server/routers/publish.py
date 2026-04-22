"""
Publish endpoint: validate trajectory server-side, then promote draft to published.

POST /api/publish   → body: { trajectory: [{x, y, t}, ...] }
"""

import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import renderer
import validator
from routers import require_session

router = APIRouter()


class TrajectoryPoint(BaseModel):
    x: float
    y: float
    t: float


class PublishBody(BaseModel):
    trajectory: list[TrajectoryPoint]


@router.post("/publish")
def publish(body: PublishBody, slot: str = Depends(require_session)):
    team, idx = slot.rsplit("-", 1)
    d = renderer.slot_dir(team, int(idx))
    draft = d / "output.mp4"

    if not draft.exists():
        raise HTTPException(400, "No rendered video found. Render your script first.")

    trajectory = [pt.model_dump() for pt in body.trajectory]

    ok, reason = validator.validate(draft, trajectory)
    if not ok:
        raise HTTPException(422, f"Trajectory validation failed: {reason}")

    # Promote draft → published
    published = d / "published.mp4"
    shutil.copy2(str(draft), str(published))

    return {"ok": True, "message": "Pattern published successfully!"}
