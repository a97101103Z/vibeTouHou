import {
  HIST_COPY_CODE, HIST_COPIED, HIST_LOADING, HIST_ERR_LOAD,
} from "../strings.js";

/**
 * ExamplesTab - Shows example pattern scripts from pattern_examples/.
 *
 * Events dispatched:
 *   loadExample → { script }  (load script into editor)
 *
 * @extends EventTarget
 */
export class ExamplesTab extends EventTarget {
  #listEl = null;

  constructor() {
    super();
  }

  init() {
    this.#listEl = document.getElementById("examples-list");
  }

  // ── Public ──────────────────────────────────────────────

  async load() {
    if (!this.#listEl) return;
    this.#listEl.innerHTML = `<div class="history-empty">${HIST_LOADING}</div>`;
    try {
      const res = await fetch("/api/examples", { credentials: "include" });
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
      this.#listEl.innerHTML = `<div class="history-empty">${HIST_ERR_LOAD}</div>`;
      return;
    }
    this.#listEl.innerHTML = "";
    entries.forEach((entry) => {
      this.#listEl.appendChild(this.#makeEntry(entry));
    });
  }

  #makeEntry(entry) {
    const el = document.createElement("div");
    el.className = "examples-entry";

    // ── Header ────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "examples-entry-header";

    const title = document.createElement("span");
    title.className = "examples-entry-title";
    title.textContent = entry.name;
    header.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "examples-entry-actions";

    const copyBtn = document.createElement("button");
    copyBtn.className = "history-btn";
    copyBtn.textContent = HIST_COPY_CODE;
    copyBtn.addEventListener("click", () => {
      this.#copyTextToClipboard(entry.code, copyBtn, HIST_COPY_CODE);
    });
    actions.appendChild(copyBtn);

    const loadBtn = document.createElement("button");
    loadBtn.className = "history-btn is-primary";
    loadBtn.textContent = "載入編輯器";
    loadBtn.addEventListener("click", () => {
      this.dispatchEvent(new CustomEvent("loadExample", {
        detail: { script: entry.code },
      }));
    });
    actions.appendChild(loadBtn);

    header.appendChild(actions);
    el.appendChild(header);

    // ── Body (code + video) ─────────────────────────────
    const body = document.createElement("div");
    body.className = "examples-entry-body";

    const codeWrap = document.createElement("div");
    codeWrap.className = "examples-code-wrap";
    const pre = document.createElement("pre");
    pre.className = "examples-code-block";
    const code = document.createElement("code");
    code.textContent = entry.code;
    pre.appendChild(code);
    codeWrap.appendChild(pre);
    body.appendChild(codeWrap);

    if (entry.video_url) {
      const video = document.createElement("video");
      video.className = "examples-video";
      video.src = entry.video_url;
      video.controls = true;
      video.preload = "none";
      video.loop = true;
      body.appendChild(video);
    }

    el.appendChild(body);
    return el;
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
}
