import importlib
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from config import ADMIN_TOKEN


@pytest.fixture()
def client(tmp_path, monkeypatch):
    import config
    import identity
    import renderer
    import gallery
    import routers.patterns as patterns

    data_dir = tmp_path / "data"
    gallery_dir = tmp_path / "gallery"
    monkeypatch.setattr(config, "DATA_DIR", data_dir)
    monkeypatch.setattr(renderer, "DATA_DIR", data_dir)
    monkeypatch.setattr(patterns, "DATA_DIR", data_dir)
    monkeypatch.setattr(identity, "DATA_DIR", data_dir)
    monkeypatch.setattr(identity, "_SESSIONS_FILE", data_dir / "sessions.json")
    monkeypatch.setattr(gallery, "DATA_DIR", data_dir)
    monkeypatch.setattr(gallery, "GALLERY_DIR", gallery_dir)
    monkeypatch.setattr(gallery, "_INDEX_FILE", gallery_dir / "index.json")
    identity._claimed.clear()
    identity._sessions.clear()

    main = importlib.import_module("main")
    return TestClient(main.app)


def _seed_published(data_dir: Path, team: str, index: int):
    d = data_dir / team / str(index)
    d.mkdir(parents=True, exist_ok=True)
    (d / "published.mp4").write_bytes(b"fake-mp4-content")


def test_gallery_list_empty(client):
    resp = client.get("/api/gallery")
    assert resp.status_code == 200
    assert resp.json() == {"entries": []}


def test_gallery_add_entry(client, tmp_path):
    import config
    _seed_published(config.DATA_DIR, "red", 1)

    resp = client.post("/api/admin/gallery", json={
        "admin_token": ADMIN_TOKEN,
        "title": "My Test Entry",
        "team": "red",
        "index": 1,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    entry = data["entry"]
    assert entry["title"] == "My Test Entry"
    assert entry["id"]
    assert entry["filename"].endswith(".mp4")

    resp = client.get("/api/gallery")
    assert resp.status_code == 200
    entries = resp.json()["entries"]
    assert len(entries) == 1
    assert entries[0]["id"] == entry["id"]


def test_gallery_add_entry_missing_video(client):
    resp = client.post("/api/admin/gallery", json={
        "admin_token": ADMIN_TOKEN,
        "title": "No Video",
        "team": "blue",
        "index": 99,
    })
    assert resp.status_code == 404


def test_gallery_add_bad_admin_token(client, tmp_path):
    import config
    _seed_published(config.DATA_DIR, "red", 1)

    resp = client.post("/api/admin/gallery", json={
        "admin_token": "wrong-token",
        "title": "Nope",
        "team": "red",
        "index": 1,
    })
    assert resp.status_code == 401


def test_gallery_delete_entry(client, tmp_path):
    import config
    _seed_published(config.DATA_DIR, "red", 1)

    add = client.post("/api/admin/gallery", json={
        "admin_token": ADMIN_TOKEN,
        "title": "To Delete",
        "team": "red",
        "index": 1,
    })
    entry_id = add.json()["entry"]["id"]

    resp = client.request("DELETE", f"/api/admin/gallery/{entry_id}", json={
        "admin_token": ADMIN_TOKEN,
    })
    assert resp.status_code == 200
    assert resp.json()["ok"] is True

    resp = client.get("/api/gallery")
    assert len(resp.json()["entries"]) == 0


def test_gallery_delete_not_found(client):
    resp = client.request("DELETE", "/api/admin/gallery/nonexistent", json={
        "admin_token": ADMIN_TOKEN,
    })
    assert resp.status_code == 404


def test_gallery_delete_bad_token(client, tmp_path):
    import config
    _seed_published(config.DATA_DIR, "red", 1)

    add = client.post("/api/admin/gallery", json={
        "admin_token": ADMIN_TOKEN,
        "title": "X",
        "team": "red",
        "index": 1,
    })
    entry_id = add.json()["entry"]["id"]

    resp = client.request("DELETE", f"/api/admin/gallery/{entry_id}", json={
        "admin_token": "wrong",
    })
    assert resp.status_code == 401


def test_gallery_stream_video(client, tmp_path):
    import config
    _seed_published(config.DATA_DIR, "red", 1)

    add = client.post("/api/admin/gallery", json={
        "admin_token": ADMIN_TOKEN,
        "title": "Stream Test",
        "team": "red",
        "index": 1,
    })
    entry_id = add.json()["entry"]["id"]

    resp = client.get(f"/api/gallery/{entry_id}/video")
    assert resp.status_code == 200
    assert resp.content == b"fake-mp4-content"


def test_gallery_stream_video_not_found(client):
    resp = client.get("/api/gallery/nonexistent/video")
    assert resp.status_code == 404


def test_gallery_add_with_empty_title_uses_slot_name(client, tmp_path):
    import config
    _seed_published(config.DATA_DIR, "blue", 3)

    resp = client.post("/api/admin/gallery", json={
        "admin_token": ADMIN_TOKEN,
        "title": "",
        "team": "blue",
        "index": 3,
    })
    assert resp.status_code == 200
    assert resp.json()["entry"]["title"] == "BLUE-3"


def test_gallery_admin_session_auth(client, tmp_path):
    import config
    import identity

    identity.create_admin_session()
    sessions = identity._sessions
    admin_session = next(k for k, v in sessions.items() if v.get("slot") == "admin")

    _seed_published(config.DATA_DIR, "red", 2)

    resp = client.post("/api/admin/gallery", json={
        "title": "Session Auth",
        "team": "red",
        "index": 2,
    }, cookies={"session": admin_session})
    assert resp.status_code == 200
    assert resp.json()["entry"]["title"] == "Session Auth"
