"""
Publish endpoint: validate trajectory server-side, then promote draft to published.

POST /api/publish   → body: { trajectory: [{x, y, t}, ...] }

The verified trajectory is also saved to published_trajectory.json for admin review.
"""

import json
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import history
import renderer
import validator
import phase
from routers import require_session

router = APIRouter()


class TrajectoryPoint(BaseModel):
    x: float
    y: float
    t: float
    vt: float | None = None


class PublishBody(BaseModel):
    trajectory: list[TrajectoryPoint]


@router.post("/publish")
def publish(body: PublishBody, slot: str = Depends(require_session)):
    if phase.is_locked():
        raise HTTPException(423, "Publishing is locked — gauntlet is now active.")
    team, idx = slot.rsplit("-", 1)
    d = renderer.slot_dir(team, int(idx))
    draft = d / "output.mp4"

    if not draft.exists():
        raise HTTPException(400, "No rendered video found. Render your script first.")

    trajectory = [pt.model_dump() for pt in body.trajectory]

    err = validator.verify_trajectory(trajectory)
    if err:
        raise HTTPException(422, f"Trajectory validation failed: {err}")

    ok, reason = validator.validate(draft, trajectory)
    if not ok:
        raise HTTPException(422, f"Trajectory validation failed: {reason}")

    # Promote draft → published
    published = d / "published.mp4"
    shutil.copy2(str(draft), str(published))

    # Save submitted trajectory for admin review
    traj_path = d / "published_trajectory.json"
    # Keep the file around even if it's the same data; this allows admins
    # to see the exact no-damage route the player submitted
    traj_path.write_text(json.dumps(trajectory, indent=2), encoding="utf-8")

    # Tag the latest history entry as published
    history.mark_latest_as_published(team, int(idx), trajectory)

    return {"ok": True, "message": "Pattern published successfully!"}


@router.post("/publish/history/{entry_id}")
def publish_from_history(entry_id: str, slot: str = Depends(require_session)):
    """Re-publish a previously approved history entry without requiring a new playtest."""
    if phase.is_locked():
        raise HTTPException(423, "Publishing is locked — gauntlet is now active.")
    team, idx = slot.rsplit("-", 1)
    d = renderer.slot_dir(team, int(idx))
    ok, err = history.publish_from_history(team, int(idx), entry_id, d)
    if not ok:
        raise HTTPException(400, err)
    return {"ok": True, "message": "Pattern published successfully!"}
