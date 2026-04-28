import importlib

import pytest
from fastapi.testclient import TestClient

from config import RED_TEAM_TOKEN, BLUE_TEAM_TOKEN, ADMIN_TOKEN, TEAM_SIZE


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
    # Clear new data structures
    identity._claimed.clear()
    identity._sessions.clear()

    main = importlib.import_module("main")
    return TestClient(main.app)


def claim_slot(client: TestClient, token: str = RED_TEAM_TOKEN) -> dict:
    response = client.post("/api/claim", json={"token": token})
    assert response.status_code == 200
    return response.json()


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_claim_slot_assigns_incremental_index(client):
    """Claims should assign indices 1, 2, 3... incrementally."""
    # First claim gets index 1
    r1 = claim_slot(client, RED_TEAM_TOKEN)
    assert r1["slot"] == "red-1"

    # Second claim gets index 2
    r2 = claim_slot(client, RED_TEAM_TOKEN)
    assert r2["slot"] == "red-2"

    # Third claim gets index 3
    r3 = claim_slot(client, RED_TEAM_TOKEN)
    assert r3["slot"] == "red-3"


def test_claim_slot_fills_gaps_after_removal(client):
    """After removing a user, new claims should fill the gap."""
    # Claim slots 1 and 2
    claim_slot(client, RED_TEAM_TOKEN)
    claim_slot(client, RED_TEAM_TOKEN)

    # Remove slot 1
    response = client.post("/api/admin/reset-slot", json={
        "admin_token": ADMIN_TOKEN,
        "team": "red",
        "index": 1
    })
    assert response.status_code == 200

    # Next claim should get index 1 (the gap)
    r = claim_slot(client, RED_TEAM_TOKEN)
    assert r["slot"] == "red-1"


def test_claim_returns_full_when_team_at_capacity(client):
    """When team is full, claims should return 409 with appropriate message."""
    # Fill the team to capacity
    for _ in range(TEAM_SIZE):
        response = client.post("/api/claim", json={"token": RED_TEAM_TOKEN})
        assert response.status_code == 200

    # Next claim should fail
    response = client.post("/api/claim", json={"token": RED_TEAM_TOKEN})
    assert response.status_code == 409
    assert "remaining" in response.json()["detail"].lower()


def test_claim_with_invalid_token_fails(client):
    """Invalid tokens should be rejected."""
    response = client.post("/api/claim", json={"token": "INVALID-TOKEN"})
    assert response.status_code == 409


def test_admin_reset_requires_valid_token(client):
    """Admin reset requires valid admin token."""
    # Claim a slot first
    claim_slot(client, RED_TEAM_TOKEN)

    # Try to reset with wrong admin token
    response = client.post("/api/admin/reset-slot", json={
        "admin_token": "WRONG-TOKEN",
        "team": "red",
        "index": 1
    })
    assert response.status_code == 403

    # Reset with correct token should work
    response = client.post("/api/admin/reset-slot", json={
        "admin_token": ADMIN_TOKEN,
        "team": "red",
        "index": 1
    })
    assert response.status_code == 200


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
