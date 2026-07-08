import { PatternTab } from "./sidebar/PatternTab.js";
import { AssetsTab } from "./sidebar/AssetsTab.js";
import { HistoryTab } from "./sidebar/HistoryTab.js";
import { ExamplesTab } from "./sidebar/ExamplesTab.js";

/**
 * SidebarWidget - Coordinates sidebar layout and tabs.
 * @extends EventTarget
 */
export class SidebarWidget extends EventTarget {
  #isExpanded = false;

  #sidebar;
  #btnExpand;
  #sidebarTabs;

  /** @type {PatternTab} */
  #patternTab;
  /** @type {AssetsTab} */
  #assetsTab;
  /** @type {HistoryTab} */
  #historyTab;
  /** @type {ExamplesTab} */
  #examplesTab;

  /**
   * @param {import("./ToastService.js").ToastService} toastService
   */
  constructor(toastService) {
    super();
    this.#patternTab = new PatternTab(toastService);
    this.#assetsTab = new AssetsTab(toastService);
    this.#historyTab = new HistoryTab(toastService);
    this.#examplesTab = new ExamplesTab();
  }

  // ── Passthrough ─────────────────────────────────────────

  async publishPattern(trajectory) {
    const success = await this.#patternTab.publishPattern(trajectory);
    if (success) {
      this.#historyTab.load();
    }
  }

  // ── Init ────────────────────────────────────────────────

  async init() {
    this.#cacheDOM();
    this.#setupEventListeners();
    await this.#patternTab.init();
    this.#assetsTab.init();
    await this.#assetsTab.loadGallery();

    this.#historyTab.init();
    this.#examplesTab.init();

    this.#examplesTab.addEventListener("loadExample", (e) => {
      const { script } = e.detail;
      this.#patternTab.loadScript(script, null);
      this.switchTab("pattern");
    });

    this.#historyTab.addEventListener("startPlaytestFromHistory", (e) => {
      const { script, videoUrl } = e.detail;
      this.#patternTab.loadScript(script, videoUrl);
      this.switchTab("pattern");
      // Dispatch startPlaytest so GameWidget picks it up
      this.dispatchEvent(
        new CustomEvent("startPlaytest", { detail: { url: videoUrl } })
      );
    });

    this.switchTab("pattern");

    this.#patternTab.addEventListener("startPlaytest", (e) => {
      this.dispatchEvent(
        new CustomEvent("startPlaytest", { detail: e.detail }),
      );
    });
  }

  #cacheDOM() {
    this.#sidebar = document.getElementById("sidebar");
    this.#btnExpand = document.getElementById("btn-expand");
    this.#sidebarTabs = document.querySelectorAll(".sidebar-tab");
  }

  // ── Sidebar layout ─────────────────────────────────────

  toggle() {
    this.#isExpanded = !this.#isExpanded;
    this.#updateDisplay();
  }

  expand() {
    if (!this.#isExpanded) {
      this.#isExpanded = true;
      this.#updateDisplay();
    }
  }

  collapse() {
    if (this.#isExpanded) {
      this.#isExpanded = false;
      this.#updateDisplay();
    }
  }

  /**
   * @param {'pattern'|'assets'|'history'|'examples'} tabName
   */
  switchTab(tabName) {
    this.#sidebar.setAttribute("data-active-tab", tabName);
    if (tabName === "history") {
      this.#historyTab.load();
    }
    if (tabName === "examples") {
      this.#examplesTab.load();
    }
    this.#updateDisplay();
  }

  #updateDisplay() {
    if (!this.#sidebar) return;
    this.#sidebar.setAttribute(
      "data-expanded",
      this.#isExpanded ? "true" : "false",
    );
  }

  // ── Phase lock ─────────────────────────────────────────

  /**
   * Lock or unlock the coding sidebar (render/playtest buttons).
   * @param {boolean} locked
   */
  setLocked(locked) {
    if (!this.#sidebar) return;
    this.#sidebar.setAttribute("data-locked", locked ? "true" : "false");

    const btnPlaytest = document.getElementById("btn-playtest");
    const btnRender = document.getElementById("btn-render-pattern");
    if (btnPlaytest) btnPlaytest.disabled = locked;
    if (btnRender) btnRender.disabled = locked;
  }

  // ── Event listeners ────────────────────────────────────

  #setupEventListeners() {
    this.#btnExpand.addEventListener("click", () => this.toggle());

    document.addEventListener("mousedown", (event) => {
      if (!this.#isExpanded || !this.#sidebar) return;
      if (!this.#sidebar.contains(event.target)) {
        this.collapse();
      }
    });

    this.#sidebarTabs.forEach((tab) => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab));
    });
  }
}
