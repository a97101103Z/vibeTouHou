import { adminApi } from "./api.js";
import { GameEngine } from "../game/engine.js";

let pollingTimer = null;

export function startPolling() {
  poll();
  pollingTimer = setInterval(poll, 5000);
}

export function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

async function poll() {
  try {
    const data = await adminApi.overview();
    renderPhase(data.phase);
    renderStats(data.slots, data.leaderboard);
    renderSlotsTable(data.slots);
    renderGallery(data.gallery);
  } catch (err) {
    console.error("Overview poll failed:", err);
  }
}

// ── Phase ─────────────────────────────────────────────────────────────────────

function renderPhase(phase) {
  const el = document.getElementById("phase-display");
  const isGauntlet = phase.phase === "gauntlet";
  const isActive = phase.active_at && Date.now() / 1000 >= phase.active_at;

  let label = isGauntlet ? "GAUNTLET" : "CODE";
  let cls = isGauntlet ? "phase-gauntlet" : "phase-code";

  let extra = "";
  if (phase.active_at && !isActive) {
    const secs = Math.max(0, Math.ceil(phase.active_at - Date.now() / 1000));
    extra = ` — activates in ${secs}s`;
  }

  el.innerHTML = `
    <span class="phase-badge ${cls}">${label}</span>
    <span style="margin-left: 8px; color: #888;">${extra}</span>
  `;

  document.getElementById("phase-select").value = isGauntlet ? "gauntlet" : "code";
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function renderStats(slots, leaderboard) {
  const total = slots.length;
  const claimed = slots.filter((s) => s.claimed).length;
  const online = slots.filter((s) => s.online).length;
  const published = slots.filter((s) => s.has_published).length;

  document.getElementById("stats-display").innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; text-align: center;">
      <div><strong style="font-size: 1.4rem;">${total}</strong><br><span style="color:#888;">Slots</span></div>
      <div><strong style="font-size: 1.4rem;">${claimed}</strong><br><span style="color:#888;">Claimed</span></div>
      <div><strong style="font-size: 1.4rem;">${online}</strong><br><span style="color:#888;">Online</span></div>
      <div><strong style="font-size: 1.4rem;">${published}</strong><br><span style="color:#888;">Published</span></div>
    </div>
  `;
}

// ── Slots Table ───────────────────────────────────────────────────────────────

function renderSlotsTable(slots) {
  const tbody = document.getElementById("slots-tbody");

  tbody.innerHTML = slots
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

  tbody.querySelectorAll("[data-action='reset']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const team = btn.dataset.team;
      const index = parseInt(btn.dataset.index);
      if (confirm(`Reset ${team}-${index}? This will delete all data for this slot.`)) {
        adminApi.resetSlot(team, index).then(() => poll()).catch((err) => alert(err.message));
      }
    });
  });

  tbody.querySelectorAll("[data-action='watch']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const team = btn.dataset.team;
      const index = parseInt(btn.dataset.index);
      openVideoPlayer(adminApi.slotVideoUrl(team, index), true);
    });
  });

  tbody.querySelectorAll("[data-action='play']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const team = btn.dataset.team;
      const index = parseInt(btn.dataset.index);
      const slotLabel = btn.dataset.slot;
      launchEngine(adminApi.slotVideoUrl(team, index), slotLabel);
    });
  });

  tbody.querySelectorAll("[data-action='add-gallery']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const team = btn.dataset.team;
      const index = parseInt(btn.dataset.index);
      const slotLabel = btn.dataset.slot;
      const title = prompt(`Name for gallery entry from ${slotLabel}:`, slotLabel);
      if (title === null) return;
      adminApi.addGalleryEntry(title || slotLabel, 0, team, index)
        .then(() => poll())
        .catch((err) => alert(err.message));
    });
  });
}

function formatTimeAgo(unixTs) {
  const secs = Math.floor((Date.now() / 1000) - unixTs);
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

// ── Gallery ───────────────────────────────────────────────────────────────────

function galleryVideoUrl(entryId) {
  return `/api/gallery/${entryId}/video`;
}

function renderGallery(entries) {
  const container = document.getElementById("gallery-admin-list");

  if (!entries || entries.length === 0) {
    container.innerHTML = '<div style="color: #555;">No gallery entries yet.</div>';
    return;
  }

  container.innerHTML = entries
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

  container.querySelectorAll("[data-action='gallery-watch']").forEach((btn) => {
    btn.addEventListener("click", () => {
      openVideoPlayer(galleryVideoUrl(btn.dataset.id), true);
    });
  });

  container.querySelectorAll("[data-action='gallery-play']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = btn.closest(".gallery-entry-row");
      const titleEl = row?.querySelector(".title");
      const label = titleEl?.textContent || "Gallery";
      launchEngine(galleryVideoUrl(btn.dataset.id), label);
    });
  });

  container.querySelectorAll("[data-action='gallery-delete']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      if (confirm(`Delete gallery entry "${id}"?`)) {
        adminApi.deleteGalleryEntry(id).then(() => poll()).catch((err) => alert(err.message));
      }
    });
  });
}

// ── Video Player ──────────────────────────────────────────────────────────────

function openVideoPlayer(url, autoplay = false) {
  const modal = document.getElementById("video-modal");
  const video = document.getElementById("admin-video-player");

  video.autoplay = autoplay;
  video.src = url;
  modal.classList.add("visible");

  const closeModal = () => {
    modal.classList.remove("visible");
    video.pause();
    video.src = "";
  };

  document.getElementById("video-modal-close").onclick = closeModal;
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
}

// ── Game Engine Play ─────────────────────────────────────────────────────────

function launchEngine(url, label) {
  const modal = document.getElementById("game-modal");
  const canvas = document.getElementById("admin-game-canvas");
  const overlay = document.getElementById("admin-canvas-overlay");
  const titleEl = document.getElementById("admin-overlay-title");
  const subEl = document.getElementById("admin-overlay-subtitle");
  const actionsEl = document.getElementById("admin-overlay-actions");
  const patternEl = document.getElementById("admin-hud-pattern");
  const timeEl = document.getElementById("admin-hud-time");
  const hitsEl = document.getElementById("admin-hud-hits");

  let engine = null;
  let running = false;

  function stop() {
    running = false;
    if (engine) { engine.stop(); engine = null; }
  }

  function close() {
    stop();
    modal.classList.remove("visible");
    modal.style.display = "";
  }

  function startGame() {
    running = true;
    engine = new GameEngine(canvas, url, {
      playerRadius: 8,
      recordTrajectory: true,
    });

    engine.addEventListener("hit", (e) => {
      hitsEl.textContent = `Hits: ${e.detail.hits}`;
    });

    engine.addEventListener("finish", () => {
      running = false;
      overlay.setAttribute("data-visible", "true");
      titleEl.textContent = "Finished";
      subEl.textContent = `Pattern: ${label}`;
      if (engine) {
        hitsEl.textContent = `Hits: ${engine.hits}`;
      }
      actionsEl.innerHTML = `<button class="btn-admin play" id="btn-game-replay">Replay</button>
        <button class="btn-admin danger" id="btn-game-close">Close</button>`;
      document.getElementById("btn-game-replay")?.addEventListener("click", () => ready());
      document.getElementById("btn-game-close")?.addEventListener("click", close);
    });

    engine.addEventListener("videoerror", () => {
      running = false;
      overlay.setAttribute("data-visible", "true");
      titleEl.textContent = "Video Error";
      subEl.textContent = "Failed to load video.";
      actionsEl.innerHTML = `<button class="btn-admin danger" id="btn-game-close">Close</button>`;
      document.getElementById("btn-game-close")?.addEventListener("click", close);
    });

    overlay.setAttribute("data-visible", "false");
    patternEl.textContent = label;
    timeEl.textContent = "10.0s";
    hitsEl.textContent = "Hits: 0";
    engine.start().catch(() => { if (running) close(); });
  }

  function ready() {
    stop();
    overlay.setAttribute("data-visible", "true");
    titleEl.textContent = "Ready";
    subEl.textContent = label;
    actionsEl.innerHTML = `<button class="btn-admin primary" id="btn-game-start">Play</button>
      <button class="btn-admin danger" id="btn-game-cancel">Cancel</button>`;
    document.getElementById("btn-game-start")?.addEventListener("click", () => {
      let count = 3;
      overlay.setAttribute("data-visible", "true");
      titleEl.textContent = String(count);
      subEl.textContent = "Get ready...";
      actionsEl.innerHTML = "";
      const interval = setInterval(() => {
        count--;
        if (count > 0) {
          titleEl.textContent = String(count);
        } else {
          clearInterval(interval);
          startGame();
        }
      }, 1000);
    });
    document.getElementById("btn-game-cancel")?.addEventListener("click", close);
  }

  // Open modal
  modal.style.display = "flex";
  modal.classList.add("visible");
  document.getElementById("game-modal-close").onclick = close;
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  ready();
}

// ── Phase control events ─────────────────────────────────────────────────────

export function setupPhaseControl() {
  document.getElementById("btn-set-phase").addEventListener("click", async () => {
    const phase = document.getElementById("phase-select").value;
    const graceSeconds = parseInt(document.getElementById("grace-seconds").value) || 60;
    try {
      await adminApi.setPhase(phase, graceSeconds);
      poll();
    } catch (err) {
      alert(err.message);
    }
  });
}

// ── Initial render (before first poll) ───────────────────────────────────────

export function renderLoading() {
  document.getElementById("slots-tbody").innerHTML =
    '<tr><td colspan="9" style="text-align: center; padding: 40px; color: #555;">Loading…</td></tr>';
}