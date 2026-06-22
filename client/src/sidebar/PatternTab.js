import {
  render as renderPattern,
  publishPattern as publishPattern,
} from "../helpers/patternApi.js";
import {
  STATUS_NOT_TESTED, STATUS_TESTED,
  RENDER_STATUS_IDLE, RENDER_STATUS_QUEUED, RENDER_STATUS_RUNNING,
  RENDER_STATUS_DONE, RENDER_STATUS_ERROR,
  TOAST_RENDER_ERROR, TOAST_NETWORK_ERROR,
} from "../strings.js";

const PATTERN_SAMPLE = `import math
import imageio
import numpy as np
import gizeh

# ─────────────────────────────────────────────────────────────
# vibeTouHou — Bullet Pattern Script
#
# This script generates a 10-second bullet-hell pattern video.
# Edit the PATTERN SETTINGS section below to create your own!
# The script should produce a file called "output.mp4".
# ─────────────────────────────────────────────────────────────

# Canvas settings (keep these as-is)
WIDTH, HEIGHT = 800, 600
FPS = 30
DURATION = 10 # seconds

# Pattern settings — edit freely!
# Uploaded assets are staged into the script's working directory,
# so you can load them directly by filename (e.g., "sprite.png").
# Try \`imageio.imread("sprite.png")\`, then put it into \`gizeh.ImagePattern()\`.

PELLETS = 24 # number of pellets in the ring
PELLET_RADIUS = 5 # size of each pellet (pixels)
SPEED = 130 # expansion speed (pixels / second)
COLOR = (1, 1, 1) # white = always a hit zone

# Render loop
frames = []

for frame_num in range(FPS * DURATION):
    t = frame_num / FPS # current time in seconds (0 → 10)

    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0))

    # Draw each pellet evenly spaced around a ring that grows over time
    for i in range(PELLETS):
        angle = (2 * math.pi / PELLETS) * i # even spacing
        dist = SPEED * t # ring expands with time
        x = WIDTH / 2 + math.cos(angle) * dist
        y = HEIGHT / 2 + math.sin(angle) * dist

        circle = gizeh.circle(r=PELLET_RADIUS, xy=(x, y), fill=COLOR)
        circle.draw(surface)

    # Capture frame
    frames.append(surface.get_npimage())

# DO NOT CHANGE THE FILENAME BELOW
# The server explicitly looks for 'output.mp4'. If you change this,
# the submission will fail because the server won't find the file!
imageio.mimwrite("output.mp4", frames, fps=FPS, macro_block_size=None,
    output_params=["-preset", "ultrafast", "-crf", "28"])
print("Done! output.mp4 created.")
`;

/**
 * PatternTab - Manages the pattern editor tab in the sidebar.
 * @extends EventTarget
 */
export class PatternTab extends EventTarget {
  #editor = null;
  #patternUrl = "/api/video/my";
  #toastService;

  #btnPlaytest;
  #btnRenderPattern;
  #patternStatus;
  #renderStatusEl;
  #renderErrorEl;

  /**
   * @param {import("../ToastService.js").ToastService} toastService
   */
  constructor(toastService) {
    super();
    this.#toastService = toastService;
  }

  async init() {
    this.#cacheDOM();
    await this.#initEditor();
    this.#setupEventListeners();
    this.#setRendered(false);
    this.#setRenderStatus("idle");
  }

