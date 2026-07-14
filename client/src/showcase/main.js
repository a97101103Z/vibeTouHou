/**
 * Showcase page entry point.
 *
 * Public (no auth required). Fetches showcase sections and renders:
 *  - Accordion sections (only one open at a time)
 *  - Each entry as a card with autoplaying muted video
 *  - Click opens the game engine for interactive play
 */

import { GameEngine, WIDTH, HEIGHT } from "../game/engine.js";
import { API_BASE, BASE_PATH } from "../constants.js";
import { applyStrings } from "../i18n.js";
import {
  SHOWCASE_EMPTY,
  SHOWCASE_SECTION_EMPTY,
  SHOWCASE_LOADING,
  SHOWCASE_LOAD_ERR,
  SHOWCASE_PATTERNS,
  SHOWCASE_READY,
  SHOWCASE_FINISHED,
  SHOWCASE_PLAY,
  SHOWCASE_REPLAY,
  SHOWCASE_CANCEL,
  SHOWCASE_CLOSE,
  SHOWCASE_VIDEO_ERR,
  SHOWCASE_GET_READY,
  HITS_DISPLAY,
} from "../strings.js";

// Patch fetch to use the configured API base path
const patchedFetch = (() => {
  if (API_BASE === "/api") return window.fetch;
  const origFetch = window.fetch;
  return (input, init) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      return origFetch(BASE_PATH + input.slice(4) , init);
    }
    return origFetch(input, init);
  };
})();
window.fetch = patchedFetch;

function showcaseVideoUrl(entryId) {
  const base = API_BASE === "/api" ? (BASE_PATH === "/" ? "/api" : BASE_PATH + "api") : API_BASE;
  return `${base}/showcase/${entryId}/video`;
}

// ── Accordion state ───────────────────────────────────────────────────────────

let openSection = null;

// ── Video autoplay management ────────────────────────────────────────────────

const videoObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const video = entry.target;
      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  },
  { threshold: 0.3 }
);

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderSections(data) {
  const container = document.getElementById("sc-sections");
  if (!container) return;

  const sections = data.sections ?? [];
  if (sections.length === 0) {
    container.innerHTML = `<div class="sc-empty">${SHOWCASE_EMPTY}</div>`;
    return;
  }

  container.innerHTML = "";

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionId = `sc-section-${i}`;

    const details = document.createElement("details");
    details.className = "sc-accordion";
    details.name = "sc-section";

    // Open the first section by default
    if (i === 0) {
      details.open = true;
      openSection = details;
    }

    const summary = document.createElement("summary");
    summary.className = "sc-accordion-header";
    summary.innerHTML = `
      <span class="sc-accordion-icon">&#9654;</span>
      <span class="sc-accordion-name">${escapeHtml(section.name)}</span>
      <span class="sc-accordion-count">${SHOWCASE_PATTERNS((section.entries ?? []).length)}</span>
    `;
    details.appendChild(summary);

    const grid = document.createElement("div");
    grid.className = "sc-entry-grid";

    const entries = section.entries ?? [];
    if (entries.length === 0) {
      grid.innerHTML = `<div class="sc-empty-section">${SHOWCASE_SECTION_EMPTY}</div>`;
    } else {
      for (const entry of entries) {
        grid.appendChild(createEntryCard(entry));
      }
    }

    details.appendChild(grid);
    container.appendChild(details);
  }

  // Observe all videos for autoplay
  container.querySelectorAll(".sc-entry-video").forEach((v) => {
    videoObserver.observe(v);
  });
}

function createEntryCard(entry) {
  const card = document.createElement("div");
  card.className = "sc-entry-card";
  card.setAttribute("data-entry-id", entry.id);

  const video = document.createElement("video");
  video.className = "sc-entry-video";
  video.src = showcaseVideoUrl(entry.id);
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "metadata";
  // Respect reduced motion preference
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    video.autoplay = true;
  }

  const title = document.createElement("div");
  title.className = "sc-entry-title";
  title.textContent = entry.title;

  card.appendChild(video);
  card.appendChild(title);

  card.addEventListener("click", () => {
    launchGame(entry, video);
  });

  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── Game engine ───────────────────────────────────────────────────────────────

let gameEngine = null;
let gameRunning = false;
let gameCountdownId = null;
let gameClosed = false;
let timerRafId = null;
let timeEl = null;

function startTimer() {
  const tick = () => {
    if (!gameRunning || !gameEngine || gameClosed) return;
    const remaining = Math.max(0, 10 - gameEngine.video.currentTime);
    if (timeEl) timeEl.textContent = `${remaining.toFixed(1)}s`;
    if (remaining > 0) timerRafId = requestAnimationFrame(tick);
  };
  timerRafId = requestAnimationFrame(tick);
}

function stopTimer() {
  if (timerRafId) { cancelAnimationFrame(timerRafId); timerRafId = null; }
}

