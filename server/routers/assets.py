"""
Asset management endpoints.

POST /api/assets/upload          → upload an image file to the user's assets/ dir
GET  /api/assets/list            → list uploaded assets
GET  /api/assets/{filename}      → serve an uploaded asset
"""

import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

import renderer
from routers import require_session

router = APIRouter()

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}
MAX_ASSET_BYTES = 10 * 1024 * 1024  # 10 MB per file


@router.post("/assets/upload")
async def upload_asset(
    file: UploadFile = File(...),
    slot: str = Depends(require_session),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"File type '{ext}' not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}")

    team, idx = slot.rsplit("-", 1)
    assets_dir = renderer.slot_dir(team, int(idx)) / "assets"
    assets_dir.mkdir(exist_ok=True)

    dest = assets_dir / Path(file.filename).name
    content = await file.read()
    if len(content) > MAX_ASSET_BYTES:
        raise HTTPException(413, "File exceeds 10 MB limit.")

    dest.write_bytes(content)
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
def get_asset(filename: str, slot: str = Depends(require_session)):
    # Prevent path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Invalid filename.")
    team, idx = slot.rsplit("-", 1)
    path = renderer.slot_dir(team, int(idx)) / "assets" / filename
    if not path.exists():
        raise HTTPException(404, "Asset not found.")
    return FileResponse(str(path))


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
