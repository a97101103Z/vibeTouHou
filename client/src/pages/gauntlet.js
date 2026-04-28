/**
 * gauntlet.js — Page 4: Competition Gauntlet.
 *
 * The player faces the opponent team's published patterns one by one
 * with the real (smaller) hitbox. Tracks cumulative hits.
 * Perfect run → Infinite Mode. Submits best score to server.
 *
 * Flow:
 *  - Patterns play back-to-back with no stop button in between.
 *  - Player position is carried over from one pattern to the next.
 *  - A ~750 ms full-black grace period separates patterns.
 *  - Pressing R resets to the very start of the gauntlet.
 *  - Navigating away while playing counts as a forfeit (engine stops).
 */

import { GameEngine, WIDTH, HEIGHT } from '../game/engine.js';
import { toast } from '../main.js';

const REAL_RADIUS  = 8;
const INFINITE_MAX_HITS = 3;
const GRACE_MS     = 750;   // black screen between patterns

let engine        = null;
let patterns      = [];
let currentIdx    = 0;
let totalHits     = 0;
let hitsPerPattern = [];
let phase         = 'menu';  // 'menu' | 'playing' | 'summary' | 'infinite'
let infiniteHits  = 0;
let infiniteTime  = 0;
let lbPollTimer   = null;
let hudRafId      = null;
let graceRafId    = null;  // tracks grace period rAF inside the engine

