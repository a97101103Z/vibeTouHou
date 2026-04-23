from pathlib import Path

from fastapi import HTTPException, Request
from fastapi.responses import FileResponse, Response


def version_for(path: Path) -> str:
    stat = path.stat()
    return f"{stat.st_mtime_ns:x}-{stat.st_size:x}"


def media_file_response(
    request: Request,
    path: Path,
    media_type: str,
    *,
    filename: str | None = None,
    cache_public: bool = False,
) -> Response:
    if not path.exists() or not path.is_file():
        raise HTTPException(404, "File not found.")

    etag = version_for(path)
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers={"ETag": etag})

    headers = {
        "Accept-Ranges": "bytes",
        "ETag": etag,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": (
            "public, max-age=31536000, immutable"
            if cache_public
            else "private, max-age=0, must-revalidate"
        ),
    }
    return FileResponse(
        str(path),
        media_type=media_type,
        filename=filename,
        headers=headers,
    )
