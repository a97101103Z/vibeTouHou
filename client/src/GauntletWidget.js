/**
 * GauntletWidget - Manages opponent patterns and leaderboard.
 * @extends EventTarget
 */

import {
  COUNTDOWN_LABEL, COUNTDOWN_SUB,
  LOADING_OPP_VIDEOS, LOADING,
  NO_PATTERNS_YET, ERR_LOAD_PATTERNS,
  NO_SCORES, LB_SCORE_HITS,
  SUMMARY_HITS,
} from "./strings.js";

export class GauntletWidget extends EventTarget {
  #patterns = [];
  #leaderboard = [];
  #lbPollTimer = null;
  #countdownInterval = null;
  #locked = true;  // locked by default until admin starts gauntlet phase

  // DOM references
  #btnStartGauntlet;
  #patternList;
  #patternItems = [];
  #leaderboardEl;
  #gauntletSection;

  get patterns() {
    return this.#patterns;
  }

  get leaderboard() {
    return this.#leaderboard;
  }

  init() {
    this.#cacheDOM();
    this.#setupEventListeners();
    // Start locked — phase service will unlock when gauntlet phase is active
    this.setLocked(true, /* skipLoad */ true);
    this.startLeaderboardPoll();
  }

  #cacheDOM() {
    this.#btnStartGauntlet = document.getElementById("btn-start-gauntlet");
    this.#patternList = document.getElementById("pattern-list");
    this.#leaderboardEl = document.getElementById("leaderboard");
    this.#gauntletSection = document.getElementById("gauntlet-section");
  }

  #setupEventListeners() {
    if (this.#btnStartGauntlet) {
      this.#btnStartGauntlet.addEventListener("click", () => {
        if (this.#locked) return;
        this.dispatchEvent(new CustomEvent("startGauntlet"));
      });
    }
  }

  // ── Phase lock ──────────────────────────────────────────────────────────────

  /**
   * Lock or unlock the gauntlet section.
   * @param {boolean} locked
   * @param {boolean} [skipLoad=false]  If true, don't trigger loadPatterns on unlock
   */
  setLocked(locked, skipLoad = false) {
    this.#locked = locked;

    if (this.#gauntletSection) {
      this.#gauntletSection.setAttribute(
        "data-locked",
        locked ? "true" : "false",
      );
    }
    if (this.#btnStartGauntlet) {
      this.#btnStartGauntlet.disabled = locked;
    }

    if (!locked && !skipLoad) {
      this.#unlockWithDelay();
    }
  }

  showCountdown(activeAt) {
    this.hideCountdown();

    if (!this.#gauntletSection) return;

    // Switch to 'pending' state so the ::after lock overlay doesn't overlap
    this.#gauntletSection.setAttribute("data-locked", "pending");

    const banner = document.createElement("div");
    banner.id = "phase-countdown";
    banner.innerHTML = `
      <div class="phase-countdown-icon">⚔️</div>
      <div class="phase-countdown-label">${COUNTDOWN_LABEL}</div>
      <div class="phase-countdown-timer" id="phase-countdown-timer">1:00</div>
      <div class="phase-countdown-sub">${COUNTDOWN_SUB}</div>
    `;

    this.#gauntletSection.appendChild(banner);

    const tick = () => {
      const secsLeft = Math.max(0, Math.ceil(activeAt - Date.now() / 1000));
      const mins = Math.floor(secsLeft / 60);
      const secs = String(secsLeft % 60).padStart(2, "0");
      const timerEl = document.getElementById("phase-countdown-timer");
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
      const subEl = banner.querySelector(".phase-countdown-sub");
      if (secsLeft === 0) {
        if (subEl) subEl.textContent = "Time's up!";
        if (this.#countdownInterval) {
          clearInterval(this.#countdownInterval);
          this.#countdownInterval = null;
        }
      }
    };

    tick();
    this.#countdownInterval = setInterval(tick, 500);
  }

  hideCountdown() {
    if (this.#countdownInterval) {
      clearInterval(this.#countdownInterval);
      this.#countdownInterval = null;
    }
    document.getElementById("phase-countdown")?.remove();
    // Restore data-locked to 'true' so the lock overlay comes back until phaselocked fires
    if (this.#gauntletSection && this.#gauntletSection.getAttribute("data-locked") === "pending") {
      this.#gauntletSection.setAttribute("data-locked", "true");
    }
  }

  /**
   * After the grace period expires, show a fake "Loading patterns…" state for
   * 1–3 seconds before actually fetching, then make the gauntlet interactive.
   */
  #unlockWithDelay() {
    // Show loading state immediately
    if (this.#patternList) {
      this.#patternList.innerHTML =
        `<div class="loading-message">${LOADING_OPP_VIDEOS}</div>`;
    }
    if (this.#btnStartGauntlet) {
      this.#btnStartGauntlet.disabled = true;
    }

    const delay = 1000 + Math.random() * 2000; // 1–3 seconds
    setTimeout(async () => {
      await this.loadPatterns();
      // Re-enable Begin only if still unlocked
      if (!this.#locked && this.#btnStartGauntlet) {
        this.#btnStartGauntlet.disabled = false;
      }
    }, delay);
  }

  async loadPatterns() {
    if (!this.#patternList) return;

    this.#patternList.innerHTML = `<div class="loading-message">${LOADING}</div>`;

    try {
      const res = await fetch("/api/patterns/opponent", {
        credentials: "include",
      });
      const data = await res.json();
      this.#patterns = data.patterns;

      if (!this.#patterns.length) {
        this.#patternList.innerHTML =
          `<div class="loading-message">${NO_PATTERNS_YET}</div>`;
        return;
      }

      this.#renderPatternList();
    } catch (_) {
      this.#patternList.innerHTML =
        `<div class="loading-message error">${ERR_LOAD_PATTERNS}</div>`;
    }
  }

  #renderPatternList() {
    if (!this.#patternList) return;

    this.#patternList.innerHTML = "";
    this.#patternItems = this.#patterns.map((p, i) => {
      const item = document.createElement("div");
      item.className = "pattern-item";
      item.id = `pi-${i}`;

      const hitsEl = document.createElement("span");
      hitsEl.className = "pi-hits";
      hitsEl.textContent = "—";

      item.innerHTML = `
        <span class="pi-idx">#${i + 1}</span>
        <span>${p.slot}</span>
      `;
      item.appendChild(hitsEl);

      item.addEventListener("click", () => {
        if (this.#locked) return;
        this.dispatchEvent(
          new CustomEvent("startGauntlet", { detail: { startIdx: i } }),
        );
      });

      this.#patternList.appendChild(item);
      return { el: item, hitsEl };
    });
  }

  /**
   * Highlight the active pattern and update done/normal states based on hits array.
   * @param {number} idx
   * @param {(number|null)[]} hitsPerPattern - array where null means untouched, number means done
   */
  activatePatternItem(idx, hitsPerPattern) {
    this.#patternItems.forEach((item, i) => {
      item.el.setAttribute("data-active", i === idx ? "true" : "false");
      item.el.setAttribute(
        "data-done",
        hitsPerPattern[i] !== null ? "true" : "false",
      );
    });
  }

  /**
   * Mark a pattern item as complete (no longer active, shown as done).
   * @param {number} idx
   */
  deactivatePatternItem(idx) {
    const item = this.#patternItems[idx];
    if (!item) return;
    item.el.setAttribute("data-active", "false");
    item.el.setAttribute("data-done", "true");
  }

  /**
   * Update the hits display text for a pattern item.
   * @param {number} idx
   * @param {number} hits
   */
  setPatternItemHits(idx, hits) {
    const item = this.#patternItems[idx];
    if (!item) return;
    item.hitsEl.textContent = hits === 0 ? "✓" : SUMMARY_HITS(hits);
  }

  /**
   * Reset all pattern items to their initial state.
   */
  resetAllPatternItems() {
    this.#patternItems.forEach((item) => {
      item.el.setAttribute("data-active", "false");
      item.el.setAttribute("data-done", "false");
      item.hitsEl.textContent = "—";
    });
  }

  startLeaderboardPoll() {
    if (this.#lbPollTimer) clearInterval(this.#lbPollTimer);
    this.updateLeaderboard();
    this.#lbPollTimer = setInterval(() => this.updateLeaderboard(), 5000);
  }

  stopLeaderboardPoll() {
    if (this.#lbPollTimer) {
      clearInterval(this.#lbPollTimer);
      this.#lbPollTimer = null;
    }
  }

  async updateLeaderboard() {
    if (!this.#leaderboardEl) return;

    try {
      const res = await fetch("/api/leaderboard", { credentials: "include" });
      const data = await res.json();
      this.#renderLeaderboard(data);
    } catch (_) {}
  }

  #renderLeaderboard(data) {
    if (!this.#leaderboardEl) return;

    const rows = [];
    for (const team of ["red", "blue"]) {
      const slots = data[team] || {};
      for (const [idx, score] of Object.entries(slots)) {
        rows.push({ team, idx: parseInt(idx), score });
      }
    }

    rows.sort((a, b) => {
      const ah = a.score.best_hits ?? Infinity;
      const bh = b.score.best_hits ?? Infinity;
      return ah - bh;
    });

    this.#leaderboard = rows;

    if (rows.length === 0) {
      this.#leaderboardEl.innerHTML =
        `<div class="empty-message">${NO_SCORES}</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    rows.forEach((r) => {
      const h = r.score.best_hits;
      const scoreStr = h == null ? "—" : LB_SCORE_HITS(h);

      const row = document.createElement("div");
      row.className = `lb-row lb-${r.team}`;

      const slot = document.createElement("span");
      slot.className = "lb-slot";
      slot.textContent = `${r.team.toUpperCase()}-${r.idx}`;

      const score = document.createElement("span");
      score.className = `lb-score ${h === 0 ? "best" : ""}`;
      score.textContent = scoreStr;

      row.appendChild(slot);
      row.appendChild(score);
      fragment.appendChild(row);
    });

    this.#leaderboardEl.innerHTML = "";
    this.#leaderboardEl.appendChild(fragment);
  }
}
