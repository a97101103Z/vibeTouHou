# Admin Panel — Implementation

> Current state of the admin panel feature on the `feat/admin-panel` branch. **NOTE:** AI-generated.

## Architecture

### Authentication
- Admin token entered in `/api/claim` → backend creates an admin session (slot `"admin"`) + sets session cookie
- Client authenticates all requests via the session cookie only (no `admin_token` stored or sent)
- Server still accepts either cookie or `admin_token` in body (`resolve_admin_token()` helper in `routers/__init__.py`) for backward compatibility
- Cookie auth exists so `<video>` elements and the embedded game engine can fetch video without JS

### Online Tracking
- Only `GET /api/leaderboard` updates `last_seen` timestamp (polled every 5s by the client)
- Not every authenticated endpoint — simpler, reliable enough
- Online threshold: `now - last_seen < 30` seconds

### Multi-Page Build
- Vite `rollupOptions.input` has two entries: `main: index.html` and `admin: admin.html`
- Admin page is a completely separate HTML file at `/admin.html`

---

## Frontend Files

### `client/admin.html`
- Separate HTML page with login overlay (admin token input) and dashboard layout
- Links `src/style.css` (shared with main SPA) and `src/admin/style.css` (overrides)
- Dashboard containers: overview cards, slots table + gallery in a `.main-panels` two-column grid
- **Video Modal** (`#video-modal`): `<video>` element for the "Watch" action
- **Game Modal** (`#game-modal`): `<canvas>` + `.canvas-hud` + `.canvas-overlay` for the "Play" action (embeds the game engine)

### `client/src/admin/main.js`
1. Check session via `GET /api/me`
2. If slot is `"admin"` → show dashboard (render + start polling)
3. If no session → show login overlay
4. On admin token submit → `POST /api/claim` → if ok, reload page (cookie now set)
5. Polls `/api/admin/overview` every 5s

### `client/src/admin/api.js`
| Method | API call |
|--------|----------|
| `me()` | `GET /api/me` |
| `claim(token)` | `POST /api/claim` |
| `overview()` | `POST /api/admin/overview` |
| `setPhase(phase, graceSeconds)` | `POST /api/admin/set-phase` |
| `resetSlot(team, index)` | `POST /api/admin/reset-slot` |
| `addGalleryEntry(title, avgHits, team, index)` | `POST /api/admin/gallery` |
| `deleteGalleryEntry(id)` | `DELETE /api/admin/gallery` |
| `slotVideoUrl(team, index)` | constructs `/api/admin/slot-video/{team}/{index}` |

All requests include `credentials: "include"`. POST/PUT/DELETE also inject `admin_token` from `sessionStorage`.

### `client/src/admin/dashboard.js`
**Renders:**
- **Phase**: current phase badge (CODE/GAUNTLET) + grace countdown
- **Stats**: 4-stat grid (total slots, claimed, online, published)
- **Slots Table**: 24 rows with status icons + per-row actions:
  - **Watch** — opens video modal with autoplay
  - **Play** — opens game modal, runs engine with `playerRadius: 8` (`REAL_RADIUS`)
  - **+Gallery** — prompts for a name, calls `addGalleryEntry` with `avg_hits: 0`
  - **Reset** — confirm dialog then calls `resetSlot`
- **Gallery**: list of entries with:
  - **Watch** — opens video modal with autoplay
  - **Play** — opens game modal, runs engine with real settings
  - **Delete** — confirm dialog then calls `deleteGalleryEntry`

**Key functions:**
- `openVideoPlayer(url, autoplay)` — modal with `<video>` element
- `launchEngine(url, label)` — embeds `GameEngine` directly (imported from `../game/engine.js`):
  - Shows a "Ready" overlay with Play/Cancel
  - 3-second countdown
  - Runs engine at `playerRadius: 8` with trajectory recording
  - On finish: shows hits result with Replay/Close
  - On error: shows close button
- `startPolling() / stopPolling()` — polls overview every 5s

