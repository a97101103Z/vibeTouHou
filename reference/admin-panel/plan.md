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
- `remove()`: no change needed
- Add `update_last_seen(session_token: str)` → sets current timestamp
- `_save()`, `_load()`: persist new dict format

### scores_router.py changes
- Before returning leaderboard data, call `identity.update_last_seen()` with the current session

---

## Phase 2: Backend — Admin session on claim

**File:** `server/routers/auth.py`

### `/api/claim` change
- Before checking team tokens, check if `body.token.strip() == ADMIN_TOKEN`
- If admin: create an admin session with slot key `"admin"`, set session cookie
- Return `{"ok": True, "admin": True, "redirect": "/admin.html"}`
- No sessionStorage needed — cookie handles it

---

## Phase 3: Backend — `require_admin()` dependency

**Files:** `server/routers/__init__.py`, `server/routers/auth.py`, `server/routers/gallery_router.py`

### `__init__.py` — Add `require_admin()`
- Checks BOTH: `session` cookie (must be admin session) OR `admin_token` in request body
- Return the admin token string or raise 401

### `auth.py` — Refactor existing admin endpoints
- Replace manual `if admin_token != ADMIN_TOKEN` checks with `require_admin()` dependency
- Endpoints affected: `reset-slot`, `set-phase`, `reset-phase`

### `gallery_router.py` — Refactor admin endpoints
- Replace manual checks with `require_admin()` dependency
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
      "assets": ["sprite.png"],
      "scores": { "best_hits": 2, "infinite_time": null }
    }
  ],
  "gallery": [...],
  "leaderboard": { "red": {...}, "blue": {...} }
}
```

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
- `renderPhaseControl()`: current phase badge + toggle button + countdown input
- `renderSlotsTable()`: 24 rows with status icons and action buttons
- `renderGallery()`: gallery entry list with delete + "Add from slot" form
- Video player modal for test-playing

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
| `server/identity.py` | Session dict format, `update_last_seen()` |
| `server/routers/__init__.py` | `require_admin()` dependency |
| `server/routers/auth.py` | Admin claim, overview, slot-video; use `require_admin()` |
| `server/routers/scores_router.py` | Track `last_seen` on leaderboard poll |
| `server/routers/gallery_router.py` | Use `require_admin()` |
| `client/vite.config.js` | Multi-page entry config |
| `client/src/helpers/login.js` | Handle admin redirect |
| `client/admin.html` | NEW — admin page HTML |
| `client/src/admin/main.js` | NEW — admin entry point |
| `client/src/admin/api.js` | NEW — admin API helper |
| `client/src/admin/dashboard.js` | NEW — dashboard renderer |

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
