/**
 * Showcase page entry point.
 *
 * Public (no auth required). Fetches showcase sections and renders:
 *  - Accordion sections (only one open at a time)
 *  - Each entry as a card with autoplaying muted video
 *  - Click opens the game engine for interactive play
 */

import { GameOverlay } from "../game/GameOverlay.js";
import { API_BASE, apiFetch } from "../constants.js";
import { applyStrings } from "../i18n.js";
import {
  SHOWCASE_EMPTY,
  SHOWCASE_SECTION_EMPTY,
  SHOWCASE_LOAD_ERR,
  SHOWCASE_PATTERNS,
  SHOWCASE_LOADING,
  SHOWCASE_VIDEO_ERR,
} from "../strings.js";

function showcaseVideoUrl(entryId) {
  return `${API_BASE}/showcase/${entryId}/video`;
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
      const res = await apiFetch("/api/showcase");
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

    for (const section of sections) {
      const details = document.createElement("details");
      details.className = "sc-accordion";
      details.name = "sc-section";

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

      const activate = () => this.#activateSection(grid);
      summary.addEventListener("mouseenter", activate);
      details.addEventListener("toggle", activate);
    }
  }

  #activateSection(grid) {
    if (grid.dataset.activated) return;
    grid.dataset.activated = "1";
    grid.querySelectorAll(".sc-entry-video").forEach((v) => {
      v.src = v.dataset.src;
      this.#videoObserver.observe(v);
    });
  }

  #createEntryCard(entry) {
    const card = document.createElement("div");
    card.className = "sc-entry-card";
    card.setAttribute("data-entry-id", entry.id);

    const video = document.createElement("video");
    video.className = "sc-entry-video";
    video.dataset.src = showcaseVideoUrl(entry.id);
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.autoplay = true;
    }

    const loading = document.createElement("div");
    loading.className = "sc-entry-loading";
    loading.textContent = SHOWCASE_LOADING;
    video.addEventListener("canplay", () => loading.remove(), { once: true });
    video.addEventListener("error", () => { loading.textContent = SHOWCASE_VIDEO_ERR; }, { once: true });

    const title = document.createElement("div");
    title.className = "sc-entry-title";
    title.textContent = entry.title;

    card.appendChild(video);
    card.appendChild(loading);
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
