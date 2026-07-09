"""
Examples endpoint.

GET /api/examples           → list example scripts from pattern_examples/
GET /api/examples/video/{name}  → serve cached example MP4
"""

from fastapi import APIRouter, HTTPException, Request
from config import API_PREFIX, EXAMPLES_DIR
from example_renderer import EXAMPLES_CACHE
from responses import media_file_response

router = APIRouter()


@router.get("/examples")
def list_examples():
    if not EXAMPLES_DIR.is_dir():
        raise HTTPException(404, "Examples directory not found.")
    entries = []
    for f in sorted(EXAMPLES_DIR.iterdir()):
        if f.suffix == ".py":
            video_path = EXAMPLES_CACHE / f"{f.stem}.mp4"
            video_url = None
            if video_path.exists():
                video_url = f"{API_PREFIX}/examples/video/{f.stem}"
            entries.append({
                "filename": f.name,
                "name": f.stem,
                "code": f.read_text(encoding="utf-8"),
                "video_url": video_url,
            })
    return entries


@router.get("/examples/video/{name}")
def get_example_video(name: str, request: Request):
    path = EXAMPLES_CACHE / f"{name}.mp4"
    if not path.exists():
        raise HTTPException(404, "Example video not found.")
    return media_file_response(request, path, "video/mp4", cache_public=True)
