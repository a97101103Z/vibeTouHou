/**
 * GauntletWidget — Manages opponent patterns and leaderboard.
 * @extends EventTarget
 */

import {
  COUNTDOWN_LABEL, COUNTDOWN_SUB,
  LOADING_OPP_VIDEOS, LOADING,
  NO_PATTERNS_YET, ERR_LOAD_PATTERNS,
  NO_SCORES,
  PATTERN_HITS_DISPLAY,
  LB_TEAM_AVG, LB_MEMBER,
} from "./strings.js";

export class GauntletWidget extends EventTarget {
  #patterns = [];
  #leaderboard = [];
  #lbPollTimer = null;
  #countdownInterval = null;
  #locked = true;

  // Per-pattern scores from the server: {"0": {"best_hits": 1}, ...}
  #slotScores = {};

  // DOM references
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
    this.setLocked(true, /* skipLoad */ true);
    this.startLeaderboardPoll();
  }

  #cacheDOM() {
    this.#patternList = document.getElementById("pattern-list");
    this.#leaderboardEl = document.getElementById("leaderboard");
    this.#gauntletSection = document.getElementById("gauntlet-section");
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

    setTimeout(async () => {
      await this.loadPatterns();
    }, 1000 + Math.random() * 2000);
  }

  // ── Patterns & Scores ──────────────────────────────────────────────────────

  async loadPatterns() {
    if (!this.#patternList) return;

    this.#patternList.innerHTML = `<div class="loading-message">${LOADING}</div>`;

    try {
      const patternsRes = await fetch("/api/patterns/opponent", { credentials: "include" });
      const patternsData = await patternsRes.json();
      this.#patterns = patternsData.patterns;

      if (!this.#patterns.length) {
        this.#patternList.innerHTML =
          `<div class="loading-message">${NO_PATTERNS_YET}</div>`;
        return;
      }

      this.#renderPatternList();
      await this.refreshProgress();
    } catch (_) {
      this.#patternList.innerHTML =
        `<div class="loading-message error">${ERR_LOAD_PATTERNS}</div>`;
    }
  }

  async refreshProgress() {
    try {
      const res = await fetch("/api/score/progress", { credentials: "include" });
      const data = await res.json();
      this.#slotScores = data.scores ?? {};
      this.#updatePatternItems();
    } catch (_) {}
  }

  #renderPatternList() {
    if (!this.#patternList) return;

    this.#patternList.innerHTML = "";
    this.#patternItems = this.#patterns.map((p, i) => {
      const item = document.createElement("div");
      item.className = "pattern-item";
      item.id = `pi-${i}`;

      const hitsDisplay = document.createElement("span");
      hitsDisplay.className = "pi-hits-display";

      item.innerHTML = `
        <span class="pi-idx">#${i + 1}</span>
        <span>${p.slot}</span>
      `;
      item.appendChild(hitsDisplay);

      item.addEventListener("click", () => {
        if (this.#locked) return;
        this.dispatchEvent(
          new CustomEvent("playPattern", { detail: { patternIdx: i } }),
        );
      });

      this.#patternList.appendChild(item);
      return { el: item, hitsDisplay };
    });

    this.#updatePatternItems();
  }

  #updatePatternItems() {
    this.#patternItems.forEach((item, i) => {
      const scoreInfo = this.#slotScores[String(i)];
      const bestHits = scoreInfo?.best_hits;

      item.el.setAttribute("data-active", "false");

      if (bestHits != null) {
        item.hitsDisplay.textContent = PATTERN_HITS_DISPLAY(bestHits);
        item.hitsDisplay.className = `pi-hits-display ${bestHits === 0 ? "perfect" : "has-hits"}`;
      } else {
        item.hitsDisplay.textContent = "";
        item.hitsDisplay.className = "pi-hits-display";
      }
    });
  }

  activatePatternItem(idx) {
    this.#patternItems.forEach((item, i) => {
      item.el.setAttribute("data-active", i === idx ? "true" : "false");
    });
  }

  resetAllPatternItems() {
    this.#patternItems.forEach((item) => {
      item.el.setAttribute("data-active", "false");
    });
  }

  // ── Leaderboard ────────────────────────────────────────────────────────────

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

    const HITS_TO_POINTS = {0: 3, 1: 2, 2: 1};
    const pointsForHits = (h) => HITS_TO_POINTS[h] ?? 0;

    const fragment = document.createDocumentFragment();
    let hasAny = false;

    for (const team of ["red", "blue"]) {
      const claimed = data.claimed?.[team] ?? [];
      const teamScores = data.scores?.[team] ?? {};

      const members = [];
      let teamTotal = 0;

      for (const idx of claimed) {
        const slotData = teamScores[idx] ?? {};
        const scores = slotData.scores ?? {};
        let total = 0;
        let done = 0;
        for (const s of Object.values(scores)) {
          const bh = s.best_hits;
          if (bh != null) {
            total += pointsForHits(bh);
            done++;
          }
        }
        members.push({ slot: `${team}-${idx}`, total_points: total, patterns_done: done });
        teamTotal += total;
      }

      const avg = members.length ? Math.round(teamTotal / members.length * 10) / 10 : 0;

      const header = document.createElement("div");
      header.className = `lb-team-header lb-${team}`;
      header.textContent = LB_TEAM_AVG(team, avg);
      fragment.appendChild(header);

      if (members.length === 0) {
        const empty = document.createElement("div");
        empty.className = "lb-row";
        empty.innerHTML = `<span class="lb-slot" style="color:var(--text-muted)">${NO_SCORES}</span>`;
        fragment.appendChild(empty);
      }

      for (const m of members) {
        const row = document.createElement("div");
        row.className = `lb-row lb-${team}`;
        row.textContent = LB_MEMBER(m.slot, m.total_points);
        fragment.appendChild(row);
        hasAny = true;
      }
    }

    if (!hasAny) {
      this.#leaderboardEl.innerHTML =
        `<div class="empty-message">${NO_SCORES}</div>`;
      return;
    }

    this.#leaderboardEl.innerHTML = "";
    this.#leaderboardEl.appendChild(fragment);
  }
}