  #cacheDOM() {
    this.#btnPlaytest = document.getElementById("btn-playtest");
    this.#btnRenderPattern = document.getElementById("btn-render-pattern");
    this.#patternStatus = document.getElementById("pattern-status-text");
    this.#renderStatusEl = document.getElementById("render-status");
    this.#renderErrorEl = document.getElementById("render-error");
  }

  // ── Public ──────────────────────────────────────────────

  get editorScript() {
    return this.#editor ? this.#editor.state.doc.toString() : "";
  }

  async publishPattern(trajectory) {
    try {
      const result = await publishPattern(trajectory);
      if (result.ok) {
        this.#toastService.toast(result.message, "success");
        this.#setVerified(true);
      } else {
        this.#toastService.toast(result.message, "error");
      }
    } catch (_) {
      this.#toastService.toast(TOAST_NETWORK_ERROR, "error");
    }
  }

  // ── DOM side effects ───────────────────────────────────

  #setRendered(value) {
    if (!this.#btnPlaytest || !this.#btnRenderPattern) return;

    if (value) {
      // Video ready — Playtest is primary action
      this.#btnPlaytest.classList.remove("btn-secondary");
      this.#btnPlaytest.classList.add("btn-primary");
      this.#btnRenderPattern.classList.remove("btn-primary");
      this.#btnRenderPattern.classList.add("btn-secondary");
      this.#btnPlaytest.disabled = false;
    } else {
      // No video — Render is primary action
      this.#btnRenderPattern.classList.remove("btn-secondary");
      this.#btnRenderPattern.classList.add("btn-primary");
      this.#btnPlaytest.classList.remove("btn-primary");
      this.#btnPlaytest.classList.add("btn-secondary");
      this.#btnPlaytest.disabled = true;
    }
  }

  #setVerified(value) {
    if (this.#patternStatus) {
      this.#patternStatus.textContent = value ? STATUS_TESTED : STATUS_NOT_TESTED;
      this.#patternStatus.setAttribute("data-tested", value ? "true" : "false");
    }
  }

  #setRenderStatus(status, durationStr = "", errorMessage = "") {
    if (!this.#renderStatusEl) return;
    if (!this.#renderErrorEl) return;

    const STATUS_LABELS = {
      idle:    RENDER_STATUS_IDLE,
      queued:  RENDER_STATUS_QUEUED,
      running: RENDER_STATUS_RUNNING,
      done:    RENDER_STATUS_DONE,
      error:   RENDER_STATUS_ERROR,
    };

    this.#renderStatusEl.setAttribute("data-status", status);
    this.#renderStatusEl.textContent =
      (STATUS_LABELS[status] ?? status.toUpperCase()) +
      (durationStr ? ` (${durationStr})` : "");

    const hasMessage = Boolean(errorMessage);
    this.#renderErrorEl.textContent = hasMessage ? errorMessage : "";
    this.#renderErrorEl.setAttribute("data-visible", hasMessage ? "true" : "false");
  }

  // ── Event handlers ─────────────────────────────────────

  async #handleRenderPattern() {
    this.#setVerified(false);
    this.#setRendered(false);
    this.#setRenderStatus("running");
    try {
      this.#patternUrl = await renderPattern(this.editorScript);
      this.#setRenderStatus("done");
      this.#setRendered(true);
    } catch (err) {
      this.#setRenderStatus("error", "", err.message);
      this.#toastService.toast(TOAST_RENDER_ERROR, "error");
    }
  }

  // ── Listeners ──────────────────────────────────────────

  #setupEventListeners() {
    this.#btnPlaytest.addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("startPlaytest", { detail: { url: this.#patternUrl } }),
      );
    });

    this.#btnRenderPattern.addEventListener("click", () => {
      this.#handleRenderPattern();
    });
  }

  // ── Editor init ────────────────────────────────────────

  async #initEditor() {
    if (!document.getElementById("pattern-tab")) return;

    try {
      const { EditorView, basicSetup } = await import("codemirror");
      const { python } = await import("@codemirror/lang-python");
      const { oneDark } = await import("@codemirror/theme-one-dark");

      this.#editor = new EditorView({
        doc: PATTERN_SAMPLE,
        extensions: [
          basicSetup,
          python(),
          oneDark,
          EditorView.theme({
            "&": { height: "400px" },
            ".cm-scroller": { overflow: "auto" },
          }),
        ],
        parent: document.getElementById("editor-wrap"),
      });
    } catch (e) {
      console.error("Failed to initialize editor:", e);
    }
  }
}
