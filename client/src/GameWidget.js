import { createHudControl } from "./game/HudControl.js";
import { initPlaytest } from "./game/PlaytestMode.js";
import { initGauntlet } from "./game/GauntletMode.js";
import { initInfinite } from "./game/InfiniteMode.js";
import { phaseService } from "./helpers/phase.js";

/**
 * GameWidget — Orchestrates game modes.
 * Owns HudControl creation and wires module events.
 */
export class GameWidget {
  #hud;
  #sidebarWidget;
  #gauntletWidget;
  #playtestMode;
  #gauntletMode;
  #infiniteMode;
  #toast;
  #running;

  /**
   * @param {import('./GauntletWidget.js').GauntletWidget} gauntletWidget
   * @param {import('./SidebarWidget.js').SidebarWidget} sidebarWidget
   * @param {import('./ToastService.js').ToastService} toastService
   */
  constructor(gauntletWidget, sidebarWidget, toastService) {
    this.#gauntletWidget = gauntletWidget;
    this.#sidebarWidget = sidebarWidget;
    this.#toast = toastService;
    this.#running = false;
  }

  init() {
    this.#hud = createHudControl("game-canvas");
    this.#hud.setPatternVisible(false);  // hidden until gauntlet mode activates it
    this.#playtestMode = initPlaytest(
      this.#hud,
      this.#sidebarWidget,
      (reason) => this.#onModeDone(reason),
      phaseService,
    );
    this.#gauntletMode = initGauntlet(
      this.#hud,
      this.#gauntletWidget,
      (reason) => this.#onModeDone(reason),
    );
    this.#infiniteMode = initInfinite(
      this.#hud,
      this.#gauntletWidget,
      (reason) => this.#onModeDone(reason),
    );
    this.#hud.showOverlay("Play", "Select a mode to begin.", []);
    this.#setupEvents();
  }

  #setupEvents() {
    this.#sidebarWidget.addEventListener("startPlaytest", (e) => {
      this.#startMode(() => {
        this.#playtestMode.run(e?.detail?.url);
      });
    });

    this.#gauntletWidget.addEventListener("startGauntlet", (e) => {
      this.#startMode(() => {
        this.#gauntletMode.run(e?.detail?.startIdx);
      });
    });

    this.#gauntletWidget.addEventListener("beginInfinite", () => {
      this.#startMode(() => {
        this.#infiniteMode.begin();
      });
    });
  }

  #startMode(start) {
    if (this.#running) {
      this.#toast?.toast("A game mode is already running.");
      return;
    }
    this.#running = true;
    this.#sidebarWidget.collapse();
    start();
  }

  #onModeDone(_reason) {
    this.#running = false;
  }
}
