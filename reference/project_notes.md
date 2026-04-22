# vibeTouHou — Project Notes
_Last updated: 2026-04-22_

---

## What Is This?

A **competitive Bullet Hell (彈幕) web platform** designed as an AI club activity ("vibecoding").  
Two teams of ~12 compete by **AI-generating bullet patterns** in Python and dodging each other's patterns in a browser.

The project is transitioning from a **local Pygame prototype** (in `reference/old/`) to a **full web application** (`client/` + `server/`).

---

## Repository Layout

```
vibeTouHou/
├── client/                    # Frontend (EMPTY — to be built)
├── server/                    # Backend  (EMPTY — to be built)
└── reference/
    ├── vibecode彈幕遊戲_AI組活動提案.md   ← Official activity proposal / game spec
    ├── project_notes.md                   ← This file
    └── old/
        ├── reference/
        │   ├── architecture.md            ← Pattern authoring guide
        │   └── game_rules.md              ← 1v1 metagame loop rules
        └── game/                          ← Pygame prototype (reference impl)
            ├── config.py
            ├── engine.py
            ├── entities.py
            ├── pattern_base.py
            ├── game.py
            ├── test_pattern.py
            ├── patterns/                  ← In-progress (untested) patterns
            └── tested_patterns/           ← Conquered patterns (permanent pool)
```

---

## The New Web Game Spec

### Canvas / Rendering
- **800 × 600 px**, black background
- Patterns are **pre-rendered 10-second MP4 videos** (not live simulation)
- Collision is **pixel-brightness based**: `Y = 0.299R + 0.587G + 0.114B > 128` = hit zone

### Competition Format
- 2 teams (~12 players each)
- Each team submits 12 bullet pattern videos
- Opponents must dodge all 12; best individual score (fewest hits) = team score
- Tiebreaker: **Infinite Mode** — survive random historical patterns until 3 hits

### Verify-to-Publish (Anti-cheat)
1. Creator writes Python script → server renders MP4
2. Creator must do a **flawless run in browser** (0 hits), with **trajectory recorded**
3. Server **re-validates** the trajectory against the stored video server-side
   → Prevents packet-manipulation (OWASP Juice Shop-style) cheating

### Victory Condition
- Fewest total hits across opponent's 12 patterns
- Tie → longer Infinite Mode survival

---

## Pygame Prototype — Key Architecture

### Core Classes (`reference/old/game/`)

| File | Purpose |
|---|---|
| `config.py` | Global constants (WIDTH=800, HEIGHT=600, FPS=60, PATTERN_DURATION=10s, MAX_HITS=3) |
| `engine.py` | `GameEngine` — main loop, collision detection, UI rendering |
| `entities.py` | `Player` + `Bullet` classes |
| `pattern_base.py` | `BasePattern` interface — `start()`, `update(engine, dt)`, `draw(surface)` |
| `game.py` | Arcade mode: 3 HP, survive 6 random `tested_patterns/` |
| `test_pattern.py` | Test harness: flawless (0 hits) → auto-promote to `tested_patterns/` |

### Pattern API (how patterns are written)
```python
from entities import Bullet
from pattern_base import BasePattern

class Pattern(BasePattern):
    def update(self, engine, dt):
        # engine.pattern_time  → seconds elapsed (0.0 – 10.0)
        # engine.bullets       → append Bullet() instances here
        engine.bullets.append(Bullet(x, y, vx, vy, radius=5, color=(255,100,100)))
```

### Player Mechanics
- Move: WASD or Arrow keys
- Focus/slow mode: hold Shift
- Hitbox: radius 8px (normal) / 14px (test mode)
- After a hit: 1s invincibility + 100ms red flash

### Promote Flow
```
patterns/ → (test_pattern.py flawless) → tested_patterns/ → (game.py arcade pool)
```

### Existing Example Patterns
- `example_rain.py` — simple vertical rain
- `example_spiral.py` — rotating spiral
- `pattern_convergence.py` — converging bullets
- `pattern_homing.py` — homing bullets
- `pattern_zigzag.py` — zigzag trajectory

---

## Web Build — What Needs to Be Built

