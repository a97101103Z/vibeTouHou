"""
Gallery — persists curated video entries across server restarts.

Storage layout (at project root /gallery/):
    index.json           ← list of entry metadata dicts
    <entry_id>.mp4       ← uploaded video files

Public API:
    list_entries()                          → list[dict]
    add_entry(admin_token, title, video_bytes, suffix) → dict | None
    delete_entry(admin_token, entry_id)     → True | None | False
    entry_video_path(entry_id)              → Path | None
"""

import json
import secrets
import shutil
import threading
from pathlib import Path

from config import ADMIN_TOKEN, DATA_DIR

GALLERY_DIR = Path(__file__).parent.parent / "gallery"
_INDEX_FILE = GALLERY_DIR / "index.json"
_lock = threading.Lock()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _load_index() -> list:
    try:
        return json.loads(_INDEX_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save_index(entries: list) -> None:
    GALLERY_DIR.mkdir(parents=True, exist_ok=True)
    _INDEX_FILE.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# ── Public API ─────────────────────────────────────────────────────────────────

def list_entries() -> list:
    """Return all gallery entries (safe to call without lock — reads only)."""
    return _load_index()


def add_entry_from_slot(
    admin_token: str,
    title: str,
    team: str,
    index: int,
) -> dict | None | bool:
    """
    Copy a published pattern video from data/{team}/{index}/ into the gallery.

    Returns:
      None  — bad admin token
      False — source video not found (not published yet)
      dict  — the created entry
    """
    if admin_token != ADMIN_TOKEN:
        return None

    # Locate the published video
    source = DATA_DIR / team / str(index) / "published.mp4"
    if not source.exists():
        return False

    entry_id = secrets.token_hex(6)  # e.g. "a3f8c1"
    filename = f"{entry_id}.mp4"

    GALLERY_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, GALLERY_DIR / filename)

    entry = {
        "id": entry_id,
        "title": title.strip() or f"{team.upper()}-{index}",
        "filename": filename,
    }

    with _lock:
        entries = _load_index()
        entries.append(entry)
        _save_index(entries)

    return entry


def delete_entry(admin_token: str, entry_id: str) -> bool | None:
    """
    Remove a gallery entry by id.
    Returns None on bad token, False if not found, True on success.
    """
    if admin_token != ADMIN_TOKEN:
        return None

    with _lock:
        entries = _load_index()
        target = next((e for e in entries if e["id"] == entry_id), None)
        if target is None:
            return False

        # Delete video file
        video_path = GALLERY_DIR / target["filename"]
        if video_path.exists():
            video_path.unlink()

        entries = [e for e in entries if e["id"] != entry_id]
        _save_index(entries)

    return True


def entry_video_path(entry_id: str) -> Path | None:
    """Return the Path to an entry's video, or None if not found."""
    for e in _load_index():
        if e["id"] == entry_id:
            p = GALLERY_DIR / e["filename"]
            return p if p.exists() else None
    return None
