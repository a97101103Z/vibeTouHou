"""
Tests for server/history.py — render history management.

Uses tmp_path to isolate all file I/O.
HISTORY_DIR and MAX_HISTORY_ENTRIES are monkeypatched on the history module
directly so no real disk dirs are touched.
"""

import json
from pathlib import Path

import pytest


# ── Fixture ────────────────────────────────────────────────────────────────────

@pytest.fixture()
def hist(tmp_path, monkeypatch):
    """
    Return the history module with HISTORY_DIR redirected to a temp directory
    and MAX_HISTORY_ENTRIES set to a small value for pruning tests.
    """
    import config
    import history

    history_dir = tmp_path / "history"
    monkeypatch.setattr(config, "HISTORY_DIR", history_dir)
    monkeypatch.setattr(config, "MAX_HISTORY_ENTRIES", 3)
    monkeypatch.setattr(history, "HISTORY_DIR", history_dir)
    monkeypatch.setattr(history, "MAX_HISTORY_ENTRIES", 3)
    return history


# ── Helpers ────────────────────────────────────────────────────────────────────

def _make_video(path: Path) -> None:
    """Write a dummy MP4 file."""
    path.write_bytes(b"fake-mp4")


# ── save_entry ─────────────────────────────────────────────────────────────────

def test_save_entry_creates_json_and_manifest(hist, tmp_path):
    """A successful render should produce a .json file and update the manifest."""
    hist.save_entry("red", 1, "print('hi')", "done", "", None)

    slot_dir = hist.HISTORY_DIR / "red" / "1"
    manifest = json.loads((slot_dir / "manifest.json").read_text())
    assert len(manifest) == 1

    entry_id = manifest[0]
    entry_path = slot_dir / f"{entry_id}.json"
    assert entry_path.exists()

    entry = json.loads(entry_path.read_text())
    assert entry["status"] == "done"
    assert entry["script"] == "print('hi')"
    assert entry["is_published"] is False
    assert entry["published_trajectory"] is None


def test_save_entry_copies_video_on_success(hist, tmp_path):
    """When status is 'done' and a video_src exists, the mp4 should be copied."""
    video = tmp_path / "output.mp4"
    _make_video(video)

    hist.save_entry("red", 1, "# script", "done", "", video)

    slot_dir = hist.HISTORY_DIR / "red" / "1"
    manifest = json.loads((slot_dir / "manifest.json").read_text())
    entry_id = manifest[0]
    assert (slot_dir / f"{entry_id}.mp4").exists()
    assert (slot_dir / f"{entry_id}.mp4").read_bytes() == b"fake-mp4"


def test_save_entry_no_video_on_error(hist, tmp_path):
    """Error renders should not create an .mp4 file even if video_src is given."""
    video = tmp_path / "output.mp4"
    _make_video(video)

    hist.save_entry("red", 2, "bad()", "error", "NameError", video)

    slot_dir = hist.HISTORY_DIR / "red" / "2"
    manifest = json.loads((slot_dir / "manifest.json").read_text())
    entry_id = manifest[0]
    # status is "error" so no mp4 should be copied
    assert not (slot_dir / f"{entry_id}.mp4").exists()


def test_save_entry_does_not_raise_on_bad_video_path(hist):
    """save_entry should silently swallow errors rather than crash the worker."""
    # Non-existent video_src should not raise
    hist.save_entry("blue", 5, "x = 1", "done", "", Path("/nonexistent/path.mp4"))


# ── get_entries — newest-first ordering ───────────────────────────────────────

def test_get_entries_returns_newest_first(hist, tmp_path):
    """Three consecutive saves should come back newest-first."""
    for i in range(3):
        hist.save_entry("red", 1, f"# script {i}", "error", "", None)

    entries = hist.get_entries("red", 1)
    assert len(entries) == 3
    # Timestamps should be in descending order (newest first)
    timestamps = [e["timestamp"] for e in entries]
    assert timestamps == sorted(timestamps, reverse=True)