### Server (`server/`)
- Accept Python script uploads from students
- Execute scripts in a **sandboxed environment** to render MP4 videos
- Store videos + player trajectory data
- **Backend re-validation** endpoint: replay trajectory against stored video, confirm no pixel collision
- Serve patterns list API for the competition frontend

### Client (`client/`)
- Browser game canvas (800×600) playing back the MP4 video as "bullets"
- Player dot that moves with WASD/Arrow keys
- Real-time pixel collision detection against video frames
- Trajectory recording during verify-to-publish
- Competition lobby UI (show opponent patterns, scores, leaderboard)

### Notes / Open Questions
- `Y > 128` threshold may be tuned post-launch (noted in proposal §六)
- Video compression (MP4/H264 encoding) may shift pixel colors slightly — check edge cases
- Server could be ws1 (cluster) or a classroom machine; keep setup portable
- Library whitelist for student scripts: Pygame, NumPy, Pillow (no arbitrary imports)

---

## Bonus Design Constraints

### 🎯 Test Mode Hitbox Difference
- During **verify-to-publish / test mode**, the player's hitbox is **intentionally slightly larger** than in actual gameplay.
- This gives the creator a bit of leeway to confirm the pattern is beatable — the real game uses a tighter hitbox.
- Prototype values: test radius = 14px, normal gameplay radius = 8px.

### 🐍 Beginner-Friendly Video Generation Scripts
- The Python scripts that generate bullet pattern videos should be **easy for beginners to read and modify**.
- **Avoid heavy OOP** — no need for a `Pattern` class hierarchy or engine coupling anymore.
- Scripts are **standalone**: they just produce a video file (`output.mp4`) and exit. No need to talk to any server or JS runtime.
- Recommended structure: a simple `for frame in range(total_frames):` loop that draws onto a canvas and writes frames.
- Students should be able to look at an example script and intuitively understand "draw stuff each frame, save video".
- Allowed libs: `pygame`, `numpy`, `Pillow` (imageio / cv2 for video export TBD).
- Example minimal skeleton:
  ```python
  import pygame, imageio, numpy as np

  WIDTH, HEIGHT = 800, 600
  FPS = 60
  DURATION = 10  # seconds

  frames = []
  surface = pygame.Surface((WIDTH, HEIGHT))

  for frame in range(FPS * DURATION):
      t = frame / FPS
      surface.fill((0, 0, 0))
      # --- draw your bullets here ---
      x = int(400 + math.cos(t * 2) * 200)
      y = int(300 + math.sin(t * 3) * 150)
      pygame.draw.circle(surface, (255, 255, 255), (x, y), 8)
      # ------------------------------
      frames.append(np.array(pygame.surfarray.array3d(surface)).transpose(1, 0, 2))

  imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None)
  ```

### 🐧 Server Must Run on Arch Linux
- The backend server should be deployable on **Arch Linux** (as well as other distros).
- Avoid Windows-only dependencies or hardcoded paths.
- Use standard Python packaging (`pyproject.toml` or `requirements.txt`).
- Sandboxed script execution should work in a headless environment (no display needed — use `pygame` with a virtual framebuffer or `imageio`/`Pillow` only).
- Consider `Xvfb` for headless Pygame rendering if needed.

