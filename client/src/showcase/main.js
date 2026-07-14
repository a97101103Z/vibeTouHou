/**
 * Showcase page entry point.
 *
 * Public (no auth required). Fetches showcase sections and renders:
 *  - Accordion sections (only one open at a time)
 *  - Each entry as a card with autoplaying muted video
 *  - Click opens the game engine for interactive play
 */

import { GameOverlay } from "../game/GameOverlay.js";
import { API_BASE, BASE_PATH } from "../constants.js";
import { applyStrings } from "../i18n.js";
import {
  SHOWCASE_EMPTY,
  SHOWCASE_SECTION_EMPTY,
  SHOWCASE_LOAD_ERR,
  SHOWCASE_PATTERNS,
} from "../strings.js";

// Patch fetch to use the configured API base path
const patchedFetch = (() => {
  if (API_BASE === "/api") return window.fetch;
  const origFetch = window.fetch;
  return (input, init) => {
    if (typeof input === "string" && input.startsWith("/api/")) {
      return origFetch(BASE_PATH + input.slice(4), init);
    }
    return origFetch(input, init);
  };
})();
window.fetch = patchedFetch;

function showcaseVideoUrl(entryId) {
  const base = API_BASE === "/api" ? (BASE_PATH === "/" ? "/api" : BASE_PATH + "api") : API_BASE;
  return `${base}/showcase/${entryId}/video`;
}

// ── Showcase ──────────────────────────────────────────────────────────────────

export class Showcase {
  #sectionsEl;
  #gameOverlay;
  #entry = null;
  #previewVideo = null;

  #videoObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      }
    },
    { threshold: 0.3 },
  );

  constructor() {
    this.#sectionsEl = document.getElementById("sc-sections");
    this.#gameOverlay = new GameOverlay({
      modal: document.getElementById("sc-game-modal"),
      buttonClasses: { play: "sc-btn sc-btn-play", close: "sc-btn sc-btn-close" },
      showTimer: true,
      onReplay: "immediate",
      onClose: () => {
        if (this.#previewVideo) this.#previewVideo.play().catch(() => {});
      },
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async init() {
    applyStrings();
    try {
      const res = await fetch("/api/showcase");
      const data = await res.json();
      this.#renderSections(data);
    } catch {
      this.#sectionsEl.innerHTML = `<div class="sc-empty">${SHOWCASE_LOAD_ERR}</div>`;
    }
  }

  // ── Section / card rendering ─────────────────────────────────────────────

  #renderSections(data) {
    const sections = data.sections ?? [];
    if (sections.length === 0) {
      this.#sectionsEl.innerHTML = `<div class="sc-empty">${SHOWCASE_EMPTY}</div>`;
      return;
    }

    this.#sectionsEl.innerHTML = "";

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      const details = document.createElement("details");
      details.className = "sc-accordion";
      details.name = "sc-section";
      if (i === 0) details.open = true;

      const summary = document.createElement("summary");
      summary.className = "sc-accordion-header";
      summary.innerHTML = `
        <span class="sc-accordion-icon">&#9654;</span>
        <span class="sc-accordion-name">${this.#escapeHtml(section.name)}</span>
        <span class="sc-accordion-count">${SHOWCASE_PATTERNS((section.entries ?? []).length)}</span>
      `;
      details.appendChild(summary);

      const grid = document.createElement("div");
      grid.className = "sc-entry-grid";

      const entries = section.entries ?? [];
      if (entries.length === 0) {
        grid.innerHTML = `<div class="sc-empty-section">${SHOWCASE_SECTION_EMPTY}</div>`;
      } else {
        for (const entry of entries) grid.appendChild(this.#createEntryCard(entry));
      }

      details.appendChild(grid);
      this.#sectionsEl.appendChild(details);
    }

    this.#sectionsEl.querySelectorAll(".sc-entry-video").forEach((v) => {
      this.#videoObserver.observe(v);
    });
  }

  #createEntryCard(entry) {
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
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.autoplay = true;
    }

    const title = document.createElement("div");
    title.className = "sc-entry-title";
    title.textContent = entry.title;

    card.appendChild(video);
    card.appendChild(title);
    card.addEventListener("click", () => this.#launchGame(entry, video));

    return card;
  }

  // ── Game modal ───────────────────────────────────────────────────────────

  #launchGame(entry, previewVideo) {
    if (previewVideo) previewVideo.pause();
    this.#entry = entry;
    this.#previewVideo = previewVideo;
    this.#gameOverlay.open(showcaseVideoUrl(entry.id), entry.title);
  }

  #escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

const showcase = new Showcase();
showcase.init();
