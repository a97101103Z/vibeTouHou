import { createHudControl } from "./game/HudControl.js";
import { initPlaytest } from "./game/PlaytestMode.js";
import { initGauntlet } from "./game/GauntletMode.js";
import { initView } from "./game/ViewMode.js";
import { phaseService } from "./helpers/phase.js";
import { OVERLAY_TITLE_DEFAULT, OVERLAY_SUB_DEFAULT, TOAST_ALREADY_RUNNING } from "./strings.js";

/**
 * GameWidget — Orchestrates game modes.
 * Owns HudControl creation and wires module events.
 */
export class GameWidget {
  #hud;
  #sidebarWidget;
  #gauntletWidget;
  #galleryWidget;
  #playtestMode;
  #gauntletMode;
  #viewMode;
  #toast;
  #running;

  /**
   * @param {import('./GauntletWidget.js').GauntletWidget} gauntletWidget
   * @param {import('./GalleryWidget.js').GalleryWidget} galleryWidget
   * @param {import('./SidebarWidget.js').SidebarWidget} sidebarWidget
   * @param {import('./ToastService.js').ToastService} toastService
   */
  constructor(gauntletWidget, galleryWidget, sidebarWidget, toastService) {
    this.#gauntletWidget = gauntletWidget;
    this.#galleryWidget = galleryWidget;
    this.#sidebarWidget = sidebarWidget;
    this.#toast = toastService;
    this.#running = false;
  }

  init() {
    this.#hud = createHudControl("game-canvas");
    this.#hud.setPatternVisible(false); // hidden until gauntlet mode activates it
    this.#playtestMode = initPlaytest(
      this.#hud,
      this.#sidebarWidget,
      this.#gauntletWidget,
      (reason) => this.#onModeDone(reason),
      phaseService,
    );
    this.#gauntletMode = initGauntlet(
      this.#hud,
      this.#gauntletWidget,
      (reason) => this.#onModeDone(reason),
    );
    this.#viewMode = initView(this.#hud, (reason) => this.#onModeDone(reason));
    this.#hud.showOverlay(OVERLAY_TITLE_DEFAULT, OVERLAY_SUB_DEFAULT, []);
    this.#setupEvents();
  }

  #setupEvents() {
    this.#sidebarWidget.addEventListener("startPlaytest", (e) => {
      this.#startMode(() => {
        this.#playtestMode.run(e?.detail?.url);
      });
    });

    this.#gauntletWidget.addEventListener("playPattern", (e) => {
      this.#startMode(() => {
        this.#gauntletMode.run(e?.detail?.patternIdx);
      });
    });

    this.#galleryWidget.addEventListener("playGalleryEntry", (e) => {
      this.playGalleryVideo(e.detail.url);
    });
  }

  #startMode(start) {
    if (this.#running) {
      this.#toast?.toast(TOAST_ALREADY_RUNNING);
      return;
    }
    this.#running = true;
    this.#sidebarWidget.collapse();
    start();
  }

  #onModeDone(_reason) {
    this.#running = false;
  }

  /**
   * Play a gallery video in view-only mode (no publish, no phase lock).
   * @param {string} url
   */
  playGalleryVideo(url) {
    this.#startMode(() => {
      this.#viewMode.run(url);
    });
  }
}
