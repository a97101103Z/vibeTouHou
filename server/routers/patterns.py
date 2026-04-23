"""
Pattern listing for the gauntlet.

GET /api/patterns/opponent   → list of published patterns from the opponent team
GET /api/video/{team}/{index} → stream a published video (only opponent's)
"""

from fastapi import APIRouter, Depends, HTTPException, Request

import renderer
from config import DATA_DIR, TEAM_SIZE
from responses import media_file_response, version_for
from routers import require_session

router = APIRouter()


def _opponent(team: str) -> str:
    return "blue" if team == "red" else "red"


@router.get("/patterns/opponent")
def get_opponent_patterns(slot: str = Depends(require_session)):
    team, _ = slot.rsplit("-", 1)
    opp = _opponent(team)

    results = []
    for idx in range(1, TEAM_SIZE + 1):
        pub = DATA_DIR / opp / str(idx) / "published.mp4"
        if pub.exists():
            results.append({
                "slot": f"{opp}-{idx}",
                "index": idx,
                "team": opp,
                "video_url": f"/api/video/{opp}/{idx}?v={version_for(pub)}",
            })
    return {"patterns": results}


@router.get("/video/{team}/{index}")
def stream_video(team: str, index: int, request: Request, slot: str = Depends(require_session)):
    my_team, _ = slot.rsplit("-", 1)

    # You may only fetch published videos from the opposing team
    if team == my_team:
        raise HTTPException(403, "You cannot fetch your own team's published videos.")
    if team not in ("red", "blue"):
        raise HTTPException(400, "Invalid team.")

    path = DATA_DIR / team / str(index) / "published.mp4"
    if not path.exists():
        raise HTTPException(404, "Pattern not yet published.")
    return media_file_response(request, path, "video/mp4", cache_public=True)
