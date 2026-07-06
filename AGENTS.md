# vibeTouHou — Agent Guide

Competitive bullet-hell (danmaku) platform. Two teams (red/blue, 12 slots each) write Python scripts to generate bullet patterns, then play through each other's patterns in a gauntlet.

## Architecture

- **Backend**: FastAPI in `server/`. Student scripts run in Docker sandbox (`server/Dockerfile.sandbox` → image `vibetouhou-sandbox`). Subprocess fallback if Docker unavailable.
- **Frontend**: Vanilla JS SPA in `client/`, built with Vite. Build output goes to `server/static/`. Vite dev server proxies `/api` to FastAPI at `127.0.0.1:8000`.
- **Data**: `data/` — per-slot dirs, sessions.json, scores.json, phase.json. `DATA_DIR` is at project root (one level above `server/`) so uvicorn `--reload` doesn't restart mid-render.
- **Deploy**: Docker Compose. Sandbox containers are Docker siblings via mounted `/var/run/docker.sock`.

## Key Commands

| What                | Command                                                            | Dir       |
| ------------------- | ------------------------------------------------------------------ | --------- |
| Start server        | `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`             | `server/` |
| Start client dev    | `npm run dev`                                                      | `client/` |
| Build client        | `npm run build`                                                    | `client/` |
| Run backend tests   | `pytest -q`                                                        | repo root |
| Run frontend tests  | `npm run test`                                                     | `client/` |
| Build sandbox image | `docker build -f Dockerfile.sandbox -t vibetouhou-sandbox .`       | `server/` |
| Start stack         | `docker compose up -d`                                             | repo root |
| Full CI             | `pytest -q` (backend) + `npm run test && npm run build` (frontend) | —         |

## Quirks & Constraints

- **Anti-cheat**: Server re-validates trajectory frame-by-frame against MP4 on publish and score submission.
- **Phase lock**: Players can only use `/api/render` and `/api/publish` during `code` phase. Score sumission is only opened during `gauntlet` phase.
- **Tokens**: `RED_TEAM_TOKEN`, `BLUE_TEAM_TOKEN`, `ADMIN_TOKEN` (env vars) must be unique and non-empty. Insecure defaults warn but work in dev. `ADMIN_TOKEN` can be used as claim body (creates an admin session) or via session cookie.
- **Render security**: Sandbox has no network, 1 GB RAM, 2 CPU, 64 PID limit. Scripts cannot access `published.mp4`.
- **Scores**: Fewer hits wins. Verified server-side by replaying trajectories against MP4s.
- **Config**: All tunables in `server/config.py` — canvas size, hitboxes (playtest vs real), speed limits, brightness threshold, allowed imports, worker count.
- **CI**: GitHub Actions on push/PR to `main`. No linter/formatter/typecheck configured.
