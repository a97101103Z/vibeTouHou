import { GameEngine } from "../game/engine.js";

const TEST_RADIUS = 14;
const REAL_RADIUS = 8;

/**
 * GameManager - Manages game canvas and game modes (playtest and gauntlet).
 */
export class GameManager {
  #engine = null;
  #isRunning = false;

  // DOM references
  #canvasOverlay;
  #overlayTitle;
  #overlaySubtitle;
  #overlayActions;
  #overlaySummary;
  #hudPattern;
  #hudTime;
  #hudHits;
  #playModeIndicator;
  #gameCanvas;

  // Dependencies
  #gauntletManager;
  #sidebarManager;

  /**
   * @param {import('./GauntletManager.js').GauntletManager} gauntletManager
   * @param {import('./SidebarManager.js').SidebarManager} sidebarManager
   */
  constructor(gauntletManager, sidebarManager) {
    this.#gauntletManager = gauntletManager;
    this.#sidebarManager = sidebarManager;
  }

  init() {
    this.#cacheDOM();
    this.#showCanvasOverlay("Play", "Select a mode to begin.", []);

    // Listen for start events
    this.#sidebarManager.addEventListener("startPlaytest", (e) =>
      this.startPlaytest(e.detail.url),
    );

    this.#gauntletManager.addEventListener("startGauntlet", (e) =>
      this.startGauntlet(e?.detail?.startIdx),
    );
  }

  #cacheDOM() {
    this.#canvasOverlay = document.getElementById("canvas-overlay");
    this.#overlayTitle = document.getElementById("overlay-title");
    this.#overlaySubtitle = document.getElementById("overlay-subtitle");
    this.#overlayActions = document.getElementById("overlay-actions");
    this.#overlaySummary = document.getElementById("overlay-summary");
    this.#hudPattern = document.getElementById("hud-pattern");
    this.#hudTime = document.getElementById("hud-time");
    this.#hudHits = document.getElementById("hud-hits");
    this.#playModeIndicator = document.getElementById("play-mode-indicator");
    this.#gameCanvas = document.getElementById("game-canvas");
  }

  // ── Shared UI ────────────────────────────────────

  #startCountdown() {
    let count = 3;
    const timerEl = document.createElement("div");
    timerEl.className = "countdown-timer";
    timerEl.textContent = count;
    this.#overlayActions.appendChild(timerEl);

    return new Promise((resolve) => {
      const interval = setInterval(() => {
        count--;
        timerEl.textContent = count;

        if (count <= 0) {
          clearInterval(interval);
          this.#overlayActions.removeChild(timerEl);
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * @param {string} title
   * @param {string} subtitle
   * @param {Array<{text: string, action: Function}>} actions
   * @param {string} [summary]
   */
  #showCanvasOverlay(title, subtitle, actions = [], summary = null) {
    if (!this.#canvasOverlay) return;

    this.#overlayTitle.textContent = title;
    this.#overlaySubtitle.innerHTML = subtitle;
    this.#overlayActions.innerHTML = "";

    actions.forEach((action) => {
      const btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.textContent = action.text;
      btn.addEventListener("click", action.action);
      this.#overlayActions.appendChild(btn);
    });

    if (this.#overlaySummary) {
      this.#overlaySummary.innerHTML = summary || "";
    }

    this.#canvasOverlay.setAttribute("data-visible", "true");
  }

  #syncTimer(video) {
    if (!video) {
      if (this.#hudTime) this.#hudTime.textContent = "10.0s";
      return;
    }

    const left = Math.max(0, 10 - video.currentTime);
    if (this.#hudTime) this.#hudTime.textContent = left.toFixed(1) + "s";

    if (this.#isRunning) {
      requestAnimationFrame(() => this.#syncTimer(video));
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
    this.#playModeIndicator.setAttribute("data-mode", mode);
  }

  // ── Playtest ────────────────────────────────────

  async startPlaytest(url) {
    if (this.#isRunning) return;

    this.#sidebarManager.collapse();
    this.#showCanvasOverlay(
      "Playtest Mode",
      "Survive 10 seconds with zero hits to verify your pattern. Hitbox is slightly larger here.",
      [],
    );
    await this.#startCountdown();
    this.#startPlaytestGame(url);
  }

  #startPlaytestGame(url) {
    this.#isRunning = true;

    this.#setModeIndicator("playtest");

    if (this.#engine) {
      this.#engine.stop();
      this.#engine = null;
    }

    const engine = new GameEngine(this.#gameCanvas, url, {
      playerRadius: TEST_RADIUS,
      recordTrajectory: true,
    });

    engine.addEventListener("hit", (e) => this.#updateHits(e.detail.hits));
    engine.addEventListener("finish", (e) =>
      this.#onPlaytestFinish(e.detail.hits, e.detail.trajectory, url),
    );
    engine.addEventListener("restart", () => {
      // relies on startPlaytestGame resetting states
      this.#isRunning = false;
      this.#startPlaytestGame(url);
    });
    engine.addEventListener("videoerror", () => {
      this.#showCanvasOverlay(
        "Video Error",
        "Could not load your pattern video.",
        [{ text: "Retry", action: () => this.startPlaytest(url) }],
      );
    });

    this.#engine = engine;
    engine.start().catch(() => {
      this.#showCanvasOverlay("Error", "Could not start playtest.", [
        { text: "Retry", action: () => this.startPlaytest(url) },
      ]);
    });

    this.#canvasOverlay.setAttribute("data-visible", "false");

    if (this.#hudHits) this.#hudHits.textContent = "Hits: 0";
    if (this.#hudPattern) this.#hudPattern.textContent = "—";
    this.#syncTimer(engine.video);
  }

  #onPlaytestFinish(hits, trajectory, url) {
    this.#isRunning = false;

    if (hits === 0) {
      this.#showCanvasOverlay(
        "🎉 Flawless Clear!",
        "Pattern confirmed survivable!",
        [
          { text: "Replay", action: () => this.startPlaytest(url) },
          {
            text: "Publish",
            action: () => this.#sidebarManager.publishPattern(trajectory),
          },
        ],
      );
    } else {
      this.#showCanvasOverlay(
        `${hits} Hit${hits > 1 ? "s" : ""} Taken`,
        "Try again to unlock Publish.",
        [{ text: "Retry", action: () => this.startPlaytest(url) }],
      );
    }
  }

  // ── Gauntlet ────────────────────────────────────

  // Gauntlet session state
  #gauntletCurrentIdx = 0;
  #gauntletTotalHits = 0;
  #gauntletHitsPerPattern = [];

  async startGauntlet(startIdx) {
    if (this.#isRunning) return;
    if (!this.#gauntletManager.patterns.length) {
      this.#showCanvasOverlay(
        "No Patterns",
        "The opposing team has not published any patterns yet.",
        [],
      );
      return;
    }

    this.#gauntletCurrentIdx = startIdx ?? 0;

    this.#sidebarManager.collapse();
    this.#showCanvasOverlay(
      "Gauntlet Mode",
      "Face every pattern published by the opposing team. Real hitbox. No mercy.",
      [],
    );
    await this.#startCountdown();
    this.#startGauntletGame();
  }

  #startGauntletGame() {
    this.#isRunning = true;
    this.#gauntletCurrentIdx = 0;
    this.#gauntletTotalHits = 0;
    this.#gauntletHitsPerPattern = new Array(
      this.#gauntletManager.patterns.length,
    ).fill(null);

    this.#setModeIndicator("gauntlet");

    this.#gauntletManager.resetAllPatternItems();

    this.#playPattern(this.#gauntletCurrentIdx, null);
  }

  #playPattern(idx, initialPlayer) {
    const p = this.#gauntletManager.patterns[idx];
    if (!p) {
      this.#endGauntlet();
      return;
    }

    this.#gauntletManager.activatePatternItem(
      idx,
      this.#gauntletHitsPerPattern,
    );

    if (this.#hudPattern)
      this.#hudPattern.textContent = `${idx + 1} / ${this.#gauntletManager.patterns.length}`;
    if (this.#canvasOverlay)
      this.#canvasOverlay.setAttribute("data-visible", "false");

    if (this.#engine) {
      this.#engine.stop();
      this.#engine = null;
    }

    const engine = new GameEngine(this.#gameCanvas, p.video_url, {
      playerRadius: REAL_RADIUS,
      recordTrajectory: false,
      initialPlayer,
    });

    engine.addEventListener("hit", (e) => {
      if (this.#hudHits) this.#hudHits.textContent = `Hits: ${e.detail.hits}`;
    });
    engine.addEventListener("finish", () => this.#onPatternFinish(idx));
    engine.addEventListener("restart", () => {
      // relies on startGauntletGame resetting states
      this.#isRunning = false;
      this.#startGauntletGame();
    });
    engine.addEventListener("videoerror", () => {
      this.#gauntletHitsPerPattern[idx] = 99;
      this.#gauntletManager.setPatternItemHits(idx, 99);
      const savedPlayer = engine
        ? { x: engine.player.x, y: engine.player.y }
        : null;
      if (idx + 1 < this.#gauntletManager.patterns.length) {
        this.#playPattern(idx + 1, savedPlayer);
      } else {
        this.#endGauntlet();
      }
    });

    this.#engine = engine;
    engine.start().catch(() => {
      this.#gauntletHitsPerPattern[idx] = 99;
      this.#gauntletManager.setPatternItemHits(idx, 99);
      if (idx + 1 < this.#gauntletManager.patterns.length) {
        this.#playPattern(idx + 1, initialPlayer);
      } else {
        this.#endGauntlet();
      }
    });

    this.#syncTimer(engine.video);
  }

  #onPatternFinish(idx) {
    const hits = this.#engine ? this.#engine.hits : 0;
    this.#gauntletHitsPerPattern[idx] = hits;
    this.#gauntletTotalHits += hits;

    this.#gauntletManager.deactivatePatternItem(idx);
    this.#gauntletManager.setPatternItemHits(idx, hits);

    setTimeout(() => {
      if (idx + 1 < this.#gauntletManager.patterns.length) {
        const savedPlayer = this.#engine
          ? { x: this.#engine.player.x, y: this.#engine.player.y }
          : null;
        this.#playPattern(idx + 1, savedPlayer);
      } else {
        this.#endGauntlet();
      }
    }, 750);
  }

  #endGauntlet() {
    this.#isRunning = false;

    this.#submitGauntletScore();

    const patternsSummary = this.#gauntletManager.patterns
      .map((p, i) => {
        const h = this.#gauntletHitsPerPattern[i];
        return `<div class="summary-list">
                  <span>#${i + 1} ${p.slot}</span>
                  <span class="summary-item ${h === 0 ? "success" : "error"}">${h}h</span>
                </div>`;
      })
      .join("");
    const summaryContainer = `
      <div>
        ${patternsSummary}
        <div class="summary-item" style="margin-top: 10px">
          Total: ${this.#gauntletTotalHits} hit${this.#gauntletTotalHits !== 1 ? "s" : ""}
        </div>
      </div>`;

    if (this.#gauntletTotalHits === 0) {
      this.#showCanvasOverlay(
        "🎉 Perfect Gauntlet!",
        `You took 0 hits across all ${this.#gauntletManager.patterns.length} patterns.<br><br>`,
        [
          { text: "♾ Infinite Mode", action: () => this.beginInfinite() },
          { text: "↩ Run Again", action: () => this.startGauntlet() },
        ],
        summaryContainer,
      );
    } else {
      this.#showCanvasOverlay(
        `${this.#gauntletTotalHits} Hit${this.#gauntletTotalHits !== 1 ? "s" : ""} Total`,
        "Run the gauntlet again to improve your score.<br><br>",
        [{ text: "↩ Run Again", action: () => this.startGauntlet() }],
        summaryContainer,
      );
    }
  }

  async #submitGauntletScore() {
    try {
      await fetch("/api/score", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hits: this.#gauntletTotalHits,
          infinite_time: null,
        }),
      });
    } catch (_) {}
  }

  // ── Infinite Mode ───────────────────────────────

  #INFINITE_MAX_HITS = 3;
  #infiniteHits = 0;
  #infiniteTime = 0;
  #infiniteQueue = [];
  #infiniteQueueIdx = 0;

  beginInfinite() {
    this.#isRunning = true;
    this.#infiniteHits = 0;
    this.#infiniteTime = 0;
    this.#infiniteQueueIdx = 0;
    this.#infiniteQueue = [...this.#gauntletManager.patterns].sort(
      () => Math.random() - 0.5,
    );

    this.#setModeIndicator("infinite");
    this.#canvasOverlay.setAttribute("data-visible", "false");

    if (this.#hudHits)
      this.#hudHits.textContent = `HP: ${this.#INFINITE_MAX_HITS} / ${this.#INFINITE_MAX_HITS}`;
    if (this.#hudPattern) this.#hudPattern.textContent = "∞";

    this.#playInfinitePattern(null);
  }

  #playInfinitePattern(initialPlayer) {
    if (this.#infiniteHits >= this.#INFINITE_MAX_HITS) {
      this.#endInfinite();
      return;
    }

    const p =
      this.#infiniteQueue[this.#infiniteQueueIdx % this.#infiniteQueue.length];

    if (this.#engine) {
      this.#engine.stop();
      this.#engine = null;
    }

    const engine = new GameEngine(this.#gameCanvas, p.video_url, {
      playerRadius: REAL_RADIUS,
      recordTrajectory: false,
      initialPlayer,
    });

    engine.addEventListener("hit", () => {
      this.#infiniteHits++;
      const remaining = Math.max(
        0,
        this.#INFINITE_MAX_HITS - this.#infiniteHits,
      );
      if (this.#hudHits)
        this.#hudHits.textContent = `HP: ${remaining} / ${this.#INFINITE_MAX_HITS}`;
      if (this.#infiniteHits >= this.#INFINITE_MAX_HITS) {
        engine.stop();
        this.#endInfinite();
      }
    });

    engine.addEventListener("finish", async () => {
      this.#infiniteTime += 10;
      const savedPlayer = { x: engine.player.x, y: engine.player.y };
      await engine.runGrace(750);
      this.#infiniteQueueIdx++;
      this.#playInfinitePattern(savedPlayer);
    });

    engine.addEventListener("restart", () => {
      this.#isRunning = false;
      this.beginInfinite();
    });

    engine.addEventListener("videoerror", () => {
      this.#infiniteQueueIdx++;
      const savedPlayer = engine
        ? { x: engine.player.x, y: engine.player.y }
        : null;
      this.#playInfinitePattern(savedPlayer);
    });

    this.#engine = engine;
    engine.start().catch(() => {
      this.#infiniteQueueIdx++;
      this.#playInfinitePattern(initialPlayer);
    });

    this.#syncTimer(engine.video);
  }

  #endInfinite() {
    this.#isRunning = false;

    if (this.#engine) {
      this.#engine.stop();
      this.#engine = null;
    }

    this.#submitInfiniteScore();

    this.#showCanvasOverlay(
      `♾ ${this.#infiniteTime.toFixed(1)}s Survived`,
      "Infinite Mode complete. Your score has been recorded.",
      [{ text: "↩ Run Again", action: () => this.startGauntlet() }],
    );
  }

  async #submitInfiniteScore() {
    try {
      await fetch("/api/score", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hits: 0,
          infinite_time: this.#infiniteTime,
        }),
      });
    } catch (_) {}
  }
}
