import { GameEngine } from "./engine.js";

const TEST_RADIUS = 14;
const REAL_RADIUS = 8;

/**
 * HudControl — Facade over canvas DOM elements and engine lifecycle.
 * Each game mode receives this object to interact with the HUD and overlay.
 */
export function createHudControl(canvasId) {
  const cache = {};

  function dom(id) {
    if (cache[id] === undefined) cache[id] = document.getElementById(id);
    return cache[id];
  }

  let abortSync = false;

  return {
    get canvas() {
      return dom(canvasId);
    },

    // ── Overlay ────────────────────────────────────────

    /**
     * @param {string} title
     * @param {string} subtitle
     * @param {Array<{text: string, action: Function}>} actions
     * @param {string} [summary]
     */
    showOverlay(title, subtitle, actions = [], summary = null) {
      const overlay = dom("canvas-overlay");
      if (!overlay) return;

      dom("overlay-title").textContent = title;
      dom("overlay-subtitle").innerHTML = subtitle;
      dom("overlay-actions").innerHTML = "";

      actions.forEach((action) => {
        const btn = document.createElement("button");
        btn.className = "btn btn-primary";
        btn.textContent = action.text;
        btn.addEventListener("click", action.action);
        dom("overlay-actions").appendChild(btn);
      });

      const summaryEl = dom("overlay-summary");
      if (summaryEl) summaryEl.innerHTML = summary || "";

      overlay.setAttribute("data-visible", "true");
    },

    hideOverlay() {
      const overlay = dom("canvas-overlay");
      if (overlay) overlay.setAttribute("data-visible", "false");
    },

    startCountdown() {
      let count = 3;
      const timerEl = document.createElement("div");
      timerEl.className = "countdown-timer";
      timerEl.textContent = count;
      dom("overlay-actions").appendChild(timerEl);

      return new Promise((resolve) => {
        const interval = setInterval(() => {
          count--;
          timerEl.textContent = count;

          if (count <= 0) {
            clearInterval(interval);
            dom("overlay-actions").removeChild(timerEl);
            resolve();
          }
        }, 1000);
      });
    },

    // ── HUD ────────────────────────────────────────────

    setTimer(text) {
      const el = dom("hud-time");
      if (el) el.textContent = text;
    },

    setHits(text) {
      const el = dom("hud-hits");
      if (el) el.textContent = text;
    },

    setPattern(text) {
      const el = dom("hud-pattern");
      if (el) el.textContent = text;
    },

    setModeIndicator(mode) {
      const el = dom("play-mode-indicator");
      if (!el) return;
      el.textContent = mode.toUpperCase();
      el.setAttribute("data-mode", mode);
    },

    // ── Timer sync loop ────────────────────────────────

    syncTimer(video) {
      abortSync = false;
      if (!video) {
        this.setTimer("10.0s");
        return;
      }

      const loop = () => {
        if (abortSync) return;
        const left = Math.max(0, 10 - video.currentTime);
        this.setTimer(left.toFixed(1) + "s");
        if (!video.ended && video.currentTime < 10) {
          requestAnimationFrame(loop);
        }
      };
      requestAnimationFrame(loop);
    },

    stopTimerSync() {
      abortSync = true;
    },

    // ── Engine management ──────────────────────────────

    createPlaytestEngine(url) {
      return new GameEngine(this.canvas, url, {
        playerRadius: TEST_RADIUS,
        recordTrajectory: true,
      });
    },

    createRealEngine(url, initialPlayer) {
      return new GameEngine(this.canvas, url, {
        playerRadius: REAL_RADIUS,
        recordTrajectory: false,
        initialPlayer,
      });
    },
  };
}