### 🌐 Client = Just a Webpage (No Exposed Code, No Local Processing)
- The **client side is a pure web browser experience** — players just visit a URL on the local network.
- Players should **never see the JS source** or game logic (serve minified/bundled assets, or just don't expose source maps).
- **No video generation on the client** — all rendering happens server-side; the client only receives the pre-made MP4.
- The browser plays back the video and handles player movement + collision detection (pixel brightness check against video frames via Canvas API).
- Anyone who **signs up on the local network** can play — no installs, no Python, nothing beyond a browser.
- This means the server is the single point of truth for: video storage, trajectory validation, scores, and leaderboard.

---

## Website Structure — 4 Subpages

Styled similarly to OWASP Juice Shop: a single-page app with a persistent navbar/sidebar that switches between major sections. No full page reloads.

---

### 📝 Page 1 — Code Submission
**Purpose:** Students write or paste their Python bullet-generation script and submit it to the server for rendering.

- Text editor (e.g. CodeMirror) for writing/pasting Python
- "Render" button → sends script to server → server runs it in sandbox → produces MP4
- Shows render status (queued / running / done / error with stderr)
- On success, video thumbnail preview appears
- Pattern is saved as a **draft** (not yet published to the pattern pool)
- Links to Page 2 (asset management) and Page 3 (playtest) naturally from here

---

### 🖼️ Page 2 — Assets: Upload Image / Download Video
**Purpose:** Manage supporting files for the script, and retrieve the rendered output.

- **Upload:** Drag-and-drop or file picker to upload custom images (sprites, textures, masks) that scripts can reference
  - Uploaded images are stored server-side and addressable by filename within the sandbox
  - Shows a list/gallery of already-uploaded assets for the current user
- **Download:** Download the latest rendered MP4 video for the user's current pattern
  - Useful for local preview, sharing, or manual inspection
- No game logic here — purely asset I/O

---

### 🎮 Page 3 — Playtest (Verify-to-Publish)
**Purpose:** The creator plays through their own pattern to verify it is beatable before it goes live.

- Embeds the 800×600 game canvas playing back the user's **own** rendered MP4
- Player dot controlled by WASD / Arrow keys
- Real-time pixel-brightness collision detection via Canvas API (`Y > 128`)
- **Hitbox is slightly larger here** (test mode) to give the creator leeway — see hitbox note above
- Trajectory is silently recorded throughout
- On surviving 10 seconds with **0 hits** → "Publish" button unlocks
  - Clicking Publish sends the trajectory to the server for backend re-validation
  - If server confirms no collision → pattern is promoted to the published pool
  - If server rejects → error message, must retry
- Failed runs (hits taken) just reset; no penalty

---

### ⚔️ Page 4 — Competition Gauntlet
**Purpose:** The main competitive experience — survive the opponent team's published patterns.

- Shows the list of the opposing team's published patterns (up to 12)
- Player works through them one by one (or in random order, TBD)
- **Hitbox is the real (smaller) size** — no leeway here
- Tracks hits taken per pattern and accumulates total score
- After all patterns are attempted, shows the run summary (hits per pattern, total)
- Best run score (fewest hits) is recorded as the team's score for that player
- If the full set is cleared with 0 total hits → **Infinite Mode** unlocks:
  - Random patterns from the historical pool, survive until 3 hits total
  - Survival time is recorded as the tiebreaker score
- Leaderboard panel showing both teams' best scores in real time

---

## Team Identity System

### Identity Setup (Login / Session)
- On first visit, each client picks:
  - **Team color**: 🔴 Red or 🔵 Blue
  - **Team index**: their slot number within the team (e.g. 1–12)
- This combination (`color + index`) uniquely identifies a player, e.g. `red-7` or `blue-3`
- No passwords needed — identity is stored in a server-side session (cookie) after the player claims their slot
- Once a slot is claimed, no one else can pick `red-7` for the duration of the event
- The server associates all submitted scripts, rendered videos, and run results with this identity

### Ownership Rules (What Each Player Can Access)

| Action | Rule |
|---|---|
| Render script (Page 1) | Always renders **under your own identity** |
| Upload assets (Page 2) | Assets scoped to your own slot |
| Download video (Page 2) | Can only download **your own** rendered video |
| Playtest (Page 3) | Only loads **your own** draft video — cannot test another player's code |
| Publish (Page 3 → server) | Server checks session matches the video's owner before promoting |
| Gauntlet (Page 4) | Only shows **opponent team's** published patterns — you cannot run your own team's gauntlet |
| Submit score (Page 4) | Score is recorded under your identity; re-runs only update if the new score is better |

### Why This Matters (Anti-cheat)
- Prevents a player from playtesting a teammate's code and publishing it under a different slot
- Prevents a player from running the gauntlet for their **own** team's patterns (which they helped create)
- Combined with the backend trajectory re-validation, this closes the main cheating surfaces:
  1. ❌ Faking a "flawless" signal without actually playing
  2. ❌ Publishing someone else's pattern as your own
  3. ❌ Playing the wrong side's gauntlet to inflate team scores

### Notes
- "Claiming a slot" should be lightweight — a simple name + team + number form, no account system needed
- The server should display a "slot taken" error if someone tries to claim an already-used identity
- An admin/host override should exist to reset slots if someone picked wrong
