/**
 * engine.js — Shared game canvas engine used by Playtest and Gauntlet pages.
 *
 * Responsibilities:
 *  - Play back an MP4 video on a canvas
 *  - Move player dot with WASD / Arrow keys (+ Shift for focus mode)
 *  - Sample video pixels around the player each frame → brightness collision check
 *  - Invincibility frames + screen flash on hit
 *  - Record trajectory [{x, y, t}] (only used by Playtest for publish)
 *  - Emit events: 'hit', 'finish'
 */

export const WIDTH    = 800;
export const HEIGHT   = 600;
const DURATION        = 10;         // seconds
const PLAYER_SPEED    = 350;
const FOCUS_SPEED     = 150;
const INVINCIBLE_TIME = 1.0;        // seconds
const FLASH_TIME      = 0.1;        // seconds
const BRIGHTNESS_THRESHOLD = 128;
const LOAD_TIMEOUT_MS = 15000;
const STALL_TIMEOUT_MS = 3500;

export class GameEngine extends EventTarget {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string}  videoUrl
   * @param {object}  opts
   * @param {number}  opts.playerRadius  8 (real) or 14 (test)
   * @param {boolean} opts.recordTrajectory
   */
  constructor(canvas, videoUrl, opts = {}) {
    super();

    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    // Offscreen canvas for pixel sampling
    this.offscreen = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(WIDTH, HEIGHT)
      : document.createElement('canvas');
    this.offscreen.width = WIDTH;
    this.offscreen.height = HEIGHT;
    this.offCtx    = this.offscreen.getContext('2d');

    this.playerRadius      = opts.playerRadius ?? 8;
    this.recordTrajectory  = opts.recordTrajectory ?? false;

    // Player state
    this.player = { x: WIDTH / 2, y: HEIGHT - 80 };
    this.invincTimer = 0;
    this.flashTimer  = 0;
    this.hits        = 0;
    this.trajectory  = [];

    // Keys held
    this._keys = {};

    // Video element
    this.video = document.createElement('video');
    this.video.src     = videoUrl;
    this.video.muted   = true;
    this.video.preload = 'auto';
    this.video.playsInline = true;
    this.video.controls = false;

    this._rafId   = null;
    this._lastTs  = null;
    this._running = false;
    this._lastVideoTime = 0;
    this._lastProgressAt = performance.now();

    // Bind key handlers
    this._onKeyDown = e => { 
      // Don't intercept if user is somehow typing
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.closest('.cm-editor')) return;
      this._keys[e.code] = true;  
      if (e.code === 'KeyR' && !e.repeat) this.dispatchEvent(new CustomEvent('restart'));
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); 
    };
    this._onKeyUp   = e => { this._keys[e.code] = false; };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Wait for video to be ready, then start the game loop. */
  async start() {
    await this._loadVideo();

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);

    this._running = true;
    this._lastTs = null;
    this._lastVideoTime = this.video.currentTime || 0;
    this._lastProgressAt = performance.now();
    try {
      await this.video.play();
    } catch (err) {
      this._running = false;
      this.dispatchEvent(new CustomEvent('videoerror', { detail: { reason: 'play-blocked', error: err } }));
      throw err;
    }
    this._loop();
  }

  /** Stop the engine and clean up. */
  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
  }

  async _loadVideo() {
    if (this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;

    await new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        this.video.removeEventListener('loadeddata', onReady);
        this.video.removeEventListener('canplay', onReady);
        this.video.removeEventListener('error', onError);
      };
      const done = fn => value => {
        if (settled) return;
        settled = true;
        cleanup();
        fn(value);
      };
      const onReady = done(resolve);
      const onError = done(() => reject(this.video.error || new Error('Video failed to load.')));
      const timer = setTimeout(
        done(() => reject(new Error('Video load timed out.'))),
        LOAD_TIMEOUT_MS,
      );

      this.video.addEventListener('loadeddata', onReady, { once: true });
      this.video.addEventListener('canplay', onReady, { once: true });
      this.video.addEventListener('error', onError, { once: true });
      this.video.load();
    });
  }

  // ── Internal loop ──────────────────────────────────────────────────────────

  _loop() {
    if (!this._running) return;
    this._rafId = requestAnimationFrame(ts => {
      const dt = this._lastTs == null ? 0 : Math.min((ts - this._lastTs) / 1000, 0.1);
      this._lastTs = ts;
      this._tick(dt);
      this._loop();
    });
  }

  _tick(dt) {
    const vt = this.video.currentTime;
    const now = performance.now();

    if (vt > this._lastVideoTime + 0.001) {
      this._lastVideoTime = vt;
      this._lastProgressAt = now;
    } else if (!this.video.paused && !this.video.ended && now - this._lastProgressAt > STALL_TIMEOUT_MS) {
      this._running = false;
      this.dispatchEvent(new CustomEvent('videoerror', { detail: { reason: 'stalled' } }));
      return;
    }

    // Check for end
    if (vt >= DURATION || this.video.ended) {
      this._running = false;
      this._drawFrame();
      this.dispatchEvent(new CustomEvent('finish', { detail: {
        hits: this.hits,
        trajectory: this.trajectory,
      }}));
      return;
    }

    // Update timers
    if (this.invincTimer > 0) this.invincTimer -= dt;
    if (this.flashTimer  > 0) this.flashTimer  -= dt;

    // Move player
    this._movePlayer(dt);

    // Record trajectory
    if (this.recordTrajectory) {
      this.trajectory.push({ x: this.player.x, y: this.player.y, t: vt });
    }

    // Collision check (only when not invincible)
    if (this.invincTimer <= 0) {
      if (this._checkCollision()) {
        this.hits++;
        this.invincTimer = INVINCIBLE_TIME;
        this.flashTimer  = FLASH_TIME;
        this.dispatchEvent(new CustomEvent('hit', { detail: { hits: this.hits, t: vt } }));
      }
    }

    this._drawFrame();
  }

  _movePlayer(dt) {
    const k = this._keys;
    let dx = 0, dy = 0;
    if (k['ArrowLeft']  || k['KeyA']) dx -= 1;
    if (k['ArrowRight'] || k['KeyD']) dx += 1;
    if (k['ArrowUp']    || k['KeyW']) dy -= 1;
    if (k['ArrowDown']  || k['KeyS']) dy += 1;

    // Normalize diagonal
    if (dx !== 0 && dy !== 0) { const l = Math.hypot(dx, dy); dx /= l; dy /= l; }

    const focus = k['ShiftLeft'] || k['ShiftRight'];
    const spd   = focus ? FOCUS_SPEED : PLAYER_SPEED;

    this.player.x = Math.max(this.playerRadius,
                    Math.min(WIDTH  - this.playerRadius, this.player.x + dx * spd * dt));
    this.player.y = Math.max(this.playerRadius,
                    Math.min(HEIGHT - this.playerRadius, this.player.y + dy * spd * dt));
  }

  _checkCollision() {
    // Draw current video frame to offscreen canvas for pixel sampling
    try {
      this.offCtx.drawImage(this.video, 0, 0, WIDTH, HEIGHT);
    } catch (_) { return false; }

    const r  = this.playerRadius;
    const px = Math.round(this.player.x);
    const py = Math.round(this.player.y);

    const x0 = Math.max(0, px - r);
    const y0 = Math.max(0, py - r);
    const x1 = Math.min(WIDTH  - 1, px + r);
    const y1 = Math.min(HEIGHT - 1, py + r);
    const w  = x1 - x0;
    const h  = y1 - y0;
    if (w <= 0 || h <= 0) return false;

    const imgData = this.offCtx.getImageData(x0, y0, w, h);
    const data    = imgData.data;

    for (let iy = 0; iy < h; iy++) {
      for (let ix = 0; ix < w; ix++) {
        const dx = (x0 + ix) - px;
        const dy = (y0 + iy) - py;
        if (dx * dx + dy * dy > r * r) continue;

        const base = (iy * w + ix) * 4;
        const R = data[base], G = data[base + 1], B = data[base + 2];
        const Y = 0.299 * R + 0.587 * G + 0.114 * B;
        if (Y > BRIGHTNESS_THRESHOLD) return true;
      }
    }
    return false;
  }

  _drawFrame() {
    const ctx = this.ctx;

    // Flash background on hit
    if (this.flashTimer > 0) {
      ctx.fillStyle = '#882020';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    } else {
      // Draw video frame
      try { ctx.drawImage(this.video, 0, 0, WIDTH, HEIGHT); }
      catch (_) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
    }

    // Draw player dot (blink during invincibility)
    const blink = this.invincTimer > 0 && Math.floor(this.invincTimer * 10) % 2 === 0;
    if (!blink) {
      const r   = this.playerRadius;
      const { x, y } = this.player;

      // Glow
      ctx.save();
      ctx.shadowBlur  = 18;
      ctx.shadowColor = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#fff';
      ctx.fillStyle   = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Tiny crosshair dot
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
