import { GameEngine } from "../game/engine.js";

/**
 * GameManager - Manages game canvas and game modes (playtest and gauntlet).
 */
export class GameManager {
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
  #gauntletManager;
  #sidebarManager;

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

    this.#gauntletManager.addEventListener("startGauntlet", () =>
      this.startGauntlet(),
    );
  }

  #cacheDOM() {
    this.#canvasOverlay = document.getElementById("canvas-overlay");
    this.#overlayTitle = document.getElementById("overlay-title");
    this.#overlaySubtitle = document.getElementById("overlay-subtitle");
    this.#overlayActions = document.getElementById("overlay-actions");
    this.#hudPattern = document.getElementById("hud-pattern");
    this.#hudTime = document.getElementById("hud-time");
    this.#hudHits = document.getElementById("hud-hits");
    this.#playModeIndicator = document.getElementById("play-mode-indicator");
  }

  startPlaytest(url) {
    if (this.#isRunning) return;

    this.#sidebarManager.collapse();
    this.#showCanvasOverlay(
      "Playtest Mode",
      "Survive 10 seconds with zero hits to verify your pattern. Hitbox is slightly larger here.",
      [],
    );
    this.#startCountdown("playtest", url);
  }

  startGauntlet() {
    if (this.#isRunning) return;
    if (!this.#gauntletManager.patterns.length) {
      this.#showCanvasOverlay(
        "No Patterns",
        "The opposing team has not published any patterns yet.",
        [],
      );
      return;
    }

    this.#sidebarManager.collapse();
    this.#showCanvasOverlay(
      "Gauntlet Mode",
      "Beat your opponents' pattern with the least hits!",
      [],
    );
    this.#startCountdown("gauntlet");
  }

  #startCountdown(mode, url = "") {
    let count = 3;
    const timerEl = document.createElement("div");
    timerEl.className = "countdown-timer";
    timerEl.textContent = count;
    this.#overlayActions.appendChild(timerEl);

    // TODO: return promise that resolves after countdown, so the caller can call "start game" themselves
    const interval = setInterval(() => {
      count--;
      timerEl.textContent = count;

      if (count <= 0) {
        clearInterval(interval);
        this.#overlayActions.removeChild(timerEl);
        this.#startGameMode(mode, url);
      }
    }, 1000);
  }

  #startGameMode(mode, url = "") {
    if (mode === "playtest") {
      this.#startPlaytestGame(url);
    } else if (mode === "gauntlet") {
      this.#startGauntletGame();
    }
  }

  #startPlaytestGame(url) {
    this.#mode = "playtest";
    this.#isRunning = true;

    this.#setModeIndicator("playtest");

    if (this.#engine) {
      this.#engine.stop();
      this.#engine = null;
    }

    const engine = new GameEngine(document.getElementById("game-canvas"), url, {
      playerRadius: 14, // TEST_RADIUS // TODO: make this magic number a constant at the top
      recordTrajectory: true,
    });

    engine.addEventListener("hit", (e) => this.#updateHits(e.detail.hits));
    engine.addEventListener("finish", (e) =>
      this.#onPlaytestFinish(e.detail.hits, e.detail.trajectory, url),
    );
    engine.addEventListener("restart", () => this.startPlaytest(url));
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
    this.#updateTimer();
  }

  #startGauntletGame() {
    this.#mode = "gauntlet";
    this.#isRunning = true;
    this.#gauntletManager.currentIdx = 0;
    this.#gauntletManager.totalHits = 0;
    this.#gauntletManager.hitsPerPattern = new Array(
      this.#gauntletManager.patterns.length,
    ).fill(null);

    this.#setModeIndicator("gauntlet");

    this.#playPattern(0, null);
  }

  #playPattern(idx, initialPlayer) {
    const p = this.#gauntletManager.patterns[idx];
    if (!p) {
      this.#endGauntlet();
      return;
    }

    document.querySelectorAll(".pattern-item").forEach((el, i) => {
      el.setAttribute("data-active", i === idx ? "true" : "false");
      el.setAttribute(
        "data-done",
        this.#gauntletManager.hitsPerPattern[i] !== null ? "true" : "false",
      );
    });

    if (this.#hudPattern)
      this.#hudPattern.textContent = `${idx + 1} / ${this.#gauntletManager.patterns.length}`;
    if (this.#canvasOverlay)
      this.#canvasOverlay.setAttribute("data-visible", "false");

    if (this.#engine) {
      this.#engine.stop();
      this.#engine = null;
    }

    const engine = new GameEngine(
      document.getElementById("game-canvas"),
      p.video_url,
      {
        playerRadius: 8, // REAL_RADIUS
        recordTrajectory: false,
        initialPlayer,
      },
    );

    engine.addEventListener("hit", (e) => {
      if (this.#hudHits) this.#hudHits.textContent = `Hits: ${e.detail.hits}`;
    });
    engine.addEventListener("finish", () => this.#onPatternFinish(idx));
    engine.addEventListener("restart", () => this.startGauntlet());
    engine.addEventListener("videoerror", () => {
      this.#gauntletManager.hitsPerPattern[idx] = 99;
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
      pi.setAttribute("data-active", "false");
      pi.setAttribute("data-done", "true");
      const hitsEl = pi.querySelector(".pi-hits");
      if (hitsEl) {
        hitsEl.textContent =
          hits === 0 ? "✓" : `${hits} hit${hits > 1 ? "s" : ""}`;
      }
    }

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

  #onPlaytestFinish(hits, trajectory, url) {
    this.#isRunning = false;
    this.#trajectory = trajectory;

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

  #endGauntlet() {
    this.#isRunning = false;

    this.#submitGauntletScore();

    const summaryContainer = document.createElement("div");
    this.#gauntletManager.patterns.forEach((p, i) => {
      const h = this.#gauntletManager.hitsPerPattern[i];
      const row = document.createElement("div");
      row.className = "summary-list";

      const label = document.createElement("span");
      label.textContent = `#${i + 1} ${p.slot}`;

      const result = document.createElement("span");
      result.className =
        h === 0 ? "summary-item success" : "summary-item error";
      result.textContent = h === 0 ? "✓" : h + "h";

      row.appendChild(label);
      row.appendChild(result);
      summaryContainer.appendChild(row);
    });

    const totalRow = document.createElement("div");
    totalRow.className = "summary-item";
    totalRow.style.marginTop = "10px";
    totalRow.textContent = `Total: ${this.#gauntletManager.totalHits} hit${this.#gauntletManager.totalHits !== 1 ? "s" : ""}`;
    summaryContainer.appendChild(totalRow);

    if (this.#gauntletManager.totalHits === 0) {
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
        `${this.#gauntletManager.totalHits} Hit${this.#gauntletManager.totalHits !== 1 ? "s" : ""} Total`,
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
          hits: this.#gauntletManager.totalHits,
          infinite_time: null,
        }),
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
   * @param {HTMLElement} [extraContent]
   */
  #showCanvasOverlay(title, subtitle, actions = [], extraContent = null) {
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

    if (extraContent) {
      this.#overlayActions.appendChild(extraContent);
    }

    this.#canvasOverlay.setAttribute("data-visible", "true");
  }

  #updateTimer() {
    if (!this.#engine || !this.#engine.video) {
      if (this.#hudTime) this.#hudTime.textContent = "10.0s";
      return;
    }

    const left = Math.max(0, 10 - this.#engine.video.currentTime);
    if (this.#hudTime) this.#hudTime.textContent = left.toFixed(1) + "s";

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
    this.#playModeIndicator.setAttribute("data-mode", mode);
  }
}
