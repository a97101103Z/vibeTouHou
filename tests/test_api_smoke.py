import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    import config
    import identity
    import renderer
    import scores
    import routers.patterns as patterns

    data_dir = tmp_path / "data"
    monkeypatch.setattr(config, "DATA_DIR", data_dir)
    monkeypatch.setattr(renderer, "DATA_DIR", data_dir)
    monkeypatch.setattr(patterns, "DATA_DIR", data_dir)
    monkeypatch.setattr(identity, "DATA_DIR", data_dir)
    monkeypatch.setattr(identity, "_SESSIONS_FILE", data_dir / "sessions.json")
    monkeypatch.setattr(scores, "_SCORES_FILE", data_dir / "scores.json")
    identity._claimed.clear()
    identity._sessions.clear()

    main = importlib.import_module("main")
    return TestClient(main.app)


def claim_slot(client: TestClient) -> None:
    response = client.post("/api/claim", json={"team": "red", "index": 1})
    assert response.status_code == 200


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_asset_upload_list_and_fetch(client):
    claim_slot(client)

    response = client.post(
        "/api/assets/upload",
        files={"file": ("sprite.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )
    assert response.status_code == 200
    assert response.json()["filename"] == "sprite.png"

    response = client.get("/api/assets/list")
    assert response.status_code == 200
    assert response.json()["files"][0]["name"] == "sprite.png"

    response = client.get("/api/assets/sprite.png")
    assert response.status_code == 200
    assert response.headers["accept-ranges"] == "bytes"


def test_my_video_response_includes_playback_headers(client, tmp_path):
    claim_slot(client)
    import renderer

    video_path = renderer.slot_dir("red", 1) / "output.mp4"
    video_path.write_bytes(b"not-a-real-mp4-but-route-smoke-is-enough")

    response = client.get("/api/video/my")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("video/mp4")
    assert response.headers["accept-ranges"] == "bytes"
    assert response.headers["etag"]


def test_spa_fallback_for_production_routes(client, monkeypatch, tmp_path):
    import main

    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<div id='app'></div>", encoding="utf-8")
    monkeypatch.setattr(main, "STATIC_DIR", static_dir)

    response = client.get("/gauntlet")
    assert response.status_code == 200
    assert b"app" in response.content
