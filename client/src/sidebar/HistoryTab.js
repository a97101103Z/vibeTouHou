import {
  HIST_COPY_CODE, HIST_PLAYTEST, HIST_PUBLISH,
  HIST_ERROR_LINE, HIST_EMPTY, HIST_LOADING, HIST_ERR_LOAD,
  HIST_COPIED, HIST_STATUS_OK, HIST_STATUS_ERR,
  HIST_PUBLISH_OK, HIST_PUBLISH_FAIL,
  TOAST_NETWORK_ERROR,
} from "../strings.js";

/**
 * HistoryTab - Shows the render history for the current slot.
 *
 * Events dispatched:
 *   startPlaytestFromHistory  → { script, videoUrl }  (load into editor + start playtest)
 *
 * @extends EventTarget
 */
export class HistoryTab extends EventTarget {
  #listEl = null;
  #toastService;

  /** @param {import("../ToastService.js").ToastService} toastService */
  constructor(toastService) {
    super();
    this.#toastService = toastService;
  }

  init() {
    this.#listEl = document.getElementById("history-list");
  }

  // ── Public ──────────────────────────────────────────────

  async load() {
    if (!this.#listEl) return;
    this.#listEl.innerHTML = `<div class="history-empty">${HIST_LOADING}</div>`;
    try {
      const res = await fetch("/api/history", { credentials: "include" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const entries = await res.json();
      this.#render(entries);
    } catch (_) {
      this.#listEl.innerHTML = `<div class="history-empty">${HIST_ERR_LOAD}</div>`;
    }
  }

  // ── Rendering ───────────────────────────────────────────

  #render(entries) {
    if (!this.#listEl) return;
    if (!entries.length) {
      this.#listEl.innerHTML = `<div class="history-empty">${HIST_EMPTY}</div>`;
      return;
    }
    this.#listEl.innerHTML = "";
    entries.forEach((entry, i) => {
      this.#listEl.appendChild(this.#makeEntry(entry, entries.length - i));
    });
  }

  #makeEntry(entry, index) {
    const el = document.createElement("div");
    el.className = "history-entry";
    el.dataset.id = entry.id;

    const isOk = entry.status === "done";
    const errorLine = isOk ? null : this.#extractErrorLine(entry.stderr || "");

    // ── Header ────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "history-entry-header";

    const indexEl = document.createElement("span");
    indexEl.className = "history-entry-index";
    indexEl.textContent = `#${index}`;
    header.appendChild(indexEl);

    const timeEl = document.createElement("span");
    timeEl.className = "history-entry-time";
    timeEl.textContent = this.#formatTime(entry.timestamp);
    header.appendChild(timeEl);

    const statusBadge = document.createElement("span");
    statusBadge.className = `history-status-badge ${isOk ? "is-ok" : "is-error"}`;
    statusBadge.textContent = isOk ? HIST_STATUS_OK : HIST_STATUS_ERR;
    header.appendChild(statusBadge);

    if (!isOk && errorLine !== null) {
      const lineBadge = document.createElement("span");
      lineBadge.className = "history-error-line-badge";
      lineBadge.textContent = HIST_ERROR_LINE(errorLine);
      header.appendChild(lineBadge);
    }

    // ── Action buttons ────────────────────────────────────
    const actions = document.createElement("div");
    actions.className = "history-entry-actions";

    // Copy Code button (always shown)
    const copyBtn = document.createElement("button");
    copyBtn.className = "history-btn";
    copyBtn.textContent = HIST_COPY_CODE;
    let copyTimer = null;
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(entry.script).then(() => {
        copyBtn.textContent = HIST_COPIED;
        clearTimeout(copyTimer);
        copyTimer = setTimeout(() => { copyBtn.textContent = HIST_COPY_CODE; }, 1500);
      });
    });
    actions.appendChild(copyBtn);

    if (isOk && entry.video_url) {
      if (entry.is_published) {
        // "Publish" button — direct re-publish without re-playtesting
        const publishBtn = document.createElement("button");
        publishBtn.className = "history-btn is-primary";
        publishBtn.textContent = HIST_PUBLISH;
        publishBtn.addEventListener("click", () => this.#handlePublishFromHistory(entry.id, publishBtn));
        actions.appendChild(publishBtn);
      } else {
        // "Test" button — load into editor + start playtest
        const testBtn = document.createElement("button");
        testBtn.className = "history-btn is-primary";
        testBtn.textContent = HIST_PLAYTEST;
        testBtn.addEventListener("click", () => {
          this.dispatchEvent(new CustomEvent("startPlaytestFromHistory", {
            detail: { script: entry.script, videoUrl: entry.video_url },
          }));
        });
        actions.appendChild(testBtn);
      }
    }

    header.appendChild(actions);
    el.appendChild(header);

    // ── Body (code + video/error) ─────────────────────────
    const body = document.createElement("div");
    body.className = "history-entry-body";

    // Left: code block
    const codeWrap = document.createElement("div");
    codeWrap.className = "history-code-wrap";
    const pre = document.createElement("pre");
    pre.className = "history-code-block";
    const code = document.createElement("code");
    code.textContent = entry.script;
    pre.appendChild(code);
    codeWrap.appendChild(pre);
    body.appendChild(codeWrap);

    // Right: video or stderr
    const mediaWrap = document.createElement("div");
    mediaWrap.className = "history-media-wrap";
    if (isOk && entry.video_url) {
      const video = document.createElement("video");
      video.className = "history-video";
      video.src = entry.video_url;
      video.controls = true;
      video.preload = "none";
      video.loop = true;
      mediaWrap.appendChild(video);
    } else {
      const stderrPre = document.createElement("pre");
      stderrPre.className = "history-stderr";
      stderrPre.textContent = entry.stderr || "(no error output)";
      mediaWrap.appendChild(stderrPre);
    }
    body.appendChild(mediaWrap);

    el.appendChild(body);
    return el;
  }

  // ── Handlers ────────────────────────────────────────────

  async #handlePublishFromHistory(entryId, btn) {
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "…";
    try {
      const res = await fetch(`/api/publish/history/${entryId}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || HIST_PUBLISH_FAIL);
      }
      this.#toastService.toast(HIST_PUBLISH_OK, "success");
    } catch (err) {
      this.#toastService.toast(err.message || HIST_PUBLISH_FAIL, "error");
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  // ── Utilities ───────────────────────────────────────────

  /**
   * Parse the last line number from a Python traceback.
   * e.g. "  File \"script.py\", line 42, in <module>"
   * Returns null if not found.
   * @param {string} stderr
   * @returns {number|null}
   */
  #extractErrorLine(stderr) {
    const matches = [...stderr.matchAll(/File "[^"]*", line (\d+)/g)];
    if (!matches.length) return null;
    return parseInt(matches[matches.length - 1][1], 10);
  }

  /**
   * Format an ISO timestamp into a locale-friendly short string.
   * @param {string} isoString
   * @returns {string}
   */
  #formatTime(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false,
      });
    } catch (_) {
      return isoString;
    }
  }
}
