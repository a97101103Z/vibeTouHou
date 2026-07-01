import { adminApi } from "./api.js";
import { GameEngine } from "../game/engine.js";

function formatTimeAgo(unixTs) {
  const secs = Math.max(0, Math.floor((Date.now() / 1000) - unixTs));
  if (secs < 5) return "now";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function formatScore(scores) {
  if (scores.best_hits === null && scores.infinite_time === null) return "—";
  if (scores.best_hits === 0 && scores.infinite_time !== null) {
    return `0h / ${scores.infinite_time}s∞`;
  }
  return `${scores.best_hits}h`;
}

function galleryVideoUrl(entryId) {
  return `/api/gallery/${entryId}/video`;
}

export class Dashboard {
  constructor() {
    this.#cacheDOM();
  }

  #pollingTimer = null;
  #countdownTimer = null;
  #gameEngine = null;
  #gameRunning = false;
  #gameCountdownId = null;
  #gameClosed = false;
  #currentPhase = null;
  #lastPhaseData = null;

  #phaseDisplay;
  #togglePhaseBtn;
  #statsDisplay;
  #slotsTbody;
  #galleryList;
  #videoModal;
  #videoPlayer;
  #videoModalClose;
  #leaderboardList;
  #graceSeconds;
  #skipBtn;

  #cacheDOM() {
    this.#phaseDisplay = document.getElementById("phase-display");
    this.#togglePhaseBtn = document.getElementById("btn-toggle-phase");
    this.#statsDisplay = document.getElementById("stats-display");
    this.#slotsTbody = document.getElementById("slots-tbody");
    this.#galleryList = document.getElementById("gallery-admin-list");
    this.#videoModal = document.getElementById("video-modal");
    this.#videoPlayer = document.getElementById("admin-video-player");
    this.#videoModalClose = document.getElementById("video-modal-close");
    this.#leaderboardList = document.getElementById("leaderboard-admin-list");
    this.#graceSeconds = document.getElementById("grace-seconds");
    this.#skipBtn = document.getElementById("btn-skip-grace");
  }

  startPolling() {
    this.#poll();
    this.#pollingTimer = setInterval(() => this.#poll(), 5000);
    this.#countdownTimer = setInterval(() => this.#tick(), 1000);
  }

  stopPolling() {
    if (this.#pollingTimer) {
      clearInterval(this.#pollingTimer);
      this.#pollingTimer = null;
    }
    if (this.#countdownTimer) {
      clearInterval(this.#countdownTimer);
      this.#countdownTimer = null;
    }
  }

  async #poll() {
    try {
      const data = await adminApi.overview();
      this.#renderPhase(data.phase);
      this.#renderStats(data.slots);
      this.#renderSlotsTable(data.slots);
      this.#renderGallery(data.gallery);
      this.#renderLeaderboard(data.leaderboard);
    } catch (err) {
      console.error("Overview poll failed:", err);
    }
  }

  renderLoading() {
    this.#slotsTbody.innerHTML =
      '<tr><td colspan="9" style="text-align: center; padding: 40px; color: #555;">Loading…</td></tr>';
  }

  #renderPhase(phase) {
    this.#lastPhaseData = phase;
    const isGauntlet = phase.phase === "gauntlet";
    const isActive = phase.active_at && Date.now() / 1000 >= phase.active_at;
    const graceActive = phase.active_at && !isActive;

    this.#currentPhase = phase.phase;

    let label = isGauntlet ? "GAUNTLET" : "CODE";
    let cls = isGauntlet ? "phase-gauntlet" : "phase-code";

    let extra = "";
    if (graceActive) {
      const secs = Math.max(0, Math.ceil(phase.active_at - Date.now() / 1000));
      extra = ` — ${isGauntlet ? "activates" : "unlocks"} in ${secs}s`;
    }

    this.#phaseDisplay.innerHTML = `
      <span class="phase-badge ${cls}">${label}</span>
      <span style="margin-left: 8px; color: #888;">${extra}</span>
    `;

    this.#togglePhaseBtn.textContent = isGauntlet ? "Switch to Code" : "Switch to Gauntlet";
    this.#skipBtn.style.display = graceActive ? "inline-block" : "none";
  }

  #tick() {
    const phase = this.#lastPhaseData;
    if (!phase || !phase.active_at) return;
    if (Date.now() / 1000 >= phase.active_at) {
      this.#poll();
      return;
    }
    const isGauntlet = phase.phase === "gauntlet";
    const secs = Math.max(0, Math.ceil(phase.active_at - Date.now() / 1000));
    const extra = ` — ${isGauntlet ? "activates" : "unlocks"} in ${secs}s`;
    const span = this.#phaseDisplay.querySelector("span:last-child");
    if (span) span.textContent = extra;
  }

  #renderStats(slots) {
    const total = slots.length;
    const claimed = slots.filter((s) => s.claimed).length;
    const online = slots.filter((s) => s.online).length;
    const published = slots.filter((s) => s.has_published).length;

    this.#statsDisplay.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; text-align: center;">
        <div><strong style="font-size: 1.4rem;">${total}</strong><br><span style="color:#888;">Slots</span></div>
        <div><strong style="font-size: 1.4rem;">${claimed}</strong><br><span style="color:#888;">Claimed</span></div>
        <div><strong style="font-size: 1.4rem;">${online}</strong><br><span style="color:#888;">Online</span></div>
        <div><strong style="font-size: 1.4rem;">${published}</strong><br><span style="color:#888;">Published</span></div>
      </div>
    `;
  }

  #renderSlotsTable(slots) {
    this.#slotsTbody.innerHTML = slots
      .map((s) => {
        const claimedLabel = s.claimed ? "Claimed" : "Free";
        const rowClass = s.claimed ? `slot-team-${s.team}` : "slot-unclaimed";

        const onlineDot = s.claimed
          ? `<span class="online-dot ${s.online ? "online" : "offline"}"></span>`
          : "";

        const lastSeen = s.last_seen
          ? formatTimeAgo(s.last_seen)
          : (s.claimed ? "none" : "—");

        const outputIcon = s.has_output
          ? '<span class="status-yes">●</span>'
          : '<span class="status-no">○</span>';

        const publishedIcon = s.has_published
          ? '<span class="status-yes">●</span>'
          : '<span class="status-no">○</span>';

        const scoreText = s.claimed ? (s.scores ? formatScore(s.scores) : "—") : "—";

        const resetBtn = s.claimed
          ? `<button class="btn-admin danger" data-action="reset" data-team="${s.team}" data-index="${s.index}">Reset</button>`
          : "";

        const watchBtn = s.has_output
          ? `<button class="btn-admin" data-action="watch" data-team="${s.team}" data-index="${s.index}">Watch</button>`
          : "";

        const playBtn = s.has_output
          ? `<button class="btn-admin play" data-action="play" data-team="${s.team}" data-index="${s.index}" data-slot="${s.slot_key.toUpperCase()}">Play</button>`
          : "";

        const addGalleryBtn = s.has_output
          ? `<button class="btn-admin primary" data-action="add-gallery" data-team="${s.team}" data-index="${s.index}" data-slot="${s.slot_key.toUpperCase()}">+Gallery</button>`
          : "";

        return `
          <tr class="${rowClass}">
            <td><strong>${s.slot_key.toUpperCase()}</strong></td>
            <td>${claimedLabel}</td>
            <td>${onlineDot}</td>
            <td>${lastSeen}</td>
            <td>${s.asset_count}</td>
            <td>${outputIcon}</td>
            <td>${publishedIcon}</td>
            <td>${scoreText}</td>
            <td style="white-space: nowrap;">
              ${watchBtn}
              ${playBtn}
              ${addGalleryBtn}
              ${resetBtn}
            </td>
          </tr>
        `;
      })
      .join("");

    this.#slotsTbody.querySelectorAll("[data-action='reset']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const team = btn.dataset.team;
        const index = parseInt(btn.dataset.index);
        if (confirm(`Reset ${team}-${index}? This will delete all data for this slot.`)) {
          adminApi.resetSlot(team, index).then(() => this.#poll()).catch((err) => alert(err.message));
        }
      });
    });

    this.#slotsTbody.querySelectorAll("[data-action='watch']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const team = btn.dataset.team;
        const index = parseInt(btn.dataset.index);
        this.#openVideoPlayer(adminApi.slotVideoUrl(team, index), true);
      });
    });

    this.#slotsTbody.querySelectorAll("[data-action='play']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const team = btn.dataset.team;
        const index = parseInt(btn.dataset.index);
        const slotLabel = btn.dataset.slot;
        this.#launchEngine(adminApi.slotVideoUrl(team, index), slotLabel);
      });
    });

    this.#slotsTbody.querySelectorAll("[data-action='add-gallery']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const team = btn.dataset.team;
        const index = parseInt(btn.dataset.index);
        const slotLabel = btn.dataset.slot;
        const title = prompt(`Name for gallery entry from ${slotLabel}:`, slotLabel);
        if (title === null) return;
        adminApi.addGalleryEntry(title || slotLabel, 0, team, index)
          .then(() => this.#poll())
          .catch((err) => alert(err.message));
      });
    });
  }

  #renderGallery(entries) {
    if (!entries || entries.length === 0) {
      this.#galleryList.innerHTML = '<div style="color: #555;">No gallery entries yet.</div>';
      return;
    }

    this.#galleryList.innerHTML = entries
      .map(
        (e) => `
        <div class="gallery-entry-row">
          <div class="gallery-entry-info">
            <span class="title">${e.title}</span>
            <span class="hits">${e.avg_hits}h</span>
            <span style="color: #555; font-size: 0.75rem;">(${e.id})</span>
          </div>
          <div class="gallery-entry-actions">
            <button class="btn-admin" data-action="gallery-watch" data-id="${e.id}">Watch</button>
            <button class="btn-admin play" data-action="gallery-play" data-id="${e.id}">Play</button>
            <button class="btn-admin danger" data-action="gallery-delete" data-id="${e.id}">Delete</button>
          </div>
        </div>
      `
      )
      .join("");

    this.#galleryList.querySelectorAll("[data-action='gallery-watch']").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.#openVideoPlayer(galleryVideoUrl(btn.dataset.id), true);
      });
    });

    this.#galleryList.querySelectorAll("[data-action='gallery-play']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = btn.closest(".gallery-entry-row");
        const titleEl = row?.querySelector(".title");
        const label = titleEl?.textContent || "Gallery";
        this.#launchEngine(galleryVideoUrl(btn.dataset.id), label);
      });
    });

    this.#galleryList.querySelectorAll("[data-action='gallery-delete']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        if (confirm(`Delete gallery entry "${id}"?`)) {
          adminApi.deleteGalleryEntry(id).then(() => this.#poll()).catch((err) => alert(err.message));
        }
      });
    });
  }

  #renderLeaderboard(data) {
    const entries = [];
    for (const [team, slots] of Object.entries(data)) {
      for (const [index, score] of Object.entries(slots)) {
        if (score.best_hits !== null) {
          entries.push({ team, index, ...score });
        }
      }
    }

    if (entries.length === 0) {
      this.#leaderboardList.innerHTML = '<div style="color: #555;">No scores yet.</div>';
      return;
    }

    entries.sort((a, b) => {
      if (a.best_hits !== b.best_hits) return a.best_hits - b.best_hits;
      return (b.infinite_time ?? 0) - (a.infinite_time ?? 0);
    });

    let rank = 0;
    let prevHits = null;
    let prevTime = null;

    this.#leaderboardList.innerHTML = `
      <table class="slots-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Team</th>
            <th>Hits</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map((e) => {
            if (e.best_hits !== prevHits || e.infinite_time !== prevTime) {
              rank++;
              prevHits = e.best_hits;
              prevTime = e.infinite_time;
            }
            const timeStr = e.infinite_time !== null ? `${e.infinite_time}s` : "—";
            return `<tr>
              <td>${rank}</td>
              <td>${e.team}-${e.index}</td>
              <td>${e.best_hits}h</td>
              <td>${timeStr}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  #openVideoPlayer(url, autoplay = false) {
    this.#videoPlayer.autoplay = autoplay;
    this.#videoPlayer.src = url;
    this.#videoModal.classList.add("visible");

    const closeModal = () => {
      this.#videoModal.classList.remove("visible");
      this.#videoPlayer.pause();
      this.#videoPlayer.src = "";
    };

    this.#videoModalClose.onclick = closeModal;
    this.#videoModal.addEventListener("click", (e) => {
      if (e.target === this.#videoModal) closeModal();
    }, { once: true });
  }

  #launchEngine(url, label) {
    this.#gameEngine = null;
    this.#gameRunning = false;
    this.#gameCountdownId = null;
    this.#gameClosed = false;

    const modal = document.getElementById("game-modal");
    const canvas = document.getElementById("admin-game-canvas");
    const ctx = canvas.getContext("2d");
    const overlay = document.getElementById("admin-canvas-overlay");
    const titleEl = document.getElementById("admin-overlay-title");
    const subEl = document.getElementById("admin-overlay-subtitle");
    const actionsEl = document.getElementById("admin-overlay-actions");
    const patternEl = document.getElementById("admin-hud-pattern");
    const timeEl = document.getElementById("admin-hud-time");
    const hitsEl = document.getElementById("admin-hud-hits");
    const modalCloseEl = document.getElementById("game-modal-close");

    const cleanup = () => {
      if (this.#gameCountdownId) { clearInterval(this.#gameCountdownId); this.#gameCountdownId = null; }
      this.#gameRunning = false;
      if (this.#gameEngine) { this.#gameEngine.stop(); this.#gameEngine = null; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const close = () => {
      if (this.#gameClosed) return;
      this.#gameClosed = true;
      cleanup();
      modal.classList.remove("visible");
      modal.style.display = "";
    };

    const startGame = () => {
      if (this.#gameClosed) return;
      this.#gameRunning = true;
      this.#gameEngine = new GameEngine(canvas, url, {
        playerRadius: 8,
        recordTrajectory: true,
      });

      this.#gameEngine.addEventListener("hit", (e) => {
        if (this.#gameClosed) return;
        hitsEl.textContent = `Hits: ${e.detail.hits}`;
      });

      this.#gameEngine.addEventListener("finish", () => {
        this.#gameRunning = false;
        overlay.setAttribute("data-visible", "true");
        titleEl.textContent = "Finished";
        subEl.textContent = `Pattern: ${label}`;
        hitsEl.textContent = `Hits: ${this.#gameEngine ? this.#gameEngine.hits : "?"}`;
        actionsEl.innerHTML = `<button class="btn-admin play" id="btn-game-replay">Replay</button>
          <button class="btn-admin danger" id="btn-game-close">Close</button>`;
        actionsEl.querySelector("#btn-game-replay")?.addEventListener("click", () => { this.#gameClosed = false; ready(); }, { once: true });
        actionsEl.querySelector("#btn-game-close")?.addEventListener("click", close, { once: true });
      });

      this.#gameEngine.addEventListener("videoerror", () => {
        this.#gameRunning = false;
        overlay.setAttribute("data-visible", "true");
        titleEl.textContent = "Video Error";
        subEl.textContent = "Failed to load video.";
        actionsEl.innerHTML = `<button class="btn-admin danger" id="btn-game-close">Close</button>`;
        actionsEl.querySelector("#btn-game-close")?.addEventListener("click", close, { once: true });
      });

      overlay.setAttribute("data-visible", "false");
      patternEl.textContent = label;
      timeEl.textContent = "10.0s";
      hitsEl.textContent = "Hits: 0";
      this.#gameEngine.start().catch(() => { if (this.#gameRunning) { this.#gameRunning = false; close(); } });
    };

    const ready = () => {
      cleanup();
      overlay.setAttribute("data-visible", "true");
      titleEl.textContent = "Ready";
      subEl.textContent = label;
      actionsEl.innerHTML = `<button class="btn-admin primary" id="btn-game-start">Play</button>
        <button class="btn-admin danger" id="btn-game-cancel">Cancel</button>`;
      actionsEl.querySelector("#btn-game-start")?.addEventListener("click", () => {
        if (this.#gameClosed) return;
        let count = 3;
        overlay.setAttribute("data-visible", "true");
        titleEl.textContent = String(count);
        subEl.textContent = "Get ready...";
        actionsEl.innerHTML = "";
        this.#gameCountdownId = setInterval(() => {
          count--;
          if (count > 0) {
            titleEl.textContent = String(count);
          } else {
            clearInterval(this.#gameCountdownId);
            this.#gameCountdownId = null;
            startGame();
          }
        }, 1000);
      }, { once: true });
      actionsEl.querySelector("#btn-game-cancel")?.addEventListener("click", close, { once: true });
    };

    this.#gameClosed = false;
    modal.style.display = "flex";
    modal.classList.add("visible");
    modalCloseEl.onclick = close;
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); }, { once: true });

    ready();
  }

  setupPhaseControl() {
    this.#togglePhaseBtn.addEventListener("click", async () => {
      const targetPhase = this.#currentPhase === "gauntlet" ? "code" : "gauntlet";
      const parsed = parseInt(this.#graceSeconds.value);
      const graceSeconds = Number.isNaN(parsed) ? 60 : parsed;
      try {
        await adminApi.setPhase(targetPhase, graceSeconds);
        this.#poll();
      } catch (err) {
        alert(err.message);
      }
    });

    this.#skipBtn.addEventListener("click", async () => {
      try {
        await adminApi.skipGrace();
        this.#poll();
      } catch (err) {
        alert(err.message);
      }
    });
  }
}
