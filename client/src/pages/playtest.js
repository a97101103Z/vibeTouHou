/**
 * playtest.js — Page 3: Verify-to-Publish.
 *
 * The player plays their own rendered video with a LARGER hitbox (test mode).
 * On a flawless run (0 hits), the Publish button appears and sends the
 * trajectory to the server for backend re-validation.
 */

import { GameEngine, WIDTH, HEIGHT } from '../game/engine.js';
import { toast } from '../main.js';

const TEST_RADIUS = 14;   // bigger hitbox for creator leniency

let engine = null;
let hudRafId = null;

export function initPlaytest(container) {
  renderUI(container);
}

function renderUI(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">🎮 Playtest</h1>
      <p class="page-subtitle">
        Survive your own pattern to verify it's beatable, then publish it to the pool.
        Hitbox is slightly <strong>larger</strong> here than in the real gauntlet — use that leeway!
      </p>
    </div>

    <div class="row" style="gap:24px;align-items:flex-start">

      <!-- Canvas -->
      <div class="col">
        <div class="canvas-wrap">
          <canvas id="game-canvas" width="800" height="600"></canvas>
          <div class="canvas-hud">
            <span id="hud-time">10.0s</span>
            <span id="hud-hits">Hits: 0</span>
            <span style="color:var(--text-muted);font-size:0.65rem">SHIFT = focus · WASD / ↕↔ = move</span>
          </div>
          <div id="canvas-overlay" class="canvas-overlay">
            <h2>Playtest</h2>
            <p>Survive 10 seconds with zero hits to unlock <strong>Publish</strong>.</p>
            <button id="btn-start-play" class="btn btn-primary">▶ Start</button>
            <p id="no-video-msg" style="color:var(--red);display:none">
              No rendered video found. <br>Go to <strong>Submit</strong> first.
            </p>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div style="width:260px;flex-shrink:0" class="col">
        <div class="card col">
          <div class="card-title">Run Result</div>
          <div id="result-box" style="color:var(--text-muted);font-size:0.85rem">
            Not played yet.
          </div>
        </div>

        <div id="publish-card" class="card col" style="display:none">
          <div class="card-title">Publish</div>
          <p style="color:var(--text-dim);font-size:0.82rem">
            Flawless clear confirmed! The server will re-validate your trajectory before publishing.
          </p>
          <button id="btn-publish" class="btn btn-primary">🚀 Publish to Pool</button>
          <div id="publish-status" style="font-size:0.8rem;color:var(--text-dim);min-height:20px"></div>
        </div>

        <div class="card">
          <div class="card-title">Hitbox Info</div>
          <p style="color:var(--text-dim);font-size:0.82rem;line-height:1.8">
            Playtest radius: <strong style="color:var(--accent)">${TEST_RADIUS}px</strong><br>
            Gauntlet radius: <strong>8px</strong><br><br>
            The extra size gives you breathing room to confirm your pattern is survivable.
          </p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-start-play').addEventListener('click', startGame);
}

// ── Game control ───────────────────────────────────────────────────────────────

async function startGame() {
  // Check that a render has completed before trying to load the video
  try {
    const res  = await fetch('/api/render/status', { credentials: 'include' });
    const data = await res.json();
    if (data.status !== 'done') {
      document.getElementById('no-video-msg').style.display = '';
      return;
    }
    window.__playtestVideoUrl = data.video_url || '/api/video/my';
  } catch (_) {
    document.getElementById('no-video-msg').style.display = '';
    return;
  }

  // Hide overlay
  document.getElementById('canvas-overlay').style.display = 'none';
  document.getElementById('publish-card').style.display  = 'none';
  document.getElementById('result-box').textContent       = 'Playing…';

  // Reset HUD
  document.getElementById('hud-hits').textContent = 'Hits: 0';

  // Destroy previous engine if any
  if (engine) engine.stop();
  if (hudRafId) cancelAnimationFrame(hudRafId);

  engine = new GameEngine(
    document.getElementById('game-canvas'),
    window.__playtestVideoUrl,
    { playerRadius: TEST_RADIUS, recordTrajectory: true }
  );

  engine.addEventListener('hit', e => {
    document.getElementById('hud-hits').textContent = `Hits: ${e.detail.hits}`;
  });

  engine.addEventListener('finish', e => {
    const { hits, trajectory } = e.detail;
    onFinish(hits, trajectory);
  });

  engine.addEventListener('restart', startGame);
  engine.addEventListener('videoerror', () => {
    showOverlay('Video playback stopped.', 'Reload or retry after checking the rendered video.', 'Retry');
  });

  // Update HUD timer during play (via rAF check on video)
  const canvas = document.getElementById('game-canvas');
  const hudTime = document.getElementById('hud-time');
  function updateHUD() {
    if (!engine || !engine.video) return;
    const left = Math.max(0, 10 - engine.video.currentTime);
    hudTime.textContent = left.toFixed(1) + 's';
    if (engine._running) hudRafId = requestAnimationFrame(updateHUD);
  }
  hudRafId = requestAnimationFrame(updateHUD);

  try { await engine.start(); }
  catch (_) {
    showOverlay('Could not load video.', 'Check that your pattern has been rendered.');
  }
}

function onFinish(hits, trajectory) {
  const resultBox = document.getElementById('result-box');

  if (hits === 0) {
    resultBox.innerHTML = '<span style="color:#50ff8c;font-weight:700">✓ FLAWLESS! 0 hits.</span><br><small style="color:var(--text-dim)">You can now publish this pattern.</small>';
    document.getElementById('publish-card').style.display = '';
    setupPublish(trajectory);
  } else {
    resultBox.innerHTML = `<span style="color:var(--red)">✗ ${hits} hit${hits > 1 ? 's' : ''} taken.</span><br><small style="color:var(--text-dim)">Try again to unlock Publish.</small>`;
  }

  showOverlay(
    hits === 0 ? '🎉 Flawless Clear!' : `${hits} Hit${hits > 1 ? 's' : ''} Taken`,
    hits === 0 ? 'Pattern confirmed survivable.' : 'Try again to unlock Publish.',
    hits === 0 ? 'Replay' : 'Retry',
  );
}

function showOverlay(title, subtitle, btnLabel = 'Retry') {
  const ov = document.getElementById('canvas-overlay');
  ov.style.display = '';
  ov.innerHTML = `
    <h2>${title}</h2>
    <p>${subtitle}</p>
    <button class="btn btn-primary" id="btn-retry-play">↩ ${btnLabel}</button>
  `;
  document.getElementById('btn-retry-play').addEventListener('click', startGame);
}

// ── Publish ────────────────────────────────────────────────────────────────────

function setupPublish(trajectory) {
  const btn    = document.getElementById('btn-publish');
  const status = document.getElementById('publish-status');

  btn.onclick = async () => {
    btn.disabled    = true;
    status.textContent = '🔄 Validating on server…';

    try {
      const res  = await fetch('/api/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trajectory }),
      });
      const data = await res.json();
      if (res.ok) {
        status.style.color = '#50ff8c';
        status.textContent = '✓ ' + (data.message || 'Published!');
        toast('Pattern published to the pool!', 'success');
        btn.textContent = '✓ Published';
      } else {
        status.style.color = 'var(--red)';
        status.textContent = '✗ ' + (data.detail || 'Validation failed.');
        btn.disabled = false;
        toast('Server rejected the trajectory.', 'error');
      }
    } catch (_) {
      status.style.color = 'var(--red)';
      status.textContent = '✗ Network error.';
      btn.disabled = false;
    }
  };
}
