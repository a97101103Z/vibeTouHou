/**
 * GauntletManager - Manages opponent patterns and leaderboard.
 * @extends EventTarget
 */

export class GauntletManager extends EventTarget {
  #patterns = [];
  #currentIdx = 0;
  #totalHits = 0;
  #hitsPerPattern = [];
  #leaderboard = [];
  #isRunning = false;
  #lbPollTimer = null;

  // DOM references
  #btnStartGauntlet;
  #patternList;
  #leaderboardEl;

  get patterns() {
    return this.#patterns;
  }

  get currentIdx() {
    return this.#currentIdx;
  }

  set currentIdx(value) {
    this.#currentIdx = value;
  }

  get totalHits() {
    return this.#totalHits;
  }

  set totalHits(value) {
    this.#totalHits = value;
  }

  get hitsPerPattern() {
    return this.#hitsPerPattern;
  }

  set hitsPerPattern(value) {
    this.#hitsPerPattern = value;
  }

  get leaderboard() {
    return this.#leaderboard;
  }

  get isRunning() {
    return this.#isRunning;
  }

  set isRunning(value) {
    this.#isRunning = value;
  }

  init() {
    this.#cacheDOM();
    this.#setupEventListeners();
    this.loadPatterns();
    this.startLeaderboardPoll();
  }

  #cacheDOM() {
    this.#btnStartGauntlet = document.getElementById("btn-start-gauntlet");
    this.#patternList = document.getElementById("pattern-list");
    this.#leaderboardEl = document.getElementById("leaderboard");
  }

  #setupEventListeners() {
    if (this.#btnStartGauntlet) {
      this.#btnStartGauntlet.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("startGauntlet"));
      });
    }
  }

  async loadPatterns() {
    if (!this.#patternList) return;

    this.#patternList.innerHTML = '<div class="loading-message">Loading…</div>';

    try {
      const res = await fetch("/api/patterns/opponent", {
        credentials: "include",
      });
      const data = await res.json();
      this.#patterns = data.patterns;

      if (!this.#patterns.length) {
        this.#patternList.innerHTML =
          '<div class="loading-message">No published patterns yet.</div>';
        return;
      }

      this.#renderPatternList();
    } catch (_) {
      this.#patternList.innerHTML =
        '<div class="loading-message error">Could not load patterns.</div>';
    }
  }

  #renderPatternList() {
    if (!this.#patternList) return;

    this.#patternList.innerHTML = "";
    this.#patterns.forEach((p, i) => {
      const item = document.createElement("div");
      item.className = "pattern-item";
      item.id = `pi-${i}`;
      item.innerHTML = `
        <span class="pi-idx">#${i + 1}</span>
        <span>${p.slot}</span>
        <span class="pi-hits">—</span>
      `;

      item.addEventListener("click", () => {
        if (!this.#isRunning) {
          this.#currentIdx = i;
          this.dispatchEvent(new CustomEvent("startGauntlet"));
        }
      });

      this.#patternList.appendChild(item);
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
      if (ah !== bh) return ah - bh;
      return (b.score.infinite_time ?? -1) - (a.score.infinite_time ?? -1);
    });

    this.#leaderboard = rows;

    if (rows.length === 0) {
      this.#leaderboardEl.innerHTML =
        '<div class="empty-message">No scores yet.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    rows.forEach((r) => {
      const h = r.score.best_hits;
      const it = r.score.infinite_time;
      const scoreStr =
        h == null
          ? "—"
          : h === 0 && it != null
            ? `Perfect + ${it.toFixed(0)}s∞`
            : `${h} hit${h !== 1 ? "s" : ""}`;

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
