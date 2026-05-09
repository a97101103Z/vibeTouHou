/**
 * PlaytestMode — Survive 10 seconds with zero hits to verify a pattern.
 *
 * @param {ReturnType<import('../helpers/phase.js').PhaseService>} phaseService
 *   Injected so the mode can check whether gauntlet is now active.
 */
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
      hud.showOverlay(
        "⚔️ Gauntlet Active",
        "Coding phase is over. Head to the Gauntlet panel to play!",
        [],
      );
      onDone?.("blocked");
      return;
    }

    if (url) {
      patternUrl = url;
    }
    if (!patternUrl) {
      hud.showOverlay(
        "No Pattern",
        "Render your pattern first to generate a playtest URL.",
        [],
      );
      onDone?.("blocked");
      return;
    }

    running = true;

    hud.showOverlay(
      "Playtest Mode",
      "Survive 10 seconds with zero hits to verify your pattern. Hitbox is slightly larger here.",
      [],
    );
    await hud.startCountdown();
    startGame();
  }

  function startGame() {
    hud.setModeIndicator("playtest");
    hud.setPatternVisible(false);  // hide the "N / total" HUD slot in playtest

    stopEngine();
    engine = hud.createPlaytestEngine(patternUrl);

    engine.addEventListener("hit", (e) => {
      hud.setHits(`Hits: ${e.detail.hits}`);
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
      hud.showOverlay("Video Error", "Could not load your pattern video.", [
        { text: "Retry", action: () => run() },
      ]);
      onDone?.("error");
    });

    engine.start().catch(() => {
      running = false;
      hud.showOverlay("Error", "Could not start playtest.", [
        { text: "Retry", action: () => run() },
      ]);
      onDone?.("error");
    });

    hud.hideOverlay();
    hud.setHits("Hits: 0");
    hud.syncTimer(engine.video);
  }

  function onFinish(hits, trajectory) {
    running = false;
    stopEngine();

    // If gauntlet phase is now active, skip the replay/publish screen entirely
    if (phaseService?.isGauntletActive()) {
      gauntletWidget.dispatchEvent(new CustomEvent("startGauntlet"));
      onDone?.("finished");
      return;
    }

    if (hits === 0) {
      hud.showOverlay(
        "\ud83c\udf89 Flawless Clear!",
        "Pattern confirmed survivable!",
        [
          { text: "Replay", action: () => run() },
          {
            text: "Publish",
            action: () => sidebarWidget.publishPattern(trajectory),
          },
        ],
      );
    } else {
      hud.showOverlay(
        `${hits} Hit${hits > 1 ? "s" : ""} Taken`,
        "Try again to unlock Publish.",
        [{ text: "Retry", action: () => run() }],
      );
    }

    onDone?.("finished");
  }

  return { run };
}
