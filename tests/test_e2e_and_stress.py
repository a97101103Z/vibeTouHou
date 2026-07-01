import asyncio
import importlib

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from config import RED_TEAM_TOKEN, BLUE_TEAM_TOKEN


PNG_BYTES = b"\x89PNG\r\n\x1a\n"


@pytest.fixture()
def app_context(tmp_path, monkeypatch):
    import config
    import identity
    import renderer
    import scores
    import routers.patterns as patterns
    import routers.scores_router as scores_router

    data_dir = tmp_path / "data"
    monkeypatch.setattr(config, "DATA_DIR", data_dir)
    monkeypatch.setattr(renderer, "DATA_DIR", data_dir)
    monkeypatch.setattr(patterns, "DATA_DIR", data_dir)
    monkeypatch.setattr(identity, "DATA_DIR", data_dir)
    monkeypatch.setattr(identity, "_SESSIONS_FILE", data_dir / "sessions.json")
    monkeypatch.setattr(scores, "_SCORES_FILE", data_dir / "scores.json")
    monkeypatch.setattr(scores_router, "DATA_DIR", data_dir)
    # Clear new data structures
    identity._claimed.clear()
    identity._sessions.clear()
    with renderer._jobs_lock:
        renderer._jobs.clear()

    main = importlib.import_module("main")
    return main.app, renderer


def _install_fake_render(monkeypatch, renderer):
    def fake_start_render(team: str, index: int, script: str):
        d = renderer.slot_dir(team, index)
        (d / "script.py").write_text(script, encoding="utf-8")
        (d / "output.mp4").write_bytes(b"fake-mp4")
        renderer._set_status(f"{team}-{index}", "done", "")
        return None

    monkeypatch.setattr(renderer, "start_render", fake_start_render)


def _seed_published(renderer, team: str, index: int):
    d = renderer.slot_dir(team, index)
    (d / "published.mp4").write_bytes(b"published-mp4")


def test_e2e_upload_render_and_gauntlet_routes(app_context, monkeypatch):
    app, renderer = app_context
    _install_fake_render(monkeypatch, renderer)
    _seed_published(renderer, "red", 1)
    _seed_published(renderer, "blue", 1)

    red_client = TestClient(app)
    blue_client = TestClient(app)

    assert red_client.post("/api/claim", json={"token": RED_TEAM_TOKEN}).status_code == 200
    assert blue_client.post("/api/claim", json={"token": BLUE_TEAM_TOKEN}).status_code == 200

    resp = red_client.post("/api/assets/upload", files={"file": ("hero.png", PNG_BYTES, "image/png")})
    assert resp.status_code == 200

    resp = red_client.post("/api/render", json={"script": "import math\nprint(1)\n"})
    assert resp.status_code == 200

    status = red_client.get("/api/render/status")
    assert status.status_code == 200
    assert status.json()["status"] == "done"
    assert "video_url" in status.json()

    my_video = red_client.get("/api/video/my")
    assert my_video.status_code == 200
    assert my_video.headers["accept-ranges"] == "bytes"

    patterns = red_client.get("/api/patterns/opponent")
    assert patterns.status_code == 200
    assert any(p["team"] == "blue" for p in patterns.json()["patterns"])

    opp_video = red_client.get("/api/video/blue/1")
    assert opp_video.status_code == 200

    own_video_forbidden = red_client.get("/api/video/red/1")
    assert own_video_forbidden.status_code == 403


def test_stress_24_users_claim_upload_render_video_score(app_context, monkeypatch):
    app, renderer = app_context
    _install_fake_render(monkeypatch, renderer)
    _seed_published(renderer, "red", 1)
    _seed_published(renderer, "blue", 1)

    import validator
    monkeypatch.setattr(validator, "count_hits", lambda _video, _traj: 0)

    async def user_flow(team: str, index: int):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            token = RED_TEAM_TOKEN if team == "red" else BLUE_TEAM_TOKEN
            claim = await client.post("/api/claim", json={"token": token})
            assert claim.status_code == 200

            up = await client.post(
                "/api/assets/upload",
                files={"file": (f"asset-{team}-{index}.png", PNG_BYTES, "image/png")},
            )
            assert up.status_code == 200

            render = await client.post("/api/render", json={"script": "import random\nprint('ok')\n"})
            assert render.status_code == 200

            status = await client.get("/api/render/status")
            assert status.status_code == 200
            payload = status.json()
            assert payload["status"] == "done"
            assert payload.get("video_url")

            mine = await client.get("/api/video/my")
            assert mine.status_code == 200

            opp_list = await client.get("/api/patterns/opponent")
            assert opp_list.status_code == 200
            assert len(opp_list.json()["patterns"]) >= 1

            opp_team = "blue" if team == "red" else "red"
            opp_video = await client.get(f"/api/video/{opp_team}/1")
            assert opp_video.status_code == 200

            score = await client.post("/api/score", json={
                "hits": 0,
                "infinite_time": None,
                "trajectories": [{"index": 1, "points": [{"x": 400, "y": 500, "t": 0.0}, {"x": 400, "y": 500, "t": 10.0}]}],
            })
            assert score.status_code == 200, score.text

            lb = await client.get("/api/leaderboard")
            assert lb.status_code == 200

    async def run_all():
        tasks = [user_flow("red", i) for i in range(1, 13)] + [user_flow("blue", i) for i in range(1, 13)]
        await asyncio.gather(*tasks)

    asyncio.run(run_all())
