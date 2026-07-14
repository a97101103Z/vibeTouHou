"""
Showcase — curated pattern showcase with named sections.

Storage layout (at project root /showcase/):
    index.json           ← sections dict with entry metadata
    <entry_id>.mp4       ← video files

Public API:
    list_sections()                              → dict
    set_sections(admin_token, data)              → bool
    video_path(entry_id)                         → Path | None
"""

import json
import threading
from pathlib import Path

from config import ADMIN_TOKEN

SHOWCASE_DIR = Path(__file__).parent.parent / "showcase"
_INDEX_FILE = SHOWCASE_DIR / "index.json"
_lock = threading.Lock()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _load_index() -> dict:
    try:
        return json.loads(_INDEX_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {"sections": []}


def _save_index(data: dict) -> None:
    SHOWCASE_DIR.mkdir(parents=True, exist_ok=True)
    _INDEX_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


# ── Public API ─────────────────────────────────────────────────────────────────

def list_sections() -> dict:
    """Return the full showcase sections structure."""
    return _load_index()


def set_sections(admin_token: str, data: dict) -> bool:
    """
    Replace the entire showcase index.

    Args:
        admin_token: must match ADMIN_TOKEN
        data: dict with "sections" key containing the new layout

    Returns:
        True on success, False on bad token.
    """
    if admin_token != ADMIN_TOKEN:
        return False

    if not isinstance(data, dict) or "sections" not in data:
        return False

    with _lock:
        _save_index(data)

    return True


def video_path(entry_id: str) -> Path | None:
    """Return the Path to a showcase entry's video, or None if not found."""
    data = _load_index()
    for section in data.get("sections", []):
        for entry in section.get("entries", []):
            if entry.get("id") == entry_id:
                filename = entry.get("filename")
                if not filename:
                    return None
                p = SHOWCASE_DIR / filename
                return p if p.exists() else None
    return None