export async function initGauntlet(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">⚔️ Gauntlet</h1>
      <p class="page-subtitle">Face <em>every</em> pattern published by the opposing team. Real hitbox. No mercy.</p>
    </div>

    <div class="row" style="gap:24px;align-items:flex-start">

      <!-- Canvas col -->
      <div class="col">
        <div class="canvas-wrap">
          <canvas id="game-canvas" width="800" height="600"></canvas>
          <div class="canvas-hud">
            <span id="hud-pattern">— / —</span>
            <span id="hud-time">10.0s</span>
            <span id="hud-hits">Hits: 0</span>
          </div>
          <div id="canvas-overlay" class="canvas-overlay">
            <h2 id="ov-title">⚔️ Gauntlet</h2>
            <p id="ov-sub">Loading opponent patterns…</p>
            <button id="btn-start-gauntlet" class="btn btn-primary" style="display:none">▶ Begin Gauntlet</button>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div style="width:260px;flex-shrink:0" class="col">

        <!-- Pattern list -->
        <div class="card col" style="max-height:280px;overflow-y:auto">
          <div class="card-title">Opponent Patterns</div>
          <div id="pattern-list" class="pattern-list">
            <div style="color:var(--text-muted);font-size:0.82rem">Loading…</div>
          </div>
        </div>

        <!-- Run summary -->
        <div id="summary-card" class="card col" style="display:none">
          <div class="card-title">Run Summary</div>
          <div id="summary-body" style="font-size:0.82rem;color:var(--text-dim)"></div>
        </div>

        <!-- Leaderboard -->
        <div class="card col">
          <div class="row center">
            <div class="card-title" style="margin:0">Leaderboard</div>
          </div>
          <div id="leaderboard" class="leaderboard" style="margin-top:8px">
            <div style="color:var(--text-muted);font-size:0.78rem">Loading…</div>
          </div>
        </div>

      </div>
    </div>
  `;

  // ── Forfeit when navigating away while playing ────────────────────────────
  new MutationObserver(() => {
    if (!container.classList.contains('active') && phase === 'playing') {
      forfeit();
    }
  }).observe(container, { attributes: true, attributeFilter: ['class'] });

  await loadPatterns();
  startLeaderboardPoll();
}

// ── Pattern loading ────────────────────────────────────────────────────────────

async function loadPatterns() {
  const listEl = document.getElementById('pattern-list');
  const ovSub  = document.getElementById('ov-sub');
  const btnGo  = document.getElementById('btn-start-gauntlet');

  try {
    const res  = await fetch('/api/patterns/opponent', { credentials: 'include' });
    const data = await res.json();
    patterns   = data.patterns;

    if (!patterns.length) {
      listEl.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem">No published patterns yet from the opposing team.</div>';
      document.getElementById('ov-title').textContent = '⏳ Waiting…';
      ovSub.textContent = 'The opposing team has not published any patterns yet.';
      return;
    }

    renderPatternList();
    ovSub.textContent = `${patterns.length} pattern${patterns.length > 1 ? 's' : ''} loaded. Ready to run the gauntlet?`;
    btnGo.style.display = '';
    btnGo.addEventListener('click', beginGauntlet);
  } catch (_) {
    listEl.innerHTML = '<div style="color:var(--red);font-size:0.82rem">Could not load patterns.</div>';
    ovSub.textContent = 'Network error. Try refreshing the page.';
  }
}

function renderPatternList() {
  const listEl = document.getElementById('pattern-list');
  listEl.innerHTML = '';
  patterns.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'pattern-item';
    item.id = `pi-${i}`;
    item.innerHTML = `
      <span class="pi-idx">#${i + 1}</span>
      <span>${p.slot}</span>
      <span class="pi-hits">—</span>
    `;
    listEl.appendChild(item);
  });
}

// ── Gauntlet flow ─────────────────────────────────────────────────────────────

function beginGauntlet() {
  currentIdx     = 0;
  totalHits      = 0;
  hitsPerPattern = new Array(patterns.length).fill(null);
  phase          = 'playing';
  document.getElementById('summary-card').style.display = 'none';
  document.getElementById('hud-hits').textContent = 'Hits: 0';
  renderPatternList();  // reset any done/active styling
  playPattern(0, null);
}

/**
 * @param {number}      idx
 * @param {{x,y}|null}  initialPlayer  – pass saved position to keep player where they were
 */
function playPattern(idx, initialPlayer) {
  const p = patterns[idx];
  if (!p) { endGauntlet(); return; }

  // Highlight active pattern in list
  document.querySelectorAll('.pattern-item').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });

  document.getElementById('hud-pattern').textContent = `${idx + 1} / ${patterns.length}`;
  document.getElementById('canvas-overlay').style.display = 'none';

  if (engine) engine.stop();
  if (hudRafId) { cancelAnimationFrame(hudRafId); hudRafId = null; }

  engine = new GameEngine(
    document.getElementById('game-canvas'),
    p.video_url,
    { playerRadius: REAL_RADIUS, recordTrajectory: false, initialPlayer }
  );

  engine.addEventListener('hit', e => {
    document.getElementById('hud-hits').textContent = `Hits: ${e.detail.hits}`;
  });

  engine.addEventListener('finish', async e => {
    if (phase !== 'playing') return;

    const { hits } = e.detail;
    hitsPerPattern[idx] = hits;
    totalHits += hits;

    // Mark pattern item as done
    const pi = document.getElementById(`pi-${idx}`);
    if (pi) {
      pi.classList.remove('active');
      pi.classList.add('done');
      pi.querySelector('.pi-hits').textContent = hits === 0 ? '✓' : `${hits} hit${hits > 1 ? 's' : ''}`;
    }

    // Grace period — player stays live, can reposition on black canvas
    await engine.runGrace(GRACE_MS);

    if (phase !== 'playing') return;   // forfeit or restart fired during grace
    const savedPlayer = { x: engine.player.x, y: engine.player.y };
    const isLast = idx === patterns.length - 1;
    if (isLast) endGauntlet();
    else playPattern(idx + 1, savedPlayer);
  });

  // R always restarts the full gauntlet from the top
  engine.addEventListener('restart', () => {
    if (phase === 'playing') beginGauntlet();
  });

  engine.addEventListener('videoerror', () => {
    showCanvasOverlay('Playback stopped', 'The video stalled before the pattern ended.', 'Retry Pattern', () => {
      playPattern(idx, initialPlayer);
    });
  });

  engine.start().catch(() => {
    showCanvasOverlay('Error', "Could not load this pattern's video.", 'Skip', () => {
      hitsPerPattern[idx] = 99;
      playPattern(idx + 1, initialPlayer);
    });
  });

  // HUD timer — runs until cancelled externally (next playPattern or forfeit)
  const hudTime = document.getElementById('hud-time');
  function tick() {
    hudTime.textContent = Math.max(0, 10 - (engine?.video?.currentTime ?? 0)).toFixed(1) + 's';
    hudRafId = requestAnimationFrame(tick);
  }
  hudRafId = requestAnimationFrame(tick);
}

function forfeit() {
  // Player left the page mid-run — stop everything silently
  if (engine) { engine.stop(); engine = null; }
  if (hudRafId) { cancelAnimationFrame(hudRafId); hudRafId = null; }
  phase = 'menu';
  // Re-show the start overlay next time they come back
  const ov = document.getElementById('canvas-overlay');
  if (ov) {
    ov.style.display = '';
    const title = document.getElementById('ov-title');
    const sub   = document.getElementById('ov-sub');
    if (title) title.textContent = '⚔️ Gauntlet';
    if (sub)   sub.textContent   = 'Run forfeited. Ready to try again?';
  }
}

function showCanvasOverlay(title, sub, btnTxt, onBtn) {
  const ov = document.getElementById('canvas-overlay');
  ov.style.display = '';
  ov.innerHTML = `
    <h2>${title}</h2><p>${sub}</p>
    <button class="btn btn-primary" id="btn-ov-action">${btnTxt}</button>
  `;
  document.getElementById('btn-ov-action').addEventListener('click', onBtn);
}

async function endGauntlet() {
  phase = 'summary';
  if (engine) engine.stop();

  // Render summary
  const summaryCard = document.getElementById('summary-card');
  const summaryBody = document.getElementById('summary-body');
  summaryCard.style.display = '';
  summaryBody.innerHTML = hitsPerPattern.map((h, i) =>
    `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)">
      <span>#${i + 1} ${patterns[i].slot}</span>
      <span style="color:${h === 0 ? '#50ff8c' : 'var(--red)'}">${h === 0 ? '✓' : h + 'h'}</span>
    </div>`
  ).join('') + `
    <div style="margin-top:10px;font-family:var(--font-ui);font-size:0.75rem;color:var(--text)">
      Total: <strong>${totalHits} hit${totalHits !== 1 ? 's' : ''}</strong>
    </div>
  `;

  // Submit score
  await fetch('/api/score', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hits: totalHits, infinite_time: null }),
  }).catch(() => {});

  toast(`Run complete! ${totalHits} total hit${totalHits !== 1 ? 's' : ''}.`, totalHits === 0 ? 'success' : '');

  if (totalHits === 0) {
    // Unlock Infinite Mode
    showCanvasOverlay(
      '🎉 Perfect Gauntlet!',
      'You took 0 hits across all patterns. Enter Infinite Mode?',
      '♾ Infinite Mode',
      beginInfinite
    );
  } else {
    showCanvasOverlay(
      `${totalHits} Hit${totalHits !== 1 ? 's' : ''} Total`,
      'Run the gauntlet again to improve your score.',
      '↩ Run Again',
      beginGauntlet
    );
  }
}

// ── Infinite Mode ─────────────────────────────────────────────────────────────

function beginInfinite() {
  phase        = 'infinite';
  infiniteHits = 0;
  infiniteTime = 0;
  currentIdx   = 0;

  const shuffled = [...patterns].sort(() => Math.random() - 0.5);
  document.getElementById('canvas-overlay').style.display = 'none';
  document.getElementById('hud-hits').textContent = `HP: ${INFINITE_MAX_HITS} / ${INFINITE_MAX_HITS}`;

  playInfinitePattern(shuffled, 0, null);
}

function playInfinitePattern(queue, qi, initialPlayer) {
  if (infiniteHits >= INFINITE_MAX_HITS) {
    endInfinite();
    return;
  }

  const p = queue[qi % queue.length];
  if (engine) engine.stop();
  if (hudRafId) { cancelAnimationFrame(hudRafId); hudRafId = null; }

  engine = new GameEngine(
    document.getElementById('game-canvas'),
    p.video_url,
    { playerRadius: REAL_RADIUS, initialPlayer }
  );

  engine.addEventListener('hit', e => {
    infiniteHits++;
    document.getElementById('hud-hits').textContent =
      `HP: ${Math.max(0, INFINITE_MAX_HITS - infiniteHits)} / ${INFINITE_MAX_HITS}`;
    if (infiniteHits >= INFINITE_MAX_HITS) {
      engine.stop();
      endInfinite();
    }
  });

  engine.addEventListener('finish', async () => {
    if (phase !== 'infinite') return;
    infiniteTime += 10;
    const savedPlayer = { x: engine.player.x, y: engine.player.y };
    await engine.runGrace(GRACE_MS);
    if (phase !== 'infinite') return;
    playInfinitePattern(queue, qi + 1, savedPlayer);
  });

  engine.addEventListener('restart', () => {
    if (phase === 'infinite') beginInfinite();
  });
  engine.addEventListener('videoerror', () => playInfinitePattern(queue, qi, initialPlayer));

  engine.start().catch(() => playInfinitePattern(queue, qi + 1, initialPlayer));
}

async function endInfinite() {
  phase = 'summary';
  if (engine) engine.stop();

  toast(`Infinite Mode: survived ${infiniteTime.toFixed(1)}s!`, 'success');

  // Update score with infinite time
  await fetch('/api/score', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hits: 0, infinite_time: infiniteTime }),
  }).catch(() => {});

  showCanvasOverlay(
    `♾ ${infiniteTime.toFixed(1)}s Survived`,
    'Infinite Mode complete. Your score has been recorded.',
    '↩ Run Again',
    beginGauntlet
  );
}

// ── Leaderboard ────────────────────────────────────────────────────────────────

function startLeaderboardPoll() {
  if (lbPollTimer) clearInterval(lbPollTimer);
  updateLeaderboard();
  lbPollTimer = setInterval(updateLeaderboard, 5000);
}

async function updateLeaderboard() {
  try {
    const res  = await fetch('/api/leaderboard', { credentials: 'include' });
    const data = await res.json();
    renderLeaderboard(data);
  } catch(_) {}
}

function renderLeaderboard(data) {
  const el = document.getElementById('leaderboard');
  if (!el) return;

  const rows = [];
  for (const team of ['red', 'blue']) {
    const slots = data[team] || {};
    for (const [idx, score] of Object.entries(slots)) {
      rows.push({ team, idx: parseInt(idx), score });
    }
  }

  // Sort: fewer hits wins; same hits → more infinite time wins
  rows.sort((a, b) => {
    const ah = a.score.best_hits ?? Infinity;
    const bh = b.score.best_hits ?? Infinity;
    if (ah !== bh) return ah - bh;
    return (b.score.infinite_time ?? -1) - (a.score.infinite_time ?? -1);
  });

  el.innerHTML = rows.length
    ? rows.map(r => {
        const h  = r.score.best_hits;
        const it = r.score.infinite_time;
        const scoreStr = h == null
          ? '—'
          : h === 0 && it != null
            ? `Perfect + ${it.toFixed(0)}s∞`
            : `${h} hit${h !== 1 ? 's' : ''}`;
        return `
          <div class="lb-row lb-${r.team}">
            <span class="lb-slot">${r.team.toUpperCase()}-${r.idx}</span>
            <span class="lb-score ${h === 0 ? 'best' : ''}">${scoreStr}</span>
          </div>`;
      }).join('')
    : '<div style="color:var(--text-muted);font-size:0.78rem">No scores yet.</div>';
}
