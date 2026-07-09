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
    const errorLine = isOk ? null : this.#extractErrorLine(entry);

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



    // ── Action buttons ────────────────────────────────────
    const actions = document.createElement("div");
    actions.className = "history-entry-actions";

    // Copy Code button (always shown)
    const copyBtn = document.createElement("button");
    copyBtn.className = "history-btn";
    copyBtn.textContent = HIST_COPY_CODE;
    copyBtn.addEventListener("click", () => {
      this.#copyTextToClipboard(entry.script, copyBtn, HIST_COPY_CODE);
    });
    actions.appendChild(copyBtn);

    if (!isOk && (entry.stderr || entry.stdout)) {
      // Copy Error button
      const copyErrBtn = document.createElement("button");
      copyErrBtn.className = "history-btn";
      copyErrBtn.textContent = "複製錯誤訊息";
      copyErrBtn.addEventListener("click", () => {
        let textToCopy = entry.stdout ? `${entry.stdout}\n` : "";
        textToCopy += entry.parsed_error?.raw_traceback || entry.stderr || "";
        this.#copyTextToClipboard(textToCopy.trim(), copyErrBtn, "複製錯誤訊息");
      });
      actions.appendChild(copyErrBtn);
    }

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

    if (!isOk && errorLine !== null) {
      // Split by line and highlight the error line
      const lines = entry.script.split("\n");
      lines.forEach((line, idx) => {
        const lineEl = document.createElement("div");
        lineEl.textContent = line;
        if (idx === errorLine - 1) {
          lineEl.style.backgroundColor = "rgba(255, 60, 80, 0.2)";
          lineEl.style.display = "block";
          lineEl.style.width = "100%";
        }
        pre.appendChild(lineEl);
      });
    } else {
      const code = document.createElement("code");
      code.textContent = entry.script;
      pre.appendChild(code);
    }
    
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
      let parsedVibeError = entry.parsed_error || null;

      if (parsedVibeError) {
        const errWrap = document.createElement("div");
        errWrap.className = "history-vibe-error";
        
        let linePrefix = "";
        if (parsedVibeError.stack_trace && parsedVibeError.stack_trace.length > 0) {
          linePrefix = `Line ${parsedVibeError.stack_trace[parsedVibeError.stack_trace.length - 1].line_number} : `;
        }
        
        const header = document.createElement("div");
        header.className = "vibe-error-header";
        let shortMsgInner = `${parsedVibeError.error_type}: ${parsedVibeError.error_message}`;
        if (parsedVibeError.error_type === "KeyboardInterrupt") {
          shortMsgInner = "程式執行時間過長";
        }
        header.textContent = `${linePrefix}${shortMsgInner}`;
        errWrap.appendChild(header);



        if (parsedVibeError.raw_traceback) {
          const rawPre = document.createElement("pre");
          rawPre.className = "history-stderr";
          rawPre.style.borderTop = "1px solid rgba(255, 60, 80, 0.2)";
          rawPre.textContent = parsedVibeError.raw_traceback;
          errWrap.appendChild(rawPre);
        }

        mediaWrap.appendChild(errWrap);
      } else {
        if (entry.stdout) {
          const stdoutPre = document.createElement("pre");
          stdoutPre.className = "history-stderr";
          stdoutPre.style.borderTop = "1px solid rgba(255, 60, 80, 0.2)";
          stdoutPre.textContent = entry.stdout;
          mediaWrap.appendChild(stdoutPre);
        }
        const stderrPre = document.createElement("pre");
        stderrPre.className = "history-stderr";
        stderrPre.textContent = entry.stderr || "(no error output)";
        mediaWrap.appendChild(stderrPre);
      }
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
    fetch(`/api/publish/history/${entryId}`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || HIST_PUBLISH_FAIL);
        }
        this.#toastService.toast(HIST_PUBLISH_OK, "success");
      })
      .catch((err) => {
        this.#toastService.toast(err.message || HIST_PUBLISH_FAIL, "error");
        btn.disabled = false;
        btn.textContent = originalText;
      });
  }

  // ── Utilities ───────────────────────────────────────────

  #copyTextToClipboard(text, btn, defaultText) {
    const success = () => {
      btn.textContent = HIST_COPIED;
      setTimeout(() => { btn.textContent = defaultText; }, 1500);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(success).catch(() => {});
    } else {
      // Fallback for non-secure contexts (HTTP)
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        success();
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      textArea.remove();
    }
  }

  /**
   * Parse the last line number from a Python traceback.
   * e.g. "  File \"script.py\", line 42, in <module>"
   * Returns null if not found.
   * @param {string} stderr
   * @returns {number|null}
   */
  #extractErrorLine(entry) {
    if (entry.parsed_error && entry.parsed_error.stack_trace && entry.parsed_error.stack_trace.length > 0) {
      return entry.parsed_error.stack_trace[entry.parsed_error.stack_trace.length - 1].line_number;
    }
    const combined = (entry.stdout || "") + "\n" + (entry.stderr || "");

    // We want the line number from the student's script, usually script.py
    const matches = [...combined.matchAll(/File ".*script\.py", line (\d+)/g)];
    if (matches.length > 0) {
      return parseInt(matches[matches.length - 1][1], 10);
    }
    // Fallback: if script.py is not found, just get the first file in the traceback
    const fallback = [...combined.matchAll(/File "[^"]*", line (\d+)/g)];
    if (fallback.length > 0) {
      return parseInt(fallback[0][1], 10);
    }
    return null;
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
