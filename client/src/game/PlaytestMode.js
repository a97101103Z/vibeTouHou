/**
 * PlaytestMode — Survive 10 seconds with zero hits to verify a pattern.
 */
export function startPlaytest(hud, sidebarWidget, url) {
  let engine = null;
  let running = false;

  function stopEngine() {
    if (engine) {
      engine.stop();
      engine = null;
    }
    hud.stopTimerSync();
  }

  async function run() {
    if (running) return;

    sidebarWidget.collapse();
    hud.showOverlay(
      "Playtest Mode",
      "Survive 10 seconds with zero hits to verify your pattern. Hitbox is slightly larger here.",
      [],
    );
    await hud.startCountdown();
    startGame();
  }

  function startGame() {
    running = true;
    hud.setModeIndicator("playtest");

    stopEngine();
    engine = hud.createPlaytestEngine(url);

    engine.addEventListener("hit", (e) => {
      hud.setHits(`Hits: ${e.detail.hits}`);
    });
    engine.addEventListener("finish", (e) => {
      onFinish(e.detail.hits, e.detail.trajectory);
    });
    engine.addEventListener("restart", () => {
      running = false;
      startGame();
    });
    engine.addEventListener("videoerror", () => {
      running = false;
      hud.showOverlay(
        "Video Error",
        "Could not load your pattern video.",
        [{ text: "Retry", action: () => run() }],
      );
    });

    engine.start().catch(() => {
      running = false;
      hud.showOverlay("Error", "Could not start playtest.", [
        { text: "Retry", action: () => run() },
      ]);
    });

    hud.hideOverlay();
    hud.setHits("Hits: 0");
    hud.setPattern("\u2014");
    hud.syncTimer(engine.video);
  }

  function onFinish(hits, trajectory) {
    running = false;

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
  }

  return { run };
}