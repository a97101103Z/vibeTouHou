import {
  render as renderPattern,
  publishPattern as publishPattern,
} from "../helpers/patternApi.js";
import {
  BTN_VIEW_RECORD, BTN_COPY_ERROR, COPIED_LABEL,
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
# vibeTouHou — 預設彈幕生成程式
#
# 這支程式會產生一段 10 秒鐘的彈幕影片。
# 您可以自由修改下方的程式來創造屬於您的彈幕！
# 注意：程式最終必須產生名為 "output.mp4" 的影片檔案。
#
# 給 LLM 生成程式碼的參考指南：
# 1. 目標： 
#     產生 10 秒鐘的彈幕影片。
# 2. 效能限制： 
#     這支程式將在受到限制的 Docker 沙盒內執行。
#     如果執行時間超過 20 秒，將會觸發執行超時（TLE），程式被強制終止。
#     請務必將數學運算與迴圈最佳化。
# 3. 畫布與座標系統：
#     畫布大小：寬 800、高 600。
#     中心點座標：(400, 300)。
#     玩家起始座標：(400, 520)。
# 4. 傷害判定機制：
#     彈幕的傷害判定是基於像素的亮度。
#     只有當像素亮度 (Y) 大於 128 時，才會被視為攻擊判定區。
#     標準亮度公式 (假設 RGB 數值介於 0~255): 
#     Y = 0.299*R + 0.587*G + 0.114*B
#     請確保您的彈幕顏色夠亮，否則打中玩家也不會扣血！
# ─────────────────────────────────────────────────────────────

# 畫布基本設定（請保持原樣）
WIDTH, HEIGHT = 800, 600
FPS = 30
DURATION = 10 # 影片長度（秒）

# 彈幕設定 — 可自由修改！
# 上傳到素材區的檔案都會被放入程式執行的目錄下，
# 所以您可以直接使用檔名來讀取（例如："sprite.png"）。
# 範例寫法：
#   img = imageio.imread("sprite.png")
#   pattern = gizeh.ImagePattern(img)

PELLETS = 24 # 圓環上的子彈數量
PELLET_RADIUS = 5 # 每顆子彈的半徑（像素）
SPEED = 130 # 子彈向外擴散的速度（像素/秒）
COLOR = (1, 1, 1) # 白色 (1,1,1) 代表亮度最高，絕對有傷害判定

# 彈幕渲染主迴圈
frames = []

for frame_num in range(FPS * DURATION):
    t = frame_num / FPS # 當前時間（秒，範圍 0 → 10）

    surface = gizeh.Surface(width=WIDTH, height=HEIGHT, bg_color=(0, 0, 0))

    # 在隨時間擴張的圓環上均勻畫出每顆子彈
    for i in range(PELLETS):
        angle = (2 * math.pi / PELLETS) * i # 均勻分佈的角度
        dist = SPEED * t # 隨著時間拉大距離
        x = WIDTH / 2 + math.cos(angle) * dist
        y = HEIGHT / 2 + math.sin(angle) * dist

        circle = gizeh.circle(r=PELLET_RADIUS, xy=(x, y), fill=COLOR)
        circle.draw(surface)

    # 擷取當前畫面
    frames.append(surface.get_npimage())

#「絕對禁止」修改以下程式
# 伺服器端會去檢查有沒有生成 'output.mp4' 這個檔案
# 如果改用其他名稱，伺服器端找不到名稱相符的檔案，提交就會失敗
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

  #errorData = null; // Store parsed error data

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
    
    // Build compact error banner structure
    this.#renderErrorEl.innerHTML = `
      <div class="compact-error-text"></div>
      <div class="compact-error-actions">
        <button class="history-btn" id="btn-view-record"></button>
        <button class="history-btn" id="btn-copy-error"></button>
        <button class="history-btn" id="btn-close-error" style="padding-left: 6px; padding-right: 6px;">✖</button>
      </div>
    `;
    
    this.#renderErrorEl.querySelector("#btn-view-record").textContent = BTN_VIEW_RECORD;
    this.#renderErrorEl.querySelector("#btn-copy-error").textContent = BTN_COPY_ERROR;
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
        return true;
      } else {
        this.#toastService.toast(result.message, "error");
        return false;
      }
    } catch (_) {
      this.#toastService.toast(TOAST_NETWORK_ERROR, "error");
      return false;
    }
  }

  /**
   * Load a script from history into the editor and mark the video as ready.
   * Called by SidebarWidget when the user clicks "Test" on a history entry.
   * @param {string} script
   * @param {string} videoUrl
   */
  loadScript(script, videoUrl) {
    if (this.#editor) {
      const { from, to } = { from: 0, to: this.#editor.state.doc.length };
      this.#editor.dispatch(
        this.#editor.state.update({ changes: { from, to, insert: script } })
      );
    }
    this.#setVerified(false);
    if (videoUrl) {
      this.#patternUrl = videoUrl;
      this.#setRendered(true);
      this.#setRenderStatus("done");
    } else {
      this.#setRendered(false);
      this.#setRenderStatus("idle");
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

  #setRenderStatus(status, durationStr = "", errorMessage = "", parsed_error = null) {
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
    if (hasMessage) {
      let shortMsg = errorMessage;
      if (parsed_error) {
        try {
          let linePrefix = "";
          if (parsed_error.stack_trace && parsed_error.stack_trace.length > 0) {
            linePrefix = `Line ${parsed_error.stack_trace[parsed_error.stack_trace.length - 1].line_number} : `;
          }
          let shortMsgInner = `${parsed_error.error_type}: ${parsed_error.error_message}`;
          if (parsed_error.error_type === "KeyboardInterrupt") {
            shortMsgInner = "程式執行時間過長";
          }
          shortMsg = `${linePrefix}${shortMsgInner}`;
        } catch(e) {}
      }
      this.#renderErrorEl.querySelector(".compact-error-text").textContent = shortMsg;
      this.#renderErrorEl.setAttribute("data-raw-error", parsed_error && parsed_error.raw_traceback ? parsed_error.raw_traceback : errorMessage);
    }
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
      if (err.status === 409) return;
      this.#setRenderStatus("error", "", err.message, err.parsed_error);
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

    this.#renderErrorEl.addEventListener("click", (e) => {
      if (e.target.id === "btn-view-record") {
        document.getElementById("tab-history")?.click();
      } else if (e.target.id === "btn-copy-error") {
        let raw = this.#renderErrorEl.getAttribute("data-raw-error") || "";
        navigator.clipboard.writeText(raw).then(() => {
          const btn = e.target;
          const old = btn.textContent;
          btn.textContent = COPIED_LABEL;
          setTimeout(() => { btn.textContent = old; }, 2000);
        });
      } else if (e.target.id === "btn-close-error") {
        this.#renderErrorEl.setAttribute("data-visible", "false");
      }
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
            "&": { height: "100%" },
            ".cm-scroller": { overflow: "auto" },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.#setRendered(false);
            }
          }),
        ],
        parent: document.getElementById("editor-wrap"),
      });
    } catch (e) {
      console.error("Failed to initialize editor:", e);
    }
  }
}
