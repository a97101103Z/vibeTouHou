/**
 * GalleryWidget — renders the Gallery section in the collapsed sidebar.
 *
 * Fires "playGalleryEntry" CustomEvent with { detail: { url } } when a
 * user clicks an entry. main.js relays this to PlaytestMode.
 *
 * @extends EventTarget
 */

import { fetchGallery, getGalleryVideoUrl } from "./helpers/galleryApi.js";
import { NO_GALLERY_ENTRIES, GALLERY_VIDEO_LABEL, GALLERY_HITS_DISPLAY } from "./strings.js";

const REFRESH_INTERVAL = 30_000;

export class GalleryWidget extends EventTarget {
  #listEl = null;
  #entries = [];
  #pollTimer = null;

  init() {
    this.#listEl = document.getElementById("gallery-list");
    this.#load();
    this.#pollTimer = setInterval(() => this.#load(), REFRESH_INTERVAL);
  }

  stop() {
    if (this.#pollTimer) clearInterval(this.#pollTimer);
  }

  async #load() {
    try {
      this.#entries = await fetchGallery();
      this.#render();
    } catch (_) {
      // Silently fail — gallery is a nice-to-have
    }
  }

  #render() {
    if (!this.#listEl) return;

    if (this.#entries.length === 0) {
      this.#listEl.innerHTML =
        `<div class="gallery-empty">${NO_GALLERY_ENTRIES}</div>`;
      return;
    }

    this.#listEl.innerHTML = "";
    this.#entries.forEach((entry, i) => {
      const row = document.createElement("div");
      row.className = "gallery-entry";
      row.setAttribute("role", "button");
      row.tabIndex = 0;

      const label = document.createElement("span");
      label.className = "ge-label";
      label.textContent = entry.title || GALLERY_VIDEO_LABEL(i + 1);

      const hits = document.createElement("span");
      hits.className = "ge-hits";
      hits.textContent = GALLERY_HITS_DISPLAY(entry.avg_hits);

      row.appendChild(label);
      row.appendChild(hits);

      const play = () => {
        this.dispatchEvent(
          new CustomEvent("playGalleryEntry", {
            detail: { url: getGalleryVideoUrl(entry.id) },
          }),
        );
      };

      row.addEventListener("click", play);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") play();
      });

      this.#listEl.appendChild(row);
    });
  }
}
