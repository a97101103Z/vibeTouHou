# Admin Panel — Implementation Plan

> **AI-generated implementation plan** — created by opencode agent for the `feat/admin-panel` branch.

## Requirements

1. Separate page from the main SPA using Vite's multi-page app config
2. Admin token entered in the login page → backend tells frontend to redirect (no separate check-admin-token endpoint)
3. Display: claimed slots, uploaded patterns/assets with statuses, online status (via leaderboard ping)
4. Toggle gauntlet mode with optional countdown time
5. Reset a slot's data
6. Test play a pattern and select it into the gallery

## Architecture Decisions

### Admin Auth: Dual authentication
- When admin token is entered in `/api/claim`, backend creates an admin session (with slot `"admin"`) and sets a session cookie
- Admin endpoints accept **either**: `session` cookie (admin session) OR `admin_token` in request body
- This keeps the video endpoint working with `<video>` tags (cookies sent automatically) while maintaining backward compatibility

### Online tracking: Leaderboard-only
- Only `GET /api/leaderboard` updates the `last_seen` timestamp (the client polls it every 5s)
- No need to instrument every authenticated endpoint — simpler change, reliable enough

---

## Phase 1: Backend — Leaderboard online tracking

**Files:** `server/identity.py`, `server/scores.py`, `server/routers/scores_router.py`

### identity.py changes
- Change `_sessions` from `dict[str, str]` to `dict[str, dict]`:
  - `session_token → {"slot": "red-1", "last_seen": float | None}`
- `_load()`: handle old format migration (string values → dict)
- `get_slot()`: extract slot string from both old (str) and new (dict) formats
- `claim()`: store dict with `last_seen` = `None`
- `remove()`: no change needed (still checks admin_token internally)
- Add `update_last_seen(session_token: str)` → sets current timestamp (in-memory only, no disk write)
- Add `create_admin_session()` → creates session with slot `"admin"`, no _claimed entry
- Add `is_claimed(slot_key)` and `get_last_seen(slot_key)` for admin overview
- `_save()`, `_load()`: persist new dict format

### scores_router.py changes
- Import `identity`, accept `session: str | None = Cookie(default=None)` in leaderboard endpoint
- Before returning, call `identity.update_last_seen(session)`

---

## Phase 2: Backend — Admin session on claim

**File:** `server/routers/auth.py`

### `/api/claim` change
- Before checking team tokens, check if `body.token.strip() == ADMIN_TOKEN`
- If admin: create an admin session via `identity.create_admin_session()`, set session cookie
- Return `{"ok": True, "admin": True, "redirect": "/admin.html"}`
- The admin frontend also stores the raw token in `sessionStorage` so subsequent POST requests can include `admin_token` in their JSON bodies (backward compat with existing library auth checks)

---

## Phase 3: Backend — `resolve_admin_token()` helper (dual auth)

**Files:** `server/routers/__init__.py`, `server/routers/auth.py`, `server/routers/gallery_router.py`

**Design note:** FastAPI's `Depends` pattern doesn't handle dual auth (cookie + body) cleanly for POST endpoints where Pydantic models parse the body separately. Instead of a Depends-based dependency, we use inline utility functions called at the top of each endpoint body.

### `__init__.py` — Add `verify_admin()` and `resolve_admin_token()`
- `verify_admin(session_token, body_admin_token)` → `bool`: returns `True` if either auth method succeeds
- `resolve_admin_token(session_token, body_admin_token)` → `str | None`: returns the canonical `ADMIN_TOKEN` if cookie auth succeeds, or the body token if it matches `ADMIN_TOKEN`, or `None` if both fail
- Cookie auth: checks `identity.get_slot(session) == "admin"`
- Body auth: checks `body_token == ADMIN_TOKEN`

### `auth.py` — Refactor existing admin endpoints
- Replace manual `if admin_token != ADMIN_TOKEN` checks with `resolve_admin_token()` at the top of each endpoint
- `effective_token = resolve_admin_token(session, body.admin_token)` then `if effective_token is None: raise 401`
- Pass `effective_token` (not raw body token) to library functions so their internal checks pass
- Endpoints affected: `reset-slot`, `set-phase`, `reset-phase`
- `SetPhaseBody` gets new field: `grace_seconds: int = 60`

### `gallery_router.py` — Refactor admin endpoints
- Same pattern: `resolve_admin_token()` at entry, pass `effective_token` to `gallery_store` functions
- Endpoints affected: `add_gallery_entry`, `delete_gallery_entry`

---

## Phase 4: Backend — Admin overview + slot-video endpoints

**File:** `server/routers/auth.py`

### `POST /api/admin/overview` (new)
Requires admin auth. Returns:
```json
{
  "phase": { "phase": "code", "active_at": null },
  "slots": [
    {
      "team": "red", "index": 1,
      "claimed": true, "slot_key": "red-1",
      "last_seen": 1719000000.0,
      "online": true,
      "has_published": true,
      "has_output": true,
      "asset_count": 3,
      "assets": ["sprite.png"]
    }
  ],
  "gallery": [...],
  "leaderboard": { "red": {...}, "blue": {...} }
}
```
Note: `leaderboard` is returned at the top level (not per-slot). The frontend joins them client-side.