function launchGame(entry, previewVideo) {
  // Pause the preview video
  if (previewVideo) previewVideo.pause();

  gameEngine = null;
  gameRunning = false;
  gameCountdownId = null;
  gameClosed = false;

  const modal = document.getElementById("sc-game-modal");
  const canvas = document.getElementById("sc-game-canvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("sc-canvas-overlay");
  const titleEl = document.getElementById("sc-overlay-title");
  const subEl = document.getElementById("sc-overlay-subtitle");
  const actionsEl = document.getElementById("sc-overlay-actions");
  const patternEl = document.getElementById("sc-hud-pattern");
  const hitsEl = document.getElementById("sc-hud-hits");
  timeEl = document.getElementById("sc-hud-time");
  const modalCloseEl = document.getElementById("sc-game-modal-close");

  const url = showcaseVideoUrl(entry.id);

  const cleanup = () => {
    if (gameCountdownId) { clearInterval(gameCountdownId); gameCountdownId = null; }
    stopTimer();
    gameRunning = false;
    if (gameEngine) { gameEngine.stop(); gameEngine = null; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const close = () => {
    if (gameClosed) return;
    gameClosed = true;
    cleanup();
    modal.classList.remove("visible");
    modal.style.display = "";
    // Resume preview video
    if (previewVideo) previewVideo.play().catch(() => {});
  };

  const startGame = () => {
    if (gameClosed) return;
    gameRunning = true;
    gameEngine = new GameEngine(canvas, url, {
      playerRadius: 8,
      recordTrajectory: false,
    });

    gameEngine.addEventListener("hit", (e) => {
      if (gameClosed) return;
      hitsEl.textContent = HITS_DISPLAY(e.detail.hits);
    });

    gameEngine.addEventListener("finish", () => {
      gameRunning = false;
      overlay.setAttribute("data-visible", "true");
      titleEl.textContent = SHOWCASE_FINISHED;
      subEl.textContent = entry.title;
      hitsEl.textContent = HITS_DISPLAY(gameEngine ? gameEngine.hits : "?");
      actionsEl.innerHTML = `
        <button class="sc-btn sc-btn-play" id="sc-btn-replay">${SHOWCASE_REPLAY}</button>
        <button class="sc-btn sc-btn-close" id="sc-btn-close-game">${SHOWCASE_CLOSE}</button>
      `;
      actionsEl.querySelector("#sc-btn-replay")?.addEventListener("click", () => {
        gameClosed = false;
        cleanup();
        let count = 3;
        overlay.setAttribute("data-visible", "true");
        titleEl.textContent = String(count);
        subEl.textContent = SHOWCASE_GET_READY;
        actionsEl.innerHTML = "";
        gameCountdownId = setInterval(() => {
          count--;
          if (count > 0) {
            titleEl.textContent = String(count);
          } else {
            clearInterval(gameCountdownId);
            gameCountdownId = null;
            startGame();
          }
        }, 1000);
      }, { once: true });
      actionsEl.querySelector("#sc-btn-close-game")?.addEventListener("click", close, { once: true });
    });

    gameEngine.addEventListener("videoerror", () => {
      gameRunning = false;
      overlay.setAttribute("data-visible", "true");
      titleEl.textContent = SHOWCASE_VIDEO_ERR;
      subEl.textContent = "";
      actionsEl.innerHTML = `<button class="sc-btn sc-btn-close" id="sc-btn-close-game">${SHOWCASE_CLOSE}</button>`;
      actionsEl.querySelector("#sc-btn-close-game")?.addEventListener("click", close, { once: true });
    });

    overlay.setAttribute("data-visible", "false");
    patternEl.textContent = entry.title;
    hitsEl.textContent = HITS_DISPLAY(0);
    if (timeEl) timeEl.textContent = "10.0s";
    gameEngine.start().then(() => startTimer()).catch(() => { if (gameRunning) { gameRunning = false; close(); } });
  };

  const ready = () => {
    cleanup();
    overlay.setAttribute("data-visible", "true");
    titleEl.textContent = SHOWCASE_READY;
    subEl.textContent = entry.title;
    actionsEl.innerHTML = `
      <button class="sc-btn sc-btn-play" id="sc-btn-start">${SHOWCASE_PLAY}</button>
      <button class="sc-btn sc-btn-close" id="sc-btn-cancel">${SHOWCASE_CANCEL}</button>
    `;
    actionsEl.querySelector("#sc-btn-start")?.addEventListener("click", () => {
      if (gameClosed) return;
      let count = 3;
      overlay.setAttribute("data-visible", "true");
      titleEl.textContent = String(count);
      subEl.textContent = SHOWCASE_GET_READY;
      actionsEl.innerHTML = "";
      gameCountdownId = setInterval(() => {
        count--;
        if (count > 0) {
          titleEl.textContent = String(count);
        } else {
          clearInterval(gameCountdownId);
          gameCountdownId = null;
          startGame();
        }
      }, 1000);
    }, { once: true });
    actionsEl.querySelector("#sc-btn-cancel")?.addEventListener("click", close, { once: true });
  };

  gameClosed = false;
  modal.style.display = "flex";
  modal.classList.add("visible");
  modalCloseEl.onclick = close;
  modal.addEventListener("click", (e) => {
    if (e.target === modal && !gameRunning) close();
  });

  ready();
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  applyStrings();
  try {
    const res = await fetch("/api/showcase");
    const data = await res.json();
    renderSections(data);
  } catch (err) {
    const container = document.getElementById("sc-sections");
    if (container) {
      container.innerHTML = `<div class="sc-empty">${SHOWCASE_LOAD_ERR}</div>`;
    }
  }
}

init();
