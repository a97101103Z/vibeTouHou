/**
 * GameManager - Manages game canvas and game modes (playtest and gauntlet).
 * @extends EventTarget
 */

import { GameEngine } from '../game/engine.js';

export class GameManager extends EventTarget {
  #engine = null;
  #mode = null;
  #isRunning = false;
  #trajectory = null;

  // DOM references
  #canvasOverlay;
  #overlayTitle;
  #overlaySubtitle;
  #overlayActions;
  #hudPattern;
  #hudTime;
  #hudHits;
  #playModeIndicator;

  // Dependencies
  #patternManager;
  #gauntletManager;
  #sidebarManager;
  #toastManager;

  get isRunning() {
    return this.#isRunning;
  }

  get mode() {
    return this.#mode;
  }

  get trajectory() {
    return this.#trajectory;
  }

  /**
   * @param {import('./PatternManager.js').PatternManager} patternManager
   * @param {import('./GauntletManager.js').GauntletManager} gauntletManager
   * @param {import('./SidebarManager.js').SidebarManager} sidebarManager
   * @param {import('./ToastManager.js').ToastManager} toastManager
   */
  constructor(patternManager, gauntletManager, sidebarManager, toastManager) {
    super();
    this.#patternManager = patternManager;
    this.#gauntletManager = gauntletManager;
    this.#sidebarManager = sidebarManager;
    this.#toastManager = toastManager;
  }

  init() {
    this.#cacheDOM();
    this.#showCanvasOverlay('Play', 'Select a mode to begin.', []);

    // Listen for startPlaytest from sidebar
    this.#sidebarManager.addEventListener('startPlaytest', () => this.startPlaytest());
  }

