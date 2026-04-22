"""
Score submission and leaderboard.

POST /api/score         → submit a gauntlet run result
GET  /api/leaderboard   → get both teams' best scores
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

import scores
from routers import require_session

router = APIRouter()


class ScoreBody(BaseModel):
    hits: int
    infinite_time: Optional[float] = None


@router.post("/score")
def submit_score(body: ScoreBody, slot: str = Depends(require_session)):
    team, idx = slot.rsplit("-", 1)
    scores.submit(team, int(idx), body.hits, body.infinite_time)
    return {"ok": True}


@router.get("/leaderboard")
def leaderboard(slot: str = Depends(require_session)):
    return scores.get_leaderboard()
