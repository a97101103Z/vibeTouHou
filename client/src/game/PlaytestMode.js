/**
 * PlaytestMode — Survive 10 seconds with zero hits to verify a pattern.
 *
 * @param {ReturnType<import('../helpers/phase.js').PhaseService>} phaseService
 *   Injected so the mode can check whether gauntlet is now active.
 */
import {
  GAUNTLET_ACTIVE_TITLE, GAUNTLET_ACTIVE_SUB,
  NO_PATTERN_TITLE, NO_PATTERN_SUB,
  PLAYTEST_TITLE, PLAYTEST_SUB,
  VIDEO_ERR_TITLE, VIDEO_ERR_SUB_PT,
  ERR_TITLE, ERR_START_PLAYTEST,
  BTN_RETRY,
  FLAWLESS_TITLE, FLAWLESS_SUB,
  BTN_REPLAY, BTN_PUBLISH, BTN_OVERWRITE_PUBLISH, BTN_AUTO_PUBLISHED, TRY_AGAIN_SUB,
  HITS_TAKEN_TITLE,
  HITS_DISPLAY, HUD_HITS_INIT,
} from "../strings.js";
import { checkPublished } from "../helpers/patternApi.js";

export function initPlaytest(hud, sidebarWidget, gauntletWidget, onDone, phaseService) {
  let engine = null;
  let running = false;
  let patternUrl = "";

  function stopEngine() {
    if (engine) {
      engine.stop();
      engine = null;
    }
    hud.stopTimerSync();
  }

  async function run(url) {
    if (running) return;

    // If gauntlet is now active, don't allow starting (or restarting) a playtest
    if (phaseService?.isGauntletActive()) {
      hud.showOverlay(GAUNTLET_ACTIVE_TITLE, GAUNTLET_ACTIVE_SUB, []);
      onDone?.("blocked");
      return;
    }

    if (url) {
      patternUrl = url;
    }
    if (!patternUrl) {
      hud.showOverlay(NO_PATTERN_TITLE, NO_PATTERN_SUB, []);
      onDone?.("blocked");
      return;
    }

    running = true;

    hud.showOverlay(PLAYTEST_TITLE, PLAYTEST_SUB, []);
    await hud.startCountdown();
    startGame();
  }

  function startGame() {
    hud.setModeIndicator("playtest");
    hud.setPatternVisible(false);  // hide the "N / total" HUD slot in playtest

    stopEngine();
    engine = hud.createPlaytestEngine(patternUrl);

    engine.addEventListener("hit", (e) => {
      hud.setHits(HITS_DISPLAY(e.detail.hits));
    });
    engine.addEventListener("finish", (e) => {
      onFinish(e.detail.hits, e.detail.trajectory);
    });
    engine.addEventListener("restart", () => {
      // Block restart if gauntlet became active while playtest was running
      if (phaseService?.isGauntletActive()) {
        running = false;
        gauntletWidget.dispatchEvent(new CustomEvent("startGauntlet"));
        onDone?.("finished");
        return;
      }
      startGame();
    });
    engine.addEventListener("videoerror", () => {
      running = false;
      hud.showOverlay(VIDEO_ERR_TITLE, VIDEO_ERR_SUB_PT, [
        { text: BTN_RETRY, action: () => run() },
      ]);
      onDone?.("error");
    });

    engine.start().catch(() => {
      running = false;
      hud.showOverlay(ERR_TITLE, ERR_START_PLAYTEST, [
        { text: BTN_RETRY, action: () => run() },
      ]);
      onDone?.("error");
    });

    hud.hideOverlay();
    hud.setHits(HUD_HITS_INIT);
    hud.syncTimer(engine.video);
  }

  async function onFinish(hits, trajectory) {
    running = false;
    stopEngine();

    // If gauntlet phase is now active, skip the replay/publish screen entirely
    if (phaseService?.isGauntletActive()) {
      gauntletWidget.dispatchEvent(new CustomEvent("startGauntlet"));
      onDone?.("finished");
      return;
    }

    if (hits === 0) {
      const hasPublished = await checkPublished();
      if (hasPublished) {
        hud.showOverlay(
          FLAWLESS_TITLE, FLAWLESS_SUB,
          [
            { text: BTN_REPLAY, action: () => run() },
            { text: BTN_OVERWRITE_PUBLISH, action: () => sidebarWidget.publishPattern(trajectory) },
          ],
        );
      } else {
        const result = await sidebarWidget.publishPattern(trajectory);
        const actions = result.ok
          ? [
              { text: BTN_REPLAY, action: () => run() },
              { text: BTN_AUTO_PUBLISHED, action: () => {} },
            ]
          : [
              { text: BTN_REPLAY, action: () => run() },
              { text: BTN_PUBLISH, action: () => sidebarWidget.publishPattern(trajectory) },
            ];
        hud.showOverlay(FLAWLESS_TITLE, FLAWLESS_SUB, actions);
      }
    } else {
      hud.showOverlay(
        HITS_TAKEN_TITLE(hits),
        TRY_AGAIN_SUB,
        [{ text: BTN_RETRY, action: () => run() }],
      );
    }

    onDone?.("finished");
  }

  return { run };
}
