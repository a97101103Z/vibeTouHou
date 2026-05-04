/**
 * PlaytestMode — Survive 10 seconds with zero hits to verify a pattern.
 */
export function initPlaytest(hud, sidebarWidget, onDone) {
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

    stopEngine();
    engine = hud.createPlaytestEngine(patternUrl);

    engine.addEventListener("hit", (e) => {
      hud.setHits(`Hits: ${e.detail.hits}`);
    });
    engine.addEventListener("finish", (e) => {
      onFinish(e.detail.hits, e.detail.trajectory);
    });
    engine.addEventListener("restart", () => startGame());
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
    hud.setPattern("\u2014");
    hud.syncTimer(engine.video);
  }

  function onFinish(hits, trajectory) {
    running = false;
    stopEngine();

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