Online status: `last_seen` within 30 seconds → online.

### `GET /api/admin/slot-video/{team}/{index}` (new)
Requires admin auth (cookie-based). Streams `data/{team}/{index}/output.mp4`.

---

## Phase 5: Frontend — Vite multi-page + admin.html

**Files:** `client/vite.config.js`, new `client/admin.html`, new `client/src/admin/*.js`

### vite.config.js
- Add `rollupOptions.input` with `main: index.html` and `admin: admin.html`
- Use `resolve(__dirname, ...)` for paths

### admin.html
- Separate HTML with login overlay (admin token input)
- Links to same `/src/style.css`
- Script entry: `/src/admin/main.js`
- Dashboard layout containers (no hardcoded dashboard HTML — rendered by JS)

### JS module structure
```
client/src/admin/
├── main.js            → entry: login check → fetch overview → render dashboard
├── api.js             → adminApi helper object (overview, setPhase, resetSlot, gallery, etc.)
└── dashboard.js       → renderOverview(), renderSlotsTable(), renderPhaseControl(), renderGallery()
```

---

## Phase 6: Frontend — Login admin redirect + admin dashboard

**Files:** `client/src/helpers/login.js`, new admin JS files

### login.js changes
- After `POST /api/claim`, check for `admin: true` in response
- If admin: `window.location.href = "/admin.html"` (cookie is already set)
- Regular team token flow unchanged

### admin/main.js
1. Check session via `GET /api/me`
2. If slot is `"admin"` → proceed to dashboard
3. If no session → show admin token login form
4. On admin token submit → `POST /api/claim` → if ok, reload page (now with cookie)
5. Start polling `/api/admin/overview` every 5s
6. Render dashboard

### admin/dashboard.js
- `renderPhase(snapshot)`: current phase badge + countdown timer if grace period active
- `renderStats(slots, leaderboard)`: 4-stat card (total, claimed, online, published)
- `renderSlotsTable(slots)`: 24 rows with status icons, reset button, watch button
- `renderGallery(entries)`: gallery entry list with delete buttons
- `setupPhaseControl()`: wire phase-select + grace-seconds input + apply button → `adminApi.setPhase()`
- `setupGalleryAdd()`: wire team/index/title/avg-hits form + add button → `adminApi.addGalleryEntry()`
- `openVideoPlayer(team, index)`: modal with `<video>` element sourcing from cookie-authed `/api/admin/slot-video/{team}/{index}`
- `startPolling() / stopPolling()`: polls `/api/admin/overview` every 5s

### admin/api.js
- `fetchOverview(adminToken)` → `POST /api/admin/overview`
- `setPhase(adminToken, phase, graceSeconds?)` → `POST /api/admin/set-phase`
- `resetSlot(adminToken, team, index)` → `POST /api/admin/reset-slot`
- `addGalleryEntry(adminToken, ...)` → `POST /api/admin/gallery`
- `deleteGalleryEntry(adminToken, id)` → `DELETE /api/admin/gallery`

---

## Files Changed/Created Summary

| File | Change |
|------|--------|
| `server/identity.py` | Session dict format, `create_admin_session()`, `update_last_seen()`, `is_claimed()`, `get_last_seen()` |
| `server/routers/__init__.py` | `verify_admin()`, `resolve_admin_token()` helpers |
| `server/routers/auth.py` | Admin claim detection, overview, slot-video; refactored admin endpoints with `resolve_admin_token()` |
| `server/routers/scores_router.py` | Track `last_seen` on leaderboard poll |
| `server/routers/gallery_router.py` | Refactored admin endpoints with `resolve_admin_token()` |
| `client/vite.config.js` | Multi-page entry config (`rollupOptions.input`) |
| `client/src/helpers/login.js` | Handle admin redirect, store token in sessionStorage |
| `client/admin.html` | NEW — admin page HTML + dashboard containers |
| `client/src/admin/main.js` | NEW — admin entry point: login check → dashboard |
| `client/src/admin/api.js` | NEW — admin API helper (cookie + body auth) |
| `client/src/admin/dashboard.js` | NEW — full dashboard renderer + event wiring |

## Verification

- `npm run build` succeeds with both HTML entry points
- `POST /api/claim` with admin token returns `{admin: true}` + sets cookie
- `GET /api/me` after admin login returns `{slot: "admin"}`
- `POST /api/admin/overview` returns full slot snapshot
- Leaderboard endpoint updates `last_seen` for requesting session
- Admin dashboard shows online status correctly (green/gray dots)
- Phase toggle with custom countdown works
- Slot reset triggers data deletion
- Slot video plays in admin panel (cookie auth works with `<video>`)
- Gallery add/delete works from admin panel
- Old `admin_token`-in-body still works for all admin endpoints
