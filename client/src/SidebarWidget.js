import { PatternTab } from "./sidebar/PatternTab.js";
import { AssetsTab } from "./sidebar/AssetsTab.js";

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

  /**
   * @param {import("./ToastService.js").ToastService} toastService
   */
  constructor(toastService) {
    super();
    this.#patternTab = new PatternTab(toastService);
    this.#assetsTab = new AssetsTab(toastService);
  }

  // ── Passthrough ─────────────────────────────────────────

  async publishPattern(trajectory) {
    await this.#patternTab.publishPattern(trajectory);
  }

  // ── Init ────────────────────────────────────────────────

  async init() {
    this.#cacheDOM();
    this.#setupEventListeners();
    await this.#patternTab.init();
    this.#assetsTab.init();
    await this.#assetsTab.loadGallery();
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
   * @param {'pattern'|'assets'} tabName
   */
  switchTab(tabName) {
    this.#sidebar.setAttribute("data-active-tab", tabName);
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

    this.#sidebarTabs.forEach((tab) => {
      tab.addEventListener("click", () => this.switchTab(tab.dataset.tab));
    });
  }
}

