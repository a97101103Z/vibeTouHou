"""
Score submission and leaderboard.

POST /api/score         → submit a gauntlet run result
GET  /api/leaderboard   → get both teams' best scores
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


class PatternTrajectory(BaseModel):
    index: int
    points: list[TrajectoryPoint]


class ScoreBody(BaseModel):
    hits: int
    infinite_time: Optional[float] = None
    trajectories: list[PatternTrajectory]


def _opponent(team: str) -> str:
    return "blue" if team == "red" else "red"


@router.post("/score")
def submit_score(body: ScoreBody, slot: str = Depends(require_session)):
    team, idx = slot.rsplit("-", 1)
    opp = _opponent(team)

    # Server-side verification: replay trajectories against opponent's published videos
    verified_hits = 0
    for traj in body.trajectories:
        video_path = DATA_DIR / opp / str(traj.index) / "published.mp4"
        if not video_path.exists():
            raise HTTPException(400, f"Pattern {opp}-{traj.index} has not been published.")
        pts = [{"x": p.x, "y": p.y, "t": p.t} for p in traj.points]
        pattern_hits = validator.count_hits(video_path, pts)
        verified_hits += pattern_hits

    if body.infinite_time is not None:
        # Infinite mode — score is survival time with 0 hits
        if body.hits != 0 or verified_hits != 0:
            raise HTTPException(
                422,
                f"Infinite mode score rejected: server found {verified_hits} hit(s), "
                "infinite mode requires 0.",
            )
        expected_time = len(body.trajectories) * 10.0
        if body.infinite_time != expected_time:
            raise HTTPException(
                422,
                f"Infinite mode score rejected: submitted {body.infinite_time}s, "
                f"expected {expected_time:.0f}s ({len(body.trajectories)} patterns × 10s).",
            )
    else:
        # Gauntlet mode — hits must match verified count
        if verified_hits != body.hits:
            raise HTTPException(
                422,
                f"Score verification failed: submitted {body.hits} hit(s), "
                f"server counted {verified_hits}.",
            )

    scores.submit(team, int(idx), body.hits, body.infinite_time)
    return {"ok": True}


@router.get("/leaderboard")
def leaderboard(slot: str = Depends(require_session), session: str | None = Cookie(default=None)):
    if session:
        identity.update_last_seen(session)
    return scores.get_leaderboard()
