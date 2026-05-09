/**
 * ViewMode — Watch a gallery pattern. Works like playtest (full hitbox, 10s)
 * but never shows Publish and is never blocked by the gauntlet phase lock.
 */
export function initView(hud, onDone) {
  let engine = null;
  let running = false;
  let currentUrl = "";

  function stopEngine() {
    if (engine) {
      engine.stop();
      engine = null;
    }
    hud.stopTimerSync();
  }

  async function run(url) {
    if (running) return;
    if (url) currentUrl = url;

    if (!currentUrl) {
      hud.showOverlay("No Video", "No gallery video selected.", []);
      onDone?.("blocked");
      return;
    }

    running = true;
    hud.showOverlay(
      "🎬 Gallery View",
      "Watch this pattern — survive 10 seconds. No publish available.",
      [],
    );
    await hud.startCountdown();
    startGame();
  }

  function startGame() {
    hud.setModeIndicator("view");
    hud.setPatternVisible(false);

    stopEngine();
    engine = hud.createRealEngine(currentUrl);

    engine.addEventListener("hit", (e) => {
      hud.setHits(`Hits: ${e.detail.hits}`);
    });

    engine.addEventListener("finish", (e) => {
      onFinish(e.detail.hits);
    });

    engine.addEventListener("restart", () => startGame());

    engine.addEventListener("videoerror", () => {
      running = false;
      hud.setPatternVisible(true);
      hud.showOverlay("Video Error", "Could not load gallery video.", [
        { text: "Retry", action: () => run() },
      ]);
      onDone?.("error");
    });

    engine.start().catch(() => {
      running = false;
      hud.setPatternVisible(true);
      hud.showOverlay("Error", "Could not start view mode.", [
        { text: "Retry", action: () => run() },
      ]);
      onDone?.("error");
    });

    hud.hideOverlay();
    hud.setHits("Hits: 0");
    hud.syncTimer(engine.video);
  }

  function onFinish(hits) {
    running = false;
    stopEngine();
    hud.setPatternVisible(true);

    if (hits === 0) {
      hud.showOverlay(
        "🎉 Flawless!",
        "You survived this pattern.",
        [{ text: "Replay", action: () => run() }],
      );
    } else {
      hud.showOverlay(
        `${hits} Hit${hits > 1 ? "s" : ""} Taken`,
        "Want to try again?",
        [{ text: "Replay", action: () => run() }],
      );
    }

    onDone?.("finished");
  }

  return { run };
}