def test_get_entries_adds_video_url_for_done_with_mp4(hist, tmp_path):
    """get_entries should add a video_url for done entries that have a saved video."""
    video = tmp_path / "output.mp4"
    _make_video(video)

    hist.save_entry("red", 1, "# ok", "done", "", video)
    entries = hist.get_entries("red", 1)

    assert len(entries) == 1
    assert "video_url" in entries[0]
    assert entries[0]["video_url"].endswith(entries[0]["id"])


def test_get_entries_no_video_url_without_mp4(hist):
    """Entries without a saved mp4 should not have a video_url key."""
    hist.save_entry("red", 1, "# bad", "error", "err", None)
    entries = hist.get_entries("red", 1)

    assert len(entries) == 1
    assert "video_url" not in entries[0]


def test_get_entries_strips_published_trajectory(hist, tmp_path):
    """published_trajectory should never be present in get_entries output."""
    video = tmp_path / "output.mp4"
    _make_video(video)

    hist.save_entry("red", 1, "# s", "done", "", video)
    traj = [{"x": 10.0, "y": 20.0, "t": 0.0}]
    hist.mark_latest_as_published("red", 1, traj)

    entries = hist.get_entries("red", 1)
    assert "published_trajectory" not in entries[0]


def test_get_entries_empty_for_new_slot(hist):
    """A slot that has never been rendered should return an empty list."""
    assert hist.get_entries("blue", 99) == []


# ── Pruning ────────────────────────────────────────────────────────────────────

def test_pruning_keeps_only_max_entries(hist):
    """When more than MAX_HISTORY_ENTRIES renders are saved, old ones are pruned."""
    # MAX_HISTORY_ENTRIES is patched to 3
    for i in range(5):
        hist.save_entry("red", 1, f"# {i}", "error", "", None)

    entries = hist.get_entries("red", 1)
    assert len(entries) == 3  # capped at max


def test_pruning_removes_oldest_files(hist):
    """Files for pruned entries should be deleted from disk."""
    for i in range(5):
        hist.save_entry("red", 1, f"# {i}", "error", "", None)

    slot_dir = hist.HISTORY_DIR / "red" / "1"
    json_files = list(slot_dir.glob("*.json"))
    # manifest.json + 3 entry JSONs = 4 total
    assert len(json_files) == 4


# ── mark_latest_as_published ──────────────────────────────────────────────────

def test_mark_latest_as_published_sets_flag(hist, tmp_path):
    """After marking, the newest entry should have is_published=True."""
    video = tmp_path / "output.mp4"
    _make_video(video)

    hist.save_entry("red", 1, "# s", "done", "", video)
    traj = [{"x": 1.0, "y": 2.0, "t": 0.0}]
    hist.mark_latest_as_published("red", 1, traj)

    slot_dir = hist.HISTORY_DIR / "red" / "1"
    manifest = json.loads((slot_dir / "manifest.json").read_text())
    entry = json.loads((slot_dir / f"{manifest[0]}.json").read_text())

    assert entry["is_published"] is True
    assert entry["published_trajectory"] == traj


def test_mark_latest_as_published_ignores_error_entries(hist):
    """Only 'done' entries should be tagged; error entries are skipped."""
    hist.save_entry("red", 1, "# bad", "error", "err", None)
    hist.mark_latest_as_published("red", 1, [{"x": 0.0, "y": 0.0, "t": 0.0}])

    slot_dir = hist.HISTORY_DIR / "red" / "1"
    manifest = json.loads((slot_dir / "manifest.json").read_text())
    entry = json.loads((slot_dir / f"{manifest[0]}.json").read_text())

    assert entry["is_published"] is False


def test_mark_latest_as_published_noop_on_empty_slot(hist):
    """Should not raise when called on a slot with no history."""
    hist.mark_latest_as_published("red", 99, [])


