"""
vibeTouHou — FastAPI application entry point.

Run with:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

The built client (npm run build) is served statically from server/static/.
During development, run the Vite dev server separately (npm run dev in client/).
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.exception_handlers import http_exception_handler
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import FileResponse

from routers import auth, render, assets, patterns, scores_router, publish, gallery_router, history_router
from config import STATIC_DIR, DATA_DIR, ROOT_PATH, API_PREFIX

# ── Application ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="vibeTouHou",
    description="Competitive bullet-hell web platform",
    version="1.0.0",
    root_path=ROOT_PATH,
)

# ── API Routers ────────────────────────────────────────────────────────────────
app.include_router(auth.router,          prefix="/api", tags=["auth"])
app.include_router(render.router,        prefix="/api", tags=["render"])
app.include_router(assets.router,        prefix="/api", tags=["assets"])
app.include_router(history_router.router, prefix="/api", tags=["history"])
app.include_router(patterns.router,      prefix="/api", tags=["patterns"])
app.include_router(scores_router.router, prefix="/api", tags=["scores"])
app.include_router(publish.router,       prefix="/api", tags=["publish"])
app.include_router(gallery_router.router, prefix="/api", tags=["gallery"])


@app.get("/api/health")
def health():
    return {"ok": True}


@app.exception_handler(StarletteHTTPException)
async def spa_fallback(request, exc):
    if (
        exc.status_code == 404
        and request.method == "GET"
        and not request.url.path.startswith(API_PREFIX)
        and STATIC_DIR.joinpath("index.html").exists()
    ):
        return FileResponse(str(STATIC_DIR / "index.html"))
    return await http_exception_handler(request, exc)

# ── Static client (production build) ──────────────────────────────────────────
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

# ── Ensure data directory exists ───────────────────────────────────────────────
DATA_DIR.mkdir(parents=True, exist_ok=True)
