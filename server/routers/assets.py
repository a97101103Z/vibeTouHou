"""
Asset management endpoints.

POST /api/assets/upload          → upload an image file to the user's assets/ dir
GET  /api/assets/list            → list uploaded assets
GET  /api/assets/{filename}      → serve an uploaded asset
"""

from pathlib import Path
import re

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File

import renderer
from responses import media_file_response
from routers import require_session

router = APIRouter()

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}
ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/bmp",
    "image/webp",
}
MAX_ASSET_BYTES = 10 * 1024 * 1024  # 10 MB per file
UPLOAD_CHUNK_BYTES = 1024 * 1024
SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_upload_name(filename: str | None) -> str:
    raw = Path(filename or "").name.strip().replace(" ", "_")
    safe = SAFE_NAME_RE.sub("_", raw)
    if not safe or safe in {".", ".."}:
        raise HTTPException(400, "Upload must include a filename.")
    if safe.startswith("."):
        safe = safe.lstrip(".")
    return safe


@router.post("/assets/upload")
async def upload_asset(
    file: UploadFile = File(...),
    slot: str = Depends(require_session),
):
    safe_name = _safe_upload_name(file.filename)
    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{ext}' not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}")
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(400, f"Content type '{file.content_type}' is not an allowed image type.")

    team, idx = slot.rsplit("-", 1)
    assets_dir = renderer.slot_dir(team, int(idx)) / "assets"
    assets_dir.mkdir(exist_ok=True)

    dest = assets_dir / safe_name
    size = 0
    try:
        with dest.open("wb") as out:
            while chunk := await file.read(UPLOAD_CHUNK_BYTES):
                size += len(chunk)
                if size > MAX_ASSET_BYTES:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(413, "File exceeds 10 MB limit.")
                out.write(chunk)
    finally:
        await file.close()

    if size == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, "Uploaded file is empty.")

    return {"ok": True, "filename": dest.name}


@router.get("/assets/list")
def list_assets(slot: str = Depends(require_session)):
    team, idx = slot.rsplit("-", 1)
    assets_dir = renderer.slot_dir(team, int(idx)) / "assets"
    if not assets_dir.exists():
        return {"files": []}
    files = [
        {"name": f.name, "size": f.stat().st_size}
        for f in sorted(assets_dir.iterdir())
        if f.is_file()
    ]
    return {"files": files}


@router.get("/assets/{filename}")
def get_asset(filename: str, request: Request, slot: str = Depends(require_session)):
    # Prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename.")
    team, idx = slot.rsplit("-", 1)
    path = renderer.slot_dir(team, int(idx)) / "assets" / filename
    if not path.exists():
        raise HTTPException(404, "Asset not found.")
    return media_file_response(request, path, "application/octet-stream", cache_public=True)


@router.delete("/assets/{filename}")
def delete_asset(filename: str, slot: str = Depends(require_session)):
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename.")
    team, idx = slot.rsplit("-", 1)
    path = renderer.slot_dir(team, int(idx)) / "assets" / filename
    if not path.exists():
        raise HTTPException(404, "Asset not found.")
    path.unlink()
    return {"ok": True}
