"""
Score submission, progress, and leaderboard.

POST /api/score          → submit a single pattern result
GET  /api/scores          → current slot's per-pattern scores
GET  /api/leaderboard    → per-team points averages
"""

from fastapi import APIRouter, Depends, HTTPException, Cookie
from pydantic import BaseModel
from typing import Optional

import scores
import identity
import validator
from config import DATA_DIR
from routers import require_session

router = APIRouter()


class TrajectoryPoint(BaseModel):
    x: float
    y: float
    t: float
    vt: float | None = None


class ScoreBody(BaseModel):
    pattern_index: int
    hits: int
    trajectory: list[TrajectoryPoint]


def _opponent(team: str) -> str:
    return "blue" if team == "red" else "red"


@router.post("/score")
def submit_score(body: ScoreBody, slot: str = Depends(require_session)):
    team, idx = slot.rsplit("-", 1)
    opp = _opponent(team)

    video_path = DATA_DIR / opp / str(body.pattern_index) / "published.mp4"
    if not video_path.exists():
        raise HTTPException(400, f"Pattern {opp}-{body.pattern_index} has not been published.")

    pts = [{"x": p.x, "y": p.y, "t": p.t, "vt": p.vt} for p in body.trajectory]
    err = validator.verify_trajectory(pts)
    if err:
        raise HTTPException(422, f"Invalid trajectory for {opp}-{body.pattern_index}: {err}")

    pattern_hits = validator.count_hits(video_path, pts)
    if pattern_hits != body.hits:
        raise HTTPException(
            422,
            f"Score verification failed: submitted {body.hits} hit(s), "
            f"server counted {pattern_hits}.",
        )

    scores.submit_pattern(team, int(idx), body.pattern_index, body.hits)
    return {"ok": True}


@router.get("/scores")
def get_scores(slot: str = Depends(require_session)):
    team, idx = slot.rsplit("-", 1)
    data = scores.get_slot_scores(team, int(idx))
    if data is None:
        return {"scores": {}}
    return {"scores": data.get("scores", {})}


@router.get("/leaderboard")
def leaderboard(session: str | None = Cookie(default=None)):
    if session:
        identity.update_last_seen(session)

    raw = scores.get_leaderboard()

    # Merge claimed slots into scores: every claimed slot appears as a key.
    # Empty value = claimed but no scores yet.
    for team in ("red", "blue"):
        for i in range(1, 13):
            if identity.is_claimed(f"{team}-{i}"):
                raw.setdefault(team, {}).setdefault(str(i), {})

    return {"scores": raw}