  #cacheDOM() {
    this.#canvasOverlay = document.getElementById('canvas-overlay');
    this.#overlayTitle = document.getElementById('overlay-title');
    this.#overlaySubtitle = document.getElementById('overlay-subtitle');
    this.#overlayActions = document.getElementById('overlay-actions');
    this.#hudPattern = document.getElementById('hud-pattern');
    this.#hudTime = document.getElementById('hud-time');
    this.#hudHits = document.getElementById('hud-hits');
    this.#playModeIndicator = document.getElementById('play-mode-indicator');
  }

  startPlaytest() {
    if (this.#isRunning) return;
    if (!this.#patternManager.videoUrl) {
      this.#showCanvasOverlay('No Video', 'Your pattern has not been rendered yet.', []);
      return;
    }

    if (this.#sidebarManager.isExpanded) {
      this.#sidebarManager.toggle();
    }

    this.#showCanvasOverlay('Playtest Mode', 'Survive 10 seconds with zero hits to verify your pattern. Hitbox is slightly larger here.', []);
    this.#startCountdown('playtest');
  }

  startGauntlet() {
    if (this.#isRunning) return;
    if (!this.#gauntletManager.patterns.length) {
      this.#showCanvasOverlay('No Patterns', 'The opposing team has not published any patterns yet.', []);
      return;
    }

    if (this.#sidebarManager.isExpanded) {
      this.#sidebarManager.toggle();
    }

    this.#startGauntletGame();
  }

  #startCountdown(mode) {
    let count = 3;
    const timerEl = document.createElement('div');
    timerEl.className = 'countdown-timer';
    timerEl.textContent = count;
    this.#overlayActions.appendChild(timerEl);

    const interval = setInterval(() => {
      count--;
      timerEl.textContent = count;

      if (count <= 0) {
        clearInterval(interval);
        this.#overlayActions.removeChild(timerEl);
        this.#startGameMode(mode);
      }
    }, 1000);
  }

  #startGameMode(mode) {
    if (mode === 'playtest') {
      this.#startPlaytestGame();
    } else if (mode === 'gauntlet') {
      this.#startGauntletGame();
    }
  }

  #startPlaytestGame() {
    this.#mode = 'playtest';
    this.#isRunning = true;

    this.#setModeIndicator('playtest');

    if (this.#engine) {
      this.#engine.stop();
      this.#engine = null;
    }

    const engine = new GameEngine(
      document.getElementById('game-canvas'),
      this.#patternManager.videoUrl,
      {
        playerRadius: 14, // TEST_RADIUS
        recordTrajectory: true
      }
    );

    engine.addEventListener('hit', (e) => this.#updateHits(e.detail.hits));
    engine.addEventListener('finish', (e) => this.#onPlaytestFinish(e.detail.hits, e.detail.trajectory));
    engine.addEventListener('restart', () => this.startPlaytest());
    engine.addEventListener('videoerror', () => {
      this.#showCanvasOverlay('Video Error', 'Could not load your pattern video.', [
        { text: 'Retry', action: () => this.startPlaytest() }
      ]);
    });

    this.#engine = engine;
    engine.start().catch(() => {
      this.#showCanvasOverlay('Error', 'Could not start playtest.', [
        { text: 'Retry', action: () => this.startPlaytest() }
      ]);
    });

    this.#canvasOverlay.setAttribute('data-visible', 'false');

    if (this.#hudHits) this.#hudHits.textContent = 'Hits: 0';
    if (this.#hudPattern) this.#hudPattern.textContent = '—';
    this.#updateTimer();

    this.dispatchEvent(new CustomEvent('gameStart', { detail: { mode: 'playtest' } }));
  }

  #startGauntletGame() {
    this.#mode = 'gauntlet';
    this.#isRunning = true;
    this.#gauntletManager.currentIdx = 0;
    this.#gauntletManager.totalHits = 0;
    this.#gauntletManager.hitsPerPattern = new Array(this.#gauntletManager.patterns.length).fill(null);

    this.#setModeIndicator('gauntlet');

    this.#playPattern(0, null);
  }

  #playPattern(idx, initialPlayer) {
    const p = this.#gauntletManager.patterns[idx];
    if (!p) {
      this.#endGauntlet();
      return;
    }

    document.querySelectorAll('.pattern-item').forEach((el, i) => {
      el.setAttribute('data-active', i === idx ? 'true' : 'false');
      el.setAttribute('data-done', this.#gauntletManager.hitsPerPattern[i] !== null ? 'true' : 'false');
    });

    if (this.#hudPattern) this.#hudPattern.textContent = `${idx + 1} / ${this.#gauntletManager.patterns.length}`;
    if (this.#canvasOverlay) this.#canvasOverlay.setAttribute('data-visible', 'false');

    if (this.#engine) {
      this.#engine.stop();
      this.#engine = null;
    }

    const engine = new GameEngine(
      document.getElementById('game-canvas'),
      p.video_url,
      {
        playerRadius: 8, // REAL_RADIUS
        recordTrajectory: false,
        initialPlayer
      }
    );

    engine.addEventListener('hit', (e) => {
      if (this.#hudHits) this.#hudHits.textContent = `Hits: ${e.detail.hits}`;
    });
    engine.addEventListener('finish', () => this.#onPatternFinish(idx));
    engine.addEventListener('restart', () => this.startGauntlet());
    engine.addEventListener('videoerror', () => {
      this.#gauntletManager.hitsPerPattern[idx] = 99;
      const savedPlayer = engine ? { x: engine.player.x, y: engine.player.y } : null;
      if (idx + 1 < this.#gauntletManager.patterns.length) {
        this.#playPattern(idx + 1, savedPlayer);
      } else {
        this.#endGauntlet();
      }
    });

    this.#engine = engine;
    engine.start().catch(() => {
      this.#gauntletManager.hitsPerPattern[idx] = 99;
      if (idx + 1 < this.#gauntletManager.patterns.length) {
        this.#playPattern(idx + 1, initialPlayer);
      } else {
        this.#endGauntlet();
      }
    });

    this.#updateTimer();
  }

  #onPatternFinish(idx) {
    const hits = this.#engine ? this.#engine.hits : 0;
    this.#gauntletManager.hitsPerPattern[idx] = hits;
    this.#gauntletManager.totalHits += hits;

    const pi = document.getElementById(`pi-${idx}`);
    if (pi) {
      pi.setAttribute('data-active', 'false');
      pi.setAttribute('data-done', 'true');
      const hitsEl = pi.querySelector('.pi-hits');
      if (hitsEl) {
        hitsEl.textContent = hits === 0 ? '✓' : `${hits} hit${hits > 1 ? 's' : ''}`;
      }
    }

    setTimeout(() => {
      if (idx + 1 < this.#gauntletManager.patterns.length) {
        const savedPlayer = this.#engine ? { x: this.#engine.player.x, y: this.#engine.player.y } : null;
        this.#playPattern(idx + 1, savedPlayer);
      } else {
        this.#endGauntlet();
      }
    }, 750);
  }

  #onPlaytestFinish(hits, trajectory) {
    this.#isRunning = false;
    this.#trajectory = trajectory;

    if (hits === 0) {
      this.#showCanvasOverlay('🎉 Flawless Clear!', 'Pattern confirmed survivable!', [
        { text: 'Replay', action: () => this.startPlaytest() },
        { text: 'Publish', action: () => this.publishPattern(trajectory) }
      ]);
    } else {
      this.#showCanvasOverlay(`${hits} Hit${hits > 1 ? 's' : ''} Taken`, 'Try again to unlock Publish.', [
        { text: 'Retry', action: () => this.startPlaytest() }
      ]);
    }

    this.dispatchEvent(new CustomEvent('gameEnd', { detail: { mode: 'playtest', hits } }));
  }

  async publishPattern(trajectory) {
    const btnPublish = document.createElement('button');
    btnPublish.className = 'btn btn-primary';
    btnPublish.textContent = '🔄 Publishing…';
    btnPublish.disabled = true;

    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:0.8rem;color:var(--text-dim);min-height:20px;margin-top:8px;';

    this.#overlayActions.innerHTML = '';
    this.#overlayActions.appendChild(btnPublish);
    this.#overlayActions.appendChild(statusEl);

    this.dispatchEvent(new CustomEvent('publishStart'));

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trajectory }),
      });
      const data = await res.json();

      if (res.ok) {
        statusEl.style.color = '#50ff8c';
        statusEl.textContent = '✓ ' + (data.message || 'Published!');
        btnPublish.textContent = '✓ Published';
        this.#toastManager.toast('Pattern published to the pool!', 'success');

        this.#sidebarManager.setPatternTested(true);
        this.dispatchEvent(new CustomEvent('publishComplete'));
      } else {
        statusEl.style.color = 'var(--red)';
        statusEl.textContent = '✗ ' + (data.detail || 'Validation failed.');
        btnPublish.disabled = false;
        btnPublish.textContent = 'Retry';
        btnPublish.onclick = () => this.publishPattern(trajectory);
        this.#toastManager.toast('Server rejected the trajectory.', 'error');
      }
    } catch (_) {
      statusEl.style.color = 'var(--red)';
      statusEl.textContent = '✗ Network error.';
      btnPublish.disabled = false;
      btnPublish.textContent = 'Retry';
      btnPublish.onclick = () => this.publishPattern(trajectory);
    }
  }

  #endGauntlet() {
    this.#isRunning = false;

    this.#submitGauntletScore();

    let summaryHTML = this.#gauntletManager.patterns.map((p, i) => {
      const h = this.#gauntletManager.hitsPerPattern[i];
      return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)">
        <span>#${i + 1} ${p.slot}</span>
        <span style="color:${h === 0 ? '#50ff8c' : 'var(--red)'}">${h === 0 ? '✓' : h + 'h'}</span>
      </div>`;
    }).join('');

    summaryHTML += `<div style="margin-top:10px;font-family:var(--font-ui);font-size:0.75rem;color:var(--text)">
      Total: <strong>${this.#gauntletManager.totalHits} hit${this.#gauntletManager.totalHits !== 1 ? 's' : ''}</strong>
    </div>`;

    if (this.#gauntletManager.totalHits === 0) {
      this.#showCanvasOverlay('🎉 Perfect Gauntlet!', `You took 0 hits across all ${this.#gauntletManager.patterns.length} patterns.<br><br>` + summaryHTML, [
        { text: '♾ Infinite Mode', action: () => this.beginInfinite() },
        { text: '↩ Run Again', action: () => this.startGauntlet() }
      ]);
    } else {
      this.#showCanvasOverlay(`${this.#gauntletManager.totalHits} Hit${this.#gauntletManager.totalHits !== 1 ? 's' : ''} Total`,
        'Run the gauntlet again to improve your score.<br><br>' + summaryHTML,
        [{ text: '↩ Run Again', action: () => this.startGauntlet() }]);
    }

    this.dispatchEvent(new CustomEvent('gameEnd', { detail: { mode: 'gauntlet', hits: this.#gauntletManager.totalHits } }));
  }

  async #submitGauntletScore() {
    try {
      await fetch('/api/score', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hits: this.#gauntletManager.totalHits, infinite_time: null }),
      });
    } catch (_) {}
  }

  beginInfinite() {
    this.startGauntlet();
  }

  /**
   * @param {string} title
   * @param {string} subtitle
   * @param {Array<{text: string, action: Function}>} actions
   */
  #showCanvasOverlay(title, subtitle, actions = []) {
    if (!this.#canvasOverlay) return;

    this.#overlayTitle.textContent = title;
    this.#overlaySubtitle.innerHTML = subtitle;
    this.#overlayActions.innerHTML = '';

    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = action.text;
      btn.addEventListener('click', action.action);
      this.#overlayActions.appendChild(btn);
    });

    this.#canvasOverlay.setAttribute('data-visible', 'true');
  }

  #updateTimer() {
    if (!this.#engine || !this.#engine.video) {
      if (this.#hudTime) this.#hudTime.textContent = '10.0s';
      return;
    }

    const left = Math.max(0, 10 - this.#engine.video.currentTime);
    if (this.#hudTime) this.#hudTime.textContent = left.toFixed(1) + 's';

    if (this.#isRunning) {
      requestAnimationFrame(() => this.#updateTimer());
    }
  }

  #updateHits(hits) {
    if (this.#hudHits) {
      this.#hudHits.textContent = `Hits: ${hits}`;
    }
  }

  #setModeIndicator(mode) {
    if (!this.#playModeIndicator) return;

    this.#playModeIndicator.textContent = mode.toUpperCase();
    this.#playModeIndicator.setAttribute('data-mode', mode);
  }
}