# ── publish_from_history ───────────────────────────────────────────────────────

def test_publish_from_history_copies_video_and_trajectory(hist, tmp_path):
    """A successfully published history entry should restore video and trajectory."""
    video = tmp_path / "output.mp4"
    _make_video(video)

    hist.save_entry("red", 1, "# s", "done", "", video)
    traj = [{"x": 5.0, "y": 10.0, "t": 0.5}]
    hist.mark_latest_as_published("red", 1, traj)

    # Get the entry_id that was saved
    slot_dir = hist.HISTORY_DIR / "red" / "1"
    manifest = json.loads((slot_dir / "manifest.json").read_text())
    entry_id = manifest[0]

    # Target slot directory (simulates where published.mp4 should land)
    game_slot = tmp_path / "game_slot"
    game_slot.mkdir()

    ok, err = hist.publish_from_history("red", 1, entry_id, game_slot)
    assert ok is True
    assert err == ""
    assert (game_slot / "published.mp4").read_bytes() == b"fake-mp4"
    restored_traj = json.loads((game_slot / "published_trajectory.json").read_text())
    assert restored_traj == traj


def test_publish_from_history_fails_for_unpublished_entry(hist, tmp_path):
    """An entry that was never marked as published should be rejected."""
    video = tmp_path / "output.mp4"
    _make_video(video)

    hist.save_entry("red", 1, "# s", "done", "", video)

    slot_dir = hist.HISTORY_DIR / "red" / "1"
    manifest = json.loads((slot_dir / "manifest.json").read_text())
    entry_id = manifest[0]

    game_slot = tmp_path / "game_slot"
    game_slot.mkdir()

    ok, err = hist.publish_from_history("red", 1, entry_id, game_slot)
    assert ok is False
    assert "not been previously published" in err


def test_publish_from_history_fails_for_missing_entry(hist, tmp_path):
    """A non-existent entry ID should return an error."""
    game_slot = tmp_path / "game_slot"
    game_slot.mkdir()

    ok, err = hist.publish_from_history("red", 1, "nonexistent_id", game_slot)
    assert ok is False
    assert "not found" in err.lower()


def test_publish_from_history_fails_when_video_missing(hist, tmp_path):
    """If the history mp4 was deleted, publish_from_history should fail gracefully."""
    video = tmp_path / "output.mp4"
    _make_video(video)

    hist.save_entry("red", 1, "# s", "done", "", video)
    traj = [{"x": 0.0, "y": 0.0, "t": 0.0}]
    hist.mark_latest_as_published("red", 1, traj)

    slot_dir = hist.HISTORY_DIR / "red" / "1"
    manifest = json.loads((slot_dir / "manifest.json").read_text())
    entry_id = manifest[0]

    # Delete the history mp4 to simulate corruption/pruning race
    (slot_dir / f"{entry_id}.mp4").unlink()

    game_slot = tmp_path / "game_slot"
    game_slot.mkdir()

    ok, err = hist.publish_from_history("red", 1, entry_id, game_slot)
    assert ok is False
    assert "video" in err.lower()


# ── get_video_path ─────────────────────────────────────────────────────────────

def test_get_video_path_returns_path_when_exists(hist, tmp_path):
    """get_video_path should return the path for an existing video."""
    video = tmp_path / "output.mp4"
    _make_video(video)

    hist.save_entry("red", 1, "# s", "done", "", video)

    slot_dir = hist.HISTORY_DIR / "red" / "1"
    manifest = json.loads((slot_dir / "manifest.json").read_text())
    entry_id = manifest[0]

    result = hist.get_video_path("red", 1, entry_id)
    assert result is not None
    assert result.exists()


def test_get_video_path_returns_none_when_missing(hist):
    """get_video_path should return None for an unknown entry ID."""
    result = hist.get_video_path("red", 1, "does_not_exist")
    assert result is None