### `client/src/admin/style.css`
- Scroll override: `html:has(body.admin-body), body.admin-body { overflow: auto }`
- `.main-panels`: grid layout (slots left, gallery right) on desktop, single column on narrow
- `.btn-admin.play`: green-tinted variant
- `.gallery-entry-row`: vertical flex (actions below title/hits)
- `.game-modal`: full-screen overlay with centered canvas
- `.grace-input`: width for the grace-seconds field
- `.table-wrap`: horizontal scroll for the slots table

---

## Backend Files

### `server/identity.py`
- `_sessions`: `dict[str, dict]` — `session_token → {"slot": str, "last_seen": float | None}`
- `_load()`: migrates old string-format sessions to dict format
- `claim()`: stores with `last_seen = None`
- `update_last_seen(session)`: sets current timestamp (in-memory only)
- `create_admin_session()`: creates session with slot `"admin"`, skips `_claimed` entry
- `is_claimed(slot_key)`, `get_last_seen(slot_key)`: for admin overview

### `server/routers/__init__.py`
- `require_session(session)` → `str`: FastAPI dependency, returns slot key or 401
- `verify_admin(session, body_token)` → `bool`: checks cookie OR body auth
- `resolve_admin_token(session, body_token)` → `str | None`: returns canonical `ADMIN_TOKEN` or None

### `server/routers/auth.py`
- **`POST /api/claim`**: detects `ADMIN_TOKEN` → calls `create_admin_session()`, returns `{admin: true, redirect: "/admin.html"}`
- **`POST /api/admin/overview`**: returns full snapshot (phase, slots, gallery, leaderboard)
- **`GET /api/admin/slot-video/{team}/{index}`**: streams `output.mp4` for any slot (admin only)
- **`POST /api/admin/set-phase`**: sets phase with optional `grace_seconds`
- **`POST /api/admin/reset-slot`**: deletes all data for a slot
- All endpoints call `resolve_admin_token()` at entry; pass `effective_token` downstream

### `server/routers/scores_router.py`
- `GET /api/leaderboard`: accepts `session` cookie, calls `identity.update_last_seen(session)` before returning

### `server/routers/gallery_router.py`
- **`POST /api/admin/gallery`**: copy a slot's `output.mp4` into gallery storage
- **`DELETE /api/admin/gallery`**: remove entry by id
- **`GET /api/gallery`**: list entries (public)
- **`GET /api/gallery/{id}/video`**: stream video (public)
- Admin endpoints guard with `resolve_admin_token()`

### `server/gallery.py`
- Storage: `gallery/index.json` + `gallery/{id}.mp4`
- Entry schema: `{id, title, avg_hits, filename}`
- `add_entry_from_slot()`: copies `data/{team}/{index}/output.mp4` into gallery

---

## Files Summary

| File | Status | Purpose |
|------|--------|---------|
| `server/identity.py` | modified | Session dict format, admin session, online tracking |
| `server/routers/__init__.py` | modified | `verify_admin()`, `resolve_admin_token()` helpers |
| `server/routers/auth.py` | modified | Admin claim, overview, slot-video; refactored admin endpoints |
| `server/routers/scores_router.py` | modified | `last_seen` update on leaderboard poll |
| `server/routers/gallery_router.py` | modified | Admin gallery CRUD with dual auth |
| `server/gallery.py` | modified | `add_entry_from_slot()` for video copying |
| `server/phase.py` | modified | `set_phase()` accepts `grace_seconds` |
| `client/vite.config.js` | modified | Multi-page entry config |
| `client/src/helpers/login.js` | modified | Admin redirect on `{admin: true}` |
| `client/admin.html` | **new** | Admin page HTML |
| `client/src/admin/main.js` | **new** | Entry point: login → dashboard |
| `client/src/admin/api.js` | **new** | API helpers |
| `client/src/admin/dashboard.js` | **new** | Full renderer + event wiring + game engine embed |
| `client/src/admin/style.css` | **new** | Admin-specific CSS |
| `reference/admin-panel/plan.md` | archived | Original implementation plan (superseded) |

## Known Gaps
- `avg_hits` is passed as `0` from the frontend (no auto-calculation endpoint yet)
- Gallery entries don't store team/index, so there's no link back to the source slot
- The game engine modal lacks focus-mode controls hint (SHIFT = focus)
