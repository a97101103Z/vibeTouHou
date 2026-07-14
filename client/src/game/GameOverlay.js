/**
 * GameOverlay — shared game modal controller.
 *
 * Manages the lifecycle of an in-page game modal: ready screen,
 * 3-2-1 countdown, engine start, hit/finish/error handling, replay.
 *
 * Expects a modal root element containing children with data-go-* attributes:
 *   data-go-close        — close button
 *   data-go-canvas       — <canvas>
 *   data-go-pattern      — HUD pattern name
 *   data-go-time         — HUD timer
 *   data-go-hits         — HUD hits counter
 *   data-go-overlay      — overlay container (data-visible toggle)
 *   data-go-title        — overlay heading
 *   data-go-subtitle     — overlay subtitle
 *   data-go-actions      — overlay action buttons container
 */

import { GameEngine } from "./engine.js";
import {
  OVERLAY_READY,
  OVERLAY_FINISHED,
  OVERLAY_VIDEO_ERR,
  OVERLAY_GET_READY,
  OVERLAY_PLAY,
  OVERLAY_REPLAY,
  OVERLAY_CANCEL,
  OVERLAY_CLOSE,
  HITS_DISPLAY,
} from "../strings.js";

export class GameOverlay extends EventTarget {
  /** @param {object} cfg */
  constructor({
    modal,
    buttonClasses = {},
    playerRadius = 8,
    recordTrajectory = false,
    showTimer = false,
    onReplay = "immediate",
    onClose = null,
  }) {
    super();

    this._modal = modal;
    this._strings = {
      ready: OVERLAY_READY,
      finished: OVERLAY_FINISHED,
      videoError: OVERLAY_VIDEO_ERR,
      getReady: OVERLAY_GET_READY,
      play: OVERLAY_PLAY,
      cancel: OVERLAY_CANCEL,
      replay: OVERLAY_REPLAY,
      close: OVERLAY_CLOSE,
      hitsDisplay: HITS_DISPLAY,
    };
    this._btnCls = buttonClasses;
    this._playerRadius = playerRadius;
    this._recordTrajectory = recordTrajectory;
    this._showTimer = showTimer;
    this._onReplay = onReplay;
    this._onClose = onClose;

    // Resolve child elements
    this._closeBtn = modal.querySelector("[data-go-close]");
    this._canvas = modal.querySelector("[data-go-canvas]");
    this._ctx = this._canvas.getContext("2d");
    this._patternEl = modal.querySelector("[data-go-pattern]");
    this._timeEl = modal.querySelector("[data-go-time]");
    this._hitsEl = modal.querySelector("[data-go-hits]");
    this._overlay = modal.querySelector("[data-go-overlay]");
    this._titleEl = modal.querySelector("[data-go-title]");
    this._subEl = modal.querySelector("[data-go-subtitle]");
    this._actionsEl = modal.querySelector("[data-go-actions]");
    this._summaryEl = modal.querySelector("[data-go-summary]");

    // State
    this._engine = null;
    this._running = false;
    this._closed = false;
    this._countdownId = null;
    this._timerRafId = null;
    this._url = null;
    this._label = null;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Show the modal and start the ready → play flow. */
  open(url, label) {
    this._url = url;
    this._label = label;
    this._closed = false;

    this._closeBtn.onclick = () => this.close();
    this._modal.removeEventListener("click", this._backdropHandler);
    this._backdropHandler = (e) => {
      if (e.target === this._modal && !this._running) this.close();
    };
    this._modal.addEventListener("click", this._backdropHandler);

    this._modal.style.display = "flex";
    this._modal.classList.add("visible");

    this._ready();
  }

  /** Stop everything and hide the modal. */
  close() {
    if (this._closed) return;
    this._closed = true;
    this._modal.removeEventListener("click", this._backdropHandler);
    this._cleanup();
    this._modal.classList.remove("visible");
    this._modal.style.display = "";
    this.dispatchEvent(new CustomEvent("overlayclose"));
    if (this._onClose) this._onClose();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  _ready() {
    this._cleanup();
    this._showOverlay(this._strings.ready, this._label, `
      <button class="${this._btnCls.play}" data-go-action="start">${this._strings.play}</button>
      <button class="${this._btnCls.close}" data-go-action="cancel">${this._strings.cancel}</button>
    `);
    this._actionsEl.querySelector('[data-go-action="start"]')?.addEventListener("click", () => {
      if (this._closed) return;
      this._startCountdown(() => this._startGame());
    }, { once: true });
    this._actionsEl.querySelector('[data-go-action="cancel"]')?.addEventListener("click", () => this.close(), { once: true });
  }

  _startCountdown(onDone) {
    let count = 3;
    this._showOverlay(String(count), this._strings.getReady, "");
    this._countdownId = setInterval(() => {
      count--;
      if (count > 0) {
        this._titleEl.textContent = String(count);
      } else {
        clearInterval(this._countdownId);
        this._countdownId = null;
        onDone();
      }
    }, 1000);
  }

  _startGame() {
    if (this._closed) return;
    this._running = true;

    this._engine = new GameEngine(this._canvas, this._url, {
      playerRadius: this._playerRadius,
      recordTrajectory: this._recordTrajectory,
    });

    this._engine.addEventListener("hit", (e) => {
      if (this._closed) return;
      this._hitsEl.textContent = this._strings.hitsDisplay(e.detail.hits);
    });

    this._engine.addEventListener("finish", () => this._onFinish());
    this._engine.addEventListener("videoerror", () => this._onVideoError());

    this._overlay.setAttribute("data-visible", "false");
    this._patternEl.textContent = this._label;
    this._hitsEl.textContent = this._strings.hitsDisplay(0);
    if (this._showTimer && this._timeEl) this._timeEl.textContent = "10.0s";

    this._engine.start()
      .then(() => { if (this._showTimer) this._startTimer(); })
      .catch(() => { if (this._running) this.close(); });
  }

  _onFinish() {
    this._running = false;
    this._stopTimer();
    const hits = this._engine ? this._engine.hits : "?";
    this._showOverlay(this._strings.finished, this._label, `
      <button class="${this._btnCls.play}" data-go-action="replay">${this._strings.replay}</button>
      <button class="${this._btnCls.close}" data-go-action="close-game">${this._strings.close}</button>
    `, `<div class="sc-summary-hits">${this._strings.hitsDisplay(hits)}</div>`);
    this._hitsEl.textContent = this._strings.hitsDisplay(hits);
    this._actionsEl.querySelector('[data-go-action="replay"]')?.addEventListener("click", () => {
      this._closed = false;
      this._cleanup();
      if (this._onReplay === "immediate") {
        this._startCountdown(() => this._startGame());
      } else {
        this._ready();
      }
    }, { once: true });
    this._actionsEl.querySelector('[data-go-action="close-game"]')?.addEventListener("click", () => this.close(), { once: true });
  }

  _onVideoError() {
    this._running = false;
    this._stopTimer();
    this._showOverlay(this._strings.videoError, "", `
      <button class="${this._btnCls.close}" data-go-action="close-game">${this._strings.close}</button>
    `);
    this._actionsEl.querySelector('[data-go-action="close-game"]')?.addEventListener("click", () => this.close(), { once: true });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  _cleanup() {
    if (this._countdownId) { clearInterval(this._countdownId); this._countdownId = null; }
    this._stopTimer();
    this._running = false;
    if (this._engine) { this._engine.stop(); this._engine = null; }
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  _showOverlay(title, sub, actionsHtml, summaryHtml = "") {
    this._overlay.setAttribute("data-visible", "true");
    this._titleEl.textContent = title;
    this._subEl.textContent = sub;
    if (this._summaryEl) this._summaryEl.innerHTML = summaryHtml;
    this._actionsEl.innerHTML = actionsHtml;
  }

  _startTimer() {
    const tick = () => {
      if (!this._running || !this._engine || this._closed) return;
      const remaining = Math.max(0, 10 - this._engine.video.currentTime);
      if (this._timeEl) this._timeEl.textContent = `${remaining.toFixed(1)}s`;
      if (remaining > 0) this._timerRafId = requestAnimationFrame(tick);
    };
    this._timerRafId = requestAnimationFrame(tick);
  }

  _stopTimer() {
    if (this._timerRafId) { cancelAnimationFrame(this._timerRafId); this._timerRafId = null; }
  }
}
