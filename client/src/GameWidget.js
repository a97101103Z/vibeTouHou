import { createHudControl } from "./game/HudControl.js";
import { startPlaytest } from "./game/PlaytestMode.js";
import { startGauntlet } from "./game/GauntletMode.js";
import { startInfinite } from "./game/InfiniteMode.js";

/**
 * GameWidget — Orchestrates game modes.
 * Owns HudControl creation and wires module events.
 */
export class GameWidget {
  #hud;
  #sidebarWidget;
  #gauntletWidget;

  /**
   * @param {import('./GauntletWidget.js').GauntletWidget} gauntletWidget
   * @param {import('./SidebarWidget.js').SidebarWidget} sidebarWidget
   */
  constructor(gauntletWidget, sidebarWidget) {
    this.#gauntletWidget = gauntletWidget;
    this.#sidebarWidget = sidebarWidget;
  }

  init() {
    this.#hud = createHudControl("game-canvas");
    this.#hud.showOverlay("Play", "Select a mode to begin.", []);
    this.#setupEvents();
  }

  #setupEvents() {
    this.#sidebarWidget.addEventListener("startPlaytest", (e) => {
      const mode = startPlaytest(this.#hud, this.#sidebarWidget, e.detail.url);
      mode.run();
    });

    this.#gauntletWidget.addEventListener("startGauntlet", (e) => {
      const mode = startGauntlet(this.#hud, this.#gauntletWidget, this.#sidebarWidget, e?.detail?.startIdx);
      mode.run(e?.detail?.startIdx);
    });

    this.#gauntletWidget.addEventListener("beginInfinite", () => {
      const mode = startInfinite(this.#hud, this.#gauntletWidget);
      mode.begin();
    });
  }
}