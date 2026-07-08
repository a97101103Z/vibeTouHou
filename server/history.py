"""
Render history management.

Stores per-slot render history under:
    {HISTORY_DIR}/{team}/{idx}/
        manifest.json          -- list of entry IDs, newest-first
        {id}.json              -- full entry metadata
        {id}.mp4               -- video (only for successful renders)

Entry IDs are UTC-timestamp strings (YYYYMMDD_HHMMSS_ffffff).
This guarantees uniqueness per slot and natural sort order.
"""

import json
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from config import HISTORY_DIR, MAX_HISTORY_ENTRIES, API_PREFIX

log = logging.getLogger(__name__)


# ── Internal helpers ───────────────────────────────────────────────────────────

def _slot_dir(team: str, idx: int) -> Path:
    """Return (and create) the history directory for the given team/slot."""
    d = HISTORY_DIR / team / str(idx)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _manifest_path(d: Path) -> Path:
    return d / "manifest.json"


def _read_manifest(d: Path) -> list[str]:
    """Return the list of entry IDs from the manifest, newest-first."""
    p = _manifest_path(d)
    if not p.exists():
        return []
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return []


def _write_manifest(d: Path, ids: list[str]) -> None:
    _manifest_path(d).write_text(json.dumps(ids), encoding="utf-8")


def _delete_entry_files(d: Path, entry_id: str) -> None:
    """Delete both the .json metadata and .mp4 video for a given entry ID."""
    for ext in (".json", ".mp4"):
        try:
            (d / f"{entry_id}{ext}").unlink(missing_ok=True)
        except Exception:
            pass


# ── Public API ─────────────────────────────────────────────────────────────────

def save_entry(
    team: str,
    idx: int,
    script: str,
    status: str,
    stderr: str,
    parsed_error: Optional[dict],
    video_src: Optional[Path],
) -> None:
    """
    Persist a render result to history.
    Automatically prunes the oldest entry when the slot exceeds MAX_HISTORY_ENTRIES.
    """
    try:
        d = _slot_dir(team, idx)
        now = datetime.now(tz=timezone.utc)
        entry_id = now.strftime("%Y%m%d_%H%M%S_") + f"{now.microsecond:06d}"

        entry = {
            "id": entry_id,
            "timestamp": now.isoformat(),
            "script": script,
            "status": status,
            "stderr": stderr,
            "parsed_error": parsed_error,
            "is_published": False,
            "published_trajectory": None,
        }
        (d / f"{entry_id}.json").write_text(
            json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        # Copy video only for successful renders that produced output
        if status == "done" and video_src and Path(video_src).exists():
            shutil.copy2(str(video_src), str(d / f"{entry_id}.mp4"))

        # Prepend to manifest (newest first)
        ids = _read_manifest(d)
        ids.insert(0, entry_id)

        # Prune over-limit entries, oldest first (end of list)
        while len(ids) > MAX_HISTORY_ENTRIES:
            _delete_entry_files(d, ids.pop())

        _write_manifest(d, ids)
    except Exception as exc:
        log.error("history.save_entry failed: %s", exc)


def get_entries(team: str, idx: int) -> list[dict]:
    """
    Return all history entries for a slot, newest-first.
    Adds a `video_url` key for successful entries that have a saved video.
    The `published_trajectory` field is stripped to keep the payload small.
    """
    d = _slot_dir(team, idx)
    ids = _read_manifest(d)
    entries: list[dict] = []
    for entry_id in ids:
        p = d / f"{entry_id}.json"
        if not p.exists():
            continue
        try:
            entry = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        # Attach a video URL if the mp4 was saved
        if entry.get("status") == "done" and (d / f"{entry_id}.mp4").exists():
            entry["video_url"] = f"{API_PREFIX}/video/history/{entry_id}"
        # Strip the large trajectory blob — clients only need the flag
        entry.pop("published_trajectory", None)
        entries.append(entry)
    return entries


def get_video_path(team: str, idx: int, entry_id: str) -> Optional[Path]:
    """Return the path to a history video file, or None if not found."""
    p = _slot_dir(team, idx) / f"{entry_id}.mp4"
    return p if p.exists() else None


def mark_latest_as_published(team: str, idx: int, trajectory: list[dict]) -> None:
    """
    Tag the newest history entry for this slot as published and store its trajectory.
    Called automatically after a successful /api/publish so that the entry can be
    re-published later without a fresh playtest.
    """
    try:
        d = _slot_dir(team, idx)
        ids = _read_manifest(d)
        if not ids:
            return
        p = d / f"{ids[0]}.json"
        if not p.exists():
            return
        entry = json.loads(p.read_text(encoding="utf-8"))
        # Only tag successfully rendered entries
        if entry.get("status") != "done":
            return
        entry["is_published"] = True
        entry["published_trajectory"] = trajectory
        p.write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as exc:
        log.error("history.mark_latest_as_published failed: %s", exc)


def publish_from_history(
    team: str, idx: int, entry_id: str, slot_path: Path
) -> tuple[bool, str]:
    """
    Re-publish a previously approved history entry without requiring a new playtest.
    Copies the history video to published.mp4 and restores the saved trajectory.
    Returns (ok, error_message).
    """
    d = _slot_dir(team, idx)
    entry_json_path = d / f"{entry_id}.json"
    entry_video_path = d / f"{entry_id}.mp4"

    if not entry_json_path.exists():
        return False, "History entry not found."
    try:
        entry = json.loads(entry_json_path.read_text(encoding="utf-8"))
    except Exception as exc:
        return False, f"Could not read history entry: {exc}"

    if not entry.get("is_published"):
        return False, "This entry has not been previously published."
    trajectory = entry.get("published_trajectory")
    if not trajectory:
        return False, "No trajectory saved for this entry."
    if not entry_video_path.exists():
        return False, "History video file not found."

    try:
        shutil.copy2(str(entry_video_path), str(slot_path / "published.mp4"))
    except Exception as exc:
        return False, f"Could not restore video: {exc}"

    try:
        (slot_path / "published_trajectory.json").write_text(
            json.dumps(trajectory, indent=2), encoding="utf-8"
        )
    except Exception as exc:
        return False, f"Could not restore trajectory: {exc}"

    return True, ""
